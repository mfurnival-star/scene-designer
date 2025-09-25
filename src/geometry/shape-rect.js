import { log } from '../log.js';

function findPrimaryChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  const priority = ['ellipse', 'circle', 'rect', 'line'];
  for (const type of priority) {
    const obj = group._objects.find(o => o && !o._isDiagnosticLabel && o.type === type);
    if (obj) return obj;
  }
  return group._objects.find(o => o && !o._isDiagnosticLabel) || null;
}

function finiteOrUndef(n) {
  return (Number.isFinite(n) ? n : undefined);
}

function primitiveRawSize(obj) {
  if (!obj) return { w: undefined, h: undefined };
  if (obj.type === 'circle' && Number.isFinite(obj.radius)) {
    return { w: obj.radius * 2, h: obj.radius * 2 };
  }
  if (obj.type === 'ellipse' && Number.isFinite(obj.rx) && Number.isFinite(obj.ry)) {
    return { w: obj.rx * 2, h: obj.ry * 2 };
  }
  if (Number.isFinite(obj.width) && Number.isFinite(obj.height)) {
    return { w: obj.width, h: obj.height };
  }
  return { w: undefined, h: undefined };
}

export function getShapeBoundingBox(shape) {
  if (!shape) return null;
  try {
    const left = finiteOrUndef(shape.left) ?? 0;
    const top = finiteOrUndef(shape.top) ?? 0;

    const primary = findPrimaryChild(shape);
    if (primary) {
      const scaledW = (typeof primary.getScaledWidth === 'function') ? finiteOrUndef(primary.getScaledWidth()) : undefined;
      const scaledH = (typeof primary.getScaledHeight === 'function') ? finiteOrUndef(primary.getScaledHeight()) : undefined;
      const raw = primitiveRawSize(primary);
      const width = scaledW ?? raw.w;
      const height = scaledH ?? raw.h;
      if (Number.isFinite(width) && Number.isFinite(height)) {
        return { left, top, width, height, source: 'primary-child' };
      }
    }

    const scaledGroupW = (typeof shape.getScaledWidth === 'function') ? finiteOrUndef(shape.getScaledWidth()) : undefined;
    const scaledGroupH = (typeof shape.getScaledHeight === 'function') ? finiteOrUndef(shape.getScaledHeight()) : undefined;
    if (Number.isFinite(scaledGroupW) && Number.isFinite(scaledGroupH)) {
      return { left, top, width: scaledGroupW, height: scaledGroupH, source: 'group-scaled' };
    }

    if (Number.isFinite(shape.width) && Number.isFinite(shape.height)) {
      return { left, top, width: shape.width, height: shape.height, source: 'group-width-height' };
    }

    if (typeof shape.getBoundingRect === 'function') {
      try {
        const r = shape.getBoundingRect(true, true);
        if (r && Number.isFinite(r.width) && Number.isFinite(r.height)) {
          return { left, top, width: r.width, height: r.height, source: 'boundingRect-fallback' };
        }
      } catch (e) {
        log("WARN", "[geometry/shape-rect] getBoundingRect fallback failed", e);
      }
    }

    return { left, top, width: 0, height: 0, source: 'fallback-zero' };
  } catch (e) {
    log("ERROR", "[geometry/shape-rect] getShapeBoundingBox error", e);
    return null;
  }
}

export function getShapesBoundingBoxes(shapes) {
  if (!Array.isArray(shapes)) return [];
  return shapes.map(s => getShapeBoundingBox(s));
}

export function getShapeCenter(shape) {
  const bbox = getShapeBoundingBox(shape);
  if (!bbox) return null;
  return { x: bbox.left + bbox.width / 2, y: bbox.top + bbox.height / 2 };
}

export function getShapeAspectRatio(shape) {
  const bbox = getShapeBoundingBox(shape);
  if (!bbox) return null;
  if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.height === 0) return null;
  return bbox.width / bbox.height;
}

export function getShapeOuterRadius(shape) {
  if (!shape) return null;
  try {
    const primary = findPrimaryChild(shape);
    if (!primary) return null;
    if (primary.type === 'circle' && Number.isFinite(primary.radius)) return primary.radius;
    if (primary.type === 'ellipse' && Number.isFinite(primary.rx) && Number.isFinite(primary.ry)) {
      return Math.max(primary.rx, primary.ry);
    }
  } catch (e) {
    log("WARN", "[geometry/shape-rect] getShapeOuterRadius error", e);
  }
  return null;
}

export function summarizeShapeGeometry(shape) {
  const bbox = getShapeBoundingBox(shape);
  return {
    id: shape?._id,
    type: shape?._type || shape?.type,
    bbox,
    center: getShapeCenter(shape),
    aspectRatio: getShapeAspectRatio(shape),
    outerRadius: getShapeOuterRadius(shape)
  };
}
