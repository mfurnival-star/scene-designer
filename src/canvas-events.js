/**
 * canvas-events.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Selection Event Sync (ESM ONLY, PHASED ARCHITECTURE v1)
 * Purpose:
 * - Listen to Fabric canvas selection lifecycle events and keep the app store
 *   (selection.js) in sync with what the user visually selected.
 * - Transactional (tokenized) selection sync: eliminates reentrancy bugs.
 * - Fix for defect1: ensures Delete operates on the shape that is visibly selected.
 * - Prevent re-entrant loops with programmatic selection changes (token, not boolean).
 * - Ignores 'selection:cleared' if not triggered by a user event (opt.e is falsy), unless token matches.
 * - Clears selection when clicking the background (mouse:down with no target).
 * - Robustly unwraps ActiveSelection so marquee multi-select enables toolbar buttons.
 *
 * PHASE 1 FIX:
 * - Correctly unwrap ActiveSelection (Fabric) so that multi-select (marquee or ctrl+click)
 *   always sets selectedShapes to ALL selected shapes, not just the last one.
 */

import { log } from './log.js';
import { getState } from './state.js';
import { setSelectedShapes as selectionSetSelectedShapes, deselectAll } from './selection.js';

/**
 * Transactional selection sync token (phase 1): increment for every programmatic selection change.
 * - Each event handler receives the current token at the time of invocation.
 * - If the event was triggered by a programmatic change, it is stamped with the token, and handlers only act if tokens mismatch.
 */
let selectionSyncToken = 0;

function withSuppressedHandlers(fn, tag = "") {
  const token = ++selectionSyncToken;
  try {
    fn(token);
  } finally {
    if (tag) log("DEBUG", "[canvas-events] Exited suppressed section", { tag, token });
  }
}

/**
 * Utility: Convert Fabric selection state to an array of selected member objects.
 * - Always unwrap ActiveSelection to its _objects (members) when present.
 * - If the active is a group or a Fabric Group, unwrap its ._objects.
 * - If the active is a single shape, return just that.
 */
function getSelectedObjectsFromFabric(canvas, options) {
  try {
    const active = canvas && typeof canvas.getActiveObject === 'function'
      ? canvas.getActiveObject()
      : null;

    // Fabric >=4: ActiveSelection is type 'activeSelection'
    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      // Unwrap all member shapes
      return active._objects.slice(); // clone for safety
    }

    // Fabric's getActiveObjects returns all selected objects (groups or singles)
    if (canvas && typeof canvas.getActiveObjects === 'function') {
      const objs = canvas.getActiveObjects() || [];
      // If it's a group selection, unwrap the group's ._objects
      if (Array.isArray(objs) && objs.length === 1 && objs[0] && objs[0].type === 'activeSelection' && Array.isArray(objs[0]._objects)) {
        return objs[0]._objects.slice();
      }
      // For multiple selected shapes (not an ActiveSelection), return as is
      return Array.isArray(objs) ? objs : (objs ? [objs] : []);
    }

    // Some Fabric builds provide selected objects directly in options.selected
    if (options && Array.isArray(options.selected) && options.selected.length) {
      const arr = options.selected;
      // If it's a group selection, unwrap
      if (arr.length === 1 && arr[0] && arr[0].type === 'activeSelection' && Array.isArray(arr[0]._objects)) {
        return arr[0]._objects.slice();
      }
      return arr;
    }

    // If the event provided a target, check for group
    if (options && options.target) {
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
  canvas.off('mouse:down');

  // Store the token at which the last programmatic selection change was made
  let lastProgrammaticToken = 0;

  const onCreated = (opt) => {
    const eventToken = selectionSyncToken;
    // Suppress if this event is echoing a programmatic change (token unchanged since last set)
    if (eventToken === lastProgrammaticToken) {
      log("DEBUG", "[canvas-events] selection:created suppressed (token match)", { eventToken, lastProgrammaticToken });
      return;
    }
    const selObjs = getSelectedObjectsFromFabric(canvas, opt);
    const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
    const prevIds = (getState().selectedShapes || []).map(s => s._id);

    log("DEBUG", "[canvas-events] selection:created", {
      fabricSelectedCount: selObjs.length,
      nextIds,
      prevIds,
      eventToken,
      lastProgrammaticToken
    });

    if (sameIdSet(nextIds, prevIds)) {
      log("DEBUG", "[canvas-events] selection:created no-op (ids match)");
      return;
    }
    withSuppressedHandlers((token) => {
      selectionSetSelectedShapes(selObjs);
      lastProgrammaticToken = token;
    }, "created->setSelectedShapes");
  };

  const onUpdated = (opt) => {
    const eventToken = selectionSyncToken;
    if (eventToken === lastProgrammaticToken) {
      log("DEBUG", "[canvas-events] selection:updated suppressed (token match)", { eventToken, lastProgrammaticToken });
      return;
    }
    const selObjs = getSelectedObjectsFromFabric(canvas, opt);
    const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
    const prevIds = (getState().selectedShapes || []).map(s => s._id);

    log("DEBUG", "[canvas-events] selection:updated", {
      fabricSelectedCount: selObjs.length,
      nextIds,
      prevIds,
      eventToken,
      lastProgrammaticToken
    });

    if (sameIdSet(nextIds, prevIds)) {
      log("DEBUG", "[canvas-events] selection:updated no-op (ids match)");
      return;
    }
    withSuppressedHandlers((token) => {
      selectionSetSelectedShapes(selObjs);
      lastProgrammaticToken = token;
    }, "updated->setSelectedShapes");
  };

  const onCleared = (opt) => {
    const eventToken = selectionSyncToken;
    // Suppress if programmatic clear just happened (token match)
    if (eventToken === lastProgrammaticToken) {
      log("DEBUG", "[canvas-events] selection:cleared suppressed (token match)", { eventToken, lastProgrammaticToken });
      return;
    }
    // Heuristic: If 'cleared' originated from programmatic discardActiveObject(),
    // Fabric does not include an original pointer event (opt.e). Ignore in that case unless token changed.
    const isUserEvent = !!(opt && opt.e);
    const hadSelection = (getState().selectedShapes || []).length > 0;

    log("DEBUG", "[canvas-events] selection:cleared", { isUserEvent, hadSelection, eventToken, lastProgrammaticToken });

    if (!isUserEvent && eventToken === lastProgrammaticToken) {
      log("DEBUG", "[canvas-events] selection:cleared ignored (programmatic, token match)");
      return;
    }
    if (!hadSelection) {
      log("DEBUG", "[canvas-events] selection:cleared no-op (already none selected)");
      return;
    }
    withSuppressedHandlers((token) => {
      deselectAll();
      lastProgrammaticToken = token;
    }, "cleared->deselectAll");
  };

  /**
   * Clear selection when clicking on background (blank area).
   */
  const onMouseDown = (opt) => {
    try {
      const eventToken = selectionSyncToken;
      if (eventToken === lastProgrammaticToken) return;
      const hadSelection = (getState().selectedShapes || []).length > 0;
      const clickedBlank = !opt?.target;
      if (hadSelection && clickedBlank) {
        log("DEBUG", "[canvas-events] mouse:down on blank area → clearing selection", { eventToken });
        withSuppressedHandlers((token) => {
          if (typeof canvas.discardActiveObject === 'function') {
            try { canvas.discardActiveObject(); } catch {}
          }
          deselectAll();
          lastProgrammaticToken = token;
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

  log("INFO", "[canvas-events] Fabric selection sync installed (created/updated/cleared handlers + blank-click clear + tokenized sync + ActiveSelection unwrap)");
}


