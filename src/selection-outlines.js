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
 * - Clears overlay in 'before:render' in device pixels (identity transform).
 * - Paints overlays in 'after:render'.
 * - When an ActiveSelection exists, member aCoords are relative to the group's origin
 *   on some platforms; we anchor to the group's absolute top-left and offset members.
 * - Hidden for single selection (single selection uses transformer UI).
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
 * Axis-aligned rect from Fabric aCoords (robust even when grouped/rotated).
 * IMPORTANT: For members of an ActiveSelection on some platforms, these values are
 * relative to the group's origin (can be negative). We'll add a group offset if present.
 */
function rectFromACoords(a) {
  if (!a) return null;
  const xs = [a.tl?.x, a.tr?.x, a.bl?.x, a.br?.x].filter(n => typeof n === 'number');
  const ys = [a.tl?.y, a.tr?.y, a.bl?.y, a.br?.y].filter(n => typeof n === 'number');
  if (xs.length < 4 || ys.length < 4) return null;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Build absolute rects for members.
 * - If ActiveSelection is present:
 *    - Anchor to active.aCoords.tl (absolute)
 *    - Member aCoords are treated as relative; we add the group's tl to get absolute.
 * - Otherwise:
 *    - Use member aCoords directly (already absolute for single objects).
 */
function collectMemberAbsoluteRects(canvas, members) {
  const rects = [];

  // Determine if ActiveSelection exists and get its absolute top-left
  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  const isActiveSel = active && active.type === 'activeSelection';
  let groupTLx = 0, groupTLy = 0;

  if (isActiveSel) {
    try {
      if (typeof active.setCoords === 'function') active.setCoords();
    } catch {}
    // Prefer active.aCoords.tl (absolute)
    const aAC = active.aCoords;
    if (aAC && aAC.tl && typeof aAC.tl.x === 'number' && typeof aAC.tl.y === 'number') {
      groupTLx = aAC.tl.x;
      groupTLy = aAC.tl.y;
    } else {
      // Fallback: active.getBoundingRect(true, true)
      try {
        const b = active.getBoundingRect(true, true);
        groupTLx = b.left || 0;
        groupTLy = b.top || 0;
      } catch {}
    }
  }

  for (const s of members) {
    if (!s) continue;
    try {
      if (typeof s.setCoords === 'function') s.setCoords();
    } catch {}
    const r = rectFromACoords(s.aCoords);
    if (!r) continue;

    if (isActiveSel) {
      // Member rect is relative to group; convert to absolute by adding group's absolute TL
      const abs = {
        left: r.left + groupTLx,
        top: r.top + groupTLy,
        width: r.width,
        height: r.height
      };
      rects.push(abs);
    } else {
      // No active selection: aCoords are absolute
      rects.push(r);
    }
  }

  return rects;
}

/**
 * Draw per-shape boxes and a single outer hull on top context.
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

  ctx.save();
  // We deliberately do not override ctx transform here; Fabric draws upper canvas with its own transform.
  // The logs show identity VPT/DPR on your device; keeping as-is avoids double transforms.

  const rects = collectMemberAbsoluteRects(canvas, members);

  // Draw per-member boxes
  for (const r of rects) {
    strokeDashedRect(ctx, r.left, r.top, r.width, r.height, { color, lineWidth: 1.4, dash: [6, 4] });
  }

  // Draw outer hull
  if (showHull && rects.length > 0) {
    const minLeft = Math.min(...rects.map(r => r.left));
    const minTop = Math.min(...rects.map(r => r.top));
    const maxRight = Math.max(...rects.map(r => r.left + r.width));
    const maxBottom = Math.max(...rects.map(r => r.top + r.height));
    const hull = expandRect(
      { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop },
      4
    );
    strokeDashedRect(ctx, hull.left, hull.top, hull.width, hull.height, { color, lineWidth: 2, dash: [8, 6] });
  }

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

