/**
 * geometry/selection-rects.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Selection Geometry Utilities (ESM ONLY, Phase 1)
 * Purpose:
 * - Provide a single source for absolute bounding rects, hulls, and per-member rects for selection.
 * - Handles ActiveSelection center-relative bounding box math (Fabric peculiarity).
 * - Used by overlays, alignment, selection logic, and future hit-testing.
 *
 * Exports:
 * - getAbsoluteRectsForSelection(selectedShapes, canvas) : Array<{left,top,width,height}>
 * - getSelectionHullRect(selectedShapes, canvas) : {left,top,width,height}
 * - getActiveSelectionMemberRects(canvas) : Array<{left,top,width,height}>
 * - getActiveSelectionHullRect(canvas) : {left,top,width,height}
 *
 * Dependencies:
 * - log.js
 *
 * Notes:
 * - When a Fabric ActiveSelection is present, member bounding boxes can be reported
 *   relative to the group's CENTER; this module composes true absolutes.
 * - All geometry values are normalized to 0.01px precision.
 * -----------------------------------------------------------
 */

import { log } from '../log.js';

/**
 * Safe bounding box getter: getBoundingRect(absolute, calc)
 */
function safeBBox(obj, absolute = true, calc = true) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    return obj.getBoundingRect(absolute, calc);
  } catch (e) {
    log("WARN", "[selection-rects] getBoundingRect failed", { absolute, calc, e });
    return null;
  }
}

/**
 * Normalize tiny fractional drift (Safari often returns 0.5px deltas).
 */
function norm(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const r = Math.round(n * 100) / 100; // keep to 0.01 precision
  const near = Math.round(r);
  return Math.abs(r - near) < 0.01 ? near : r;
}

/**
 * Get absolute bounding rects for selected shapes.
 * - If canvas has ActiveSelection, computes member rects using center anchoring.
 * - Otherwise, uses per-object getBoundingRect(true, true).
 * Returns array of {left, top, width, height}
 */
export function getAbsoluteRectsForSelection(selectedShapes, canvas) {
  if (!Array.isArray(selectedShapes) || selectedShapes.length === 0) return [];
  if (!canvas || typeof canvas.getActiveObject !== 'function') {
    // No canvas: fallback to per-object absolute bounding rects
    return selectedShapes.map(s => {
      const r = safeBBox(s, true, true);
      return r
        ? { left: norm(r.left), top: norm(r.top), width: norm(r.width), height: norm(r.height) }
        : null;
    }).filter(Boolean);
  }

  const active = canvas.getActiveObject();
  if (active && active.type === 'activeSelection' && Array.isArray(active._objects) && active._objects.length >= 2) {
    // Compose member rects using center anchoring
    try { if (typeof active.setCoords === 'function') active.setCoords(); } catch {}
    const activeAbs = safeBBox(active, true, true);
    if (!activeAbs) return [];
    const centerX = norm(activeAbs.left + activeAbs.width / 2);
    const centerY = norm(activeAbs.top + activeAbs.height / 2);

    return active._objects.map(m => {
      if (!m) return null;
      try { if (typeof m.setCoords === 'function') m.setCoords(); } catch {}
      const rel = safeBBox(m, false, true);
      if (!rel) return null;
      return {
        left: norm(centerX + rel.left),
        top: norm(centerY + rel.top),
        width: norm(rel.width),
        height: norm(rel.height)
      };
    }).filter(Boolean);
  } else {
    // No ActiveSelection: per-object absolutes
    return selectedShapes.map(s => {
      const r = safeBBox(s, true, true);
      return r
        ? { left: norm(r.left), top: norm(r.top), width: norm(r.width), height: norm(r.height) }
        : null;
    }).filter(Boolean);
  }
}

/**
 * Get outer hull bounding rect for selected shapes.
 * Returns {left, top, width, height}
 */
export function getSelectionHullRect(selectedShapes, canvas) {
  const rects = getAbsoluteRectsForSelection(selectedShapes, canvas);
  if (!rects.length) return null;
  const minLeft = Math.min(...rects.map(r => r.left));
  const minTop = Math.min(...rects.map(r => r.top));
  const maxRight = Math.max(...rects.map(r => r.left + r.width));
  const maxBottom = Math.max(...rects.map(r => r.top + r.height));
  return {
    left: norm(minLeft),
    top: norm(minTop),
    width: norm(maxRight - minLeft),
    height: norm(maxBottom - minTop)
  };
}

/**
 * For overlays: get absolute rects for current ActiveSelection members.
 */
export function getActiveSelectionMemberRects(canvas) {
  if (!canvas || typeof canvas.getActiveObject !== 'function') return [];
  const active = canvas.getActiveObject();
  if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects)) return [];
  try { if (typeof active.setCoords === 'function') active.setCoords(); } catch {}
  const activeAbs = safeBBox(active, true, true);
  if (!activeAbs) return [];
  const centerX = norm(activeAbs.left + activeAbs.width / 2);
  const centerY = norm(activeAbs.top + activeAbs.height / 2);

  return active._objects.map(m => {
    if (!m) return null;
    try { if (typeof m.setCoords === 'function') m.setCoords(); } catch {}
    const rel = safeBBox(m, false, true);
    if (!rel) return null;
    return {
      left: norm(centerX + rel.left),
      top: norm(centerY + rel.top),
      width: norm(rel.width),
      height: norm(rel.height)
    };
  }).filter(Boolean);
}

/**
 * Get hull rect for current ActiveSelection (for overlay painter).
 */
export function getActiveSelectionHullRect(canvas) {
  const rects = getActiveSelectionMemberRects(canvas);
  if (!rects.length) return null;
  const minLeft = Math.min(...rects.map(r => r.left));
  const minTop = Math.min(...rects.map(r => r.top));
  const maxRight = Math.max(...rects.map(r => r.left + r.width));
  const maxBottom = Math.max(...rects.map(r => r.top + r.height));
  return {
    left: norm(minLeft),
    top: norm(minTop),
    width: norm(maxRight - minLeft),
    height: norm(maxBottom - minTop)
  };
}

