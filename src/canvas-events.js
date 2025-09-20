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
 * Utility: Normalize Fabric selection event into an array of selected objects.
 * Handles both single-object and multi-select (ActiveSelection) cases.
 */
function getSelectedObjectsFromFabric(canvas, options) {
  if (canvas && typeof canvas.getActiveObjects === 'function') {
    const objs = canvas.getActiveObjects() || [];
    return Array.isArray(objs) ? objs : (objs ? [objs] : []);
  }
  if (options && Array.isArray(options.selected) && options.selected.length) {
    return options.selected;
  }
  if (options && options.target) {
    return [options.target];
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
    // Suppress re-entrant Fabric events caused by transformer attach/setActiveObject
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

  canvas.on('selection:created', onCreated);
  canvas.on('selection:updated', onUpdated);
  canvas.on('selection:cleared', onCleared);

  log("INFO", "[canvas-events] Fabric selection sync installed (created/updated/cleared handlers + reentrancy guard)");
}
