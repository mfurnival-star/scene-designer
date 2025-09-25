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
import {
  applyStrokeColorToShape,
  applyFillColorToShape,
  applyStrokeWidthToShape,
  getFirstChildStroke,
  getFirstChildFill,
  getFirstChildStrokeWidth
} from './commands-style.js';

function requestRender() {
  const c = getState().fabricCanvas;
  if (!c) return;
  if (typeof c.requestRenderAll === 'function') c.requestRenderAll();
  else c.renderAll();
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

function getPrimaryDrawableChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  const priority = ['ellipse', 'circle', 'rect', 'line'];
  for (const t of priority) {
    const obj = group._objects.find(o => o && !o._isDiagnosticLabel && o.type === t);
    if (obj) return obj;
  }
  return group._objects.find(o => o && !o._isDiagnosticLabel) || null;
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
    log("ERROR", "[commands-structure] setAngleAndCenter failed", e);
  }
}

function duplicateShapePreservingTransforms(src, dx = 20, dy = 20) {
  if (!src) return null;
  const type = src._type || src.type;
  const center = (typeof src.getCenterPoint === "function") ? src.getCenterPoint() : getShapeCenter(src);
  if (!center) return null;

  const sx = Number.isFinite(src.scaleX) ? src.scaleX : 1;
  const sy = Number.isFinite(src.scaleY) ? src.scaleY : 1;
  const angle = Number.isFinite(src.angle) ? src.angle : 0;
  const destCenter = { x: center.x + dx, y: center.y + dy };

  let dup = null;

  try {
    if (type === 'point') {
      dup = makePointShape(destCenter.x, destCenter.y);
    } else if (type === 'circle') {
      const child = getPrimaryDrawableChild(src);
      const r = Number.isFinite(child?.radius) ? Number(child.radius) : getShapeOuterRadius(src) || 10;
      dup = makeCircleShape(destCenter.x, destCenter.y, r);
      dup.set({ scaleX: sx, scaleY: sy, angle });
      setAngleAndCenter(dup, angle, destCenter);
    } else if (type === 'ellipse') {
      const child = getPrimaryDrawableChild(src);
      const rx = Number.isFinite(child?.rx) ? Number(child.rx) : Math.max(1, (getShapeBoundingBox(src)?.width || 20) / 2);
      const ry = Number.isFinite(child?.ry) ? Number(child.ry) : Math.max(1, (getShapeBoundingBox(src)?.height || 12) / 2);
      dup = makeEllipseShape(destCenter.x, destCenter.y, rx * 2, ry * 2);
      dup.set({ scaleX: sx, scaleY: sy, angle });
      setAngleAndCenter(dup, angle, destCenter);
    } else if (type === 'rect') {
      const child = getPrimaryDrawableChild(src);
      const baseW = Number.isFinite(child?.width) ? Number(child.width) : (getShapeBoundingBox(src)?.width || 40);
      const baseH = Number.isFinite(child?.height) ? Number(child.height) : (getShapeBoundingBox(src)?.height || 24);
      dup = makeRectShape(destCenter.x - baseW / 2, destCenter.y - baseH / 2, baseW, baseH);
      dup.set({ scaleX: sx, scaleY: sy, angle });
      setAngleAndCenter(dup, angle, destCenter);
    } else {
      dup = duplicateShapeFallback(src, dx, dy);
    }
  } catch (e) {
    log("WARN", "[commands-structure] duplicate build failed; using fallback", e);
    dup = null;
  }

  try {
    if (dup) {
      const stroke = getFirstChildStroke(src);
      const fill = getFirstChildFill(src);
      const sw = getFirstChildStrokeWidth(src);
      if (stroke) applyStrokeColorToShape(dup, stroke);
      if (fill) applyFillColorToShape(dup, fill);
      if (Number.isFinite(sw) && sw > 0) applyStrokeWidthToShape(dup, sw);
    }
  } catch (e) {
    log("WARN", "[commands-structure] duplicate style copy failed", e);
  }

  return dup;
}

function clampDeltaToImage(bbox, dx, dy, img) {
  if (!img || !bbox) return { dx, dy };
  try {
    const imgW = img.width;
    const imgH = img.height;
    const newLeft = bbox.left + dx;
    const newTop = bbox.top + dy;
    const clampedLeft = Math.min(Math.max(newLeft, 0), Math.max(0, imgW - bbox.width));
    const clampedTop = Math.min(Math.max(newTop, 0), Math.max(0, imgH - bbox.height));
    return {
      dx: clampedLeft - bbox.left,
      dy: clampedTop - bbox.top
    };
  } catch (e) {
    log("WARN", "[commands-structure] clampDeltaToImage failed", e);
    return { dx, dy };
  }
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

function cmdAddShape(payload) {
  const { shapeType, opts } = payload || {};
  const shape = createShapeByType(shapeType, opts || {});
  if (!shape) return null;
  addShape(shape);
  selectionSetSelectedShapes([shape]);
  return { type: 'DELETE_SHAPES', payload: { ids: [shape._id] } };
}

function cmdAddShapes(payload) {
  const { shapes } = payload || {};
  const arr = Array.isArray(shapes) ? shapes.filter(Boolean) : [];
  if (!arr.length) return null;
  arr.forEach(s => addShape(s));
  selectionSetSelectedShapes(arr);
  return { type: 'DELETE_SHAPES', payload: { ids: arr.map(s => s._id) } };
}

function cmdDeleteShapes(payload) {
  const { ids } = payload || {};
  const targets = getShapesByIds(ids || []);
  if (!targets.length) return null;
  const removed = [];
  targets.forEach(shape => {
    removed.push(shape);
    removeShape(shape);
  });
  const remainingSelected = (getState().selectedShapes || []).filter(s => !ids.includes(s._id));
  selectionSetSelectedShapes(remainingSelected);
  return { type: 'ADD_SHAPES', payload: { shapes: removed } };
}

function cmdDuplicateShapes(payload) {
  const { ids, offset } = payload || {};
  const dx = Number(offset?.x) || 20;
  const dy = Number(offset?.y) || 20;

  const sources = getShapesByIds(ids || getSelectedIds());
  if (!sources.length) return null;

  const created = sources.map(src => {
    let dup = duplicateShapePreservingTransforms(src, dx, dy);
    if (!dup) dup = duplicateShapeFallback(src, dx, dy);
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

  if (!created.length) return null;

  selectionSetSelectedShapes(created);
  return { type: 'DELETE_SHAPES', payload: { ids: created.map(s => s._id) } };
}

function cmdSetSelection(payload) {
  const { ids } = payload || {};
  const prevIds = getSelectedIds();
  const next = getShapesByIds(ids || []);
  selectionSetSelectedShapes(next);
  return { type: 'SET_SELECTION', payload: { ids: prevIds } };
}

function cmdMoveShapesDelta(payload) {
  const { ids, dx = 0, dy = 0, clamp = true } = payload || {};
  const dxN = Number(dx) || 0;
  const dyN = Number(dy) || 0;

  const shapes = getShapesByIds(ids && ids.length ? ids : getSelectedIds());
  const targets = shapes.filter(s => s && !s.locked);
  if (!targets.length) return null;

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
      shape.set({ left: (shape.left ?? 0) + ddx, top: (shape.top ?? 0) + ddy });
      if (typeof shape.setCoords === "function") shape.setCoords();
    } catch (e) {
      log("ERROR", "[commands-structure] MOVE_SHAPES_DELTA failed", e);
    }
  });

  requestRender();
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
      log("ERROR", "[commands-structure] SET_POSITIONS failed", e);
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
  if (!targets.length) return null;

  const prev = targets.map(shape => {
    try {
      const center = (typeof shape.getCenterPoint === "function")
        ? shape.getCenterPoint()
        : getShapeCenter(shape);
      const angle = Number(shape.angle) || 0;
      setAngleAndCenter(shape, 0, center);
      return { id: shape._id, angle, center };
    } catch (e) {
      log("ERROR", "[commands-structure] RESET_ROTATION failed", e);
      return null;
    }
  }).filter(Boolean);

  requestRender();
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
      log("ERROR", "[commands-structure] SET_ANGLES_POSITIONS failed", e);
    }
  });

  requestRender();
  return { type: 'SET_ANGLES_POSITIONS', payload: { items: prev } };
}

function cmdLockShapes(payload) {
  const { ids } = payload || {};
  const shapes = getShapesByIds(ids && ids.length ? ids : getSelectedIds());
  if (!shapes.length) return null;

  const affected = [];
  shapes.forEach(s => {
    if (!s.locked) {
      applyLockFlags(s, true);
      affected.push(s._id);
    }
  });

  if (!affected.length) return null;

  requestRender();
  selectionSetSelectedShapes(shapes.slice());
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

  if (!targets.length) return null;

  const affected = [];
  targets.forEach(s => {
    if (s.locked) {
      applyLockFlags(s, false);
      affected.push(s._id);
    }
  });

  if (!affected.length) return null;

  const preserve = (getState().selectedShapes || []).slice();
  selectionSetSelectedShapes(preserve);

  requestRender();
  return { type: 'LOCK_SHAPES', payload: { ids: affected } };
}

function cmdAlignSelected(payload) {
  const mode = payload?.mode;
  const ref = payload?.ref === 'canvas' ? 'canvas' : 'selection';
  const valid = new Set(['left', 'centerX', 'right', 'top', 'middleY', 'bottom']);
  if (!valid.has(mode)) return null;

  const store = getState();
  const selected = Array.isArray(store.selectedShapes) ? store.selectedShapes.filter(Boolean) : [];
  if (selected.length < 2) return null;

  const bboxes = getAbsoluteRectsForSelection(selected, store.fabricCanvas);
  const existingBboxes = bboxes.filter(Boolean);
  if (existingBboxes.length < 2) return null;

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
      shape.set({ left: (shape.left ?? 0) + dx, top: (shape.top ?? 0) + dy });
      if (typeof shape.setCoords === "function") shape.setCoords();
      movedCount++;
    } catch (e) {
      log("ERROR", "[commands-structure] ALIGN_SELECTED move failed", e);
    }
  });

  if (movedCount === 0) return null;

  requestRender();
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
      log("ERROR", "[commands-structure] SET_TRANSFORMS failed", e);
    }
  });

  requestRender();
  return { type: 'SET_TRANSFORMS', payload: { items: prev } };
}

export function executeStructureCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') return null;
  const p = cmd.payload || {};
  switch (cmd.type) {
    case 'ADD_SHAPE': return cmdAddShape(p);
    case 'ADD_SHAPES': return cmdAddShapes(p);
    case 'DELETE_SHAPES': return cmdDeleteShapes(p);
    case 'DUPLICATE_SHAPES': return cmdDuplicateShapes(p);
    case 'SET_SELECTION': return cmdSetSelection(p);
    case 'MOVE_SHAPES_DELTA': return cmdMoveShapesDelta(p);
    case 'SET_POSITIONS': return cmdSetPositions(p);
    case 'RESET_ROTATION': return cmdResetRotation(p);
    case 'SET_ANGLES_POSITIONS': return cmdSetAnglesPositions(p);
    case 'LOCK_SHAPES': return cmdLockShapes(p);
    case 'UNLOCK_SHAPES': return cmdUnlockShapes(p);
    case 'ALIGN_SELECTED': return cmdAlignSelected(p);
    case 'SET_TRANSFORMS': return cmdSetTransforms(p);
    default: return null;
  }
}
