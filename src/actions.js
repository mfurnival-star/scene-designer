import { log } from './log.js';
import { getState } from './state.js';
import { dispatch } from './commands/command-bus.js';

/*
  NOTE (Phase 2 interim):
  This file still contains some filtering / validation logic (locked shape checks, etc.).
  Full refactor to make these pure thin intent wrappers is scheduled for a later batch
  (Step 5 in the Phase 2 completion plan).
*/

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
    log("INFO", "[actions] Nothing selected to delete");
    return;
  }
  const unlockedIds = selected.filter(s => s && !s.locked).map(s => s._id);
  if (unlockedIds.length === 0) {
    log("INFO", "[actions] All selected shapes are locked");
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
    log("INFO", "[actions] No unlocked shapes selected to duplicate");
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
    log("INFO", "[actions] Nothing selected to lock");
    return;
  }
  const unlockedIds = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!unlockedIds.length) {
    log("INFO", "[actions] No unlocked shapes to lock");
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
      log("INFO", "[actions] No locked shapes selected to unlock");
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
    log("INFO", "[actions] No eligible shapes for reset rotation");
    return;
  }
  dispatch({
    type: 'RESET_ROTATION',
    payload: { ids: targets.map(t => t._id) }
  });
}

export function setStrokeColorForSelected(color, options = {}) {
  const selected = getState().selectedShapes || [];
  const ids = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!ids.length) {
    log("INFO", "[actions] No unlocked shapes selected for stroke color");
    return;
  }
  if (typeof color !== 'string' || !color) {
    log("WARN", "[actions] Invalid stroke color");
    return;
  }
  dispatch({
    type: 'SET_STROKE_COLOR',
    payload: { ids, color }
  }, options);
}

export function setFillColorForSelected(fill, options = {}) {
  const selected = getState().selectedShapes || [];
  const ids = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!ids.length) {
    log("INFO", "[actions] No unlocked shapes selected for fill color");
    return;
  }
  if (typeof fill !== 'string' || !fill) {
    log("WARN", "[actions] Invalid fill color");
    return;
  }
  dispatch({
    type: 'SET_FILL_COLOR',
    payload: { ids, fill }
  }, options);
}

export function setStrokeWidthForSelected(width, options = {}) {
  const selected = getState().selectedShapes || [];
  const ids = selected.filter(s => s && !s.locked).map(s => s._id);
  if (!ids.length) {
    log("INFO", "[actions] No unlocked shapes selected for stroke width");
    return;
  }
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) {
    log("WARN", "[actions] Invalid stroke width");
    return;
  }
  dispatch({
    type: 'SET_STROKE_WIDTH',
    payload: { ids, width: w }
  }, options);
}

/* Scene-level intent wrappers */

export function setSceneImage(url, imageObj, options = {}) {
  dispatch({
    type: 'SET_IMAGE',
    payload: { url: url || null, imageObj: url ? imageObj || null : null }
  }, options);
}

export function clearSceneImage(options = {}) {
  dispatch({
    type: 'SET_IMAGE',
    payload: { url: null, imageObj: null }
  }, options);
}

export function setSceneName(name, options = {}) {
  const n = typeof name === 'string' ? name : '';
  dispatch({
    type: 'SET_SCENE_NAME',
    payload: { name: n }
  }, options);
}

export function setSceneLogic(logic, options = {}) {
  const l = typeof logic === 'string' && logic ? logic : 'AND';
  dispatch({
    type: 'SET_SCENE_LOGIC',
    payload: { logic: l }
  }, options);
}

export function setDiagnosticLabelsVisibility(visible, options = {}) {
  dispatch({
    type: 'SET_DIAGNOSTIC_LABEL_VISIBILITY',
    payload: { visible: !!visible }
  }, options);
}

export { alignSelected } from './actions-alignment.js';
