import { log } from '../log.js';
import { getState } from '../state.js';

/*
  Batch 6: Style Payload Normalization (items[] only, legacy form rejected)
  -------------------------------------------------------------------------
  - Only accepts payloads of shape { items: [ { id, color } ] }, etc.
  - Legacy payloads (ids + color/fill/width) are rejected with WARN/LEGACY_PAYLOAD.
  - All normalization helpers for legacy forms removed.
  - No-ops and validation codes: NO_CHANGE, NO_TARGETS, NO_TARGETS_UNLOCKED, INVALID_PAYLOAD, INVALID_COLOR, INVALID_FILL, INVALID_WIDTH, LEGACY_PAYLOAD.
  - Inverse commands record only changed shapes.
*/

const NOOP = {
  NO_CHANGE: 'NO_CHANGE',
  NO_TARGETS: 'NO_TARGETS',
  NO_TARGETS_UNLOCKED: 'NO_TARGETS_UNLOCKED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INVALID_COLOR: 'INVALID_COLOR',
  INVALID_FILL: 'INVALID_FILL',
  INVALID_WIDTH: 'INVALID_WIDTH',
  LEGACY_PAYLOAD: 'LEGACY_PAYLOAD'
};

function logNoop(cmdType, reason, meta = {}) {
  const level = reason === NOOP.LEGACY_PAYLOAD ? "WARN" : "INFO";
  log(level, `[commands-style] ${cmdType} no-op`, { reason, ...meta });
  return null;
}

function requestRender() {
  const c = getState().fabricCanvas;
  if (!c) return;
  if (typeof c.requestRenderAll === 'function') c.requestRenderAll();
  else c.renderAll();
}

export function isDrawableChild(obj) {
  return !!obj && !obj._isDiagnosticLabel && (
    obj.type === 'rect' ||
    obj.type === 'circle' ||
    obj.type === 'ellipse' ||
    obj.type === 'line'
  );
}

export function getFirstChildStroke(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(isDrawableChild);
  if (!child) return null;
  return ('stroke' in child) ? child.stroke : null;
}

export function getFirstChildFill(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(o =>
    isDrawableChild(o) && (o.type === 'rect' || o.type === 'circle' || o.type === 'ellipse')
  );
  if (!child) return null;
  return ('fill' in child) ? child.fill : null;
}

export function getFirstChildStrokeWidth(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(isDrawableChild);
  if (!child) return null;
  const w = Number(child.strokeWidth);
  return Number.isFinite(w) ? w : null;
}

/* ---------- Low-level apply helpers (per shape) ---------- */

export function applyStrokeColorToShape(shape, color) {
  if (!shape || shape.locked || !Array.isArray(shape._objects)) return;
  shape._objects.forEach(obj => {
    if (!isDrawableChild(obj)) return;
    if ('stroke' in obj) obj.set({ stroke: color });
    if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
    obj.objectCaching = false; obj.dirty = true;
    if (typeof obj.setCoords === 'function') { try { obj.setCoords(); } catch {} }
  });
  shape.objectCaching = false; shape.dirty = true;
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}

export function applyFillColorToShape(shape, rgba) {
  if (!shape || shape.locked || shape._type === 'point' || !Array.isArray(shape._objects)) return;
  shape._objects.forEach(obj => {
    if (!isDrawableChild(obj)) return;
    if (obj.type === 'line') return;
    if ('fill' in obj) obj.set({ fill: rgba });
    obj.objectCaching = false; obj.dirty = true;
    if (typeof obj.setCoords === 'function') { try { obj.setCoords(); } catch {} }
  });
  shape.objectCaching = false; shape.dirty = true;
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}

export function applyStrokeWidthToShape(shape, width) {
  if (!shape || shape.locked || !Array.isArray(shape._objects)) return;
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return;
  shape._objects.forEach(obj => {
    if (!isDrawableChild(obj)) return;
    if ('strokeWidth' in obj) obj.set({ strokeWidth: w });
    if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
    obj.objectCaching = false; obj.dirty = true;
    if (typeof obj.setCoords === 'function') { try { obj.setCoords(); } catch {} }
  });
  shape.objectCaching = false; shape.dirty = true;
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}

/* ---------- Normalized items[] only: validation ---------- */

function validateStrokeItems(payload) {
  if (!payload || !Array.isArray(payload.items)) return { valid: false, reason: NOOP.INVALID_PAYLOAD };
  if (payload.items.length === 0) return { valid: false, reason: NOOP.NO_TARGETS };
  for (const i of payload.items) {
    if (!i || i.id == null || typeof i.color !== 'string' || !i.color.trim()) {
      return { valid: false, reason: NOOP.INVALID_COLOR };
    }
  }
  return { valid: true };
}
function validateFillItems(payload) {
  if (!payload || !Array.isArray(payload.items)) return { valid: false, reason: NOOP.INVALID_PAYLOAD };
  if (payload.items.length === 0) return { valid: false, reason: NOOP.NO_TARGETS };
  for (const i of payload.items) {
    if (!i || i.id == null || typeof i.fill !== 'string' || !i.fill.trim()) {
      return { valid: false, reason: NOOP.INVALID_FILL };
    }
  }
  return { valid: true };
}
function validateWidthItems(payload) {
  if (!payload || !Array.isArray(payload.items)) return { valid: false, reason: NOOP.INVALID_PAYLOAD };
  if (payload.items.length === 0) return { valid: false, reason: NOOP.NO_TARGETS };
  for (const i of payload.items) {
    const w = Number(i?.width);
    if (!i || i.id == null || !Number.isFinite(w) || w <= 0) {
      return { valid: false, reason: NOOP.INVALID_WIDTH };
    }
  }
  return { valid: true };
}

/* ---------- Commands ---------- */

function cmdSetStrokeColor(payload) {
  if (payload && (payload.ids || payload.color)) {
    // Legacy form: reject with warning
    return logNoop('SET_STROKE_COLOR', NOOP.LEGACY_PAYLOAD, { legacy: true });
  }
  const { valid, reason } = validateStrokeItems(payload);
  if (!valid) return logNoop('SET_STROKE_COLOR', reason);

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const resolved = payload.items
    .map(r => {
      const s = shapesMap.get(r.id);
      return s ? { shape: s, color: r.color.trim() } : null;
    })
    .filter(Boolean);

  if (!resolved.length) return logNoop('SET_STROKE_COLOR', NOOP.NO_TARGETS);

  const unlocked = resolved.filter(r => !r.shape.locked);
  if (!unlocked.length) return logNoop('SET_STROKE_COLOR', NOOP.NO_TARGETS_UNLOCKED, { requested: resolved.length });

  const prev = [];
  let changed = 0;

  unlocked.forEach(({ shape, color }) => {
    const before = getFirstChildStroke(shape);
    if (before === color) return;
    prev.push({ id: shape._id, color: before });
    try { applyStrokeColorToShape(shape, color); changed++; } catch (e) {
      log("ERROR", "[commands-style] stroke apply failed", { id: shape._id, error: e });
    }
  });

  if (changed === 0) return logNoop('SET_STROKE_COLOR', NOOP.NO_CHANGE);

  requestRender();
  return { type: 'SET_STROKE_COLOR', payload: { items: prev } };
}

function cmdSetFillColor(payload) {
  if (payload && (payload.ids || payload.fill)) {
    return logNoop('SET_FILL_COLOR', NOOP.LEGACY_PAYLOAD, { legacy: true });
  }
  const { valid, reason } = validateFillItems(payload);
  if (!valid) return logNoop('SET_FILL_COLOR', reason);

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const resolved = payload.items
    .map(r => {
      const s = shapesMap.get(r.id);
      return s ? { shape: s, fill: r.fill.trim() } : null;
    })
    .filter(Boolean);

  if (!resolved.length) return logNoop('SET_FILL_COLOR', NOOP.NO_TARGETS);

  // Exclude points & locked shapes
  const unlocked = resolved.filter(r => !r.shape.locked && r.shape._type !== 'point');
  if (!unlocked.length) {
    const anyLocked = resolved.some(r => r.shape.locked);
    return logNoop('SET_FILL_COLOR',
      anyLocked ? NOOP.NO_TARGETS_UNLOCKED : NOOP.NO_TARGETS,
      { requested: resolved.length });
  }

  const prev = [];
  let changed = 0;

  unlocked.forEach(({ shape, fill }) => {
    const before = getFirstChildFill(shape);
    if (before === fill) return;
    prev.push({ id: shape._id, fill: before });
    try { applyFillColorToShape(shape, fill); changed++; } catch (e) {
      log("ERROR", "[commands-style] fill apply failed", { id: shape._id, error: e });
    }
  });

  if (changed === 0) return logNoop('SET_FILL_COLOR', NOOP.NO_CHANGE);

  requestRender();
  return { type: 'SET_FILL_COLOR', payload: { items: prev } };
}

function cmdSetStrokeWidth(payload) {
  if (payload && (payload.ids || payload.width)) {
    return logNoop('SET_STROKE_WIDTH', NOOP.LEGACY_PAYLOAD, { legacy: true });
  }
  const { valid, reason } = validateWidthItems(payload);
  if (!valid) return logNoop('SET_STROKE_WIDTH', reason);

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const resolved = payload.items
    .map(r => {
      const s = shapesMap.get(r.id);
      return s ? { shape: s, width: Number(r.width) } : null;
    })
    .filter(Boolean);

  if (!resolved.length) return logNoop('SET_STROKE_WIDTH', NOOP.NO_TARGETS);

  const unlocked = resolved.filter(r => !r.shape.locked);
  if (!unlocked.length) return logNoop('SET_STROKE_WIDTH', NOOP.NO_TARGETS_UNLOCKED, { requested: resolved.length });

  const prev = [];
  let changed = 0;

  unlocked.forEach(({ shape, width }) => {
    const before = getFirstChildStrokeWidth(shape);
    if (before === width) return;
    prev.push({ id: shape._id, width: before });
    try { applyStrokeWidthToShape(shape, width); changed++; } catch (e) {
      log("ERROR", "[commands-style] stroke width apply failed", { id: shape._id, error: e });
    }
  });

  if (changed === 0) return logNoop('SET_STROKE_WIDTH', NOOP.NO_CHANGE);

  requestRender();
  return { type: 'SET_STROKE_WIDTH', payload: { items: prev } };
}

/* ---------- Dispatcher ---------- */

export function executeStyleCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') return null;
  const p = cmd.payload || {};
  switch (cmd.type) {
    case 'SET_STROKE_COLOR': return cmdSetStrokeColor(p);
    case 'SET_FILL_COLOR': return cmdSetFillColor(p);
    case 'SET_STROKE_WIDTH': return cmdSetStrokeWidth(p);
    default: return null;
  }
}
