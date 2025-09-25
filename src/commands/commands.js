import { log } from '../log.js';
import {
  getState,
  addShape,
  removeShape
} from '../state.js';
import {
  setSelectedShapes as selectionSetSelectedShapes
} from '../selection.js';
import {
  makePointShape,
  makeRectShape,
  makeCircleShape,
  makeEllipseShape
} from '../shapes.js';
import {
  getShapeBoundingBox,
  getShapeCenter,
  getShapeOuterRadius
} from '../geometry/shape-rect.js';
import { getAbsoluteRectsForSelection } from '../geometry/selection-rects.js';

function requestRender() {
  const canvas = getState().fabricCanvas;
  if (!canvas) return;
  if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
  else canvas.renderAll();
}

function getShapesByIds(ids) {
  const map = new Map((getState().shapes || []).filter(Boolean).map(s => [s._id, s]));
  return (ids || []).map(id => map.get(id)).filter(Boolean);
}

function getSelectedIds() {
  return (getState().selectedShapes || []).map(s => s && s._id).filter(Boolean);
}

function uniqueIdFor(type = "shape") {
  return `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function createShapeByType(type, opts = {}) {
  const store = getState();
  const w = store.settings?.defaultRectWidth || 50;
  const h = store.settings?.defaultRectHeight || 30;
  const r = store.settings?.defaultCircleRadius || 15;

  const x = (opts.x !== undefined)
    ? opts.x
    : (store.settings?.canvasMaxWidth || 600) * ((store.settings?.shapeStartXPercent ?? 50) / 100);
  const y = (opts.y !== undefined)
    ? opts.y
    : (store.settings?.canvasMaxHeight || 400) * ((store.settings?.shapeStartYPercent ?? 50) / 100);

  if (type === "rect") return makeRectShape(x - w / 2, y - h / 2, w, h);
  if (type === "circle") return makeCircleShape(x, y, r);
  if (type === "ellipse") return makeEllipseShape(x, y, w, h);
  if (type === "point") return makePointShape(x, y);
  return null;
}

function duplicateShapeFallback(src, dx = 20, dy = 20) {
  if (!src) return null;
  const type = src._type || src.type;
  if (type === 'point') {
    const cx = (src.left ?? 0) + dx;
    const cy = (src.top ?? 0) + dy;
    return makePointShape(cx, cy);
  }
  if (type === 'rect') {
    const bbox = getShapeBoundingBox(src);
    if (!bbox) return null;
    return makeRectShape(bbox.left + dx, bbox.top + dy, bbox.width, bbox.height);
  }
  if (type === 'circle') {
    const center = getShapeCenter(src);
    const r = getShapeOuterRadius(src);
    if (!center || !Number.isFinite(r)) return null;
    return makeCircleShape(center.x + dx, center.y + dy, r);
  }
  if (type === 'ellipse') {
    const center = getShapeCenter(src);
    const bbox = getShapeBoundingBox(src);
    if (!center || !bbox) return null;
    return makeEllipseShape(center.x + dx, center.y + dy, bbox.width, bbox.height);
  }
  const bbox = getShapeBoundingBox(src);
  if (bbox) {
    return makeRectShape(bbox.left + dx, bbox.top + dy, bbox.width, bbox.height);
  }
  return null;
}

function cmdAddShape(payload) {
  const { shapeType, opts } = payload || {};
  const shape = createShapeByType(shapeType, opts || {});
  if (!shape) {
    log("WARN", "[commands] ADD_SHAPE failed to create", { shapeType, opts });
    return null;
  }
  addShape(shape);
  selectionSetSelectedShapes([shape]);
  log("INFO", "[commands] Added shape", { type: shapeType, id: shape._id });
  return { type: 'DELETE_SHAPES', payload: { ids: [shape._id] } };
}

function cmdAddShapes(payload) {
  const { shapes } = payload || {};
  const arr = Array.isArray(shapes) ? shapes.filter(Boolean) : [];
  if (!arr.length) return null;
  arr.forEach(s => addShape(s));
  selectionSetSelectedShapes(arr);
  log("INFO", "[commands] Added shapes (batch)", { count: arr.length, ids: arr.map(s => s._id) });
  return { type: 'DELETE_SHAPES', payload: { ids: arr.map(s => s._id) } };
}

function cmdDeleteShapes(payload) {
  const { ids } = payload || {};
  const targets = getShapesByIds(ids || []);
  if (!targets.length) {
    log("INFO", "[commands] DELETE_SHAPES: nothing to delete");
    return null;
  }
  const removed = [];
  targets.forEach(shape => {
    removed.push(shape);
    removeShape(shape);
  });
  const remainingSelected = (getState().selectedShapes || []).filter(s => !ids.includes(s._id));
  selectionSetSelectedShapes(remainingSelected);

  log("INFO", "[commands] Deleted shapes", { count: targets.length, ids: targets.map(s => s._id) });
  return { type: 'ADD_SHAPES', payload: { shapes: removed } };
}

function cmdDuplicateShapes(payload) {
  const { ids, offset } = payload || {};
  const dx = Number(offset?.x) || 20;
  const dy = Number(offset?.y) || 20;

  const sources = getShapesByIds(ids || getSelectedIds());
  if (!sources.length) {
    log("INFO", "[commands] DUPLICATE_SHAPES: no source shapes");
    return null;
  }

  const created = sources.map(src => {
    const dup = duplicateShapeFallback(src, dx, dy);
    if (dup) {
      dup.locked = false;
      dup.selectable = true;
      dup.evented = true;
      dup.lockMovementX = false;
      dup.lockMovementY = false;
      dup.lockScalingX = false;
      dup.lockScalingY = false;
      dup.lockRotation = false;
      dup.hoverCursor = 'move';
      if (!dup._id) dup._id = uniqueIdFor(dup._type || 'shape');
      addShape(dup);
    }
    return dup;
  }).filter(Boolean);

  if (!created.length) {
    log("INFO", "[commands] DUPLICATE_SHAPES: no duplicates created");
    return null;
  }

  selectionSetSelectedShapes(created);
  log("INFO", "[commands] Duplicated shapes", { count: created.length, ids: created.map(s => s._id) });
  return { type: 'DELETE_SHAPES', payload: { ids: created.map(s => s._id) } };
}

function cmdSetSelection(payload) {
  const { ids } = payload || {};
  const prevIds = getSelectedIds();
  const next = getShapesByIds(ids || []);
  selectionSetSelectedShapes(next);
  log("INFO", "[commands] Selection set", { count: next.length });
  return { type: 'SET_SELECTION', payload: { ids: prevIds } };
}

function clampDeltaToImage(bbox, dx, dy, img) {
  if (!img || !bbox) return { dx, dy };
  try {
    const imgW = img.width;
    const imgH = img.height;

    const newLeft = bbox.left + dx;
    const newTop = bbox.top + dy;

    const minLeft = 0;
    const minTop = 0;
    const maxLeft = Math.max(0, imgW - bbox.width);
    const maxTop = Math.max(0, imgH - bbox.height);

    const clampedLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);
    const clampedTop = Math.min(Math.max(newTop, minTop), maxTop);

    return {
      dx: clampedLeft - bbox.left,
      dy: clampedTop - bbox.top
    };
  } catch (e) {
    log("WARN", "[commands] clampDeltaToImage failed; applying unclamped delta", e);
    return { dx, dy };
  }
}

function setAngleAndCenter(shape, angle, center) {
  try {
    if (!shape) return;
    const a = Number(angle) || 0;
    shape.set({ angle: a });
    if (center && typeof shape.setPositionByOrigin === "function") {
      shape.setPositionByOrigin(center, 'center', 'center');
    } else if (center) {
      const w = typeof shape.getScaledWidth === "function" ? shape.getScaledWidth() : (shape.width || 0);
      const h = typeof shape.getScaledHeight === "function" ? shape.getScaledHeight() : (shape.height || 0);
      shape.set({ left: center.x - w / 2, top: center.y - h / 2 });
    }
    if (typeof shape.setCoords === "function") shape.setCoords();
  } catch (e) {
    log("ERROR", "[commands] setAngleAndCenter failed", { id: shape?._id, error: e });
  }
}

function cmdMoveShapesDelta(payload) {
  const { ids, dx = 0, dy = 0, clamp = true } = payload || {};
  const dxN = Number(dx) || 0;
  const dyN = Number(dy) || 0;

  const shapes = getShapesByIds(ids && ids.length ? ids : getSelectedIds());
  const targets = shapes.filter(s => s && !s.locked);
  if (!targets.length) {
    log("INFO", "[commands] MOVE_SHAPES_DELTA: no unlocked targets");
    return null;
  }

  const prevPositions = [];
  const img = getState().bgFabricImage;

  targets.forEach(shape => {
    try {
      prevPositions.push({ id: shape._id, left: shape.left ?? 0, top: shape.top ?? 0 });
      let ddx = dxN, ddy = dyN;
      if (clamp) {
        const bbox = getShapeBoundingBox(shape);
        const clamped = clampDeltaToImage(bbox, dxN, dyN, img);
        ddx = clamped.dx;
        ddy = clamped.dy;
      }
      const newLeft = (shape.left ?? 0) + ddx;
      const newTop = (shape.top ?? 0) + ddy;
      shape.set({ left: newLeft, top: newTop });
      if (typeof shape.setCoords === "function") shape.setCoords();
    } catch (e) {
      log("ERROR", "[commands] MOVE_SHAPES_DELTA: failed to move shape", { id: shape._id, error: e });
    }
  });

  requestRender();
  log("INFO", "[commands] Moved shapes by delta", { count: targets.length, dx: dxN, dy: dyN });
  return { type: 'SET_POSITIONS', payload: { positions: prevPositions } };
}

function cmdSetPositions(payload) {
  const { positions } = payload || {};
  const arr = Array.isArray(positions) ? positions.filter(p => p && p.id != null) : [];
  if (!arr.length) return null;

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const prevPositions = [];

  arr.forEach(p => {
    const shape = shapesMap.get(p.id);
    if (!shape) return;
    try {
      prevPositions.push({ id: shape._id, left: shape.left ?? 0, top: shape.top ?? 0 });
      shape.set({ left: Number(p.left) || 0, top: Number(p.top) || 0 });
      if (typeof shape.setCoords === "function") shape.setCoords();
    } catch (e) {
      log("ERROR", "[commands] SET_POSITIONS failed", { id: p.id, error: e });
    }
  });

  requestRender();
  return { type: 'SET_POSITIONS', payload: { positions: prevPositions } };
}

function cmdResetRotation(payload) {
  const { ids } = payload || {};
  const shapes = getShapesByIds(ids && ids.length ? ids : getSelectedIds());
  const targets = shapes.filter(s =>
    s && !s.locked && (s._type === 'rect' || s._type === 'circle' || s._type === 'ellipse')
  );
  if (!targets.length) {
    log("INFO", "[commands] RESET_ROTATION: no eligible targets");
    return null;
  }

  const prev = targets.map(shape => {
    try {
      const center = (typeof shape.getCenterPoint === "function")
        ? shape.getCenterPoint()
        : getShapeCenter(shape);
      const angle = Number(shape.angle) || 0;

      setAngleAndCenter(shape, 0, center);
      return { id: shape._id, angle, center };
    } catch (e) {
      log("ERROR", "[commands] RESET_ROTATION: failed for shape", { id: shape._id, error: e });
      return null;
    }
  }).filter(Boolean);

  requestRender();
  log("INFO", "[commands] Rotation reset to 0°", { ids: targets.map(t => t._id) });
  return { type: 'SET_ANGLES_POSITIONS', payload: { items: prev } };
}

function cmdSetAnglesPositions(payload) {
  const { items } = payload || {};
  const arr = Array.isArray(items) ? items.filter(i => i && i.id != null) : [];
  if (!arr.length) return null;

  const map = new Map((getState().shapes || []).map(s => [s._id, s]));
  const prev = [];

  arr.forEach(i => {
    const shape = map.get(i.id);
    if (!shape) return;
    try {
      const currentCenter = (typeof shape.getCenterPoint === "function")
        ? shape.getCenterPoint()
        : getShapeCenter(shape);
      prev.push({ id: shape._id, angle: Number(shape.angle) || 0, center: currentCenter });

      setAngleAndCenter(shape, i.angle, i.center);
    } catch (e) {
      log("ERROR", "[commands] SET_ANGLES_POSITIONS failed", { id: i.id, error: e });
    }
  });

  requestRender();
  return { type: 'SET_ANGLES_POSITIONS', payload: { items: prev } };
}

function applyLockFlags(shape, locked) {
  if (!shape) return;
  if (locked) {
    shape.locked = true;
    shape.selectable = true;
    shape.evented = true;
    shape.lockMovementX = true;
    shape.lockMovementY = true;
    shape.lockScalingX = true;
    shape.lockScalingY = true;
    shape.lockRotation = true;
    shape.hoverCursor = 'not-allowed';
  } else {
    shape.locked = false;
    shape.selectable = true;
    shape.evented = true;
    shape.lockMovementX = false;
    shape.lockMovementY = false;
    shape.lockScalingX = false;
    shape.lockScalingY = false;
    shape.lockRotation = false;
    shape.hoverCursor = 'move';
  }
  if (typeof shape.setCoords === "function") {
    try { shape.setCoords(); } catch {}
  }
}

function cmdLockShapes(payload) {
  const { ids } = payload || {};
  const shapes = getShapesByIds(ids && ids.length ? ids : getSelectedIds());
  if (!shapes.length) {
    log("INFO", "[commands] LOCK_SHAPES: nothing selected");
    return null;
  }

  const affected = [];
  shapes.forEach(s => {
    if (!s.locked) {
      applyLockFlags(s, true);
      affected.push(s._id);
    }
  });

  if (!affected.length) {
    log("INFO", "[commands] LOCK_SHAPES: no unlocked shapes to lock");
    return null;
  }

  requestRender();
  selectionSetSelectedShapes(shapes.slice());
  log("INFO", "[commands] Locked shapes", { count: affected.length, ids: affected });
  return { type: 'UNLOCK_SHAPES', payload: { ids: affected } };
}

function cmdUnlockShapes(payload) {
  const { ids } = payload || {};
  const shapes = getState().shapes || [];
  let targets;
  if (ids && ids.length) {
    targets = getShapesByIds(ids);
  } else {
    const selected = getState().selectedShapes || [];
    targets = selected.length ? selected.filter(Boolean) : shapes.filter(s => s && s.locked);
  }

  if (!targets.length) {
    log("INFO", "[commands] UNLOCK_SHAPES: no shapes to unlock");
    return null;
  }

  const affected = [];
  targets.forEach(s => {
    if (s.locked) {
      applyLockFlags(s, false);
      affected.push(s._id);
    }
  });

  if (!affected.length) {
    log("INFO", "[commands] UNLOCK_SHAPES: none were locked");
    return null;
  }

  const preserve = (getState().selectedShapes || []).slice();
  selectionSetSelectedShapes(preserve);

  requestRender();
  log("INFO", "[commands] Unlocked shapes", { count: affected.length, ids: affected });
  return { type: 'LOCK_SHAPES', payload: { ids: affected } };
}

function referenceFromBboxes(bboxes, mode) {
  if (!Array.isArray(bboxes) || bboxes.length === 0) return 0;
  switch (mode) {
    case 'left':
      return Math.min(...bboxes.map(b => b.left));
    case 'centerX': {
      const leftmost = bboxes.reduce((min, b) => (b.left < min.left ? b : min), bboxes[0]);
      return leftmost.left + leftmost.width / 2;
    }
    case 'right':
      return Math.max(...bboxes.map(b => b.left + b.width));
    case 'top':
      return Math.min(...bboxes.map(b => b.top));
    case 'middleY': {
      const topmost = bboxes.reduce((min, b) => (b.top < min.top ? b : min), bboxes[0]);
      return topmost.top + topmost.height / 2;
    }
    case 'bottom':
      return Math.max(...bboxes.map(b => b.top + b.height));
    default:
      return 0;
  }
}

function cmdAlignSelected(payload) {
  const mode = payload?.mode;
  const ref = payload?.ref === 'canvas' ? 'canvas' : 'selection';
  const valid = new Set(['left', 'centerX', 'right', 'top', 'middleY', 'bottom']);
  if (!valid.has(mode)) {
    log("WARN", "[commands] ALIGN_SELECTED: invalid mode", { mode });
    return null;
  }

  const store = getState();
  const selected = Array.isArray(store.selectedShapes) ? store.selectedShapes.filter(Boolean) : [];
  if (selected.length < 2) {
    log("INFO", "[commands] ALIGN_SELECTED: need 2+ selected");
    return null;
  }

  const bboxes = getAbsoluteRectsForSelection(selected, store.fabricCanvas);
  const existingBboxes = bboxes.filter(Boolean);
  if (existingBboxes.length < 2) {
    log("WARN", "[commands] ALIGN_SELECTED: not enough valid bounding boxes", { have: existingBboxes.length });
    return null;
  }

  let referenceValue;
  if (ref === 'canvas' && store.bgFabricImage && Number.isFinite(store.bgFabricImage.width) && Number.isFinite(store.bgFabricImage.height)) {
    const img = store.bgFabricImage;
    switch (mode) {
      case 'left': referenceValue = 0; break;
      case 'centerX': referenceValue = img.width / 2; break;
      case 'right': referenceValue = img.width; break;
      case 'top': referenceValue = 0; break;
      case 'middleY': referenceValue = img.height / 2; break;
      case 'bottom': referenceValue = img.height; break;
      default: referenceValue = 0;
    }
  } else {
    referenceValue = referenceFromBboxes(existingBboxes, mode);
  }

  const prevPositions = [];
  const img = store.bgFabricImage;
  let movedCount = 0;

  selected.forEach((shape, idx) => {
    if (!shape) return;
    const bbox = bboxes[idx];
    if (!bbox) return;
    if (shape.locked) return;

    let dx = 0, dy = 0;
    switch (mode) {
      case 'left':
        dx = referenceValue - bbox.left; break;
      case 'centerX':
        dx = referenceValue - (bbox.left + bbox.width / 2); break;
      case 'right':
        dx = referenceValue - (bbox.left + bbox.width); break;
      case 'top':
        dy = referenceValue - bbox.top; break;
      case 'middleY':
        dy = referenceValue - (bbox.top + bbox.height / 2); break;
      case 'bottom':
        dy = referenceValue - (bbox.top + bbox.height); break;
      default: break;
    }

    const clamped = clampDeltaToImage(bbox, dx, dy, img);
    if (mode === 'left' || mode === 'centerX' || mode === 'right') {
      dx = clamped.dx;
      dy = 0;
    } else {
      dx = 0;
      dy = clamped.dy;
    }

    if (dx === 0 && dy === 0) return;

    try {
      prevPositions.push({ id: shape._id, left: shape.left ?? 0, top: shape.top ?? 0 });
      const newLeft = (shape.left ?? 0) + dx;
      const newTop = (shape.top ?? 0) + dy;
      shape.set({ left: newLeft, top: newTop });
      if (typeof shape.setCoords === "function") shape.setCoords();
      movedCount++;
    } catch (e) {
      log("ERROR", "[commands] ALIGN_SELECTED: move failed", { id: shape._id, error: e });
    }
  });

  if (movedCount === 0) {
    log("INFO", "[commands] ALIGN_SELECTED: nothing moved");
    return null;
  }

  requestRender();
  log("INFO", "[commands] ALIGN_SELECTED complete", { mode, ref, movedCount, selectedCount: selected.length });
  return { type: 'SET_POSITIONS', payload: { positions: prevPositions } };
}

function cmdSetTransforms(payload) {
  const { items } = payload || {};
  const arr = Array.isArray(items) ? items.filter(i => i && i.id != null) : [];
  if (!arr.length) return null;

  const map = new Map((getState().shapes || []).map(s => [s._id, s]));
  const prev = [];

  arr.forEach(i => {
    const shape = map.get(i.id);
    if (!shape) return;
    try {
      prev.push({
        id: shape._id,
        left: Number.isFinite(shape.left) ? shape.left : 0,
        top: Number.isFinite(shape.top) ? shape.top : 0,
        scaleX: Number.isFinite(shape.scaleX) ? shape.scaleX : 1,
        scaleY: Number.isFinite(shape.scaleY) ? shape.scaleY : 1,
        angle: Number(shape.angle) || 0
      });

      const next = {};
      if (i.left !== undefined) next.left = Number(i.left) || 0;
      if (i.top !== undefined) next.top = Number(i.top) || 0;
      if (i.scaleX !== undefined) next.scaleX = Number(i.scaleX) || 1;
      if (i.scaleY !== undefined) next.scaleY = Number(i.scaleY) || 1;
      if (i.angle !== undefined) next.angle = Number(i.angle) || 0;

      shape.set(next);
      if (typeof shape.setCoords === "function") shape.setCoords();
    } catch (e) {
      log("ERROR", "[commands] SET_TRANSFORMS apply failed", { id: i.id, error: e });
    }
  });

  requestRender();
  return { type: 'SET_TRANSFORMS', payload: { items: prev } };
}

function isDrawableChild(obj) {
  return !!obj && !obj._isDiagnosticLabel && (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse' || obj.type === 'line');
}
function getFirstChildStroke(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(isDrawableChild);
  if (!child) return null;
  return ('stroke' in child) ? child.stroke : null;
}
function getFirstChildFill(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(o => isDrawableChild(o) && (o.type === 'rect' || o.type === 'circle' || o.type === 'ellipse'));
  if (!child) return null;
  return ('fill' in child) ? child.fill : null;
}
function applyStrokeColorToShape(shape, color) {
  if (!shape || shape.locked || !Array.isArray(shape._objects)) return;
  shape._objects.forEach(obj => {
    if (!isDrawableChild(obj)) return;
    if ('stroke' in obj) obj.set({ stroke: color });
    if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
  });
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}
function applyFillColorToShape(shape, rgba) {
  if (!shape || shape.locked || shape._type === 'point' || !Array.isArray(shape._objects)) return;
  shape._objects.forEach(obj => {
    if (!isDrawableChild(obj)) return;
    if (obj.type === 'line') return;
    if ('fill' in obj) obj.set({ fill: rgba });
  });
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}
function getFirstChildStrokeWidth(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(isDrawableChild);
  if (!child) return null;
  return ('strokeWidth' in child) ? (Number(child.strokeWidth) || 0) : null;
}
function applyStrokeWidthToShape(shape, width) {
  if (!shape || shape.locked || !Array.isArray(shape._objects)) return;
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return;
  shape._objects.forEach(obj => {
    if (!isDrawableChild(obj)) return;
    if ('strokeWidth' in obj) obj.set({ strokeWidth: w });
    if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
  });
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}

function cmdSetStrokeColor(payload) {
  const items = Array.isArray(payload?.items) ? payload.items.filter(i => i && i.id != null && typeof i.color === 'string') : null;
  const color = typeof payload?.color === 'string' ? payload.color : null;

  let targets = [];
  if (items && items.length) {
    const byId = new Map((getState().shapes || []).map(s => [s._id, s]));
    targets = items.map(i => {
      const s = byId.get(i.id);
      return s && !s.locked ? { shape: s, color: i.color } : null;
    }).filter(Boolean);
  } else {
    const ids = Array.isArray(payload?.ids) && payload.ids.length ? payload.ids : getSelectedIds();
    if (!ids.length || !color) {
      log("INFO", "[commands] SET_STROKE_COLOR: no targets or color");
      return null;
    }
    targets = getShapesByIds(ids).filter(s => s && !s.locked).map(s => ({ shape: s, color }));
  }

  if (!targets.length) {
    log("INFO", "[commands] SET_STROKE_COLOR: nothing to apply");
    return null;
  }

  const prev = [];
  targets.forEach(({ shape, color: c }) => {
    try {
      const before = getFirstChildStroke(shape);
      prev.push({ id: shape._id, color: before });
      applyStrokeColorToShape(shape, c);
    } catch (e) {
      log("WARN", "[commands] SET_STROKE_COLOR: apply failed", { id: shape?._id, error: e });
    }
  });

  requestRender();
  log("INFO", "[commands] Stroke color applied", { count: targets.length });
  return { type: 'SET_STROKE_COLOR', payload: { items: prev } };
}

function cmdSetFillColor(payload) {
  const items = Array.isArray(payload?.items) ? payload.items.filter(i => i && i.id != null && typeof i.fill === 'string') : null;
  const fill = typeof payload?.fill === 'string' ? payload.fill : null;

  let targets = [];
  if (items && items.length) {
    const byId = new Map((getState().shapes || []).map(s => [s._id, s]));
    targets = items.map(i => {
      const s = byId.get(i.id);
      return s && !s.locked ? { shape: s, fill: i.fill } : null;
    }).filter(Boolean);
  } else {
    const ids = Array.isArray(payload?.ids) && payload.ids.length ? payload.ids : getSelectedIds();
    if (!ids.length || !fill) {
      log("INFO", "[commands] SET_FILL_COLOR: no targets or fill");
      return null;
    }
    targets = getShapesByIds(ids).filter(s => s && !s.locked && s._type !== 'point').map(s => ({ shape: s, fill }));
  }

  if (!targets.length) {
    log("INFO", "[commands] SET_FILL_COLOR: nothing to apply");
    return null;
  }

  const prev = [];
  targets.forEach(({ shape, fill: f }) => {
    try {
      const before = getFirstChildFill(shape);
      prev.push({ id: shape._id, fill: before });
      applyFillColorToShape(shape, f);
    } catch (e) {
      log("WARN", "[commands] SET_FILL_COLOR: apply failed", { id: shape?._id, error: e });
    }
  });

  requestRender();
  log("INFO", "[commands] Fill color applied", { count: targets.length });
  return { type: 'SET_FILL_COLOR', payload: { items: prev } };
}

function cmdSetStrokeWidth(payload) {
  const items = Array.isArray(payload?.items) ? payload.items.filter(i => i && i.id != null && Number.isFinite(Number(i.width)) && Number(i.width) > 0) : null;
  const width = Number(payload?.width);
  let targets = [];

  if (items && items.length) {
    const byId = new Map((getState().shapes || []).map(s => [s._id, s]));
    targets = items.map(i => {
      const s = byId.get(i.id);
      const w = Number(i.width);
      return s && !s.locked && Number.isFinite(w) && w > 0 ? { shape: s, width: w } : null;
    }).filter(Boolean);
  } else {
    const ids = Array.isArray(payload?.ids) && payload.ids.length ? payload.ids : getSelectedIds();
    if (!ids.length || !Number.isFinite(width) || width <= 0) {
      log("INFO", "[commands] SET_STROKE_WIDTH: no targets or invalid width");
      return null;
    }
    targets = getShapesByIds(ids).filter(s => s && !s.locked).map(s => ({ shape: s, width }));
  }

  if (!targets.length) {
    log("INFO", "[commands] SET_STROKE_WIDTH: nothing to apply");
    return null;
  }

  const prev = [];
  targets.forEach(({ shape, width: w }) => {
    try {
      const before = getFirstChildStrokeWidth(shape);
      prev.push({ id: shape._id, width: before });
      applyStrokeWidthToShape(shape, w);
    } catch (e) {
      log("WARN", "[commands] SET_STROKE_WIDTH: apply failed", { id: shape?._id, error: e });
    }
  });

  requestRender();
  log("INFO", "[commands] Stroke width applied", { count: targets.length, width: items && items.length ? 'per-item' : width });
  return { type: 'SET_STROKE_WIDTH', payload: { items: prev } };
}

export function executeCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') {
    log("WARN", "[commands] executeCommand: invalid cmd", { cmd });
    return null;
  }
  const t = cmd.type;
  const p = cmd.payload || {};

  switch (t) {
    case 'ADD_SHAPE':
      return cmdAddShape(p);
    case 'ADD_SHAPES':
      return cmdAddShapes(p);
    case 'DELETE_SHAPES':
      return cmdDeleteShapes(p);
    case 'DUPLICATE_SHAPES':
      return cmdDuplicateShapes(p);
    case 'SET_SELECTION':
      return cmdSetSelection(p);

    case 'MOVE_SHAPES_DELTA':
      return cmdMoveShapesDelta(p);
    case 'SET_POSITIONS':
      return cmdSetPositions(p);

    case 'RESET_ROTATION':
      return cmdResetRotation(p);
    case 'SET_ANGLES_POSITIONS':
      return cmdSetAnglesPositions(p);

    case 'LOCK_SHAPES':
      return cmdLockShapes(p);
    case 'UNLOCK_SHAPES':
      return cmdUnlockShapes(p);

    case 'ALIGN_SELECTED':
      return cmdAlignSelected(p);

    case 'SET_TRANSFORMS':
      return cmdSetTransforms(p);

    case 'SET_STROKE_COLOR':
      return cmdSetStrokeColor(p);
    case 'SET_FILL_COLOR':
      return cmdSetFillColor(p);

    case 'SET_STROKE_WIDTH':
      return cmdSetStrokeWidth(p);

    default:
      log("WARN", "[commands] Unknown command type", { type: t });
      return null;
  }
}
