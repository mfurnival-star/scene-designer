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

// ---------- Helpers for movement/rotation/locking ----------

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

// ---------- MOVE_SHAPES_DELTA (+ internal SET_POSITIONS) ----------

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

// ---------- RESET_ROTATION (+ internal SET_ANGLES_POSITIONS) ----------

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
      // Snapshot current state before applying
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

// ---------- LOCK / UNLOCK ----------

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

  // Preserve selection
  const preserve = (getState().selectedShapes || []).slice();
  selectionSetSelectedShapes(preserve);

  requestRender();
  log("INFO", "[commands] Unlocked shapes", { count: affected.length, ids: affected });
  return { type: 'LOCK_SHAPES', payload: { ids: affected } };
}

// ---------- Execute ----------

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

    default:
      log("WARN", "[commands] Unknown command type", { type: t });
      return null;
  }
}
