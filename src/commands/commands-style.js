import { log } from '../log.js';
import { getState } from '../state.js';

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
  return !!obj && !obj._isDiagnosticLabel && (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse' || obj.type === 'line');
}

export function getFirstChildStroke(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(isDrawableChild);
  if (!child) return null;
  return ('stroke' in child) ? child.stroke : null;
}

export function getFirstChildFill(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(o => isDrawableChild(o) && (o.type === 'rect' || o.type === 'circle' || o.type === 'ellipse'));
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
    if (!ids.length || !color) return null;
    targets = getShapesByIds(ids).filter(s => s && !s.locked).map(s => ({ shape: s, color }));
  }
  if (!targets.length) return null;

  const prev = [];
  targets.forEach(({ shape, color: c }) => {
    try {
      const before = getFirstChildStroke(shape);
      prev.push({ id: shape._id, color: before });
      applyStrokeColorToShape(shape, c);
    } catch (e) { log("ERROR", "[commands-style] stroke apply failed", e); }
  });

  requestRender();
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
    if (!ids.length || !fill) return null;
    targets = getShapesByIds(ids).filter(s => s && !s.locked && s._type !== 'point').map(s => ({ shape: s, fill }));
  }
  if (!targets.length) return null;

  const prev = [];
  targets.forEach(({ shape, fill: f }) => {
    try {
      const before = getFirstChildFill(shape);
      prev.push({ id: shape._id, fill: before });
      applyFillColorToShape(shape, f);
    } catch (e) { log("ERROR", "[commands-style] fill apply failed", e); }
  });

  requestRender();
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
    if (!ids.length || !Number.isFinite(width) || width <= 0) return null;
    targets = getShapesByIds(ids).filter(s => s && !s.locked).map(s => ({ shape: s, width }));
  }
  if (!targets.length) return null;

  const prev = [];
  targets.forEach(({ shape, width: w }) => {
    try {
      const before = getFirstChildStrokeWidth(shape);
      prev.push({ id: shape._id, width: before });
      applyStrokeWidthToShape(shape, w);
    } catch (e) { log("ERROR", "[commands-style] stroke width apply failed", e); }
  });

  requestRender();
  return { type: 'SET_STROKE_WIDTH', payload: { items: prev } };
}

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
