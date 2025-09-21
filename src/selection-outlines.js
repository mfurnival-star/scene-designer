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
 * Diagnostics (temporary, runtime-togglable):
 * - Set in DevTools console without rebuild:
 *   - window.__OUTLINE_DEBUG = true   → draw all methods + emit detailed logs
 *   - window.__OUTLINE_METHOD = 'm1' | 'm2' | 'm3' (default 'm2')
 *     m1 = aCoords-based (canvas/object space)
 *     m2 = getBoundingRect(true, true) absolute rect
 *     m3 = getCoords(true) derived absolute corners
 *
 * Public Exports:
 * - installSelectionOutlines(canvas) -> detachFn
 *
 * Behavior:
 * - Clears overlay in 'before:render' in device pixels (identity transform).
 * - Paints overlays in 'after:render' using Fabric’s viewportTransform × retina scaling,
 *   then draws in canvas/object coordinates (for m1/m3). For m2, we draw in the same
 *   transform (the rects are absolute); visual comparison will tell us which aligns.
 * - Hidden for single selection (single selection uses transformer UI).
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * - fabric-wrapper.js (default export for version info if needed)
 * -----------------------------------------------------------
 */

import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';
import fabric from './fabric-wrapper.js';

/**
 * Runtime debug flags from window (safe access).
 */
function getDebugFlags() {
  let DEBUG = false;
  let METHOD = 'm2'; // default
  try {
    if (typeof window !== "undefined") {
      DEBUG = !!window.__OUTLINE_DEBUG;
      const m = window.__OUTLINE_METHOD;
      if (m === 'm1' || m === 'm2' || m === 'm3') METHOD = m;
    }
  } catch {}
  return { DEBUG, METHOD };
}

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
 * Stroke a dashed rectangle in the CURRENT context transform.
 */
function strokeDashedRect(ctx, x, y, w, h, { color = '#2176ff', lineWidth = 1.2, dash = [6, 4] } = {}) {
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
 * Method m1: Rect from object's aCoords in CANVAS OBJECT SPACE (pre-viewport).
 */
function rectFromACoords(obj) {
  if (!obj) return null;
  try {
    if (typeof obj.setCoords === 'function') obj.setCoords();
    const a = obj.aCoords;
    if (!a || !a.tl || !a.tr || !a.bl || !a.br) return null;
    const xs = [a.tl.x, a.tr.x, a.bl.x, a.br.x];
    const ys = [a.tl.y, a.tr.y, a.bl.y, a.br.y];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  } catch {
    return null;
  }
}

/**
 * Method m2: canvas-absolute bounding rect (include stroke + transforms).
 */
function rectFromBounding(obj) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    return obj.getBoundingRect(true, true);
  } catch {
    return null;
  }
}

/**
 * Method m3: rect from object's absolute corner points (getCoords(true)).
 */
function rectFromGetCoords(obj) {
  if (!obj || typeof obj.getCoords !== 'function') return null;
  try {
    const pts = obj.getCoords(true); // absolute
    if (!Array.isArray(pts) || pts.length === 0) return null;
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  } catch {
    return null;
  }
}

/**
 * Apply Fabric's viewportTransform and retina scaling to the top context,
 * so drawing in object/canvas coordinates aligns with what you see on screen.
 */
function applyViewportAndRetinaToTopContext(canvas, ctx) {
  const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
  const dpr = getDpr(canvas);
  ctx.setTransform(
    vpt[0] * dpr, vpt[1] * dpr,
    vpt[2] * dpr, vpt[3] * dpr,
    vpt[4] * dpr, vpt[5] * dpr
  );
}

/**
 * Draw per-shape boxes and a single outer hull on top context.
 */
function paintSelectionOutlines(canvas) {
  const ctx = getTopContext(canvas);
  if (!ctx) return;

  const { DEBUG, METHOD } = getDebugFlags();
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

  // Diagnostics: one-time per frame environment dump
  if (DEBUG) {
    try {
      const dpr = getDpr(canvas);
      const vpt = canvas.viewportTransform || [1,0,0,1,0,0];
      const uEl = canvas.upperCanvasEl;
      const lc = canvas.getContext && canvas.getContext();
      const upper = {
        width: uEl?.width, height: uEl?.height,
        styleW: uEl?.style?.width, styleH: uEl?.style?.height
      };
      const domTx = (typeof ctx.getTransform === 'function') ? ctx.getTransform() : null;
      log("DEBUG", "[selection-outlines][diag] frame", {
        fabricVersion: fabric?.version || 'unknown',
        methodInUse: METHOD,
        activeType: active?.type,
        dpr,
        vpt,
        upper,
        ctxTransform: domTx ? [domTx.a, domTx.b, domTx.c, domTx.d, domTx.e, domTx.f] : 'n/a'
      });
    } catch (e) {
      log("WARN", "[selection-outlines][diag] env dump failed", e);
    }
  }

  // We will draw with (viewport × retina) transform applied to ctx.
  ctx.save();
  applyViewportAndRetinaToTopContext(canvas, ctx);

  const rectsForHull = [];

  // Per-member drawing
  for (let idx = 0; idx < members.length; idx++) {
    const s = members[idx];
    if (!s) continue;

    // Compute all three methods
    const r1 = rectFromACoords(s);          // canvas/object space (pre-viewport)
    const r2 = rectFromBounding(s);         // absolute rect
    const r3 = rectFromGetCoords(s);        // absolute from corners

    if (DEBUG) {
      log("DEBUG", "[selection-outlines][diag] rects", {
        idx, id: s._id, type: s._type, locked: s.locked,
        r1_ac: r1, r2_bbox: r2, r3_coords: r3
      });
    }

    // Draw all methods if DEBUG (different colors) to compare visually
    if (DEBUG) {
      if (r1) strokeDashedRect(ctx, r1.left, r1.top, r1.width, r1.height, { color: '#2176ff', lineWidth: 1, dash: [5, 3] }); // blue
      if (r2) strokeDashedRect(ctx, r2.left, r2.top, r2.width, r2.height, { color: '#00c853', lineWidth: 1, dash: [4, 3] }); // green
      if (r3) strokeDashedRect(ctx, r3.left, r3.top, r3.width, r3.height, { color: '#ff9100', lineWidth: 1, dash: [4, 3] }); // orange
    }

    // Choose which to use for normal (non-debug) rendering
    let use = null;
    if (METHOD === 'm1') use = r1;
    else if (METHOD === 'm2') use = r2;
    else use = r3;

    if (!DEBUG) {
      const c = color; // normal color (blue or red)
      if (use) strokeDashedRect(ctx, use.left, use.top, use.width, use.height, { color: c, lineWidth: 1.4, dash: [6, 4] });
    }

    if (use) rectsForHull.push(use);
  }

  // Draw outer hull (based on chosen method rectangles)
  if (showHull && rectsForHull.length > 0) {
    const minLeft = Math.min(...rectsForHull.map(r => r.left));
    const minTop = Math.min(...rectsForHull.map(r => r.top));
    const maxRight = Math.max(...rectsForHull.map(r => r.left + r.width));
    const maxBottom = Math.max(...rectsForHull.map(r => r.top + r.height));
    const hull = expandRect(
      { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop },
      4
    );
    const hullColor = anyLocked ? '#e53935' : (DEBUG ? '#2962ff' : color);
    strokeDashedRect(ctx, hull.left, hull.top, hull.width, hull.height, { color: hullColor, lineWidth: 2, dash: [8, 6] });
  }

  ctx.restore();
}

/**
 * Install overlay painter and selection change triggers.
 * - Clears in before:render at identity in device pixels.
 * - Paints in after:render with explicit (viewport × retina) transform.
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

  // Bind hooks (avoid broad canvas.off() to not stomp others)
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

  log("INFO", "[selection-outlines] Overlay selection outlines installed (diagnostics enabled via window.__OUTLINE_DEBUG/__OUTLINE_METHOD)");
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
