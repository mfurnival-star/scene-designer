/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Fabric.js Panel (Fabric Migration, Deep TRACE Logging)
 * - Modern ES module for all canvas, image, and shape logic using Fabric.js.
 * - NO UI creation or controls here: toolbar, image upload, and server image logic are only in src/toolbar.js.
 * - Handles Fabric.js canvas creation, image background, shape creation, deletion, selection, lock, drag, and transform.
 * - Integrates per-shape state machine from shape-state.js for robust state transitions.
 * - Imports all dependencies as ES modules.
 * - All state flows via AppState.
 * - Logging via log.js (TRACE at every function entry/exit, decision point, and mutation).
 * -----------------------------------------------------------
 *
 * NOTE: Fabric.js npm package (v5.x) is UMD-only (no named ESM exports).
 * Use default import and destructure classes from 'fabric'.
 */

import fabric from 'fabric';
const { Canvas, Rect, Circle, Line, Group, Image } = fabric;

import {
  AppState,
  setShapes,
  addShape,
  removeShape,
  setImage,
  setSelectedShapes,
  subscribe
} from './state.js';
import { log } from './log.js';
import {
  attachTransformerForShape,
  detachTransformer,
  updateTransformer
} from './transformer.js';
import {
  getShapeState,
  setShapeState,
  selectShape,
  deselectShape,
  startDraggingShape,
  stopDraggingShape
} from './shape-state.js';
import { setSelectedShape, attachSelectionHandlers } from './selection.js';

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
  log("TRACE", `[canvas] dumpFabricDebug exit`, { tag, obj });
}

/**
 * Background image logic.
 * Draws image as non-selectable, non-evented Fabric object.
 */
function updateBackgroundImage() {
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
    // Fabric.js image object
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
      canvas.setWidth(img.width);
      canvas.setHeight(img.height);
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
 * Selection state sanitization.
 */
function sanitizeSelection() {
  log("TRACE", "[canvas] sanitizeSelection ENTRY");
  if (!AppState.fabricCanvas) {
    log("TRACE", "[canvas] sanitizeSelection EXIT (no canvas)");
    return;
  }
  AppState.selectedShapes = (AppState.selectedShapes || []).filter(
    s => !!s && AppState.fabricCanvas.getObjects().includes(s)
  );
  if (AppState.selectedShapes.length === 1) {
    AppState.selectedShape = AppState.selectedShapes[0];
  } else {
    AppState.selectedShape = null;
  }
  log("TRACE", "[canvas] sanitizeSelection EXIT", {
    selectedShapesCount: AppState.selectedShapes.length,
    selectedShapeLabel: AppState.selectedShape?._label
  });
}

/**
 * Remove all shape handlers except selection.
 */
function removeAllShapeHandlers(obj) {
  log("TRACE", "[canvas] removeAllShapeHandlers ENTRY", { obj });
  if (obj && typeof obj.off === "function") {
    obj.off('mousedown');
    obj.off('mouseup');
    obj.off('moving');
    obj.off('selected');
    obj.off('deselected');
    obj.off('modified');
  }
  log("TRACE", "[canvas] removeAllShapeHandlers EXIT");
}

/**
 * Attach selection handlers and log.
 */
function centralAttachShapeEvents(obj) {
  log("TRACE", "[canvas] centralAttachShapeEvents ENTRY", { obj });
  removeAllShapeHandlers(obj);
  attachSelectionHandlers(obj);
  log("TRACE", "[canvas] centralAttachShapeEvents EXIT");
}

/**
 * Clamp shape to canvas bounds.
 */
function clampShapeToCanvas(obj) {
  log("TRACE", "[canvas] clampShapeToCanvas ENTRY", { obj });
  const canvas = AppState.fabricCanvas;
  let minX = obj.left, minY = obj.top;
  let maxX = obj.left + (obj.width * obj.scaleX);
  let maxY = obj.top + (obj.height * obj.scaleY);
  let dx = 0, dy = 0;
  if (minX < 0) dx = -minX;
  if (maxX > canvas.width) dx = canvas.width - maxX;
  if (minY < 0) dy = -minY;
  if (maxY > canvas.height) dy = canvas.height - maxY;
  obj.left += dx;
  obj.top += dy;
  log("TRACE", "[canvas] clampShapeToCanvas EXIT", { obj });
}

/**
 * Selection highlight: draws bounding box for multi-select.
 */
function updateSelectionHighlight() {
  log("TRACE", "[canvas] updateSelectionHighlight ENTRY");
  const canvas = AppState.fabricCanvas;
  if (!canvas) {
    log("TRACE", "[canvas] updateSelectionHighlight EXIT (no canvas)");
    return;
  }
  // Remove previous highlight box
  if (AppState.groupBoundingBox) {
    canvas.remove(AppState.groupBoundingBox);
    AppState.groupBoundingBox = null;
    log("DEBUG", "[canvas] updateSelectionHighlight: old highlight removed");
  }
  sanitizeSelection();

  // Single selection, unlocked: do not draw highlight box (transformer is shown by selection.js)
  if (AppState.selectedShapes.length === 1 && !AppState.selectedShapes[0].locked) {
    canvas.renderAll();
    dumpFabricDebug(AppState.selectedShapes[0], "updateSelectionHighlight (single)");
    log("TRACE", "[canvas] updateSelectionHighlight EXIT (single selection)");
  } else if (AppState.selectedShapes.length > 1) {
    detachTransformer();
    // Calculate bounds
    const sel = AppState.selectedShapes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of sel) {
      let left = s.left, top = s.top, right = left + (s.width * s.scaleX), bottom = top + (s.height * s.scaleY);
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }
    // Draw bounding box
    const box = new Rect({
      left: minX - 4,
      top: minY - 4,
      width: maxX - minX + 8,
      height: maxY - minY + 8,
      stroke: sel.some(s => s.locked) ? "#e53935" : "#2176ff",
      strokeWidth: 3,
      fill: '',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false
    });
    AppState.groupBoundingBox = box;
    canvas.add(box);
    box.moveTo(canvas.getObjects().length - 1); // bring to top
    canvas.renderAll();
    dumpFabricDebug(box, "updateSelectionHighlight (multi)");
    log("TRACE", "[canvas] updateSelectionHighlight EXIT (multi selection)");
  } else {
    detachTransformer();
    canvas.renderAll();
    log("TRACE", "[canvas] updateSelectionHighlight EXIT (no selection)");
  }
}

/**
 * Build the Fabric.js canvas panel.
 */
export function buildCanvasPanel(rootElement, container) {
  log("TRACE", "[canvas] buildCanvasPanel ENTRY", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
  try {
    log("INFO", "[canvas] buildCanvasPanel called", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      componentName: container?.componentName
    });

    // Destroy previous canvas if present
    if (AppState.fabricCanvas && typeof AppState.fabricCanvas.dispose === "function") {
      AppState.fabricCanvas.dispose();
      log("DEBUG", "[canvas] buildCanvasPanel: previous canvas disposed");
    }
    const width = 600;
    const height = 400;
    const containerDiv = document.createElement('div');
    containerDiv.id = "fabric-canvas-div";
    containerDiv.style.position = "relative";
    containerDiv.style.width = width + "px";
    containerDiv.style.height = height + "px";
    rootElement.innerHTML = "";
    rootElement.appendChild(containerDiv);

    // Fabric.js canvas
    const canvas = new Canvas(containerDiv, {
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

    subscribe((state, details) => {
      log("TRACE", "[canvas] subscriber callback FIRED", { state, details });
      if (details && details.type === "image") {
        log("DEBUG", "[canvas] subscriber: image change detected", { details });
        updateBackgroundImage();
        containerDiv.style.width = canvas.width + "px";
        containerDiv.style.height = canvas.height + "px";
      }
      // Listen for shape additions; always add shape if not present
      if (details && details.type === "addShape" && details.shape) {
        dumpFabricDebug(details.shape, "addShape (canvas subscriber)");
        log("DEBUG", "[canvas] subscriber: addShape detected", { details });
        if (AppState.fabricCanvas && !AppState.fabricCanvas.getObjects().includes(details.shape)) {
          AppState.fabricCanvas.add(details.shape);
          AppState.fabricCanvas.renderAll();
          centralAttachShapeEvents(details.shape);
          log("DEBUG", "[canvas] addShape: shape added to canvas");
        }
      }
      // Optionally: handle shape removal logic here if needed
      if (details && details.type === "selection") {
        log("DEBUG", "[canvas] subscriber: selection change detected", { details });
        updateSelectionHighlight();
      }
    });

    if (AppState.imageObj) {
      log("TRACE", "[canvas] buildCanvasPanel: AppState.imageObj present, loading background image");
      updateBackgroundImage();
      containerDiv.style.width = canvas.width + "px";
      containerDiv.style.height = canvas.height + "px";
    }

    log("INFO", "[canvas] Canvas panel initialized (Fabric.js only, no UI controls)");

  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
  log("TRACE", "[canvas] buildCanvasPanel EXIT", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
}
