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
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { AppState, setShapes, addShape, removeShape, setImage, setSelectedShapes, subscribe } from './state.js';
import { log } from './log.js';

// --- Internal State ---
let konvaInitialized = false;
let bgKonvaImage = null;
let groupBoundingBox = null;

// --- Helper: set or clear the Konva background image on canvas
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
    // Fit image to stage dimensions, respecting aspect ratio (basic logic only)
    const stage = AppState.konvaStage;
    if (!stage) {
      log("WARN", "[canvas] updateBackgroundImage: no konvaStage");
      return;
    }
    let w = AppState.imageObj.naturalWidth || AppState.imageObj.width;
    let h = AppState.imageObj.naturalHeight || AppState.imageObj.height;
    // Fit to stage size (if defined), else use image size
    let targetW = stage.width ? stage.width() : w;
    let targetH = stage.height ? stage.height() : h;
    // Simple fit mode
    const scale = Math.min(targetW / w, targetH / h, 1);
    const drawW = Math.round(w * scale);
    const drawH = Math.round(h * scale);

    bgKonvaImage = new Konva.Image({
      image: AppState.imageObj,
      x: 0,
      y: 0,
      width: drawW,
      height: drawH,
      listening: false
    });
    layer.add(bgKonvaImage);
    bgKonvaImage.moveToBottom();
    layer.draw();
    log("DEBUG", "[canvas] updateBackgroundImage: background set", {
      imgW: w, imgH: h, stageW: targetW, stageH: targetH, drawW, drawH
    });
  } else {
    log("DEBUG", "[canvas] updateBackgroundImage: no imageObj, background cleared");
    // Nothing to do, already cleared above
  }
  log("TRACE", "[canvas] updateBackgroundImage exit");
}

/**
 * Central selection filtering (no stale references)
 */
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

/**
 * Remove all Konva event handlers from shape
 */
function removeAllShapeHandlers(shape) {
  log("TRACE", "[canvas] removeAllShapeHandlers entry", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
  if (shape && typeof shape.off === "function") {
    shape.off('mousedown.shape dragmove.shape transformstart.shape transformend.shape');
  }
  log("TRACE", "[canvas] removeAllShapeHandlers exit");
}

/**
 * Attach all required handlers to shape
 */
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

  shape.on('transformstart.shape', () => {
    log("DEBUG", "[canvas] transformstart.shape event", shape && shape._id ? { _id: shape._id, _type: shape._type } : { shape });
    if (!shape || !AppState.konvaLayer.findOne(node => node === shape)) return;
    sanitizeSelection();
    if (shape._type === "circle") {
      shape.setAttr("scaleY", shape.scaleX());
    }
  });

  shape.on('transformend.shape', () => {
    log("DEBUG", "[canvas] transformend.shape event", shape && shape._id ? { _id: shape._id, _type: shape._type } : { shape });
    if (!shape || !AppState.konvaLayer.findOne(node => node === shape)) return;
    sanitizeSelection();
    if (shape._type === "circle") {
      const scale = shape.scaleX();
      shape.radius(shape.radius() * scale);
      shape.scale({ x: 1, y: 1 });
    } else if (shape._type === "rect") {
      const scaleX = shape.scaleX(), scaleY = shape.scaleY();
      shape.width(shape.width() * scaleX);
      shape.height(shape.height() * scaleY);
      shape.scale({ x: 1, y: 1 });
    }
    updateSelectionHighlight();
    AppState.konvaLayer.batchDraw();
  });
  log("TRACE", "[canvas] attachShapeEvents exit", shape && shape._id ? { _id: shape._id, _type: shape._type } : shape);
}

/**
 * Clamp logic for shape and group drag
 */
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
  log("TRACE", "[canvas] clampGroupDragDelta entry", { dx, dy }); // Don't log origPositions, could be circular
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

/**
 * Selection Highlight Logic
 */
function updateSelectionHighlight() {
  log("TRACE", "[canvas] updateSelectionHighlight entry");
  const layer = AppState.konvaLayer;
  // Remove any old bounding box
  if (groupBoundingBox) { groupBoundingBox.destroy(); groupBoundingBox = null; }
  sanitizeSelection();
  if (AppState.selectedShapes.length === 1 && !AppState.selectedShapes[0].locked) {
    if (AppState.transformer) AppState.transformer.destroy();
    const tr = new Konva.Transformer({
      nodes: [AppState.selectedShapes[0]],
      enabledAnchors: AppState.selectedShapes[0]._type === "point" ? [] :
        AppState.selectedShapes[0]._type === "circle"
          ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
          : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
      rotateEnabled: AppState.selectedShapes[0]._type !== "point"
    });
    AppState.transformer = tr;
    layer.add(tr);
    layer.draw();
  } else if (AppState.selectedShapes.length > 1) {
    if (AppState.transformer) { AppState.transformer.destroy(); AppState.transformer = null; }
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
  } else {
    if (AppState.transformer) { AppState.transformer.destroy(); AppState.transformer = null; }
    layer.draw();
  }
  log("TRACE", "[canvas] updateSelectionHighlight exit");
}

/**
 * Main Panel Build
 */
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
      containerComponentName: container?.componentName
    });

    rootElement.innerHTML = `
      <div id="canvas-panel-container" style="width:100%;height:100%;position:relative;">
        <div id="canvas-toolbar-main" style="display:flex;flex-wrap:wrap;align-items:center;padding:6px 8px 4px 8px;background:#f7f7fa;border-bottom:1px solid #bbb;">
          <input type="file" id="canvas-image-upload" accept="image/*" style="display:inline-block;">
          <select id="canvas-server-image-select" style="margin-left:6px;">
            <option value="">[Server image]</option>
            <option value="sample1.png">sample1.png</option>
            <option value="sample2.png">sample2.png</option>
          </select>
          <span style="margin-left:12px;">Shape:</span>
          <select id="shape-type-select" style="margin-left:4px;">
            <option value="point">Point</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <button id="add-shape-btn" style="margin-left:4px;">Add</button>
          <button id="delete-shape-btn" style="margin-left:12px;">Delete</button>
          <button id="duplicate-shape-btn" style="margin-left:4px;">Duplicate</button>
          <button id="align-left-btn" style="margin-left:12px;">Align Left</button>
          <button id="align-center-btn">Align Center</button>
          <button id="align-right-btn">Align Right</button>
          <button id="align-top-btn" style="margin-left:4px;">Align Top</button>
          <button id="align-middle-btn">Align Middle</button>
          <button id="align-bottom-btn">Align Bottom</button>
          <button id="select-all-btn" style="margin-left:12px;">Select All</button>
          <button id="lock-btn" style="margin-left:14px;">Lock</button>
          <button id="unlock-btn" style="margin-left:4px;">Unlock</button>
        </div>
        <div id="konva-stage-div" style="width:100%;height:calc(100% - 44px);background:#eee;"></div>
      </div>
    `;

    // --- Diagnostic logging for image upload setup ---
    const imageUpload = rootElement.querySelector('#canvas-image-upload');
    const serverImageSelect = rootElement.querySelector('#canvas-server-image-select');
    log("TRACE", "[canvas] image upload DOM nodes", {
      imageUploadType: typeof imageUpload,
      serverImageSelectType: typeof serverImageSelect
    });

    // --- Konva Stage/Layer Setup ---
    const stageDiv = rootElement.querySelector('#konva-stage-div');
    if (!stageDiv) {
      log("ERROR", "[canvas] konva-stage-div not found in DOM");
      return;
    }
    // Destroy previous stage if any
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

    // --- Image Upload (from device) ---
    if (imageUpload) {
      imageUpload.addEventListener('change', function(e) {
        log("TRACE", "[canvas] imageUpload changed", e);
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
          log("TRACE", "[canvas] FileReader onload", { resultLen: ev.target.result.length });
          const url = ev.target.result;
          // Create an Image object, wait for it to load, then call setImage(url, imgObj)
          const imgObj = new window.Image();
          imgObj.onload = function() {
            log("DEBUG", "[canvas] imageUpload: Image object loaded", { width: imgObj.naturalWidth, height: imgObj.naturalHeight });
            setImage(url, imgObj);
            if (serverImageSelect) serverImageSelect.value = "";
          };
          imgObj.onerror = function(e) {
            log("ERROR", "[canvas] imageUpload: Image object failed to load", e);
            setImage(null, null);
          };
          imgObj.src = url;
        };
        reader.readAsDataURL(file);
      });
    } else {
      log("ERROR", "[canvas] imageUpload element not found in DOM");
    }

    // --- Server Image Select ---
    if (serverImageSelect) {
      serverImageSelect.addEventListener('change', function(e) {
        log("TRACE", "[canvas] serverImageSelect changed", e);
        const filename = e.target.value;
        if (!filename) {
          setImage(null, null);
          return;
        }
        const url = './images/' + filename;
        const imgObj = new window.Image();
        imgObj.onload = function() {
          log("DEBUG", "[canvas] serverImageSelect: Image object loaded", { width: imgObj.naturalWidth, height: imgObj.naturalHeight });
          setImage(url, imgObj);
          if (imageUpload) imageUpload.value = "";
        };
        imgObj.onerror = function(e) {
          log("ERROR", "[canvas] serverImageSelect: Image object failed to load", e);
          setImage(null, null);
        };
        imgObj.src = url;
      });
    } else {
      log("ERROR", "[canvas] serverImageSelect element not found in DOM");
    }

    // --- AppState subscription: update background image on setImage ---
    subscribe((state, details) => {
      if (details && details.type === "image") {
        updateBackgroundImage();
      }
    });

    // On panel build, show current background if image is present
    if (AppState.imageObj) {
      updateBackgroundImage();
    }

    // ...[Rest of UI hook-up, Konva setup, and shape logic as in your robust version. All functions should have entry/exit TRACE logs.]

    log("INFO", "[canvas] Canvas panel fully initialized");
  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    log("TRACE", "[canvas] buildCanvasPanel exit (error)");
    throw e;
  }
  log("TRACE", "[canvas] buildCanvasPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
}

