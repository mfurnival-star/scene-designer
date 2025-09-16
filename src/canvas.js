/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Konva Panel (Refactored + Unselect Bugfix)
 * - Modern ES module for all canvas, image, and shape logic.
 * - NO UI creation or controls here: all toolbar, image upload, and server image logic are now only in src/toolbar.js.
 * - Handles Konva stage/layer, creation, deletion, duplication, selection, lock, drag, and transform.
 * - Integrates per-shape state machine from shape-state.js for robust state transitions.
 * - Imports all dependencies as ES modules.
 * - All state flows via AppState.
 * - Logging via log.js.
 * - Unselect handler now fires only when clicking the canvas background (not on a shape).
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { AppState, setShapes, addShape, removeShape, setImage, setSelectedShapes, subscribe } from './state.js';
import { log } from './log.js';
import { attachTransformerForShape, detachTransformer, updateTransformer } from './transformer.js';
import { getShapeState, setShapeState, selectShape, deselectShape, startDraggingShape, stopDraggingShape } from './shape-state.js';
import { setSelectedShape, attachSelectionHandlers } from './selection.js';

// --- Utility: Dump shape diagnostic info for debugging ---
function dumpShapeDebug(shape, tag = "") {
  log("DEBUG", `[canvas] ${tag} shape diagnostic`, {
    typeofShape: typeof shape,
    constructorName: shape?.constructor?.name,
    isKonva: shape instanceof Konva.Shape,
    isGroup: shape instanceof Konva.Group,
    isRect: shape instanceof Konva.Rect,
    isCircle: shape instanceof Konva.Circle,
    attrs: shape?.attrs,
    className: shape?.className,
    _type: shape?._type,
    _label: shape?._label,
    _state: shape?._state,
    keys: shape ? Object.keys(shape) : []
  });
}

// --- Extra: Dump Konva layer state (children and their types) ---
function dumpLayerState(layer, tag = "") {
  if (!layer) return;
  const children = layer.getChildren();
  log("DEBUG", `[canvas] ${tag} layer children`, {
    count: children.length,
    types: children.map(n => n.className || n.constructor?.name || typeof n),
    labels: children.map(n => n._label || n._type || n.className || n.constructor?.name),
    listeningStates: children.map(n => n.listening && typeof n.listening === "function" ? n.listening() : n.listening)
  });
}

// Extra: Dump event listeners for every shape (diagnostic)
function dumpShapeEventListeners(shape, tag = "") {
  log("DEBUG", `[canvas] ${tag} eventListeners`, {
    shapeId: shape?._id,
    shapeType: shape?._type,
    eventListeners: shape?.eventListeners
  });
}

// --- Background image logic (no change) ---
function updateBackgroundImage() {
  const layer = AppState.konvaLayer;
  if (!layer) return;
  if (AppState.bgKonvaImage) {
    AppState.bgKonvaImage.destroy();
    AppState.bgKonvaImage = null;
    layer.draw();
  }
  if (AppState.imageObj) {
    const stage = AppState.konvaStage;
    if (!stage) return;
    let w = AppState.imageObj.naturalWidth || AppState.imageObj.width;
    let h = AppState.imageObj.naturalHeight || AppState.imageObj.height;
    stage.width(w);
    stage.height(h);

    AppState.bgKonvaImage = new Konva.Image({
      image: AppState.imageObj,
      x: 0,
      y: 0,
      width: w,
      height: h,
      listening: false
    });
    layer.add(AppState.bgKonvaImage);
    AppState.bgKonvaImage.moveToBottom();
    layer.draw();
    dumpLayerState(layer, "updateBackgroundImage");
  } else {
    dumpLayerState(layer, "updateBackgroundImage");
  }
}

// --- Selection state sanitization ---
function sanitizeSelection() {
  if (!AppState.konvaLayer) return;
  AppState.selectedShapes = (AppState.selectedShapes || []).filter(
    s => !!s && AppState.konvaLayer.findOne(node => node === s)
  );
  if (AppState.selectedShapes.length === 1) {
    AppState.selectedShape = AppState.selectedShapes[0];
  } else {
    AppState.selectedShape = null;
  }
}

// --- Remove all shape handlers except selection ---
function removeAllShapeHandlers(shape) {
  if (shape && typeof shape.off === "function") {
    shape.off('mousedown.shape dragmove.shape dragstart.shape dragend.shape transformstart.shape transformend.shape');
  }
}

// --- Central: Attach selection handler (logging) ---
function centralAttachShapeEvents(shape) {
  removeAllShapeHandlers(shape);
  attachSelectionHandlers(shape);
}

// --- Clamp shape to stage (no change) ---
function clampShapeToStage(shape) {
  const stage = AppState.konvaStage;
  let minX, minY, maxX, maxY;
  if (shape._type === "rect") {
    minX = shape.x(); minY = shape.y();
    maxX = minX + shape.width(); maxY = minY + shape.height();
  } else if (shape._type === "circle") {
    minX = shape.x() - shape.radius(); minY = shape.y() - shape.radius();
    maxX = shape.x() + shape.radius(); maxY = shape.y() + shape.radius();
  } else if (shape._type === "point") {
    minX = shape.x(); minY = shape.y();
    maxX = shape.x(); maxY = shape.y();
  }
  let dx = 0, dy = 0;
  if (minX < 0) dx = -minX;
  if (maxX > stage.width()) dx = stage.width() - maxX;
  if (minY < 0) dy = -minY;
  if (maxY > stage.height()) dy = stage.height() - maxY;
  shape.x(shape.x() + dx);
  shape.y(shape.y() + dy);
}

// --- Clamp group drag delta (no change) ---
function clampGroupDragDelta(dx, dy, origPositions) {
  const stage = AppState.konvaStage;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  origPositions.forEach(obj => {
    const shape = obj.shape;
    let bx, by, bx2, by2;
    if (shape._type === "rect") {
      bx = obj.x + dx; by = obj.y + dy;
      bx2 = bx + shape.width(); by2 = by + shape.height();
    } else if (shape._type === "circle") {
      bx = obj.x + dx - shape.radius(); by = obj.y + dy - shape.radius();
      bx2 = obj.x + dx + shape.radius(); by2 = obj.y + dx + shape.radius();
    } else if (shape._type === "point") {
      bx = obj.x + dx; by = obj.y + dy;
      bx2 = bx; by2 = by;
    }
    minX = Math.min(minX, bx); minY = Math.min(minY, by);
    maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
  });
  let adjDx = dx, adjDy = dy;
  if (minX < 0) adjDx += -minX;
  if (maxX > stage.width()) adjDx += stage.width() - maxX;
  if (minY < 0) adjDy += -minY;
  if (maxY > stage.height()) adjDy += stage.height() - maxY;
  return [adjDx, adjDy];
}

// --- Selection highlight: draws highlight/bounding box for multi-select
function updateSelectionHighlight() {
  const layer = AppState.konvaLayer;
  if (AppState.groupBoundingBox) { AppState.groupBoundingBox.destroy(); AppState.groupBoundingBox = null; }
  sanitizeSelection();

  // Single selection, unlocked: do not draw highlight box (transformer is shown by selection.js)
  if (AppState.selectedShapes.length === 1 && !AppState.selectedShapes[0].locked) {
    layer.draw();
    dumpLayerState(layer, "updateSelectionHighlight (single)");
  } else if (AppState.selectedShapes.length > 1) {
    detachTransformer();
    const sel = AppState.selectedShapes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of sel) {
      let bx, by, bx2, by2;
      if (s._type === "rect") {
        bx = s.x(); by = s.y(); bx2 = bx + s.width(); by2 = by + s.height();
      } else if (s._type === "circle") {
        bx = s.x() - s.radius(); by = s.y() - s.radius();
        bx2 = s.x() + s.radius(); by2 = s.y() + s.radius();
      } else if (s._type === "point") {
        bx = s.x(); by = s.y();
        bx2 = bx; by2 = by;
      }
      minX = Math.min(minX, bx); minY = Math.min(minY, by);
      maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
    }
    AppState.groupBoundingBox = new Konva.Rect({
      x: minX - 4, y: minY - 4,
      width: maxX - minX + 8, height: maxY - minY + 8,
      stroke: sel.some(s => s.locked) ? "#e53935" : "#2176ff",
      strokeWidth: 3, dash: [8, 5], listening: false
    });
    layer.add(AppState.groupBoundingBox);
    layer.draw();
    dumpLayerState(layer, "updateSelectionHighlight (multi)");
  } else {
    detachTransformer();
    layer.draw();
    dumpLayerState(layer, "updateSelectionHighlight (none)");
  }
}

export function buildCanvasPanel(rootElement, container) {
  try {
    log("INFO", "[canvas] buildCanvasPanel called", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      componentName: container?.componentName
    });

    if (AppState.konvaStage && typeof AppState.konvaStage.destroy === "function") {
      AppState.konvaStage.destroy();
    }
    const width = 600;
    const height = 400;
    const containerDiv = document.createElement('div');
    containerDiv.id = "konva-stage-div";
    containerDiv.style.position = "relative";
    containerDiv.style.width = width + "px";
    containerDiv.style.height = height + "px";
    rootElement.innerHTML = "";
    rootElement.appendChild(containerDiv);

    const stage = new Konva.Stage({
      container: containerDiv,
      width,
      height
    });
    const layer = new Konva.Layer();
    stage.add(layer);
    AppState.konvaStage = stage;
    AppState.konvaLayer = layer;

    // --- Unselect shapes by clicking on empty background ONLY ---
    stage.on("mousedown.unselect touchstart.unselect", function(e) {
      // Only deselect if background is clicked (not a shape)
      if (e.target && e.target.className === "Stage") {
        AppState.selectedShapes.forEach(deselectShape);
        setSelectedShapes([]);
        // Re-attach selection handlers to all shapes after deselect
        (AppState.shapes || []).forEach(s => {
          attachSelectionHandlers(s);
        });
      }
    });

    subscribe((state, details) => {
      if (details && details.type === "image") {
        updateBackgroundImage();
        dumpLayerState(layer, "subscriber:image after update");
        containerDiv.style.width = stage.width() + "px";
        containerDiv.style.height = stage.height() + "px";
      }
      // --- Listen for shape additions and ensure all shapes are always added to Konva layer ---
      if (details && details.type === "addShape" && details.shape) {
        dumpShapeDebug(details.shape, "addShape (canvas subscriber)");
        // Only add shape if not already present in layer
        const alreadyPresent = AppState.konvaLayer.findOne(node => node === details.shape);
        if (AppState.konvaLayer && !alreadyPresent) {
          AppState.konvaLayer.add(details.shape);
          AppState.konvaLayer.draw();
          centralAttachShapeEvents(details.shape);
        } else {
          dumpLayerState(AppState.konvaLayer, "addShape (already present)");
        }
      }
      // Optionally: handle shape removal logic here if needed
      if (details && details.type === "selection") {
        updateSelectionHighlight();
        dumpLayerState(layer, "subscriber:selection after update");
      }
    });

    if (AppState.imageObj) {
      updateBackgroundImage();
      dumpLayerState(layer, "buildCanvasPanel (imageObj present)");
      containerDiv.style.width = stage.width() + "px";
      containerDiv.style.height = stage.height() + "px";
    }

    log("INFO", "[canvas] Canvas panel initialized (Konva only, no UI controls)");
    dumpLayerState(layer, "buildCanvasPanel end");
  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
}

