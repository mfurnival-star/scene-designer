/**
 * geometry/shape-rect.js
 * -----------------------------------------------------------
 * Scene Designer – Unified Single-Shape Geometry Helpers (ESM ONLY)
 * Purpose:
 * - Provide ONE canonical way to obtain bounding box and derived geometry
 *   (center, aspect ratio, outer radius) for any individual shape/group.
 * - Replaces ad‑hoc mixes of:
 *      shape.width / shape.height
 *      child.radius * 2
 *      shape.getScaledWidth()/getScaledHeight()
 *      shape.getBoundingRect()
 * - Phase 1 Completion: canvas-constraints.js (single-shape clamping) and debug.js
 *   now consume these helpers instead of calling Fabric APIs directly.
 *
 * Exports:
 *   getShapeBoundingBox(shape) -> { left, top, width, height, source }
 *   getShapesBoundingBoxes(shapes) -> array of (bbox|null)
 *   getShapeCenter(shape) -> { x, y } | null
 *   getShapeAspectRatio(shape) -> number|null  (width / height)
 *   getShapeOuterRadius(shape) -> number|null  (circle: r, ellipse: max(rx,ry), else null)
 *
 * Design Notes:
 * - We treat all user-created shapes (rect/circle/ellipse/point) as Fabric Groups
 *   whose primary drawable is the first non-diagnostic child of type rect|circle|ellipse|line.
 * - We avoid getBoundingRect(true,true) for single shapes (except last-resort fallback),
 *   because it is more expensive and sensitive to viewport transforms.
 * - We include a 'source' string in the bbox to aid debugging (which branch produced it).
 * - Scaling: If a shape or its primary child has been scaled, we use
 *      getScaledWidth()/getScaledHeight() when present to reflect the rendered size.
 *   This keeps previews and undo/redo readiness consistent for future phases.
 *
 * Dependencies:
 * - log.js (log) – DEBUG / WARN level instrumentation (silent in prod if log level < Debug).
 * -----------------------------------------------------------
 */

import { log } from '../log.js';

/**
 * Internal: Identify the primary drawable object inside a group.
 * Skips diagnostic labels and invisible helper objects (like hit areas).
 */
function findPrimaryChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  // Prefer circle / ellipse / rect in that order (more specific first)
  const priority = ['ellipse', 'circle', 'rect', 'line'];
  for (const type of priority) {
    const obj = group._objects.find(o =>
      o &&
      !o._isDiagnosticLabel &&
      o.type === type
    );
    if (obj) return obj;
  }
  // Fallback: first non-diagnostic child
  return group._objects.find(o => o && !o._isDiagnosticLabel) || null;
}

/**
 * Get a stable numeric value if finite; else undefined.
 */
function finiteOrUndef(n) {
  return (Number.isFinite(n) ? n : undefined);
}

/**
 * Return the raw (unscaled) size for primitive child if possible.
 */
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

/**
 * getShapeBoundingBox(shape)
 * Unified bounding box (left/top already on the group) with width/height derived
 * without resorting to getBoundingRect() unless absolutely necessary.
 *
 * Returns: { left, top, width, height, source }
 *  - source notes which branch supplied width/height for diagnostics.
 */
export function getShapeBoundingBox(shape) {
  if (!shape) return null;
  try {
    const left = finiteOrUndef(shape.left) ?? 0;
    const top = finiteOrUndef(shape.top) ?? 0;

    // 1. Primary child path (recommended)
    const primary = findPrimaryChild(shape);
    if (primary) {
      // Use scaled width/height if available (reflects current visual size)
      const scaledW = (typeof primary.getScaledWidth === 'function')
        ? finiteOrUndef(primary.getScaledWidth())
        : undefined;
      const scaledH = (typeof primary.getScaledHeight === 'function')
        ? finiteOrUndef(primary.getScaledHeight())
        : undefined;

      // Raw fallback
      const raw = primitiveRawSize(primary);

      const width = scaledW ?? raw.w;
      const height = scaledH ?? raw.h;

      if (Number.isFinite(width) && Number.isFinite(height)) {
        return { left, top, width, height, source: 'primary-child' };
      }
    }

    // 2. Group scaled dimensions (Fabric group keeps track of these)
    const scaledGroupW = (typeof shape.getScaledWidth === 'function')
      ? finiteOrUndef(shape.getScaledWidth())
      : undefined;
    const scaledGroupH = (typeof shape.getScaledHeight === 'function')
      ? finiteOrUndef(shape.getScaledHeight())
      : undefined;
    if (Number.isFinite(scaledGroupW) && Number.isFinite(scaledGroupH)) {
      return { left, top, width: scaledGroupW, height: scaledGroupH, source: 'group-scaled' };
    }

    // 3. Direct width/height properties on the group
    if (Number.isFinite(shape.width) && Number.isFinite(shape.height)) {
      return { left, top, width: shape.width, height: shape.height, source: 'group-width-height' };
    }

    // 4. Last resort: Fabric boundingRect (more expensive, transform-sensitive)
    if (typeof shape.getBoundingRect === 'function') {
      try {
        const r = shape.getBoundingRect(true, true);
        if (r && Number.isFinite(r.width) && Number.isFinite(r.height)) {
          return {
            left,
            top,
            width: r.width,
            height: r.height,
            source: 'boundingRect-fallback'
          };
        }
      } catch (e) {
        log("WARN", "[geometry/shape-rect] getBoundingRect fallback failed", e);
      }
    }

    // 5. Total fallback: zero size (should not typically happen)
    return { left, top, width: 0, height: 0, source: 'fallback-zero' };
  } catch (e) {
    log("ERROR", "[geometry/shape-rect] getShapeBoundingBox error", e);
    return null;
  }
}

/**
 * Batch helper: get bboxes for an array of shapes (null entries if failing).
 */
export function getShapesBoundingBoxes(shapes) {
  if (!Array.isArray(shapes)) return [];
  return shapes.map(s => getShapeBoundingBox(s));
}

/**
 * Center of shape (bbox center). Returns { x, y } or null.
 */
export function getShapeCenter(shape) {
  const bbox = getShapeBoundingBox(shape);
  if (!bbox) return null;
  return {
    x: bbox.left + bbox.width / 2,
    y: bbox.top + bbox.height / 2
  };
}

/**
 * Aspect ratio (width / height) or null if height is 0 or bbox missing.
 */
export function getShapeAspectRatio(shape) {
  const bbox = getShapeBoundingBox(shape);
  if (!bbox) return null;
  if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.height === 0) return null;
  return bbox.width / bbox.height;
}

/**
 * For circle or ellipse groups: return outer radius (circle r, ellipse max(rx, ry)).
 * Returns null for other types.
 */
export function getShapeOuterRadius(shape) {
  if (!shape) return null;
  try {
    const primary = findPrimaryChild(shape);
    if (!primary) return null;
    if (primary.type === 'circle' && Number.isFinite(primary.radius)) {
      return primary.radius;
    }
    if (primary.type === 'ellipse' && Number.isFinite(primary.rx) && Number.isFinite(primary.ry)) {
      return Math.max(primary.rx, primary.ry);
    }
  } catch (e) {
    log("DEBUG", "[geometry/shape-rect] getShapeOuterRadius error (non-fatal)", e);
  }
  return null;
}

/* ---------- Debug Helpers (optional) ---------- */

/**
 * Produce a concise debug summary for a shape geometry (not used in core flow yet).
 */
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

