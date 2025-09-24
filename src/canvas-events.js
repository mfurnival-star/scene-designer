/**
 * canvas-events.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Selection Event Sync (ESM ONLY, Phase 1)
 *
 * Purpose:
 * - Keep store selection in sync with Fabric visual selection.
 * - Tokenized suppression prevents feedback loops.
 * - Unwrap ActiveSelection to store all members for multi-select.
 * - Clear selection on blank clicks.
 * - Maintain a lightweight, structured trace buffer for diagnostics.
 *
 * Logging Policy (reduced noise):
 * - INFO: one concise line per user-visible selection change.
 * - DEBUG: minimal, only for unusual branches.
 * - No ENTRY/EXIT spam; helpers are silent in hot paths.
 *
 * Exports:
 * - installFabricSelectionSync(canvas)
 * - getSelectionEventTrace()
 * -----------------------------------------------------------
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
    // Silent failure warning only
    log("WARN", "[canvas-events] pushTrace failed", e);
  }
}

/**
 * Public getter for debug integrations.
 */
export function getSelectionEventTrace() {
  return selectionEventTrace.slice();
}

// ---------------- Transaction Token ----------------
let selectionSyncToken = 0;

function withSuppressedHandlers(fn) {
  const token = ++selectionSyncToken;
  fn(token);
}

// ---------------- Helpers ----------------
function getSelectedObjectsFromFabric(canvas, options) {
  try {
    const active = canvas && typeof canvas.getActiveObject === 'function'
      ? canvas.getActiveObject()
      : null;

    // Direct ActiveSelection
    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      return active._objects.slice();
    }

    // Convenience (some Fabric builds)
    if (canvas && typeof canvas.getActiveObjects === 'function') {
      const objs = canvas.getActiveObjects() || [];
      if (objs.length === 1 &&
          objs[0] &&
          objs[0].type === 'activeSelection' &&
          Array.isArray(objs[0]._objects)) {
        return objs[0]._objects.slice();
      }
      return Array.isArray(objs) ? objs : (objs ? [objs] : []);
    }

    // Fallback: options.selected
    if (options && Array.isArray(options.selected) && options.selected.length) {
      const arr = options.selected;
      if (arr.length === 1 &&
          arr[0] &&
          arr[0].type === 'activeSelection' &&
          Array.isArray(arr[0]._objects)) {
        return arr[0]._objects.slice();
      }
      return arr;
    }

    // Fallback: event target
    if (options && options.target) {
      const t = options.target;
      if (t.type === 'activeSelection' && Array.isArray(t._objects)) {
        return t._objects.slice();
      }
      return [t];
    }
  } catch (e) {
    log("ERROR", "[canvas-events] getSelectedObjectsFromFabric error", e);
  }
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
 * Ensure consistent UI flags for ActiveSelection (no transform handles).
 */
function enforceActiveSelectionVisuals(canvas) {
  try {
    if (!canvas || typeof canvas.getActiveObject !== 'function') return;
    const active = canvas.getActiveObject();
    if (active && active.type === 'activeSelection') {
      if (active.hasControls !== false || active.hasBorders !== true) {
        active.set({ hasControls: false, hasBorders: true, selectable: true });
        if (typeof active.setCoords === 'function') { try { active.setCoords(); } catch {} }
      }
    }
  } catch (e) {
    // Non-fatal
  }
}

// ---------------- Main Installer ----------------
export function installFabricSelectionSync(canvas) {
  log("INFO", "[canvas-events] Installing Fabric selection sync");

  if (!canvas) {
    log("ERROR", "[canvas-events] installFabricSelectionSync: canvas is null/undefined");
    return;
  }

  // Remove only our prior handlers (non-destructive)
  try {
    canvas.off('selection:created');
    canvas.off('selection:updated');
    canvas.off('selection:cleared');
    canvas.off('mouse:down');
  } catch {
    // ignore
  }

  let lastProgrammaticToken = 0;

  const onCreated = (opt) => {
    const prevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);

      enforceActiveSelectionVisuals(canvas);

      // Suppress only if truly duplicate (token + id set)
      if (selectionSyncToken === lastProgrammaticToken && sameIdSet(nextIds, prevIds)) {
        pushTrace({ event: 'selection:created', suppressed: true, token: selectionSyncToken, prevIds, nextIds });
        return;
      }

      if (!sameIdSet(nextIds, prevIds)) {
        withSuppressedHandlers((token) => {
          selectionSetSelectedShapes(selObjs);
          lastProgrammaticToken = token;
        });
        log("INFO", "[canvas-events] Selection created", { count: nextIds.length });
        pushTrace({ event: 'selection:created', suppressed: false, token: selectionSyncToken, prevIds, nextIds });
      } else {
        pushTrace({ event: 'selection:created', suppressed: false, noop: true, token: selectionSyncToken, prevIds, nextIds });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] selection:created error", e);
      pushTrace({ event: 'selection:created', error: true, message: e?.message, prevIds });
    }
  };

  const onUpdated = (opt) => {
    const prevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);

      enforceActiveSelectionVisuals(canvas);

      if (selectionSyncToken === lastProgrammaticToken && sameIdSet(nextIds, prevIds)) {
        pushTrace({ event: 'selection:updated', suppressed: true, token: selectionSyncToken, prevIds, nextIds });
        return;
      }

      if (!sameIdSet(nextIds, prevIds)) {
        withSuppressedHandlers((token) => {
          selectionSetSelectedShapes(selObjs);
          lastProgrammaticToken = token;
        });
        log("INFO", "[canvas-events] Selection updated", { count: nextIds.length });
        pushTrace({ event: 'selection:updated', suppressed: false, token: selectionSyncToken, prevIds, nextIds });
      } else {
        pushTrace({ event: 'selection:updated', suppressed: false, noop: true, token: selectionSyncToken, prevIds, nextIds });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] selection:updated error", e);
      pushTrace({ event: 'selection:updated', error: true, message: e?.message, prevIds });
    }
  };

  const onCleared = (opt) => {
    const prevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      if (selectionSyncToken === lastProgrammaticToken) {
        pushTrace({ event: 'selection:cleared', suppressed: true, token: selectionSyncToken, prevIds, nextIds: [] });
        return;
      }

      const hadSelection = prevIds.length > 0;
      if (!hadSelection) {
        pushTrace({ event: 'selection:cleared', noop: true, token: selectionSyncToken, prevIds, nextIds: [] });
        return;
      }

      withSuppressedHandlers((token) => {
        deselectAll();
        lastProgrammaticToken = token;
      });
      log("INFO", "[canvas-events] Selection cleared");
      pushTrace({ event: 'selection:cleared', suppressed: false, token: selectionSyncToken, prevIds, nextIds: [] });
    } catch (e) {
      log("ERROR", "[canvas-events] selection:cleared error", e);
      pushTrace({ event: 'selection:cleared', error: true, message: e?.message, prevIds });
    }
  };

  const onMouseDown = (opt) => {
    const prevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      if (selectionSyncToken === lastProgrammaticToken) return;
      const hadSelection = prevIds.length > 0;
      const clickedBlank = !opt?.target;

      if (hadSelection && clickedBlank) {
        withSuppressedHandlers((token) => {
          try { if (typeof canvas.discardActiveObject === 'function') canvas.discardActiveObject(); } catch {}
          deselectAll();
          lastProgrammaticToken = token;
        });
        if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
        else canvas.renderAll();

        log("INFO", "[canvas-events] Blank click → selection cleared");
        pushTrace({ event: 'mouse:down-blank-clear', token: selectionSyncToken, prevIds, nextIds: [] });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] mouse:down handler error", e);
    }
  };

  // Attach handlers
  canvas.on('selection:created', onCreated);
  canvas.on('selection:updated', onUpdated);
  canvas.on('selection:cleared', onCleared);
  canvas.on('mouse:down', onMouseDown);

  log("INFO", "[canvas-events] Selection sync installed (created/updated/cleared + blank-click clear + tokenized sync + ActiveSelection unwrap + trace buffer)");
}
