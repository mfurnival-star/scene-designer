/**
 * canvas-events.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Selection Event Sync (ESM ONLY)
 * Purpose:
 * - Listen to Fabric canvas selection lifecycle events and keep the app store
 *   (selection.js) in sync with what the user visually selected.
 * - Fix for defect1: ensures Delete operates on the shape that is visibly selected.
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
 * - Avoids namespaced event names like 'mouse:down.centralized' (not supported by Fabric).
 * - Guards against no-op loops by comparing selected IDs before mutating store.
 */

import { log } from './log.js';
import { getState } from './state.js';
import { setSelectedShapes as selectionSetSelectedShapes, deselectAll } from './selection.js';

/**
 * Utility: Normalize Fabric selection event into an array of selected objects.
 * Handles both single-object and multi-select (ActiveSelection) cases.
 */
function getSelectedObjectsFromFabric(canvas, options) {
  // Prefer Fabric's own accessor if available
  if (canvas && typeof canvas.getActiveObjects === 'function') {
    const objs = canvas.getActiveObjects() || [];
    return Array.isArray(objs) ? objs : (objs ? [objs] : []);
  }
  // Fallback to event payloads
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
    const selObjs = getSelectedObjectsFromFabric(canvas, opt);
    const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
    const prevIds = (getState().selectedShapes || []).map(s => s._id);

    log("DEBUG", "[canvas-events] selection:created", {
      fabricSelectedCount: selObjs.length,
      nextIds,
      prevIds
    });

    // No-op if selection already matches
    if (sameIdSet(nextIds, prevIds)) {
      log("TRACE", "[canvas-events] selection:created no-op (ids match)");
      return;
    }
    // Sync to selection.js (handles transformer + shape state)
    selectionSetSelectedShapes(selObjs);
  };

  const onUpdated = (opt) => {
    const selObjs = getSelectedObjectsFromFabric(canvas, opt);
    const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
    const prevIds = (getState().selectedShapes || []).map(s => s._id);

    log("DEBUG", "[canvas-events] selection:updated", {
      fabricSelectedCount: selObjs.length,
      nextIds,
      prevIds
    });

    if (sameIdSet(nextIds, prevIds)) {
      log("TRACE", "[canvas-events] selection:updated no-op (ids match)");
      return;
    }
    selectionSetSelectedShapes(selObjs);
  };

  const onCleared = (opt) => {
    const hadSelection = (getState().selectedShapes || []).length > 0;
    log("DEBUG", "[canvas-events] selection:cleared", { hadSelection });
    if (!hadSelection) {
      log("TRACE", "[canvas-events] selection:cleared no-op (already none selected)");
      return;
    }
    deselectAll();
  };

  canvas.on('selection:created', onCreated);
  canvas.on('selection:updated', onUpdated);
  canvas.on('selection:cleared', onCleared);

  log("INFO", "[canvas-events] Fabric selection sync installed (created/updated/cleared handlers)");
}
