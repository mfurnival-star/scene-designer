import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';
import {
  getActiveSelectionMemberRects,
  getActiveSelectionHullRect
} from './geometry/selection-rects.js';

function getTopContext(canvas) {
  if (!canvas) return null;
  const ctx =
    canvas.contextTop ||
    (canvas.upperCanvasEl && canvas.upperCanvasEl.getContext && canvas.upperCanvasEl.getContext('2d')) ||
    (typeof canvas.getSelectionContext === 'function' ? canvas.getSelectionContext() : null);
  return ctx || null;
}

function getDpr(canvas) {
  try {
    if (typeof canvas.getRetinaScaling === 'function') return canvas.getRetinaScaling();
  } catch {}
  return (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
}

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

function getViewportTransform(canvas) {
  const vt = Array.isArray(canvas?.viewportTransform) ? canvas.viewportTransform : null;
  return vt && vt.length >= 6 ? vt : [1, 0, 0, 1, 0, 0];
}

function removeLegacyOutlineObjects(canvas) {
  try {
    const objs = canvas.getObjects() || [];
    const doomed = objs.filter(o => o && o._isSelectionOutline === true);
    if (doomed.length) {
      doomed.forEach(o => canvas.remove(o));
      log("INFO", "[selection-outlines] Removed legacy outline objects", { count: doomed.length });
    }
  } catch (e) {
    log("WARN", "[selection-outlines] Failed removing legacy outline objects", e);
  }
}

function strokeDashedRect(ctx, x, y, w, h, {
  color = '#2176ff',
  screenLinePx = 1.4,
  screenDashPx = [6, 4],
  dpr = 1,
  scale = 1
} = {}) {
  if (!ctx) return;
  const pxToCanvas = 1 / Math.max(0.0001, dpr * scale);
  const lineWidth = Math.max(0.75, screenLinePx) * pxToCanvas;
  const dash = (Array.isArray(screenDashPx) ? screenDashPx : [6, 4]).map(v => Math.max(0, Number(v) || 0) * pxToCanvas);

  ctx.save();
  try {
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    const xAligned = Math.round(x) === x ? x + (0.5 * pxToCanvas) : x;
    const yAligned = Math.round(y) === y ? y + (0.5 * pxToCanvas) : y;
    ctx.strokeRect(xAligned, yAligned, w, h);
  } finally {
    ctx.restore();
  }
}

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

function paintSelectionOutlines(canvas) {
  const ctx = getTopContext(canvas);
  if (!ctx) return;

  const show = getState()?.settings?.multiDragBox !== false;
  if (!show) return;

  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects) || active._objects.length <= 1) {
    return;
  }

  const anyLocked = active._objects.some(s => s && s.locked);
  const color = anyLocked ? '#e53935' : '#2176ff';

  const dpr = getDpr(canvas);
  const scale = getScale(canvas);
  const vt = getViewportTransform(canvas);

  ctx.save();
  try {
    const a = (vt[0] || 1) * dpr;
    const b = (vt[1] || 0) * dpr;
    const c = (vt[2] || 0) * dpr;
    const d = (vt[3] || 1) * dpr;
    const e = (vt[4] || 0) * dpr;
    const f = (vt[5] || 0) * dpr;
    ctx.setTransform(a, b, c, d, e, f);

    const rects = getActiveSelectionMemberRects(canvas);
    if (!Array.isArray(rects) || rects.length === 0) return;

    for (const r of rects) {
      strokeDashedRect(ctx, r.left, r.top, r.width, r.height, {
        color,
        screenLinePx: 1.4,
        screenDashPx: [6, 4],
        dpr,
        scale
      });
    }

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
    log("ERROR", "[selection-outlines] Painter error", e);
  } finally {
    ctx.restore();
  }
}

export function installSelectionOutlines(canvas) {
  if (!canvas) {
    log("ERROR", "[selection-outlines] installSelectionOutlines: canvas is null/undefined");
    return () => {};
  }

  removeLegacyOutlineObjects(canvas);

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

  const painter = () => { paintSelectionOutlines(canvas); };

  canvas.on('before:render', clearTop);
  canvas.on('after:render', painter);

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

  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;
    if (
      details.type === 'setSettings' ||
      (details.type === 'setSetting' && details.key === 'multiDragBox')
    ) {
      onSelectionEvent();
    }
  });

  log("INFO", "[selection-outlines] Overlay installed");
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
      const ctx = getTopContext(canvas);
      if (ctx) {
        const dpr = getDpr(canvas);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.getWidth() * dpr, canvas.getHeight() * dpr);
        ctx.restore();
      }
      log("INFO", "[selection-outlines] Overlay detached");
    } catch (e) {
      log("ERROR", "[selection-outlines] Detach error", e);
    }
  };
}
