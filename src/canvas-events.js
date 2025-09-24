/**
 * canvas-events.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Selection Event Sync (ESM ONLY, PHASED ARCHITECTURE v1)
 *
 * Purpose:
 * - Listen to Fabric canvas selection lifecycle events and keep the app store (selection.js)
 *   in sync with what the user visually selected.
 * - Transactional (tokenized) selection sync eliminates reentrancy / stale selection bugs.
 * - Unwraps ActiveSelection so multi-select updates store with ALL members.
 * - Clears selection on blank canvas click.
 * - Prevents duplicate store updates (suppresses only when BOTH token + id set match).
 *
 * Phase 1 Enhancements (2025-09-24):
 * - Fixed handler clobbering (moved off() calls out of constraints module).
 * - Added deep DEBUG instrumentation for event payloads and state diffs.
 * - Updated suppression logic: only suppress when token matches and sets are identical.
 *
 * New (2025-09-24, debug-snapshot-5 prep):
 * - Internal selection event ring buffer (selectionEventTrace) independent of log interception.
 * - Export getSelectionEventTrace() for debug.js (direct, deterministic capture).
 * - Reassert ActiveSelection UI flags (hasControls=false, hasBorders=true) every created/updated.
 * - Added trace entries for selection:created / selection:updated / selection:cleared with before/after id sets.
 *
 * Exports:
 * - installFabricSelectionSync(canvas)
 * - getSelectionEventTrace()           (NEW) – returns shallow copy of ring buffer
 *
 * Dependencies:
 * - log.js
 * - state.js
 * - selection.js (selectionSetSelectedShapes, deselectAll)
 *
 * Notes:
 * - We keep the existing TEST handler log to verify handler attachment (can be removed later).
 * - Ring buffer holds last 25 events (configurable via TRACE_CAPACITY).
 */

import { log } from './log.js';
import { getState } from './state.js';
import {
  setSelectedShapes as selectionSetSelectedShapes,
  deselectAll
} from './selection.js';

// ---------------- Internal Trace Ring Buffer ----------------
const TRACE_CAPACITY = 25;
const selectionEventTrace = [];

/**
 * Push a structured selection event trace entry.
 */
function pushTrace(entry) {
  try {
    selectionEventTrace.push({
      timeISO: new Date().toISOString(),
      ...entry
    });
    if (selectionEventTrace.length > TRACE_CAPACITY) {
      selectionEventTrace.shift();
    }
  } catch (e) {
    log("WARN", "[canvas-events] pushTrace failed", e);
  }
}

/**
 * Public getter for debug.js (snapshot integration).
 */
export function getSelectionEventTrace() {
  return selectionEventTrace.slice();
}

// ---------------- Transaction Token ----------------
let selectionSyncToken = 0;

function withSuppressedHandlers(fn, tag = "") {
  const token = ++selectionSyncToken;
  try {
    fn(token);
  } finally {
    if (tag) log("DEBUG", "[canvas-events] Exited suppressed section", { tag, token });
  }
}

// ---------------- Helpers ----------------
function getSelectedObjectsFromFabric(canvas, options) {
  log("DEBUG", "[canvas-events] getSelectedObjectsFromFabric ENTRY", { canvasInstance: canvas, options });
  try {
    const active = canvas && typeof canvas.getActiveObject === 'function'
      ? canvas.getActiveObject()
      : null;

    // Direct ActiveSelection
    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      log("DEBUG", "[canvas-events] ActiveSelection detected", {
        activeObj: active,
        memberCount: active._objects.length
      });
      return active._objects.slice();
    }

    // Use Fabric's convenience
    if (canvas && typeof canvas.getActiveObjects === 'function') {
      const objs = canvas.getActiveObjects() || [];
      if (objs.length === 1 &&
          objs[0] &&
          objs[0].type === 'activeSelection' &&
          Array.isArray(objs[0]._objects)) {
        log("DEBUG", "[canvas-events] getActiveObjects: single activeSelection container", {
          memberCount: objs[0]._objects.length
        });
        return objs[0]._objects.slice();
      }
      log("DEBUG", "[canvas-events] getActiveObjects: returning array", { count: objs.length });
      return Array.isArray(objs) ? objs : (objs ? [objs] : []);
    }

    // Fallback: options.selected
    if (options && Array.isArray(options.selected) && options.selected.length) {
      const arr = options.selected;
      if (arr.length === 1 &&
          arr[0] &&
          arr[0].type === 'activeSelection' &&
          Array.isArray(arr[0]._objects)) {
        log("DEBUG", "[canvas-events] options.selected: ActiveSelection unwrap");
        return arr[0]._objects.slice();
      }
      return arr;
    }

    // Fallback: event target
    if (options && options.target) {
      const t = options.target;
      if (t.type === 'activeSelection' && Array.isArray(t._objects)) {
        log("DEBUG", "[canvas-events] options.target: ActiveSelection unwrap");
        return t._objects.slice();
      }
      return [t];
    }
  } catch (e) {
    log("ERROR", "[canvas-events] getSelectedObjectsFromFabric error", e);
  }
  log("DEBUG", "[canvas-events] getSelectedObjectsFromFabric EXIT (empty)");
  return [];
}

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
 * Reassert (normalize) ActiveSelection UI flags: we intentionally keep no transform handles
 * for multi-select group drags in Phase 1 (only hull + per-member outlines).
 */
function enforceActiveSelectionVisuals(canvas) {
  try {
    if (!canvas || typeof canvas.getActiveObject !== 'function') return;
    const active = canvas.getActiveObject();
    if (active && active.type === 'activeSelection') {
      // Only set if different to minimize churn
      if (active.hasControls !== false || active.hasBorders !== true) {
        active.set({
          hasControls: false,
          hasBorders: true,
          selectable: true // still must remain selectable for internal Fabric operations
        });
        if (typeof active.setCoords === 'function') {
          try { active.setCoords(); } catch {}
        }
        log("DEBUG", "[canvas-events] ActiveSelection visuals enforced");
      }
    }
  } catch (e) {
    log("WARN", "[canvas-events] enforceActiveSelectionVisuals failed", e);
  }
}

// ---------------- Main Installer ----------------
export function installFabricSelectionSync(canvas) {
  log("INFO", "[canvas-events] installFabricSelectionSync CALLED", {
    canvasInstance: canvas,
    canvasType: canvas?.constructor?.name,
    canvasId: canvas?.lowerCanvasEl?.id
  });

  if (!canvas) {
    log("ERROR", "[canvas-events] installFabricSelectionSync: canvas is null/undefined");
    return;
  }

  // Remove any prior handlers (only those we control)
  try {
    canvas.off('selection:created');
    canvas.off('selection:updated');
    canvas.off('selection:cleared');
    canvas.off('mouse:down');
  } catch (e) {
    log("WARN", "[canvas-events] Error detaching prior handlers", e);
  }

  let lastProgrammaticToken = 0;

  function confirmHandlerAttachment(tag) {
    log("INFO", "[canvas-events] Handler attached", {
      tag,
      canvasType: canvas?.constructor?.name,
      canvasId: canvas?.lowerCanvasEl?.id
    });
  }

  // Optional test handler (kept for now; can remove later)
  const testFireCreated = (opt) => {
    log("INFO", "[canvas-events] TEST selection:created handler fired", { opt });
  };
  canvas.on('selection:created', testFireCreated);

  // ------------- Handlers -------------
  const onCreated = (opt) => {
    let tracePrevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      log("INFO", "[canvas-events] selection:created handler FIRED", { opt });
      const eventToken = selectionSyncToken;
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
      const prevIds = tracePrevIds;

      log("DEBUG", "[canvas-events] selection:created event received", {
        eventToken,
        lastProgrammaticToken,
        nextIds,
        prevIds
      });

      // Enforce visuals (ActiveSelection)
      enforceActiveSelectionVisuals(canvas);

      // Suppress only if truly duplicate
      if (eventToken === lastProgrammaticToken && sameIdSet(nextIds, prevIds)) {
        log("DEBUG", "[canvas-events] selection:created suppressed (token + ids match)");
        pushTrace({
            event: 'selection:created',
            suppressed: true,
            token: eventToken,
            prevIds,
            nextIds
        });
        return;
      }

      if (!sameIdSet(nextIds, prevIds)) {
        withSuppressedHandlers((token) => {
          selectionSetSelectedShapes(selObjs);
          lastProgrammaticToken = token;
          log("DEBUG", "[canvas-events] selection:created store sync (setSelectedShapes)", {
            syncedIds: nextIds
          });
        }, "created->setSelectedShapes");
        pushTrace({
          event: 'selection:created',
          suppressed: false,
          token: selectionSyncToken,
          prevIds,
          nextIds
        });
      } else {
        log("DEBUG", "[canvas-events] selection:created no-op (ids match)");
        pushTrace({
          event: 'selection:created',
          suppressed: false,
          noop: true,
            token: selectionSyncToken,
          prevIds,
          nextIds
        });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] selection:created handler error", { error: e });
      pushTrace({
        event: 'selection:created',
        error: true,
        message: e?.message,
        prevIds: tracePrevIds
      });
    }
  };

  const onUpdated = (opt) => {
    let tracePrevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      log("INFO", "[canvas-events] selection:updated handler FIRED", { opt });
      const eventToken = selectionSyncToken;
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);
      const prevIds = tracePrevIds;

      log("DEBUG", "[canvas-events] selection:updated event received", {
        eventToken,
        lastProgrammaticToken,
        nextIds,
        prevIds
      });

      enforceActiveSelectionVisuals(canvas);

      if (eventToken === lastProgrammaticToken && sameIdSet(nextIds, prevIds)) {
        log("DEBUG", "[canvas-events] selection:updated suppressed (token + ids match)");
        pushTrace({
          event: 'selection:updated',
          suppressed: true,
          token: eventToken,
          prevIds,
          nextIds
        });
        return;
      }

      if (!sameIdSet(nextIds, prevIds)) {
        withSuppressedHandlers((token) => {
          selectionSetSelectedShapes(selObjs);
          lastProgrammaticToken = token;
          log("DEBUG", "[canvas-events] selection:updated store sync (setSelectedShapes)", {
            syncedIds: nextIds
          });
        }, "updated->setSelectedShapes");
        pushTrace({
          event: 'selection:updated',
          suppressed: false,
          token: selectionSyncToken,
          prevIds,
          nextIds
        });
      } else {
        log("DEBUG", "[canvas-events] selection:updated no-op (ids match)");
        pushTrace({
          event: 'selection:updated',
          suppressed: false,
          noop: true,
          token: selectionSyncToken,
          prevIds,
          nextIds
        });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] selection:updated handler error", { error: e });
      pushTrace({
        event: 'selection:updated',
        error: true,
        message: e?.message,
        prevIds: tracePrevIds
      });
    }
  };

  const onCleared = (opt) => {
    let tracePrevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      log("INFO", "[canvas-events] selection:cleared handler FIRED", { opt });
      const eventToken = selectionSyncToken;
      const isUserEvent = !!(opt && opt.e);
      const hadSelection = (getState().selectedShapes || []).length > 0;

      log("DEBUG", "[canvas-events] selection:cleared event received", {
        eventToken,
        lastProgrammaticToken,
        isUserEvent,
        hadSelection
      });

      if (eventToken === lastProgrammaticToken) {
        log("DEBUG", "[canvas-events] selection:cleared suppressed (token match)");
        pushTrace({
          event: 'selection:cleared',
          suppressed: true,
          token: eventToken,
          prevIds: tracePrevIds,
          nextIds: []
        });
        return;
      }

      if (!hadSelection) {
        log("DEBUG", "[canvas-events] selection:cleared no-op (already empty)");
        pushTrace({
          event: 'selection:cleared',
          noop: true,
          token: selectionSyncToken,
          prevIds: tracePrevIds,
          nextIds: []
        });
        return;
      }

      withSuppressedHandlers((token) => {
        deselectAll();
        lastProgrammaticToken = token;
        log("DEBUG", "[canvas-events] selection:cleared store sync (deselectAll)");
      }, "cleared->deselectAll");

      pushTrace({
        event: 'selection:cleared',
        suppressed: false,
        token: selectionSyncToken,
        prevIds: tracePrevIds,
        nextIds: []
      });
    } catch (e) {
      log("ERROR", "[canvas-events] selection:cleared handler error", { error: e });
      pushTrace({
        event: 'selection:cleared',
        error: true,
        message: e?.message,
        prevIds: tracePrevIds
      });
    }
  };

  const onMouseDown = (opt) => {
    let tracePrevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      log("INFO", "[canvas-events] mouse:down handler FIRED", { opt });
      const eventToken = selectionSyncToken;
      if (eventToken === lastProgrammaticToken) return;

      const hadSelection = (getState().selectedShapes || []).length > 0;
      const clickedBlank = !opt?.target;

      if (hadSelection && clickedBlank) {
        log("DEBUG", "[canvas-events] mouse:down on blank area → clearing selection", {
          eventToken
        });
        withSuppressedHandlers((token) => {
          if (typeof canvas.discardActiveObject === 'function') {
            try { canvas.discardActiveObject(); } catch (e2) {
              log("WARN", "[canvas-events] discardActiveObject failed", e2);
            }
          }
          deselectAll();
          lastProgrammaticToken = token;
          log("DEBUG", "[canvas-events] mouse:down store sync (deselectAll)");
        }, "mousedown-blank->deselectAll");
        if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
        else canvas.renderAll();

        pushTrace({
          event: 'mouse:down-blank-clear',
          token: selectionSyncToken,
          prevIds: tracePrevIds,
          nextIds: []
        });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] mouse:down handler error", { error: e });
    }
  };

  // ------------- Attach -------------
  canvas.on('selection:created', onCreated);
  confirmHandlerAttachment('selection:created');

  canvas.on('selection:updated', onUpdated);
  confirmHandlerAttachment('selection:updated');

  canvas.on('selection:cleared', onCleared);
  confirmHandlerAttachment('selection:cleared');

  canvas.on('mouse:down', onMouseDown);
  confirmHandlerAttachment('mouse:down');

  log("INFO", "[canvas-events] Fabric selection sync installed (created/updated/cleared + blank-click clear + tokenized sync + ActiveSelection unwrap + trace buffer)");
  log("DEBUG", "[canvas-events] installFabricSelectionSync EXIT", { canvasRef: canvas });
}

