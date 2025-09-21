/**
 * selection-outlines.js
 * -----------------------------------------------------------
 * Scene Designer – Multi-select Outlines Overlay (ESM ONLY)
 * Purpose:
 * - Draw dashed selection outlines as an overlay (on Fabric's top canvas),
 *   never as real Fabric objects. Prevents "ghost boxes" and keeps
 *   ActiveSelection hull behavior intact.
 * - Shows per-shape dashed boxes for multi-select and a single outer hull box.
 * - Colors:
 *    - Blue (#2176ff) for normal selections
 *    - Red (#e53935) if any selected shape is locked (both per-shape and hull)
 *
 * Public Exports:
 * - installSelectionOutlines(canvas) -> detachFn
 *
 * Behavior:
 * - Hooks into Fabric 'after:render' to paint overlays each frame.
 * - Requests re-render on selection changes and during object moves.
 * - Respects settings.multiDragBox (if false, draws only per-shape boxes; hull optional).
 * - Hidden for single selection (single selection uses transformer UI).
 *
 * Notes:
 * - Also removes any legacy Fabric outline objects flagged with _isSelectionOutline.
 * - No business logic; pure paint/update.
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * - Fabric.js canvas instance provided by caller
 * -----------------------------------------------------------
 */

import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';

/**
 * Obtain the overlay (top) 2D context for Fabric.
 */
function getTopContext(canvas) {
  if (!canvas) return null;
  // Fabric v2/3: upperCanvasEl; v4/5: contextTop exists
  const ctx =
    canvas.contextTop ||
    (canvas.upperCanvasEl && canvas.upperCanvasEl.getContext && canvas.upperCanvasEl.getContext('2d')) ||
    (typeof canvas.getSelectionContext === 'function' ? canvas.getSelectionContext() : null);
  return ctx || null;
}

/**
 * Remove any legacy Fabric objects that were used for outlines previously.
 * Guard against cloning/dup issues.
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

function strokeDashedRect(ctx, x, y, w, h, { color = '#2176ff', lineWidth = 1, dash = [6, 4] } = {}) {
  if (!ctx) return;
  ctx.save();
  try {
    ctx.setLineDash(dash);
  } catch {
    // Older browsers may not support; ignore
  }
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
 * Draw per-shape boxes and a single outer hull on top context.
 */
function paintSelectionOutlines(canvas) {
  const ctx = getTopContext(canvas);
  if (!ctx) return;

  const selected = getState().selectedShapes || [];
  if (!Array.isArray(selected) || selected.length <= 1) {
    // Single selection or none: clear overlay and exit (transformer handles single)
    ctx.clearRect(0, 0, canvas.getWidth(), canvas.getHeight());
    return;
  }

  const anyLocked = selected.some(s => s && s.locked);
  const color = anyLocked ? '#e53935' : '#2176ff';
  const showHull = getState().settings?.multiDragBox !== false;

  // Clear the top overlay before drawing
  ctx.clearRect(0, 0, canvas.getWidth(), canvas.getHeight());

  // Collect each shape's bounding rect (true, true => include stroke and transformations)
  const rects = [];
  selected.forEach(s => {
    if (!s || typeof s.getBoundingRect !== 'function') return;
    try {
      const r = s.getBoundingRect(true, true);
      rects.push(r);
      // Per-shape thin dashed
      strokeDashedRect(ctx, r.left, r.top, r.width, r.height, { color, lineWidth: 1, dash: [5, 4] });
    } catch (e) {
      log("WARN", "[selection-outlines] getBoundingRect failed for shape", { id: s?._id, type: s?._type, e });
    }
  });

  if (showHull && rects.length > 0) {
    // Compute outer hull; add small padding so it reads distinctly from inner boxes
    const pad = 4;
    const minLeft = Math.min(...rects.map(r => r.left));
    const minTop = Math.min(...rects.map(r => r.top));
    const maxRight = Math.max(...rects.map(r => r.left + r.width));
    const maxBottom = Math.max(...rects.map(r => r.top + r.height));
    const hull = expandRect(
      { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop },
      pad
    );
    // Outer hull thicker dashed
    strokeDashedRect(ctx, hull.left, hull.top, hull.width, hull.height, { color, lineWidth: 2, dash: [8, 6] });
  }
}

/**
 * Install overlay painter and selection change triggers.
 * Returns detach function.
 */
export function installSelectionOutlines(canvas) {
  if (!canvas) {
    log("ERROR", "[selection-outlines] installSelectionOutlines: canvas is null/undefined");
    return () => {};
  }

  // One-time cleanup for any legacy outline Fabric objects
  removeLegacyOutlineObjects(canvas);

  // Ensure top context exists at least once (Fabric sets it up after first render)
  // We'll still guard inside painter.
  const painter = () => {
    try {
      paintSelectionOutlines(canvas);
    } catch (e) {
      log("ERROR", "[selection-outlines] Painter error in after:render", e);
    }
  };

  // Bind after:render; remove existing handler if any (avoid dup on hot-reload)
  canvas.off('after:render');
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

  // Also subscribe to store to pick up settings changes (e.g., multiDragBox) or selection via store-only flows
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
      canvas.off('after:render', painter);
      canvas.off('selection:created', onSelectionEvent);
      canvas.off('selection:updated', onSelectionEvent);
      canvas.off('selection:cleared', onSelectionEvent);
      canvas.off('object:moving', onSelectionEvent);
      canvas.off('object:modified', onSelectionEvent);
      unsub && unsub();
      // Final clear of top context
      const ctx = getTopContext(canvas);
      if (ctx) ctx.clearRect(0, 0, canvas.getWidth(), canvas.getHeight());
      log("INFO", "[selection-outlines] Overlay selection outlines detached");
    } catch (e) {
      log("ERROR", "[selection-outlines] Detach error", e);
    }
  };
}
