import { log } from '../log.js';
import { getState, setShapes, setImage } from '../state.js';
import { makePointShape, makeRectShape, makeCircleShape, makeEllipseShape } from '../shapes.js';
import {
  applyStrokeColorToShape,
  applyFillColorToShape,
  applyStrokeWidthToShape
} from '../commands/commands-style.js';

function primaryDrawableChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  const priority = ['ellipse', 'circle', 'rect', 'line'];
  for (const t of priority) {
    const obj = group._objects.find(o => o && !o._isDiagnosticLabel && o.type === t);
    if (obj) return obj;
  }
  return group._objects.find(o => o && !o._isDiagnosticLabel) || null;
}

function readStyle(child) {
  if (!child) return { stroke: null, fill: null, strokeWidth: null };
  const stroke = typeof child.stroke === 'string' ? child.stroke : null;
  const fill = typeof child.fill === 'string' ? child.fill : null;
  const sw = Number(child.strokeWidth);
  const strokeWidth = Number.isFinite(sw) && sw > 0 ? sw : null;
  return { stroke, fill, strokeWidth };
}

function shapeToSerializable(shape) {
  if (!shape) return null;
  const type = shape._type || shape.type;
  const id = shape._id || null;
  const left = Number.isFinite(shape.left) ? shape.left : 0;
  const top = Number.isFinite(shape.top) ? shape.top : 0;
  const scaleX = Number.isFinite(shape.scaleX) ? shape.scaleX : 1;
  const scaleY = Number.isFinite(shape.scaleY) ? shape.scaleY : 1;
  const angle = Number.isFinite(shape.angle) ? shape.angle : 0;
  const locked = !!shape.locked;

  if (type === 'point') {
    return {
      id, type, locked,
      transform: { left, top, scaleX, scaleY, angle },
      base: { x: left, y: top },
      style: null
    };
  }

  const child = primaryDrawableChild(shape);
  const style = readStyle(child);

  if (type === 'rect') {
    const w = Number.isFinite(child?.width) ? Number(child.width) : 0;
    const h = Number.isFinite(child?.height) ? Number(child.height) : 0;
    return {
      id, type, locked,
      transform: { left, top, scaleX, scaleY, angle },
      base: { left, top, width: w, height: h },
      style
    };
  }

  if (type === 'circle') {
    const r = Number.isFinite(child?.radius) ? Number(child.radius) : 0;
    const cx = left + r;
    const cy = top + r;
    return {
      id, type, locked,
      transform: { left, top, scaleX, scaleY, angle },
      base: { cx, cy, r },
      style
    };
  }

  if (type === 'ellipse') {
    const rx = Number.isFinite(child?.rx) ? Number(child.rx) : 0;
    const ry = Number.isFinite(child?.ry) ? Number(child.ry) : 0;
    const cx = left + rx;
    const cy = top + ry;
    return {
      id, type, locked,
      transform: { left, top, scaleX, scaleY, angle },
      base: { cx, cy, rx, ry },
      style
    };
  }

  return {
    id, type: 'rect', locked,
    transform: { left, top, scaleX, scaleY, angle },
    base: { left, top, width: Number(child?.width) || 0, height: Number(child?.height) || 0 },
    style
  };
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
  if (typeof shape.setCoords === 'function') { try { shape.setCoords(); } catch {} }
}

function makeShapeFromSerializable(s) {
  if (!s || typeof s !== 'object') return null;
  const type = s.type;
  const t = s.transform || {};
  const style = s.style || null;

  let group = null;

  if (type === 'point') {
    group = makePointShape(s.base?.x ?? 0, s.base?.y ?? 0);
  } else if (type === 'rect') {
    const b = s.base || {};
    group = makeRectShape(Number(b.left) || 0, Number(b.top) || 0, Number(b.width) || 0, Number(b.height) || 0);
  } else if (type === 'circle') {
    const b = s.base || {};
    group = makeCircleShape(Number(b.cx) || 0, Number(b.cy) || 0, Number(b.r) || 0);
  } else if (type === 'ellipse') {
    const b = s.base || {};
    const rx = Number(b.rx) || 0;
    const ry = Number(b.ry) || 0;
    group = makeEllipseShape(Number(b.cx) || 0, Number(b.cy) || 0, rx * 2, ry * 2);
  } else {
    const b = s.base || {};
    group = makeRectShape(Number(b.left) || 0, Number(b.top) || 0, Number(b.width) || 0, Number(b.height) || 0);
  }

  if (!group) return null;

  if (s.id) group._id = s.id;

  try {
    const next = {};
    if (t.left !== undefined) next.left = Number(t.left) || 0;
    if (t.top !== undefined) next.top = Number(t.top) || 0;
    if (t.scaleX !== undefined) next.scaleX = Number(t.scaleX) || 1;
    if (t.scaleY !== undefined) next.scaleY = Number(t.scaleY) || 1;
    if (t.angle !== undefined) next.angle = Number(t.angle) || 0;
    group.set(next);
    if (typeof group.setCoords === 'function') { try { group.setCoords(); } catch {} }
  } catch {}

  try {
    if (style) {
      if (typeof style.stroke === 'string' && style.stroke) applyStrokeColorToShape(group, style.stroke);
      if (typeof style.fill === 'string' && style.fill && type !== 'point') applyFillColorToShape(group, style.fill);
      if (Number.isFinite(Number(style.strokeWidth)) && Number(style.strokeWidth) > 0) applyStrokeWidthToShape(group, Number(style.strokeWidth));
    }
  } catch {}

  applyLockFlags(group, !!s.locked);
  return group;
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

export function serializeScene() {
  const state = getState();
  const canvas = state.fabricCanvas;
  const width = canvas ? canvas.getWidth() : (state.settings?.canvasMaxWidth ?? 600);
  const height = canvas ? canvas.getHeight() : (state.settings?.canvasMaxHeight ?? 400);

  const shapes = (state.shapes || []).filter(Boolean).map(shapeToSerializable).filter(Boolean);

  const payload = {
    version: 1,
    canvas: { width, height },
    imageURL: state.imageURL || null,
    shapes
  };
  log("INFO", "[scene-io] Scene serialized", { shapeCount: shapes.length });
  return payload;
}

export async function deserializeScene(scene) {
  const data = typeof scene === 'string' ? JSON.parse(scene) : scene;
  if (!data || typeof data !== 'object') {
    log("ERROR", "[scene-io] Invalid scene payload");
    return { shapesLoaded: 0, imageSet: false };
  }

  const shapes = Array.isArray(data.shapes) ? data.shapes.map(makeShapeFromSerializable).filter(Boolean) : [];
  setShapes(shapes);

  let imageSet = false;
  if (data.imageURL && typeof data.imageURL === 'string') {
    try {
      const img = await loadImageElement(data.imageURL);
      setImage(data.imageURL, img);
      imageSet = true;
    } catch (e) {
      log("WARN", "[scene-io] Failed to load image from URL", { url: data.imageURL, error: e });
    }
  }

  log("INFO", "[scene-io] Scene deserialized", { shapesLoaded: shapes.length, imageSet });
  return { shapesLoaded: shapes.length, imageSet };
}

export function exportSceneJSON(pretty = true) {
  const obj = serializeScene();
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

export async function importSceneJSON(json) {
  const obj = JSON.parse(json);
  return await deserializeScene(obj);
}
