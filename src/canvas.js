/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Fabric.js Panel (Centralized Selection Handler, Fabric.js, MiniLayout Panel, Zustand Store)
 * - Fabric.js canvas creation, image background, shape management.
 * - All selection/deselection/multiselect handled in a single canvas event handler.
 * - No shape-level selection handlers for selection/deselection.
 * - State is managed via Zustand store from state.js.
 * - Exports: buildCanvasPanel({ element, title, componentName })
 * - Panel factory for MiniLayout; renders the main canvas panel.
 * - Logging via log.js at TRACE/DEBUG/INFO.
 * - Image always at top left, canvas/container sized to image, scrollbars as needed.
 * -----------------------------------------------------------
 */

import { Canvas, Rect, Circle, Line, Group, Image } from './fabric-wrapper.js';
import {
  getState,
  setShapes,
  addShape,
  removeShape,
  setImage,
  setSelectedShapes,
  setFabricCanvas,
  setBgFabricImage,
  sceneDesignerStore,
} from './state.js';
import { log } from './log.js';
import { setShapeState, selectShape, deselectShape } from './shape-state.js';

/**
 * Move all shapes above the background image (index 0).
 */
function moveShapesToFront() {
  const store = getState();
  if (!store.fabricCanvas) return;
  const objs = store.fabricCanvas.getObjects();
  if (!objs.length) return;
  // Find bg image (should be at index 0)
  const bgImg = store.bgFabricImage;
  objs.forEach((obj) => {
    if (obj !== bgImg) {
      // Move all non-image shapes to the top (after bg image)
      obj.moveTo(store.fabricCanvas.getObjects().length - 1);
    }
  });
  store.fabricCanvas.renderAll();
}

/**
 * Background image logic.
 * Draws image as non-selectable, non-evented Fabric object.
 * Resizes canvas and container to match image size.
 * Ensures scrollbars if image/canvas is larger than visible panel.
 */
function updateBackgroundImage(containerDiv, element) {
  log("TRACE", "[canvas] updateBackgroundImage ENTRY");
  const store = getState();
  const canvas = store.fabricCanvas;
  if (!canvas) {
    log("TRACE", "[canvas] updateBackgroundImage EXIT (no canvas)");
    return;
  }
  // Remove previous background image if present
  if (store.bgFabricImage) {
    canvas.remove(store.bgFabricImage);
    setBgFabricImage(null);
    canvas.renderAll();
    log("DEBUG", "[canvas] updateBackgroundImage: old image removed");
  }
  if (store.imageObj) {
    const imgObj = store.imageObj;
    log("TRACE", "[canvas] updateBackgroundImage: loading new image", { imgObj });
    Image.fromURL(imgObj.src || store.imageURL, function(img) {
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
      setBgFabricImage(img);
      canvas.add(img);
      img.moveTo(0); // send to bottom (index 0)
      // After adding the image, move all shapes above it
      moveShapesToFront();
      canvas.renderAll();
      log("DEBUG", "[canvas] updateBackgroundImage: image added", {
        type: img.type, width: img.width, height: img.height
      });
      log("TRACE", "[canvas] updateBackgroundImage EXIT (image loaded)");
    });
  } else {
    log("TRACE", "[canvas] updateBackgroundImage EXIT (no imageObj)");
  }
}

/**
 * Centralized canvas pointer event handler for selection/deselection/multiselect.
 */
function centralizedCanvasPointerHandler(e) {
  log("TRACE", "[canvas] centralizedCanvasPointerHandler FIRED", { event: e });
  const state = getState();
  const canvas = state.fabricCanvas;
  const shapes = state.shapes || [];

  // If background is clicked (no shape), deselect all
  if (!e.target) {
    log("DEBUG", "[canvas] centralized handler: background clicked, deselecting all");
    setSelectedShapes([]);
    canvas.discardActiveObject();
    canvas.renderAll();
    return;
  }

  // If a shape is clicked
  const shape = e.target;
  // Multi-select toggle (ctrl/meta)
  const isMulti = e.e && (e.e.ctrlKey || e.e.metaKey);

  if (isMulti) {
    // If shape is already selected, remove; else add
    const idx = state.selectedShapes.indexOf(shape);
    if (idx === -1) {
      setSelectedShapes([...state.selectedShapes, shape]);
    } else {
      const arr = state.selectedShapes.slice();
      arr.splice(idx, 1);
      setSelectedShapes(arr);
    }
    log("DEBUG", "[canvas] centralized handler: multi-select", {
      shapeType: shape._type,
      shapeLabel: shape._label,
      shapeId: shape._id,
      selectedShapes: getState().selectedShapes.map(sh => sh._id)
    });
  } else {
    setSelectedShapes([shape]);
    log("DEBUG", "[canvas] centralized handler: single selection", {
      shapeType: shape._type,
      shapeLabel: shape._label,
      shapeId: shape._id
    });
  }
  canvas.setActiveObject(shape);
  canvas.renderAll();
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
    const store = getState();
    if (store.fabricCanvas && typeof store.fabricCanvas.dispose === "function") {
      store.fabricCanvas.dispose();
      log("DEBUG", "[canvas] buildCanvasPanel: previous canvas disposed");
    }

    // Use default width/height for initial render (will resize to image when image loads)
    const width = store.settings?.canvasMaxWidth || 600;
    const height = store.settings?.canvasMaxHeight || 400;

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
    setFabricCanvas(canvas);
    log("DEBUG", "[canvas] buildCanvasPanel: Fabric.js canvas created", { width, height });

    // --- Centralized selection/deselection handler ---
    canvas.off("mouse:down.centralized");
    canvas.on("mouse:down.centralized", centralizedCanvasPointerHandler);

    // --- Sync shapes on canvas panel creation ---
    log("TRACE", "[canvas] buildCanvasPanel: Syncing shapes on init");
    const shapes = getState().shapes;
    if (Array.isArray(shapes) && shapes.length > 0) {
      log("DEBUG", "[canvas] Syncing existing shapes to canvas on panel build");
      shapes.forEach((shape, idx) => {
        log("TRACE", `[canvas] buildCanvasPanel: Shape ${idx} sync`, {
          type: shape?._type,
          label: shape?._label,
          id: shape?._id
        });
        if (getState().fabricCanvas && !getState().fabricCanvas.getObjects().includes(shape)) {
          getState().fabricCanvas.add(shape);
          // No selection handler attached to shape!
          moveShapesToFront();
          log("TRACE", `[canvas] buildCanvasPanel: Shape ${idx} added to canvas`, {
            type: shape?._type,
            label: shape?._label,
            id: shape?._id
          });
        } else {
          log("WARN", `[canvas] buildCanvasPanel: Shape ${idx} already on canvas or canvas missing`, {
            type: shape?._type,
            label: shape?._label,
            id: shape?._id
          });
        }
      });
      getState().fabricCanvas.renderAll();
      log("TRACE", "[canvas] buildCanvasPanel: All shapes rendered");
    } else {
      log("DEBUG", "[canvas] buildCanvasPanel: No shapes to sync on init");
    }

    // Subscribe to store for image and shape changes (FILTERED)
    log("TRACE", "[canvas] Subscribing to store state changes");

    let prevImageObj = null;
    let prevImageURL = null;

    sceneDesignerStore.subscribe(() => {
      const state = getState();
      // Only update background image if imageObj or imageURL actually changed
      if (state.imageObj !== prevImageObj || state.imageURL !== prevImageURL) {
        updateBackgroundImage(containerDiv, element);
        prevImageObj = state.imageObj;
        prevImageURL = state.imageURL;
      }
      // Add shapes
      const canvasShapes = state.fabricCanvas?.getObjects() || [];
      const stateShapes = state.shapes || [];
      stateShapes.forEach(shape => {
        if (state.fabricCanvas && !canvasShapes.includes(shape)) {
          state.fabricCanvas.add(shape);
          // No selection handler attached to shape!
          moveShapesToFront();
          log("TRACE", "[canvas] subscribe: shape added to canvas", {
            type: shape?._type,
            label: shape?._label,
            id: shape?._id
          });
        }
      });
      // Remove shapes
      canvasShapes.forEach(obj => {
        if (!stateShapes.includes(obj) && obj !== state.bgFabricImage) {
          state.fabricCanvas.remove(obj);
        }
      });
      state.fabricCanvas?.renderAll();
    });

    if (getState().imageObj) {
      log("TRACE", "[canvas] buildCanvasPanel: imageObj present, loading background image");
      updateBackgroundImage(containerDiv, element);
      prevImageObj = getState().imageObj;
      prevImageURL = getState().imageURL;
    }

    log("INFO", "[canvas] Canvas panel initialized (Fabric.js only, centralized event handler, no shape-level selection handlers)");

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

