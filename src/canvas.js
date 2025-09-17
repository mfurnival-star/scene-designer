/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Fabric.js Panel (Fabric.js Migration, MiniLayout Panel)
 * - Fabric.js canvas creation, image background, shape management.
 * - All logic is ES module only, no window/global access.
 * - Exports: buildCanvasPanel({ element, title, componentName })
 * - Panel factory for MiniLayout; renders the main canvas panel.
 * - Logging via log.js at TRACE/DEBUG/INFO.
 * - Refactored: Image always at top left, canvas/container sized to image, scrollbars as needed.
 * -----------------------------------------------------------
 */

import { Canvas, Rect, Circle, Line, Group, Image } from './fabric-wrapper.js';
import { AppState, setShapes, addShape, removeShape, setImage, setSelectedShapes, subscribe } from './state.js';
import { log } from './log.js';
import { attachSelectionHandlers } from './selection.js';
import { setShapeState, selectShape, deselectShape } from './shape-state.js';

/**
 * Utility: Dump Fabric object diagnostic info for debugging.
 */
function dumpFabricDebug(obj, tag = "") {
  log("DEBUG", `[canvas] ${tag} fabric diagnostic`, {
    type: obj?.type,
    label: obj?._label,
    state: obj?._state,
    locked: obj?.locked,
    left: obj?.left,
    top: obj?.top,
    width: obj?.width,
    height: obj?.height,
    radius: obj?.radius,
    selectable: obj?.selectable,
    evented: obj?.evented,
    keys: obj ? Object.keys(obj) : []
  });
}

/**
 * Background image logic.
 * Draws image as non-selectable, non-evented Fabric object.
 * Resizes canvas and container to match image size.
 * Ensures scrollbars if image/canvas is larger than visible panel.
 */
function updateBackgroundImage(containerDiv, element) {
  log("TRACE", "[canvas] updateBackgroundImage ENTRY");
  const canvas = AppState.fabricCanvas;
  if (!canvas) {
    log("TRACE", "[canvas] updateBackgroundImage EXIT (no canvas)");
    return;
  }
  // Remove previous background image if present
  if (AppState.bgFabricImage) {
    canvas.remove(AppState.bgFabricImage);
    AppState.bgFabricImage = null;
    canvas.renderAll();
    log("DEBUG", "[canvas] updateBackgroundImage: old image removed");
  }
  if (AppState.imageObj) {
    const imgObj = AppState.imageObj;
    log("TRACE", "[canvas] updateBackgroundImage: loading new image", { imgObj });
    Image.fromURL(imgObj.src || AppState.imageURL, function(img) {
      img.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        hasBorders: false,
        hasControls: false,
        hoverCursor: 'default'
      });
      // Resize Fabric.js canvas and container to image size
      canvas.setWidth(img.width);
      canvas.setHeight(img.height);
      containerDiv.style.width = img.width + "px";
      containerDiv.style.height = img.height + "px";
      // Panel body: scrollbars if needed
      if (element) {
        element.style.overflow = "auto";
        element.style.width = "100%";
        element.style.height = "100%";
      }
      AppState.bgFabricImage = img;
      canvas.add(img);
      img.moveTo(0); // send to bottom
      canvas.renderAll();
      dumpFabricDebug(img, "updateBackgroundImage");
      log("TRACE", "[canvas] updateBackgroundImage EXIT (image loaded)");
    });
  } else {
    log("TRACE", "[canvas] updateBackgroundImage EXIT (no imageObj)");
  }
}

/**
 * Build the Fabric.js canvas panel. MiniLayout-compliant: accepts { element, title, componentName }.
 */
export function buildCanvasPanel({ element, title, componentName }) {
  log("TRACE", "[canvas] buildCanvasPanel ENTRY", {
    elementType: element?.tagName,
    title,
    componentName
  });
  try {
    log("INFO", "[canvas] buildCanvasPanel called", {
      elementType: element?.tagName,
      title,
      componentName
    });

    // Destroy previous canvas if present
    if (AppState.fabricCanvas && typeof AppState.fabricCanvas.dispose === "function") {
      AppState.fabricCanvas.dispose();
      log("DEBUG", "[canvas] buildCanvasPanel: previous canvas disposed");
    }
    // Use default width/height for initial render (will resize to image when image loads)
    const width = AppState.settings?.canvasMaxWidth || 600;
    const height = AppState.settings?.canvasMaxHeight || 400;

    // --- Create a <div> container for Fabric.js canvas, with overflow: auto for scrollbars ---
    const containerDiv = document.createElement('div');
    containerDiv.id = "fabric-canvas-div";
    containerDiv.style.position = "relative";
    containerDiv.style.width = width + "px";
    containerDiv.style.height = height + "px";
    containerDiv.style.overflow = "auto"; // enable scrollbars if needed
    containerDiv.style.background = "#f7f9fc";
    element.innerHTML = "";
    element.style.overflow = "auto";
    element.appendChild(containerDiv);

    // Create the <canvas> element for Fabric.js
    const canvasEl = document.createElement('canvas');
    canvasEl.id = "fabric-main-canvas";
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.display = "block";
    canvasEl.style.position = "absolute";
    canvasEl.style.left = "0";
    canvasEl.style.top = "0";
    containerDiv.appendChild(canvasEl);

    // Fabric.js canvas: must pass the <canvas> element, not a <div>
    const canvas = new Canvas(canvasEl, {
      width,
      height,
      selection: true,
      backgroundColor: "#f7f9fc"
    });
    AppState.fabricCanvas = canvas;
    log("DEBUG", "[canvas] buildCanvasPanel: Fabric.js canvas created", { width, height });

    // --- Unselect shapes by clicking on empty background ---
    canvas.on("mouse:down", function(e) {
      log("TRACE", "[canvas] mouse:down handler FIRED", { event: e });
      if (!e.target) {
        AppState.selectedShapes.forEach(deselectShape);
        setSelectedShapes([]);
        (AppState.shapes || []).forEach(s => {
          attachSelectionHandlers(s);
        });
        log("DEBUG", "[canvas] mouse:down: all shapes deselected");
      }
    });

    // Subscribe to AppState for image and shape changes
    subscribe((state, details) => {
      log("TRACE", "[canvas] subscriber callback FIRED", { state, details });
      if (details && details.type === "image") {
        log("DEBUG", "[canvas] subscriber: image change detected", { details });
        updateBackgroundImage(containerDiv, element);
      }
      if (details && details.type === "addShape" && details.shape) {
        dumpFabricDebug(details.shape, "addShape (canvas subscriber)");
        log("DEBUG", "[canvas] subscriber: addShape detected", { details });
        if (AppState.fabricCanvas && !AppState.fabricCanvas.getObjects().includes(details.shape)) {
          AppState.fabricCanvas.add(details.shape);
          AppState.fabricCanvas.renderAll();
          attachSelectionHandlers(details.shape);
          log("DEBUG", "[canvas] addShape: shape added to canvas");
        }
      }
      if (details && details.type === "selection") {
        log("DEBUG", "[canvas] subscriber: selection change detected", { details });
        AppState.fabricCanvas.renderAll();
      }
    });

    if (AppState.imageObj) {
      log("TRACE", "[canvas] buildCanvasPanel: AppState.imageObj present, loading background image");
      updateBackgroundImage(containerDiv, element);
    }

    log("INFO", "[canvas] Canvas panel initialized (Fabric.js only, no UI controls)");

  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
  log("TRACE", "[canvas] buildCanvasPanel EXIT", {
    elementType: element?.tagName,
    title,
    componentName
  });
}
