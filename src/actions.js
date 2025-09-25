import { log } from './log.js';
import { getState } from './state.js';
import { dispatch } from './commands/command-bus.js';

export function addShapeOfType(type, opts = {}) {
  const valid = new Set(["point", "rect", "circle", "ellipse"]);
  const shapeType = valid.has(type) ? type : "point";

  dispatch({
    type: 'ADD_SHAPE',
    payload: { shapeType, opts }
  });
}

export function deleteSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] deleteSelectedShapes: nothing selected");
    return;
  }
  const unlockedIds = selected.filter(s => s && !s.locked).map(s => s._id);
  if (unlockedIds.length === 0) {
    log("INFO", "[actions] deleteSelectedShapes: all selected shapes are locked");
    return;
  }

  dispatch({
    type: 'DELETE_SHAPES',
    payload: { ids: unlockedIds }
  });
}

export function duplicateSelectedShapes() {
  const selected = getState().selectedShapes || [];
  const unlockedIds = selected.filter(s => s && !s.locked).map(s => s._id);

  if (unlockedIds.length === 0) {
    log("INFO", "[actions] duplicateSelectedShapes: no unlocked shapes selected");
    return;
  }

  dispatch({
    type: 'DUPLICATE_SHAPES',
    payload: { ids: unlockedIds, offset: { x: 20, y: 20 } }
  });
}

export function lockSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] lockSelectedShapes: nothing selected");
    return;
  }

  const unlockedIds = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!unlockedIds.length) {
    log("INFO", "[actions] lockSelectedShapes: no unlocked shapes to lock");
    return;
  }

  dispatch({
    type: 'LOCK_SHAPES',
    payload: { ids: unlockedIds }
  });
}

export function unlockSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (selected.length > 0) {
    const lockedIds = selected.filter(s => s && s.locked).map(s => s._id);
    if (!lockedIds.length) {
      log("INFO", "[actions] unlockSelectedShapes: no locked shapes selected");
      return;
    }
    dispatch({
      type: 'UNLOCK_SHAPES',
      payload: { ids: lockedIds }
    });
  } else {
    dispatch({ type: 'UNLOCK_SHAPES' });
  }
}

export function resetRotationForSelectedShapes() {
  const selected = getState().selectedShapes || [];
  const targets = selected.filter(s =>
    s && !s.locked && (s._type === 'rect' || s._type === 'circle' || s._type === 'ellipse')
  );

  if (targets.length === 0) {
    log("INFO", "[actions] resetRotationForSelectedShapes: no eligible shapes (need unlocked rect/circle/ellipse)");
    return;
  }

  dispatch({
    type: 'RESET_ROTATION',
    payload: { ids: targets.map(t => t._id) }
  });
}

export function setStrokeColorForSelected(color) {
  const selected = getState().selectedShapes || [];
  const ids = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!ids.length) {
    log("INFO", "[actions] setStrokeColorForSelected: no unlocked shapes selected");
    return;
  }
  if (typeof color !== 'string' || !color) {
    log("WARN", "[actions] setStrokeColorForSelected: invalid color");
    return;
  }
  dispatch({
    type: 'SET_STROKE_COLOR',
    payload: { ids, color }
  });
}

export function setFillColorForSelected(fill) {
  const selected = getState().selectedShapes || [];
  const ids = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!ids.length) {
    log("INFO", "[actions] setFillColorForSelected: no unlocked shapes selected");
    return;
  }
  if (typeof fill !== 'string' || !fill) {
    log("WARN", "[actions] setFillColorForSelected: invalid fill");
    return;
  }
  dispatch({
    type: 'SET_FILL_COLOR',
    payload: { ids, fill }
  });
}

export function setStrokeWidthForSelected(width) {
  const selected = getState().selectedShapes || [];
  const ids = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!ids.length) {
    log("INFO", "[actions] setStrokeWidthForSelected: no unlocked shapes selected");
    return;
  }
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) {
    log("WARN", "[actions] setStrokeWidthForSelected: invalid width", { width });
    return;
  }
  dispatch({
    type: 'SET_STROKE_WIDTH',
    payload: { ids, width: w }
  });
}

export { alignSelected } from './actions-alignment.js';
