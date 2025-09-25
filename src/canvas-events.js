import { log } from './log.js';
import { getState } from './state.js';
import {
  setSelectedShapes as selectionSetSelectedShapes,
  deselectAll
} from './selection.js';

const TRACE_CAPACITY = 25;
const selectionEventTrace = [];

function pushTrace(entry) {
  try {
    selectionEventTrace.push({ timeISO: new Date().toISOString(), ...entry });
    if (selectionEventTrace.length > TRACE_CAPACITY) selectionEventTrace.shift();
  } catch (e) {
    log("WARN", "[canvas-events] pushTrace failed", e);
  }
}

export function getSelectionEventTrace() {
  return selectionEventTrace.slice();
}

let selectionSyncToken = 0;
function withSuppressedHandlers(fn) {
  const token = ++selectionSyncToken;
  fn(token);
}

function getSelectedObjectsFromFabric(canvas, options) {
  try {
    const active = canvas && typeof canvas.getActiveObject === 'function'
      ? canvas.getActiveObject()
      : null;

    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      return active._objects.slice();
    }

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
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

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
  } catch {}
}

const HANDLERS_KEY = '__sceneDesignerSelectionSyncHandlers__';

function detachOurHandlers(canvas) {
  try {
    const list = canvas[HANDLERS_KEY];
    if (Array.isArray(list)) {
      list.forEach(({ event, fn }) => { try { canvas.off(event, fn); } catch {} });
      canvas[HANDLERS_KEY] = [];
    }
  } catch (e) {
    log("WARN", "[canvas-events] Failed detaching prior handlers", e);
  }
}

export function installFabricSelectionSync(canvas) {
  if (!canvas) {
    log("ERROR", "[canvas-events] installFabricSelectionSync: canvas is null/undefined");
    return () => {};
  }

  detachOurHandlers(canvas);

  const localHandlers = [];
  const on = (event, fn) => {
    canvas.on(event, fn);
    localHandlers.push({ event, fn });
  };

  let lastProgrammaticToken = 0;

  const onCreated = (opt) => {
    const prevIds = (getState().selectedShapes || []).map(s => s._id);
    try {
      const selObjs = getSelectedObjectsFromFabric(canvas, opt);
      const nextIds = selObjs.filter(Boolean).map(o => o._id).filter(Boolean);

      enforceActiveSelectionVisuals(canvas);

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

  const onCleared = () => {
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

        log("INFO", "[canvas-events] Blank click cleared selection");
        pushTrace({ event: 'mouse:down-blank-clear', token: selectionSyncToken, prevIds, nextIds: [] });
      }
    } catch (e) {
      log("ERROR", "[canvas-events] mouse:down handler error", e);
    }
  };

  on('selection:created', onCreated);
  on('selection:updated', onUpdated);
  on('selection:cleared', onCleared);
  on('mouse:down', onMouseDown);

  canvas[HANDLERS_KEY] = localHandlers;

  log("INFO", "[canvas-events] Selection sync installed");
  return function detach() {
    detachOurHandlers(canvas);
    log("INFO", "[canvas-events] Selection sync detached");
  };
}
