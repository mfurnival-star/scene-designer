/**
 * canvas-events.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Selection Event Sync (ESM ONLY)
 * Purpose:
 * - Listen to Fabric canvas selection lifecycle events and keep the app store
 *   (selection.js) in sync with what the user visually selected.
 * - Fix for defect1: ensures Delete operates on the shape that is visibly selected.
 * - Prevent re-entrant loops with programmatic selection changes.
 *
 * Exports:
 * - installFabricSelectionSync(canvas)
 *
 * Dependencies:
 * - log.js (logging)
 * - state.js (getState)
 * - selection.js (setSelectedShapes, deselectAll)
 *
 * Notes:
 * - Uses Fabric events: 'selection:created', 'selection:updated', 'selection:cleared'.
 * - Avoids namespaced event names (not supported by Fabric).
 * - Guards against no-op loops by comparing selected IDs before mutating store.
 * - Suppresses handling when changes are programmatic (to avoid event feedback loops).
 * - Ignores 'selection:cleared' if not triggered by a user event (opt.e is falsy).
 * - NEW: Clears selection when clicking the background (mouse:down with no target).
 * - NEW (2025-09-23): Robustly unwrap ActiveSelection so marquee multi-select enables toolbar buttons.
 */

import { log } from './log.js';
import { getState } from './state.js';
import { setSelectedShapes as selectionSetSelectedShapes, deselectAll } from './selection.js';

/**
 * Internal re-entrancy guard: when we mutate selection programmatically,
 * Fabric can emit selection events. We suppress handling while the mutation runs.
 */
let suppressHandlers = false;
function withSuppressedHandlers(fn, tag = "") {
  suppressHandlers = true;
  try {
    fn();
  } finally {
    suppressHandlers = false;
    if (tag) log("DEBUG", "[canvas-events] Exited suppressed section", { tag });
  }
}

/**
 * Utility: Convert Fabric selection state to an array of selected member objects.
 * - Always unwrap ActiveSelection to its _objects (members) when present.
 * - Falls back to options.selected / options.target.
 */
function getSelectedObjectsFromFabric(canvas, options) {
  try {
    const active = canvas && typeof canvas.getActiveObject === 'function'
      ? canvas.getActiveObject()
      : null;

    // If we have an ActiveSelection, always return its members
    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      return active._objects.slice(); // clone for safety
    }

    if (canvas && typeof canvas.getActiveObjects === 'function') {
      const objs = canvas.getActiveObjects() || [];
      if (Array.isArray(objs) && objs.length === 1 && objs[0] && objs[0].type === 'activeSelection') {
        const sel = objs[0];
        if (Array.isArray(sel._objects)) return sel._objects.slice();
      }
      return Array.isArray(objs) ? objs : (objs ? [objs] : []);
    }

    if (options && Array.isArray(options.selected) && options.selected.length) {
      // Some builds provide members directly here
      const arr = options.selected;
      // If this happens to be [ActiveSelection], unwrap
      if (arr.length === 1 && arr[0] && arr[0].type === 'activeSelection' && Array.isArray(arr[0]._objects)) {
        return arr[0]._objects.slice();
      }
      return arr;
    }

    if (options && options.target) {
      // Single target case
      const t = options.target;
      if (t && t.type === 'activeSelection' && Array.isArray(t._objects)) {
        return t._objects.slice();
      }
      return [t];
    }
  } catch (e) {
    log("ERROR", "[canvas-events] getSelectedObjectsFromFabric error", e);
  }
  return [];
}

/**
 * Utility: compare two arrays of ids for strict equality (order-insensitive).
 */
function sameIdSet(aIds, bIds) {
  if (aIds.length !== bIds.length) return false;
  const a = [...aIds].sort();
  const b = [...bIds].sort();
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Attach Fabric canvas selection sync handlers.
 * Calling this multiple times is safe; existing handlers are removed first.
 */
export function installFabricSelectionSync(canvas) {
  if (!canvas) {
    log("ERROR", "[canvas-events] installFabricSelectionSync: canvas is null/undefined");
    return;
  }

  // Remove any prior handlers to avoid duplicate firings on rebuild/hot-reload
  canvas.off('selection:created');
  canvas.off('selection:updated');
  canvas.off('selection:cleared');
  // NEW: also normalize mouse:down listener
  canvas.off('mouse:down');

  const onCreated = (opt) => {
    if (suppressHandlers) {
      log("DEBUG", "[canvas-events] selection:created suppressed");
      return;
    }
    const selObjs = getSelectedObjectsFromFabric(canvas, opt);
    const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
    const prevIds = (getState().selectedShapes || []).map(s => s._id);

    log("DEBUG", "[canvas-events] selection:created", {
      fabricSelectedCount: selObjs.length,
      nextIds,
      prevIds
    });

    if (sameIdSet(nextIds, prevIds)) {
      log("DEBUG", "[canvas-events] selection:created no-op (ids match)");
      return;
    }
    withSuppressedHandlers(() => selectionSetSelectedShapes(selObjs), "created->setSelectedShapes");
  };

  const onUpdated = (opt) => {
    if (suppressHandlers) {
      log("DEBUG", "[canvas-events] selection:updated suppressed");
      return;
    }
    const selObjs = getSelectedObjectsFromFabric(canvas, opt);
    const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
    const prevIds = (getState().selectedShapes || []).map(s => s._id);

    log("DEBUG", "[canvas-events] selection:updated", {
      fabricSelectedCount: selObjs.length,
      nextIds,
      prevIds
    });

    if (sameIdSet(nextIds, prevIds)) {
      log("DEBUG", "[canvas-events] selection:updated no-op (ids match)");
      return;
    }
    withSuppressedHandlers(() => selectionSetSelectedShapes(selObjs), "updated->setSelectedShapes");
  };

  const onCleared = (opt) => {
    if (suppressHandlers) {
      log("DEBUG", "[canvas-events] selection:cleared suppressed");
      return;
    }
    // Heuristic: If 'cleared' originated from programmatic discardActiveObject(),
    // Fabric does not include an original pointer event (opt.e). Ignore in that case.
    const isUserEvent = !!(opt && opt.e);
    const hadSelection = (getState().selectedShapes || []).length > 0;

    log("DEBUG", "[canvas-events] selection:cleared", { isUserEvent, hadSelection });

    if (!isUserEvent) {
      log("DEBUG", "[canvas-events] selection:cleared ignored (programmatic)");
      return;
    }
    if (!hadSelection) {
      log("DEBUG", "[canvas-events] selection:cleared no-op (already none selected)");
      return;
    }
    withSuppressedHandlers(() => deselectAll(), "cleared->deselectAll");
  };

  /**
   * Clear selection when clicking on background (blank area).
   */
  const onMouseDown = (opt) => {
    try {
      if (suppressHandlers) return;
      const hadSelection = (getState().selectedShapes || []).length > 0;
      const clickedBlank = !opt?.target;
      if (hadSelection && clickedBlank) {
        log("DEBUG", "[canvas-events] mouse:down on blank area → clearing selection");
        withSuppressedHandlers(() => {
          if (typeof canvas.discardActiveObject === 'function') {
            try { canvas.discardActiveObject(); } catch {}
          }
          deselectAll();
        }, "mousedown-blank->deselectAll");
        if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
        else canvas.renderAll();
      }
    } catch (e) {
      log("ERROR", "[canvas-events] mouse:down handler error", e);
    }
  };

  canvas.on('selection:created', onCreated);
  canvas.on('selection:updated', onUpdated);
  canvas.on('selection:cleared', onCleared);
  canvas.on('mouse:down', onMouseDown);

  log("INFO", "[canvas-events] Fabric selection sync installed (created/updated/cleared handlers + blank-click clear + reentrancy guard + ActiveSelection unwrap)");
}

