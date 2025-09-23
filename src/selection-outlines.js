/**
 * selection-outlines.js
 * -----------------------------------------------------------
 * Scene Designer – Multi-select Outlines Overlay (ESM ONLY, Responsive/Zoom-Aware)
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
 * - Geometry for outlines is sourced from geometry/selection-rects.js (canvas coordinate space).
 * - Responsive/zoom-aware: outlines respect Fabric viewportTransform and retina scaling.
 *   Line widths and dash lengths stay visually consistent across zoom levels and DPRs.
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * - geometry/selection-rects.js (centralized geometry)
 * -----------------------------------------------------------
 */

import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';
import {
  getActiveSelectionMemberRects,
  getActiveSelectionHullRect
} from './geometry/selection-rects.js';

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
 * Current Fabric zoom (scale) from viewportTransform.
 */
function getScale(canvas) {
  try {
    if (typeof canvas.getZoom === 'function') {
      const z = canvas.getZoom();
      return Number.isFinite(z) && z > 0 ? z : 1;
    }
    const vt = Array.isArray(canvas.viewportTransform) ? canvas.viewportTransform : null;
    const sx = vt && Number.isFinite(vt[0]) ? vt[0] : 1;
    return sx || 1;
  } catch {
    return 1;
  }
}

/**
 * Viewport transform array [a, b, c, d, e, f] or identity.
 */
function getViewportTransform(canvas) {
  const vt = Array.isArray(canvas?.viewportTransform) ? canvas.viewportTransform : null;
  return vt && vt.length >= 6 ? vt : [1, 0, 0, 1, 0, 0];
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
 * Stroke a dashed rectangle with screen-px-consistent styling regardless of zoom/DPR.
 * - ctx is expected to be set to the combined transform already (DPR * viewportTransform).
 * - To keep a 1px screen line: lineWidthCanvas = 1 / (DPR * scale).
 */
function strokeDashedRect(ctx, x, y, w, h, {
  color = '#2176ff',
  screenLinePx = 1.4,
  screenDashPx = [6, 4],
  dpr = 1,
  scale = 1
} = {}) {
  if (!ctx) return;

  // Convert desired screen pixels to canvas units under the current transform (DPR * scale)
  const pxToCanvas = 1 / Math.max(0.0001, dpr * scale);
  const lineWidth = Math.max(0.75, screenLinePx) * pxToCanvas;
  const dash = (Array.isArray(screenDashPx) ? screenDashPx : [6, 4]).map(v => Math.max(0, Number(v) || 0) * pxToCanvas);

  ctx.save();
  try {
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    // Pixel-align for crispness when possible (in canvas units)
    const xAligned = Math.round(x) === x ? x + (0.5 * pxToCanvas) : x;
    const yAligned = Math.round(y) === y ? y + (0.5 * pxToCanvas) : y;

    ctx.strokeRect(xAligned, yAligned, w, h);
  } finally {
    ctx.restore();
  }
}

/**
 * Expand rect by padding expressed in screen pixels → converted to canvas units.
 */
function expandRectForScreenPadding(rect, screenPaddingPx, dpr, scale) {
  const pad = Number(screenPaddingPx) || 0;
  if (!rect || pad <= 0) return rect;
  const pxToCanvas = 1 / Math.max(0.0001, dpr * scale);
  const p = pad * pxToCanvas;
  return {
    left: rect.left - p,
    top: rect.top - p,
    width: rect.width + p * 2,
    height: rect.height + p * 2
  };
}

/**
 * Draw per-shape boxes and a single outer hull on top context.
 * Geometry from geometry/selection-rects.js (canvas coordinate space).
 * Applies combined transform (DPR * viewportTransform) so outlines follow zoom.
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
    return; // Nothing to overlay (single selection or no selection)
  }

  const anyLocked = active._objects.some(s => s && s.locked);
  const color = anyLocked ? '#e53935' : '#2176ff';

  const dpr = getDpr(canvas);
  const scale = getScale(canvas);
  const vt = getViewportTransform(canvas); // [a, b, c, d, e, f]

  ctx.save();
  try {
    // Reset to identity and apply combined transform explicitly to be deterministic.
    // This ensures we always know the units when computing line widths/dashes.
    // Combined = DPR * viewportTransform
    const a = (vt[0] || 1) * dpr;
    const b = (vt[1] || 0) * dpr;
    const c = (vt[2] || 0) * dpr;
    const d = (vt[3] || 1) * dpr;
    const e = (vt[4] || 0) * dpr;
    const f = (vt[5] || 0) * dpr;
    ctx.setTransform(a, b, c, d, e, f);

    // Use centralized geometry utility (canvas-space rects)
    const rects = getActiveSelectionMemberRects(canvas);
    if (!Array.isArray(rects) || rects.length === 0) return;

    // Draw per-member boxes (keep dashes/line widths visually consistent)
    for (const r of rects) {
      strokeDashedRect(ctx, r.left, r.top, r.width, r.height, {
        color,
        screenLinePx: 1.4,
        screenDashPx: [6, 4],
        dpr,
        scale
      });
    }

    // Draw outer hull with a slightly thicker stroke and padded by 4 screen px
    const hull = getActiveSelectionHullRect(canvas);
    if (hull) {
      const paddedHull = expandRectForScreenPadding(hull, 4, dpr, scale);
      strokeDashedRect(ctx, paddedHull.left, paddedHull.top, paddedHull.width, paddedHull.height, {
        color,
        screenLinePx: 2,
        screenDashPx: [8, 6],
        dpr,
        scale
      });
    }
  } catch (e) {
    log("ERROR", "[selection-outlines] Painter error in after:render", e);
  } finally {
    ctx.restore();
  }
}

/**
 * Install overlay painter and selection change triggers.
 * - Clears in before:render at identity in device pixels.
 * - Paints in after:render with DPR*viewportTransform applied.
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
    paintSelectionOutlines(canvas);
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

  log("INFO", "[selection-outlines] Overlay selection outlines installed (zoom/DPR-aware)");
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

