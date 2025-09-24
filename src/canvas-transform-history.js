import { log } from './log.js';
import { getState } from './state.js';
import { dispatch } from './commands/command-bus.js';

const HANDLERS_KEY = '__sceneDesignerTransformHistoryHandlers__';

function snapshotOfShape(shape) {
  if (!shape || !shape._id) return null;
  const left = Number.isFinite(shape.left) ? shape.left : 0;
  const top = Number.isFinite(shape.top) ? shape.top : 0;
  const scaleX = Number.isFinite(shape.scaleX) ? shape.scaleX : 1;
  const scaleY = Number.isFinite(shape.scaleY) ? shape.scaleY : 1;
  const angle = Number.isFinite(shape.angle) ? shape.angle : 0;
  return { id: shape._id, left, top, scaleX, scaleY, angle };
}

function getActiveSelectionMembers(canvas) {
  try {
    const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
    if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
      return active._objects.slice().filter(Boolean);
    }
    if (active) return [active];
  } catch {}
  return [];
}

function mapById(items) {
  const m = new Map();
  items.forEach(it => { if (it && it.id != null) m.set(it.id, it); });
  return m;
}

function diffChanged(pre, post) {
  if (!pre || !post) return false;
  const EPS_POS = 0.01;
  const EPS_SCALE = 0.0001;
  const EPS_ANGLE = 0.01;
  if (Math.abs((pre.left ?? 0) - (post.left ?? 0)) > EPS_POS) return true;
  if (Math.abs((pre.top ?? 0) - (post.top ?? 0)) > EPS_POS) return true;
  if (Math.abs((pre.scaleX ?? 1) - (post.scaleX ?? 1)) > EPS_SCALE) return true;
  if (Math.abs((pre.scaleY ?? 1) - (post.scaleY ?? 1)) > EPS_SCALE) return true;
  if (Math.abs((pre.angle ?? 0) - (post.angle ?? 0)) > EPS_ANGLE) return true;
  return false;
}

export function installCanvasTransformHistory(canvas) {
  if (!canvas) {
    log("ERROR", "[transform-history] install: canvas is null/undefined");
    return () => {};
  }

  try {
    const prior = canvas[HANDLERS_KEY];
    if (Array.isArray(prior)) {
      prior.forEach(({ event, fn }) => { try { canvas.off(event, fn); } catch {} });
      canvas[HANDLERS_KEY] = [];
    }
  } catch (e) {
    log("WARN", "[transform-history] failed detaching prior handlers", e);
  }

  const localHandlers = [];
  const on = (event, fn) => {
    canvas.on(event, fn);
    localHandlers.push({ event, fn });
  };

  let gesture = {
    started: false,
    moved: false,
    pre: new Map(),
    selectionIds: []
  };

  function beginGesture() {
    try {
      const members = getActiveSelectionMembers(canvas);
      if (!members.length) return;
      gesture.started = true;
      gesture.moved = false;
      gesture.pre.clear();
      gesture.selectionIds = [];
      members.forEach(s => {
        const snap = snapshotOfShape(s);
        if (snap) {
          gesture.pre.set(snap.id, snap);
          gesture.selectionIds.push(snap.id);
        }
      });
      log("DEBUG", "[transform-history] gesture start", { count: gesture.pre.size });
    } catch (e) {
      log("WARN", "[transform-history] beginGesture error", e);
    }
  }

  function markMoved() {
    if (gesture.started) gesture.moved = true;
  }

  function finalizeGesture(reason) {
    if (!gesture.started) return;

    try {
      const stateShapes = getState().shapes || [];
      const byId = new Map(stateShapes.filter(Boolean).map(s => [s._id, s]));
      const postItems = [];
      const changedIds = [];

      gesture.selectionIds.forEach(id => {
        const shape = byId.get(id);
        if (!shape) return;
        const post = snapshotOfShape(shape);
        const pre = gesture.pre.get(id);
        if (pre && post && diffChanged(pre, post)) {
          postItems.push(post);
          changedIds.push(id);
        }
      });

      if (postItems.length > 0) {
        dispatch({ type: 'SET_TRANSFORMS', payload: { items: postItems } });
        log("INFO", "[transform-history] gesture committed", { reason, changed: postItems.length });
      } else {
        log("DEBUG", "[transform-history] gesture no-op", { reason, moved: gesture.moved, tracked: gesture.pre.size });
      }
    } catch (e) {
      log("ERROR", "[transform-history] finalizeGesture error", e);
    } finally {
      gesture.started = false;
      gesture.moved = false;
      gesture.pre.clear();
      gesture.selectionIds = [];
    }
  }

  const onMouseDown = () => {
    beginGesture();
  };

  const onScaling = () => {
    markMoved();
  };
  const onMoving = () => {
    markMoved();
  };
  const onRotating = () => {
    markMoved();
  };

  const onObjectModified = () => {
    finalizeGesture('object:modified');
  };

  const onMouseUp = () => {
    finalizeGesture('mouse:up');
  };

  on('mouse:down', onMouseDown);
  on('mouse:up', onMouseUp);
  on('object:scaling', onScaling);
  on('object:moving', onMoving);
  on('object:rotating', onRotating);
  on('object:modified', onObjectModified);

  canvas[HANDLERS_KEY] = localHandlers;

  log("INFO", "[transform-history] Installed transform history listeners");
  return function detach() {
    try {
      const list = canvas[HANDLERS_KEY];
      if (Array.isArray(list)) {
        list.forEach(({ event, fn }) => { try { canvas.off(event, fn); } catch {} });
        canvas[HANDLERS_KEY] = [];
      }
      log("INFO", "[transform-history] Detached transform history listeners");
    } catch (e) {
      log("ERROR", "[transform-history] detach error", e);
    }
  };
}
