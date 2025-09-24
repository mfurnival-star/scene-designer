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
 * - **2025-09-24**: Selection suppression logic updated:
 *      - Only suppress selection events if both token matches AND selected IDs match.
 *      - Always sync selection if IDs differ, no matter the token.
 * - **2025-09-24**: Added additional INFO-level logs to confirm handler registration and event firing.
 * - **2025-09-24**: DEBUG sweep, extra diagnostics for handler attachment, canvas instance, event payloads, selection states, and error cases.
 */

import { log } from './log.js';
import { getState } from './state.js';
import { setSelectedShapes as selectionSetSelectedShapes, deselectAll } from './selection.js';

// Transactional selection sync token (phase 1): increment for every programmatic selection change.
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
  log("DEBUG", "[canvas-events] getSelectedObjectsFromFabric ENTRY", { canvasInstance: canvas, options });
  try {
    const active = canvas && typeof canvas.getActiveObject === 'function'
      ? canvas.getActiveObject()
      : null;

    // Fabric >=4: ActiveSelection is type 'activeSelection'
    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      log("DEBUG", "[canvas-events] ActiveSelection detected", { activeObj: active, memberCount: active._objects.length });
      return active._objects.slice(); // clone for safety
    }

    // Fabric's getActiveObjects returns all selected objects (groups or singles)
    if (canvas && typeof canvas.getActiveObjects === 'function') {
      const objs = canvas.getActiveObjects() || [];
      // If it's a group selection, unwrap the group's ._objects
      if (Array.isArray(objs) && objs.length === 1 && objs[0] && objs[0].type === 'activeSelection' && Array.isArray(objs[0]._objects)) {
        log("DEBUG", "[canvas-events] getActiveObjects: group selection with ActiveSelection", { group: objs[0], memberCount: objs[0]._objects.length });
        return objs[0]._objects.slice();
      }
      // For multiple selected shapes (not an ActiveSelection), return as is
      log("DEBUG", "[canvas-events] getActiveObjects: returning objects", { count: objs.length });
      return Array.isArray(objs) ? objs : (objs ? [objs] : []);
    }

    // Some Fabric builds provide selected objects directly in options.selected
    if (options && Array.isArray(options.selected) && options.selected.length) {
      const arr = options.selected;
      // If it's a group selection, unwrap
      if (arr.length === 1 && arr[0] && arr[0].type === 'activeSelection' && Array.isArray(arr[0]._objects)) {
        log("DEBUG", "[canvas-events] options.selected: group selection with ActiveSelection", { group: arr[0], memberCount: arr[0]._objects.length });
        return arr[0]._objects.slice();
      }
      log("DEBUG", "[canvas-events] options.selected: returning array", { count: arr.length });
      return arr;
    }

    // If the event provided a target, check for group
    if (options && options.target) {
      const t = options.target;
      if (t && t.type === 'activeSelection' && Array.isArray(t._objects)) {
        log("DEBUG", "[canvas-events] options.target: ActiveSelection", { target: t, memberCount: t._objects.length });
        return t._objects.slice();
      }
      log("DEBUG", "[canvas-events] options.target: returning single", { target: t });
      return [t];
    }
  } catch (e) {
    log("ERROR", "[canvas-events] getSelectedObjectsFromFabric error", e);
  }
  log("DEBUG", "[canvas-events] getSelectedObjectsFromFabric EXIT (empty)");
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
  log("INFO", "[canvas-events] installFabricSelectionSync CALLED", { canvasInstance: canvas, canvasType: canvas?.constructor?.name, canvasId: canvas?.lowerCanvasEl?.id, canvasRef: canvas });

  if (!canvas) {
    log("ERROR", "[canvas-events] installFabricSelectionSync: canvas is null/undefined");
    return;
  }

  // Remove any prior handlers to avoid duplicate firings on rebuild/hot-reload
  try {
    canvas.off('selection:created');
    canvas.off('selection:updated');
    canvas.off('selection:cleared');
    canvas.off('mouse:down');
  } catch (e) {
    log("WARN", "[canvas-events] Error detaching prior handlers", e);
  }

  // Store the token at which the last programmatic selection change was made
  let lastProgrammaticToken = 0;

  // --- DEBUG: Confirm handler attachment immediately after registration ---
  function confirmHandlerAttachment(tag) {
    try {
      // No _eventListeners property in most Fabric builds; fallback to test fire
      log("INFO", "[canvas-events] Handler attached", { tag, canvasType: canvas?.constructor?.name, canvasId: canvas?.lowerCanvasEl?.id });
    } catch (e) {
      log("WARN", "[canvas-events] confirmHandlerAttachment error", { tag, error: e });
    }
  }

  // --- DEBUG: Fire test handler (should log after every selection:created) ---
  const testFireCreated = (opt) => {
    log("INFO", "[canvas-events] TEST selection:created handler fired", { opt, canvasRef: canvas });
  };
  canvas.on('selection:created', testFireCreated);

  // --- Main Handlers ---
  const onCreated = (opt) => {
    try {
      log("INFO", "[canvas-events] selection:created handler FIRED", { opt, canvasRef: canvas });
      const eventToken = selectionSyncToken;
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
      const prevIds = (getState().selectedShapes || []).map(s => s._id);

      log("DEBUG", "[canvas-events] selection:created event received", {
        eventToken, lastProgrammaticToken, nextIds, prevIds, opt, canvasRef: canvas
      });

      // Only suppress if both token matches AND IDs match (no change)
      if (eventToken === lastProgrammaticToken && sameIdSet(nextIds, prevIds)) {
        log("DEBUG", "[canvas-events] selection:created suppressed (token match and ids match)", { eventToken, lastProgrammaticToken, nextIds, prevIds });
        return;
      }

      // Always sync selection if IDs differ
      if (!sameIdSet(nextIds, prevIds)) {
        withSuppressedHandlers((token) => {
          selectionSetSelectedShapes(selObjs);
          lastProgrammaticToken = token;
          log("DEBUG", "[canvas-events] selection:created store sync (setSelectedShapes)", { syncedIds: nextIds, selObjs });
        }, "created->setSelectedShapes");
      } else {
        log("DEBUG", "[canvas-events] selection:created no-op (ids match)");
      }
    } catch (e) {
      log("ERROR", "[canvas-events] selection:created handler error", { error: e, opt, canvasRef: canvas });
    }
  };

  const onUpdated = (opt) => {
    try {
      log("INFO", "[canvas-events] selection:updated handler FIRED", { opt, canvasRef: canvas });
      const eventToken = selectionSyncToken;
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
      const prevIds = (getState().selectedShapes || []).map(s => s._id);

      log("DEBUG", "[canvas-events] selection:updated event received", {
        eventToken, lastProgrammaticToken, nextIds, prevIds, opt, canvasRef: canvas
      });

      // Only suppress if both token matches AND IDs match (no change)
      if (eventToken === lastProgrammaticToken && sameIdSet(nextIds, prevIds)) {
        log("DEBUG", "[canvas-events] selection:updated suppressed (token match and ids match)", { eventToken, lastProgrammaticToken, nextIds, prevIds });
        return;
      }

      // Always sync selection if IDs differ
      if (!sameIdSet(nextIds, prevIds)) {
        withSuppressedHandlers((token) => {
          selectionSetSelectedShapes(selObjs);
          lastProgrammaticToken = token;
          log("DEBUG", "[canvas-events] selection:updated store sync (setSelectedShapes)", { syncedIds: nextIds, selObjs });
        }, "updated->setSelectedShapes");
      } else {
        log("DEBUG", "[canvas-events] selection:updated no-op (ids match)");
      }
    } catch (e) {
      log("ERROR", "[canvas-events] selection:updated handler error", { error: e, opt, canvasRef: canvas });
    }
  };

  const onCleared = (opt) => {
    try {
      log("INFO", "[canvas-events] selection:cleared handler FIRED", { opt, canvasRef: canvas });
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

      log("DEBUG", "[canvas-events] selection:cleared event received", { isUserEvent, hadSelection, eventToken, lastProgrammaticToken, opt, canvasRef: canvas });

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
        log("DEBUG", "[canvas-events] selection:cleared store sync (deselectAll)");
      }, "cleared->deselectAll");
    } catch (e) {
      log("ERROR", "[canvas-events] selection:cleared handler error", { error: e, opt, canvasRef: canvas });
    }
  };

  /**
   * Clear selection when clicking on background (blank area).
   */
  const onMouseDown = (opt) => {
    try {
      log("INFO", "[canvas-events] mouse:down handler FIRED", { opt, canvasRef: canvas });
      const eventToken = selectionSyncToken;
      if (eventToken === lastProgrammaticToken) return;
      const hadSelection = (getState().selectedShapes || []).length > 0;
      const clickedBlank = !opt?.target;
      if (hadSelection && clickedBlank) {
        log("DEBUG", "[canvas-events] mouse:down on blank area → clearing selection", { eventToken, opt, canvasRef: canvas });
        withSuppressedHandlers((token) => {
          if (typeof canvas.discardActiveObject === 'function') {
            try { canvas.discardActiveObject(); } catch (e2) { log("WARN", "[canvas-events] discardActiveObject failed", e2); }
          }
          deselectAll();
          lastProgrammaticToken = token;
          log("DEBUG", "[canvas-events] mouse:down store sync (deselectAll)");
        }, "mousedown-blank->deselectAll");
        if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
        else canvas.renderAll();
      }
    } catch (e) {
      log("ERROR", "[canvas-events] mouse:down handler error", { error: e, opt, canvasRef: canvas });
    }
  };

  // Attach handlers and confirm
  canvas.on('selection:created', onCreated);
  confirmHandlerAttachment('selection:created');
  canvas.on('selection:updated', onUpdated);
  confirmHandlerAttachment('selection:updated');
  canvas.on('selection:cleared', onCleared);
  confirmHandlerAttachment('selection:cleared');
  canvas.on('mouse:down', onMouseDown);
  confirmHandlerAttachment('mouse:down');

  log("INFO", "[canvas-events] Fabric selection sync installed (created/updated/cleared handlers + blank-click clear + tokenized sync + ActiveSelection unwrap)");
  log("DEBUG", "[canvas-events] installFabricSelectionSync EXIT", { canvasRef: canvas });
}


