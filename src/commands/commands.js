
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
  // Unknown → try bbox as rect
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
  // Snapshot removed shapes (same instances) for undo
  const removed = [];
  targets.forEach(shape => {
    removed.push(shape);
    removeShape(shape);
  });
  // Clear selection if it referenced any removed shapes
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
    // Prefer async clone if ever needed; for command determinism we use synchronous fallback
    const dup = duplicateShapeFallback(src, dx, dy);
    if (dup) {
      // Ensure reasonable unlocked defaults
      dup.locked = false;
      dup.selectable = true;
      dup.evented = true;
      dup.lockMovementX = false;
      dup.lockMovementY = false;
      dup.lockScalingX = false;
      dup.lockScalingY = false;
      dup.lockRotation = false;
      dup.hoverCursor = 'move';
      // New id (factory already sets one, but ensure uniqueness if needed)
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
    default:
      log("WARN", "[commands] Unknown command type", { type: t });
      return null;
  }
}
