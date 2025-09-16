/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Konva Panel
 * - Robust, modern ES module for all canvas, image, and shape logic.
 * - Handles creation, deletion, duplication, selection, lock, drag, and transform.
 * - Imports all dependencies as ES modules.
 * - All state and selection is sanitized after every mutation to avoid stale references.
 * - No global/window code; all state flows via AppState.
 * - Logging: Uses log.js; logs at INFO for user/major events, DEBUG for internal state changes, TRACE for entry/exit of all functions.
 * - Transformer logic for shape anchors and resizing is now delegated to transformer.js.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { AppState, setShapes, addShape, removeShape, setImage, setSelectedShapes, subscribe } from './state.js';
import { log } from './log.js';
import { attachTransformerForShape, detachTransformer, updateTransformer } from './transformer.js';

let konvaInitialized = false;
let bgKonvaImage = null;
let groupBoundingBox = null;

/**
 * Utility: Dump shape diagnostic info for debugging.
 */
function dumpShapeDebug(shape, tag = "") {
  log("TRACE", `[canvas] ${tag} shape diagnostic`, {
    typeofShape: typeof shape,
    constructorName: shape?.constructor?.name,
    isKonva: shape instanceof Konva.Shape,
    isGroup: shape instanceof Konva.Group,
    isRect: shape instanceof Konva.Rect,
    isCircle: shape instanceof Konva.Circle,
    isObject: shape && typeof shape === "object" && !(shape instanceof Konva.Shape),
    attrs: shape?.attrs,
    className: shape?.className,
    _type: shape?._type,
    _label: shape?._label,
    keys: shape ? Object.keys(shape) : []
  });
}

/**
 * Extra: Dump Konva layer state (children and their types).
 */
function dumpLayerState(layer, tag = "") {
  if (!layer) {
    log("TRACE", `[canvas] ${tag} dumpLayerState: NO layer`);
    return;
  }
  const children = layer.getChildren();
  log("TRACE", `[canvas] ${tag} layer children`, {
    count: children.length,
    types: children.map(n => n.className || n.constructor?.name || typeof n),
    labels: children.map(n => n._label || n._type || n.className || n.constructor?.name)
  });
}

function updateBackgroundImage() {
  log("TRACE", "[canvas] updateBackgroundImage entry");
  const layer = AppState.konvaLayer;
  if (!layer) {
    log("WARN", "[canvas] updateBackgroundImage: no konvaLayer yet");
    return;
  }
  if (bgKonvaImage) {
    bgKonvaImage.destroy();
    bgKonvaImage = null;
    layer.draw();
  }
  if (AppState.imageObj) {
    const stage = AppState.konvaStage;
    if (!stage) {
      log("WARN", "[canvas] updateBackgroundImage: no konvaStage");
      return;
    }
    let w = AppState.imageObj.naturalWidth || AppState.imageObj.width;
    let h = AppState.imageObj.naturalHeight || AppState.imageObj.height;
    stage.width(w);
    stage.height(h);

    bgKonvaImage = new Konva.Image({
      image: AppState.imageObj,
      x: 0,
      y: 0,
      width: w,
      height: h,
      listening: false
    });
    layer.add(bgKonvaImage);
    bgKonvaImage.moveToBottom();
    layer.draw();
    log("DEBUG", "[canvas] updateBackgroundImage: background set (actual size)", {
      imgW: w, imgH: h
    });
    dumpLayerState(layer, "updateBackgroundImage");
  } else {
    log("DEBUG", "[canvas] updateBackgroundImage: no imageObj, background cleared");
    dumpLayerState(layer, "updateBackgroundImage");
  }
  log("TRACE", "[canvas] updateBackgroundImage exit");
}

function sanitizeSelection() {
  log("TRACE", "[canvas] sanitizeSelection entry");
  if (!AppState.konvaLayer) {
    log("TRACE", "[canvas] sanitizeSelection exit (no layer)");
    return;
  }
  AppState.selectedShapes = (AppState.selectedShapes || []).filter(
    s => !!s && AppState.konvaLayer.findOne(node => node === s)
  );
  if (AppState.selectedShapes.length === 1) {
    AppState.selectedShape = AppState.selectedShapes[0];
  } else {
    AppState.selectedShape = null;
  }
  log("TRACE", "[canvas] sanitizeSelection exit");
}

function removeAllShapeHandlers(shape) {
  log("TRACE", "[canvas] removeAllShapeHandlers entry", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
  if (shape && typeof shape.off === "function") {
    shape.off('mousedown.shape dragmove.shape transformstart.shape transformend.shape');
  }
  log("TRACE", "[canvas] removeAllShapeHandlers exit");
}

function attachShapeEvents(shape) {
  log("TRACE", "[canvas] attachShapeEvents entry", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
  removeAllShapeHandlers(shape);

  shape.on('mousedown.shape', (e) => {
    log("DEBUG", "[canvas] mousedown.shape event", shape && shape._id ? { _id: shape._id, _type: shape._type } : { shape });
    if (!shape || !AppState.konvaLayer.findOne(node => node === shape)) return;
    sanitizeSelection();
    if (shape.locked) return;
    if (!AppState.selectedShapes.includes(shape)) {
      setSelectedShapes([shape]);
    }
    updateSelectionHighlight();
  });

  shape.on('dragmove.shape', () => {
    log("DEBUG", "[canvas] dragmove.shape event", shape && shape._id ? { _id: shape._id, _type: shape._type } : { shape });
    if (!shape || !AppState.konvaLayer.findOne(node => node === shape)) return;
    sanitizeSelection();
    if (shape.locked) {
      shape.stopDrag();
      return;
    }
    if (AppState.selectedShapes.length === 1) clampShapeToStage(shape);
    updateSelectionHighlight();
  });

  log("TRACE", "[canvas] attachShapeEvents exit", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
}

function clampShapeToStage(shape) {
  log("TRACE", "[canvas] clampShapeToStage entry", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
  const stage = AppState.konvaStage;
  let minX, minY, maxX, maxY;
  if (shape._type === "rect") {
    minX = shape.x(); minY = shape.y();
    maxX = minX + shape.width(); maxY = minY + shape.height();
  } else {
    minX = shape.x() - shape.radius(); minY = shape.y() - shape.radius();
    maxX = shape.x() + shape.radius(); maxY = shape.y() + shape.radius();
  }
  let dx = 0, dy = 0;
  if (minX < 0) dx = -minX;
  if (maxX > stage.width()) dx = stage.width() - maxX;
  if (minY < 0) dy = -minY;
  if (maxY > stage.height()) dy = stage.height() - maxY;
  shape.x(shape.x() + dx);
  shape.y(shape.y() + dy);
  log("TRACE", "[canvas] clampShapeToStage exit", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
}

function clampGroupDragDelta(dx, dy, origPositions) {
  log("TRACE", "[canvas] clampGroupDragDelta entry", { dx, dy });
  const stage = AppState.konvaStage;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  origPositions.forEach(obj => {
    const shape = obj.shape;
    let bx, by, bx2, by2;
    if (shape._type === "rect") {
      bx = obj.x + dx; by = obj.y + dy;
      bx2 = bx + shape.width(); by2 = by + shape.height();
    } else {
      bx = obj.x + dx - shape.radius(); by = obj.y + dy - shape.radius();
      bx2 = obj.x + dx + shape.radius(); by2 = obj.y + dx + shape.radius();
    }
    minX = Math.min(minX, bx); minY = Math.min(minY, by);
    maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
  });
  let adjDx = dx, adjDy = dy;
  if (minX < 0) adjDx += -minX;
  if (maxX > stage.width()) adjDx += stage.width() - maxX;
  if (minY < 0) adjDy += -minY;
  if (maxY > stage.height()) adjDy += stage.height() - maxY;
  log("TRACE", "[canvas] clampGroupDragDelta exit", { adjDx, adjDy });
  return [adjDx, adjDy];
}

function updateSelectionHighlight() {
  log("TRACE", "[canvas] updateSelectionHighlight entry");
  const layer = AppState.konvaLayer;
  if (groupBoundingBox) { groupBoundingBox.destroy(); groupBoundingBox = null; }
  sanitizeSelection();

  if (AppState.selectedShapes.length === 1 && !AppState.selectedShapes[0].locked) {
    updateTransformer();
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
      } else {
        bx = s.x() - s.radius(); by = s.y() - s.radius();
        bx2 = s.x() + s.radius(); by2 = s.y() + s.radius();
      }
      minX = Math.min(minX, bx); minY = Math.min(minY, by);
      maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
    }
    groupBoundingBox = new Konva.Rect({
      x: minX - 4, y: minY - 4,
      width: maxX - minX + 8, height: maxY - minY + 8,
      stroke: sel.some(s => s.locked) ? "#e53935" : "#2176ff",
      strokeWidth: 3, dash: [8, 5], listening: false
    });
    layer.add(groupBoundingBox);
    layer.draw();
    dumpLayerState(layer, "updateSelectionHighlight (multi)");
  } else {
    detachTransformer();
    layer.draw();
    dumpLayerState(layer, "updateSelectionHighlight (none)");
  }
  log("TRACE", "[canvas] updateSelectionHighlight exit");
}

export function buildCanvasPanel(rootElement, container) {
  log("TRACE", "[canvas] buildCanvasPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
  try {
    log("INFO", "[canvas] buildCanvasPanel called", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      componentName: container?.componentName
    });

    rootElement.innerHTML = `
      <div id="canvas-panel-container" style="width:100%;height:100%;position:relative;overflow:hidden;">
        <div id="canvas-toolbar-main" style="display:flex;flex-wrap:wrap;align-items:center;padding:6px 8px 4px 8px;background:#f7f7fa;border-bottom:1px solid #bbb;">
          <input type="file" id="canvas-image-upload" accept="image/*" style="display:inline-block;" disabled>
          <select id="canvas-server-image-select" style="margin-left:6px;" disabled>
            <option value="">[Server image]</option>
            <option value="sample1.png">sample1.png</option>
            <option value="sample2.png">sample2.png</option>
          </select>
          <span style="margin-left:12px;">Shape:</span>
          <select id="shape-type-select" style="margin-left:4px;" disabled>
            <option value="point">Point</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <button id="add-shape-btn" style="margin-left:4px;" disabled>Add</button>
          <button id="delete-shape-btn" style="margin-left:12px;" disabled>Delete</button>
          <button id="duplicate-shape-btn" style="margin-left:4px;" disabled>Duplicate</button>
          <button id="align-left-btn" style="margin-left:12px;" disabled>Align Left</button>
          <button id="align-center-btn" disabled>Align Center</button>
          <button id="align-right-btn" disabled>Align Right</button>
          <button id="align-top-btn" style="margin-left:4px;" disabled>Align Top</button>
          <button id="align-middle-btn" disabled>Align Middle</button>
          <button id="align-bottom-btn" disabled>Align Bottom</button>
          <button id="select-all-btn" style="margin-left:12px;" disabled>Select All</button>
          <button id="lock-btn" style="margin-left:14px;" disabled>Lock</button>
          <button id="unlock-btn" style="margin-left:4px;" disabled>Unlock</button>
        </div>
        <div id="konva-stage-scroll-container" style="width:100%;height:calc(100% - 44px);overflow:auto;position:relative;background:#eee;">
          <div id="konva-stage-div" style="position:relative;width:max-content;height:max-content;"></div>
        </div>
      </div>
    `;

    const scrollContainer = rootElement.querySelector('#konva-stage-scroll-container');
    if (scrollContainer) {
      scrollContainer.style.overflow = "auto";
      scrollContainer.style.width = "100%";
      scrollContainer.style.height = "calc(100% - 44px)";
    }

    const stageDiv = rootElement.querySelector('#konva-stage-div');
    if (!stageDiv) {
      log("ERROR", "[canvas] konva-stage-div not found in DOM");
      return;
    }
    if (AppState.konvaStage && typeof AppState.konvaStage.destroy === "function") {
      AppState.konvaStage.destroy();
    }
    const width = stageDiv.clientWidth || 600;
    const height = stageDiv.clientHeight || 400;
    const stage = new Konva.Stage({
      container: stageDiv,
      width,
      height
    });
    const layer = new Konva.Layer();
    stage.add(layer);
    AppState.konvaStage = stage;
    AppState.konvaLayer = layer;

    subscribe((state, details) => {
      log("TRACE", "[canvas] subscriber fired", { details });
      if (details && details.type === "image") {
        log("TRACE", "[canvas] subscriber: image update event");
        updateBackgroundImage();
        dumpLayerState(layer, "subscriber:image after update");
        if (scrollContainer && stage) {
          stageDiv.style.width = stage.width() + "px";
          stageDiv.style.height = stage.height() + "px";
        }
      }
      // --- Listen for shape additions and ensure all shapes are always added to Konva layer ---
      if (details && details.type === "addShape" && details.shape) {
        log("TRACE", "[canvas] subscriber: addShape event", { shape: details.shape });
        dumpShapeDebug(details.shape, "addShape (canvas subscriber)");
        // Only add shape if not already present in layer
        const alreadyPresent = AppState.konvaLayer.findOne(node => node === details.shape);
        log("TRACE", "[canvas] addShape: alreadyPresent?", alreadyPresent);
        if (AppState.konvaLayer && !alreadyPresent) {
          AppState.konvaLayer.add(details.shape);
          AppState.konvaLayer.draw();
          log("INFO", `[canvas] Shape added to Konva layer`, details.shape);
          dumpLayerState(AppState.konvaLayer, "addShape after add");
          // Attach transformer for single selection, if shape is selectable
          if (!details.shape.locked && details.shape._type !== "point") {
            log("TRACE", "[canvas] addShape: attaching transformer", { shape: details.shape });
            attachTransformerForShape(details.shape);
          }
        } else {
          log("DEBUG", "[canvas] Shape not added to Konva layer (already present or not a Konva object)", details.shape);
          dumpLayerState(AppState.konvaLayer, "addShape (already present)");
        }
      }
      // Optionally: handle shape removal logic here if needed
      if (details && details.type === "selection") {
        log("TRACE", "[canvas] subscriber: selection event");
        updateSelectionHighlight();
        // Ensure transformer updates on selection changes
        updateTransformer();
        dumpLayerState(layer, "subscriber:selection after update");
      }
    });

    if (AppState.imageObj) {
      updateBackgroundImage();
      dumpLayerState(layer, "buildCanvasPanel (imageObj present)");
      if (scrollContainer && stage) {
        stageDiv.style.width = stage.width() + "px";
        stageDiv.style.height = stage.height() + "px";
      }
    }

    log("INFO", "[canvas] Canvas panel fully initialized (scrollable, legacy UI elements disabled)");
    dumpLayerState(layer, "buildCanvasPanel end");
  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    log("TRACE", "[canvas] buildCanvasPanel exit (error)");
    throw e;
  }
  log("TRACE", "[canvas] buildCanvasPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
}

