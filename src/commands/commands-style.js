import { log } from '../log.js';
import { getState } from '../state.js';

/*
  Batch 5: Authoritative validation + standardized no-op logging
  - Introduced reason codes + logNoop for consistent diagnostics.
  - Removed reliance on pre-filtering in actions layer (executors authoritative).
  - Inverses only record actually changed shapes (skip unchanged).
  - Supports both legacy payload forms (ids + value) and normalized items[] arrays.

  No-op Reason Codes:
    NO_CHANGE            → Resolved targets produced no effective mutation (already at requested value).
    NO_TARGETS           → No shapes resolved / no ids / empty selection.
    NO_TARGETS_UNLOCKED  → Shapes resolved but all are locked / ineligible.
    INVALID_PAYLOAD      → Structural payload invalid (missing fields, wrong types).
    INVALID_COLOR        → Color field missing / not a non-empty string.
    INVALID_FILL         → Fill field missing / not a non-empty string.
    INVALID_WIDTH        → Width missing / non-finite / <= 0.
*/

const NOOP = {
  NO_CHANGE: 'NO_CHANGE',
  NO_TARGETS: 'NO_TARGETS',
  NO_TARGETS_UNLOCKED: 'NO_TARGETS_UNLOCKED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  INVALID_COLOR: 'INVALID_COLOR',
  INVALID_FILL: 'INVALID_FILL',
  INVALID_WIDTH: 'INVALID_WIDTH'
};

function logNoop(cmdType, reason, meta = {}) {
  log("INFO", `[commands-style] ${cmdType} no-op`, { reason, ...meta });
  return null;
}

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

/* ---------- Normalization Helpers ---------- */

function normalizeStrokeTargets(payload) {
  // Returns { entries, reason? }
  if (payload?.items) {
    if (!Array.isArray(payload.items) || !payload.items.length) {
      return { entries: [], reason: NOOP.INVALID_PAYLOAD };
    }
    const rows = payload.items
      .filter(i => i && i.id != null && typeof i.color === 'string' && i.color.trim().length)
      .map(i => ({ id: i.id, color: i.color.trim() }));
    if (!rows.length) return { entries: [], reason: NOOP.INVALID_COLOR };
    return { entries: rows };
  }

  const ids = Array.isArray(payload?.ids) && payload.ids.length
    ? payload.ids
    : getSelectedIds();
  if (!ids.length) return { entries: [], reason: NOOP.NO_TARGETS };

  if (typeof payload?.color !== 'string' || !payload.color.trim()) {
    return { entries: [], reason: NOOP.INVALID_COLOR };
  }
  const color = payload.color.trim();
  return { entries: ids.map(id => ({ id, color })) };
}

function normalizeFillTargets(payload) {
  if (payload?.items) {
    if (!Array.isArray(payload.items) || !payload.items.length) {
      return { entries: [], reason: NOOP.INVALID_PAYLOAD };
    }
    const rows = payload.items
      .filter(i => i && i.id != null && typeof i.fill === 'string' && i.fill.trim().length)
      .map(i => ({ id: i.id, fill: i.fill.trim() }));
    if (!rows.length) return { entries: [], reason: NOOP.INVALID_FILL };
    return { entries: rows };
  }

  const ids = Array.isArray(payload?.ids) && payload.ids.length
    ? payload.ids
    : getSelectedIds();
  if (!ids.length) return { entries: [], reason: NOOP.NO_TARGETS };

  if (typeof payload?.fill !== 'string' || !payload.fill.trim()) {
    return { entries: [], reason: NOOP.INVALID_FILL };
  }
  const fill = payload.fill.trim();
  return { entries: ids.map(id => ({ id, fill })) };
}

function normalizeWidthTargets(payload) {
  if (payload?.items) {
    if (!Array.isArray(payload.items) || !payload.items.length) {
      return { entries: [], reason: NOOP.INVALID_PAYLOAD };
    }
    const rows = payload.items
      .filter(i => {
        if (!i || i.id == null) return false;
        const w = Number(i.width);
        return Number.isFinite(w) && w > 0;
      })
      .map(i => ({ id: i.id, width: Number(i.width) }));
    if (!rows.length) return { entries: [], reason: NOOP.INVALID_WIDTH };
    return { entries: rows };
  }

  const ids = Array.isArray(payload?.ids) && payload.ids.length
    ? payload.ids
    : getSelectedIds();
  if (!ids.length) return { entries: [], reason: NOOP.NO_TARGETS };

  const w = Number(payload?.width);
  if (!Number.isFinite(w) || w <= 0) {
    return { entries: [], reason: NOOP.INVALID_WIDTH };
  }
  return { entries: ids.map(id => ({ id, width: w })) };
}

/* ---------- Commands ---------- */

function cmdSetStrokeColor(payload) {
  const { entries, reason } = normalizeStrokeTargets(payload);
  if (reason === NOOP.NO_TARGETS) return logNoop('SET_STROKE_COLOR', reason);
  if (reason) return logNoop('SET_STROKE_COLOR', reason);

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const resolved = entries
    .map(r => {
      const s = shapesMap.get(r.id);
      return s ? { shape: s, color: r.color } : null;
    })
    .filter(Boolean);

  if (!resolved.length) return logNoop('SET_STROKE_COLOR', NOOP.NO_TARGETS);

  const unlocked = resolved.filter(r => !r.shape.locked);
  if (!unlocked.length) return logNoop('SET_STROKE_COLOR', NOOP.NO_TARGETS_UNLOCKED, { requested: resolved.length });

  const prev = [];
  let changed = 0;

  unlocked.forEach(({ shape, color }) => {
    const before = getFirstChildStroke(shape);
    if (before === color) return; // no effective change
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
  const { entries, reason } = normalizeFillTargets(payload);
  if (reason === NOOP.NO_TARGETS) return logNoop('SET_FILL_COLOR', reason);
  if (reason) return logNoop('SET_FILL_COLOR', reason);

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const resolved = entries
    .map(r => {
      const s = shapesMap.get(r.id);
      return s ? { shape: s, fill: r.fill } : null;
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
  const { entries, reason } = normalizeWidthTargets(payload);
  if (reason === NOOP.NO_TARGETS) return logNoop('SET_STROKE_WIDTH', reason);
  if (reason) return logNoop('SET_STROKE_WIDTH', reason);

  const shapesMap = new Map((getState().shapes || []).map(s => [s._id, s]));
  const resolved = entries
    .map(r => {
      const s = shapesMap.get(r.id);
      return s ? { shape: s, width: r.width } : null;
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
