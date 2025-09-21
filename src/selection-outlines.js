/**
 * selection-outlines.js
 * -----------------------------------------------------------
 * Scene Designer – Multi-select Outlines Overlay (ESM ONLY)
 * Purpose:
 * - Draw dashed selection outlines as an overlay on Fabric's top canvas (no Fabric objects).
 * - Shows per-shape dashed boxes for multi-select and a single outer hull box.
 * - Colors:
 *    - Blue (#2176ff) for normal selections
 *    - Red (#e53935) if any selected shape is locked (both per-shape and hull)
 *
 * Public Exports:
 * - installSelectionOutlines(canvas) -> detachFn
 *
 * Behavior:
 * - Clears overlay in 'before:render' (DPR-aware).
 * - Paints overlays in 'after:render' each frame.
 * - Requests re-render on selection changes and during object moves.
 * - Hidden for single selection (single selection uses transformer UI).
 *
 * Notes:
 * - Computes screen-space rects by transforming aCoords with the current viewportTransform.
 * - Draws at identity transform in DEVICE PIXELS to avoid drift/offset on iOS/Safari.
 * - No business logic; pure paint/update.
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * - fabric-wrapper.js (default export for util.transformPoint, Point)
 * -----------------------------------------------------------
 */

import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';
import fabric from './fabric-wrapper.js';

/**
 * Obtain the overlay (top) 2D context for Fabric.
 */
function getTopContext(canvas) {
  if (!canvas) return null;
  const ctx =
    canvas.contextTop ||
    (canvas.upperCanvasEl && canvas.upperCanvasEl.getContext && canvas.upperCanvasEl.getContext('2d')) ||
    (typeof canvas.getSelectionContext === 'function' ? canvas.getSelectionContext() : null);
  return ctx || null;
}

/**
 * Device pixel ratio used by Fabric for upper canvas scaling.
 */
function getDpr(canvas) {
  try {
    if (typeof canvas.getRetinaScaling === 'function') return canvas.getRetinaScaling();
  } catch {}
  return (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
}

/**
 * Remove any legacy Fabric objects that were used for outlines previously.
 */
function removeLegacyOutlineObjects(canvas) {
  try {
    const objs = canvas.getObjects() || [];
    const doomed = objs.filter(o => o && o._isSelectionOutline === true);
    if (doomed.length) {
      doomed.forEach(o => canvas.remove(o));
      log("INFO", "[selection-outlines] Removed legacy outline Fabric objects", { count: doomed.length });
    }
  } catch (e) {
    log("WARN", "[selection-outlines] Failed to remove legacy outline objects", e);
  }
}

/**
 * Stroke a dashed rectangle at identity transform (expects DEVICE-PIXEL coordinates).
 */
function strokeDashedRect(ctx, x, y, w, h, { color = '#2176ff', lineWidth = 1, dash = [6, 4] } = {}) {
  if (!ctx) return;
  ctx.save();
  try { ctx.setLineDash(dash); } catch {}
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function expandRect(rect, padding) {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2
  };
}

/**
 * Transform object's aCoords through the current viewportTransform to SCREEN (CSS) coords,
 * then convert to DEVICE-PIXEL coords (multiply by DPR).
 * Returns {left, top, width, height} in DEVICE PIXELS.
 */
function rectFromACoordsInDevicePixels(obj, canvas, dpr) {
  if (!obj || !canvas) return null;

  try {
    if (typeof obj.setCoords === 'function') obj.setCoords();
    const a = obj.aCoords;
    if (!a || !a.tl || !a.tr || !a.bl || !a.br) return null;

    const vpt = canvas.viewportTransform || fabric.iMatrix;
    const tp = (pt) => {
      const p = new fabric.Point(pt.x, pt.y);
      const t = fabric.util.transformPoint(p, vpt);
      return { x: t.x, y: t.y };
    };

    const tl = tp(a.tl);
    const tr = tp(a.tr);
    const bl = tp(a.bl);
    const br = tp(a.br);

    const xs = [tl.x, tr.x, bl.x, br.x];
    const ys = [tl.y, tr.y, bl.y, br.y];

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    // Convert CSS px → device px and round to integers to avoid blurriness
    const L = Math.round(minX * dpr);
    const T = Math.round(minY * dpr);
    const W = Math.round((maxX - minX) * dpr);
    const H = Math.round((maxY - minY) * dpr);

    return { left: L, top: T, width: W, height: H };
  } catch (e) {
    log("WARN", "[selection-outlines] rectFromACoordsInDevicePixels failed", { id: obj?._id, e });
    return null;
  }
}

/**
 * Draw per-shape boxes and a single outer hull on top context (device-pixel space).
 */
function paintSelectionOutlines(canvas) {
  const ctx = getTopContext(canvas);
  if (!ctx) return;

  const state = getState();
  const selectedStore = state.selectedShapes || [];

  // Prefer current Fabric members if an ActiveSelection exists (keeps sync while dragging group)
  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  const members = (active && active.type === 'activeSelection' && Array.isArray(active._objects))
    ? active._objects
    : selectedStore;

  if (!Array.isArray(members) || members.length <= 1) {
    // Single or none: transformer handles single; nothing to overlay.
    return;
  }

  const anyLocked = members.some(s => s && s.locked);
  const color = anyLocked ? '#e53935' : '#2176ff';
  const showHull = state.settings?.multiDragBox !== false;

  // Draw in DEVICE PIXELS at identity transform
  const dpr = getDpr(canvas);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Build rects in device pixels from aCoords + viewportTransform
  const rects = [];
  for (const s of members) {
    if (!s) continue;
    const r = rectFromACoordsInDevicePixels(s, canvas, dpr);
    if (r) {
      rects.push(r);
      strokeDashedRect(ctx, r.left, r.top, r.width, r.height, { color, lineWidth: 1, dash: [5, 4] });
    }
  }

  if (showHull && rects.length > 0) {
    const pad = Math.round(4 * dpr);
    const minLeft = Math.min(...rects.map(r => r.left));
    const minTop = Math.min(...rects.map(r => r.top));
    const maxRight = Math.max(...rects.map(r => r.left + r.width));
    const maxBottom = Math.max(...rects.map(r => r.top + r.height));
    const hull = expandRect(
      { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop },
      pad
    );
    strokeDashedRect(ctx, hull.left, hull.top, hull.width, hull.height, { color, lineWidth: Math.max(1, Math.round(1 * dpr)), dash: [8, 6] });
  }

  ctx.restore();
}

/**
 * Install overlay painter and selection change triggers.
 * Clears in before:render (device pixels), paints in after:render.
 * Returns detach function.
 */
export function installSelectionOutlines(canvas) {
  if (!canvas) {
    log("ERROR", "[selection-outlines] installSelectionOutlines: canvas is null/undefined");
    return () => {};
  }

  // One-time cleanup for any legacy outline Fabric objects
  removeLegacyOutlineObjects(canvas);

  // Clear overlay fully (DEVICE PIXELS) before Fabric draws selection UI
  const clearTop = () => {
    try {
      const ctx = getTopContext(canvas);
      if (!ctx) return;
      const dpr = getDpr(canvas);
      const w = canvas.getWidth() * dpr;
      const h = canvas.getHeight() * dpr;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.restore();
    } catch (e) {
      log("WARN", "[selection-outlines] clearTop failed", e);
    }
  };

  const painter = () => {
    try {
      paintSelectionOutlines(canvas);
    } catch (e) {
      log("ERROR", "[selection-outlines] Painter error in after:render", e);
    }
  };

  // Bind hooks
  canvas.on('before:render', clearTop);
  canvas.on('after:render', painter);

  // Nudge renders when selection changes or objects move
  const onSelectionEvent = () => {
    try {
      if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
      else canvas.renderAll();
    } catch {}
  };
  canvas.on('selection:created', onSelectionEvent);
  canvas.on('selection:updated', onSelectionEvent);
  canvas.on('selection:cleared', onSelectionEvent);
  canvas.on('object:moving', onSelectionEvent);
  canvas.on('object:modified', onSelectionEvent);

  // Also subscribe to store to pick up settings changes or store-driven selection
  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;
    if (
      details.type === 'setSelectedShapes' ||
      details.type === 'setSettings' ||
      (details.type === 'setSetting' && details.key === 'multiDragBox')
    ) {
      onSelectionEvent();
    }
  });

  log("INFO", "[selection-outlines] Overlay selection outlines installed");
  return function detach() {
    try {
      canvas.off('before:render', clearTop);
      canvas.off('after:render', painter);
      canvas.off('selection:created', onSelectionEvent);
      canvas.off('selection:updated', onSelectionEvent);
      canvas.off('selection:cleared', onSelectionEvent);
      canvas.off('object:moving', onSelectionEvent);
      canvas.off('object:modified', onSelectionEvent);
      unsub && unsub();
      // Final clear of top context
      const ctx = getTopContext(canvas);
      if (ctx) {
        const dpr = getDpr(canvas);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.getWidth() * dpr, canvas.getHeight() * dpr);
        ctx.restore();
      }
      log("INFO", "[selection-outlines] Overlay selection outlines detached");
    } catch (e) {
      log("ERROR", "[selection-outlines] Detach error", e);
    }
  };
}

