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
 * - Clears overlay in 'before:render' (device pixels, identity transform).
 * - Paints overlays in 'after:render'.
 * - Only paints when:
 *    - Settings: Show Multi-Drag Box is enabled (settings.multiDragBox !== false), AND
 *    - A Fabric ActiveSelection exists with 2+ members.
 * - When ActiveSelection exists, some Fabric builds report member bounding boxes
 *   relative to the group CENTER. We compose absolute rects as:
 *     activeAbs = active.getBoundingRect(true, true)
 *     center = { x: activeAbs.left + activeAbs.width/2, y: activeAbs.top + activeAbs.height/2 }
 *     memberRel = member.getBoundingRect(false, true)
 *     memberAbs = { left: center.x + memberRel.left, top: center.y + memberRel.top, ... }
 * - Single selection is ignored (transformer UI handles it).
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * -----------------------------------------------------------
 */

import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';

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

function strokeDashedRect(ctx, x, y, w, h, { color = '#2176ff', lineWidth = 1.2, dash = [6, 4] } = {}) {
  if (!ctx) return;
  ctx.save();
  try { ctx.setLineDash(dash); } catch {}
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  // Pixel-align for crisp dashes when values are integers
  const px = Math.round(x) === x ? 0.5 : 0;
  const py = Math.round(y) === y ? 0.5 : 0;
  ctx.strokeRect(x + px, y + py, w, h);
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

// Safe wrapper around getBoundingRect
function safeBBox(obj, absolute, calc) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    return obj.getBoundingRect(absolute, calc);
  } catch (e) {
    log("WARN", "[selection-outlines] getBoundingRect failed", { absolute, calc, e });
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
 * Build absolute rects for members using ActiveSelection center anchoring.
 */
function collectMemberAbsoluteRectsFromActive(active) {
  const rects = [];
  if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects)) return rects;

  try { if (typeof active.setCoords === 'function') active.setCoords(); } catch {}
  const activeAbs = safeBBox(active, true, true);
  if (!activeAbs) return rects;

  const centerX = (activeAbs.left || 0) + (activeAbs.width || 0) / 2;
  const centerY = (activeAbs.top || 0) + (activeAbs.height || 0) / 2;

  for (const s of active._objects) {
    if (!s) continue;
    try { if (typeof s.setCoords === 'function') s.setCoords(); } catch {}
    const rel = safeBBox(s, false, true);
    if (!rel) continue;
    rects.push({
      left: norm(centerX + rel.left),
      top: norm(centerY + rel.top),
      width: norm(rel.width),
      height: norm(rel.height)
    });
  }
  return rects;
}

/**
 * Draw per-shape boxes and a single outer hull on top context.
 * IMPORTANT: Draw only if setting enabled and an ActiveSelection exists.
 */
function paintSelectionOutlines(canvas) {
  const ctx = getTopContext(canvas);
  if (!ctx) return;

  // Respect setting: Show Multi-Drag Box
  const show = getState()?.settings?.multiDragBox !== false;
  if (!show) return;

  // Only honor Fabric's current ActiveSelection. If none → nothing to paint.
  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects) || active._objects.length <= 1) {
    // Nothing to overlay (single selection or no selection)
    return;
  }

  const anyLocked = active._objects.some(s => s && s.locked);
  const color = anyLocked ? '#e53935' : '#2176ff';

  ctx.save();

  const rects = collectMemberAbsoluteRectsFromActive(active);
  if (rects.length === 0) {
    ctx.restore();
    return;
  }

  // Draw per-member boxes
  for (const r of rects) {
    strokeDashedRect(ctx, r.left, r.top, r.width, r.height, { color, lineWidth: 1.4, dash: [6, 4] });
  }

  // Draw outer hull
  const minLeft = Math.min(...rects.map(r => r.left));
  const minTop = Math.min(...rects.map(r => r.top));
  const maxRight = Math.max(...rects.map(r => r.left + r.width));
  const maxBottom = Math.max(...rects.map(r => r.top + r.height));
  const hull = expandRect(
    { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop },
    4
  );
  strokeDashedRect(ctx, hull.left, hull.top, hull.width, hull.height, { color, lineWidth: 2, dash: [8, 6] });

  ctx.restore();
}

/**
 * Install overlay painter and selection change triggers.
 * - Clears in before:render at identity in device pixels.
 * - Paints in after:render.
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
      // Reset to identity to clear in device pixels
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.restore();
    } catch (e) {
      log("WARN", "[selection-outlines] clearTop failed", e);
    }
  };

  // Draw our overlays after Fabric renders objects and marquee/controls
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

  // Also subscribe to store-driven settings changes that affect visibility
  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;
    if (
      details.type === 'setSettings' ||
      (details.type === 'setSetting' && details.key === 'multiDragBox')
    ) {
      onSelectionEvent();
    }
  });

  log("INFO", "[selection-outlines] Overlay selection outlines installed (ActiveSelection-only, honors multiDragBox)");
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

