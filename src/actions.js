import { log } from './log.js';
import { getState } from './state.js';
import { dispatch } from './commands/command-bus.js';
export { alignSelected } from './actions-alignment.js';

/*
  Batch 6 – Style Payload Normalization (items[] only, legacy forms removed)
  -------------------------------------------------------------------------
  - setStrokeColorForSelected, setFillColorForSelected, setStrokeWidthForSelected now emit only items[] payloads.
  - Removed legacy (ids + color/fill/width) command payloads.
  - Early "no selection" logs remain per Hybrid policy.
  - All correctness/validation is enforced in command executors.
*/

export function addShapeOfType(type, opts = {}) {
  const shapeType = typeof type === 'string' ? type : 'point';
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
  dispatch({
    type: 'DELETE_SHAPES',
    payload: { ids: selected.map(s => s && s._id).filter(Boolean) }
  });
}

export function duplicateSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] Nothing selected to duplicate");
    return;
  }
  dispatch({
    type: 'DUPLICATE_SHAPES',
    payload: { ids: selected.map(s => s && s._id).filter(Boolean), offset: { x: 20, y: 20 } }
  });
}

export function lockSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] Nothing selected to lock");
    return;
  }
  dispatch({
    type: 'LOCK_SHAPES',
    payload: { ids: selected.map(s => s && s._id).filter(Boolean) }
  });
}

export function unlockSelectedShapes() {
  const selected = getState().selectedShapes || [];
  const ids = selected.map(s => s && s._id).filter(Boolean);
  if (!ids.length) {
    log("INFO", "[actions] No selection – unlocking will target any locked shapes (executor decides)");
    dispatch({ type: 'UNLOCK_SHAPES' });
    return;
  }
  dispatch({
    type: 'UNLOCK_SHAPES',
    payload: { ids }
  });
}

export function resetRotationForSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] Nothing selected for reset rotation");
    return;
  }
  dispatch({
    type: 'RESET_ROTATION',
    payload: { ids: selected.map(s => s && s._id).filter(Boolean) }
  });
}

/* Style Intents (items[] only) */

export function setStrokeColorForSelected(color, options = {}) {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No selection for stroke color");
    return;
  }
  const items = selected
    .map(s => s && s._id)
    .filter(Boolean)
    .map(id => ({ id, color }));
  dispatch({
    type: 'SET_STROKE_COLOR',
    payload: { items }
  }, options);
}

export function setFillColorForSelected(fill, options = {}) {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No selection for fill color");
    return;
  }
  const items = selected
    .map(s => s && s._id)
    .filter(Boolean)
    .map(id => ({ id, fill }));
  dispatch({
    type: 'SET_FILL_COLOR',
    payload: { items }
  }, options);
}

export function setStrokeWidthForSelected(width, options = {}) {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No selection for stroke width");
    return;
  }
  const items = selected
    .map(s => s && s._id)
    .filter(Boolean)
    .map(id => ({ id, width }));
  dispatch({
    type: 'SET_STROKE_WIDTH',
    payload: { items }
  }, options);
}

/* Scene / Metadata */

export function setSceneImage(url, imageObj, options = {}) {
  dispatch({
    type: 'SET_IMAGE',
    payload: { url: url || null, imageObj: url ? (imageObj || null) : null }
  }, options);
}

export function clearSceneImage(options = {}) {
  dispatch({
    type: 'SET_IMAGE',
    payload: { url: null, imageObj: null }
  }, options);
}

export function setSceneName(name, options = {}) {
  dispatch({
    type: 'SET_SCENE_NAME',
    payload: { name: typeof name === 'string' ? name : '' }
  }, options);
}

export function setSceneLogic(logic, options = {}) {
  dispatch({
    type: 'SET_SCENE_LOGIC',
    payload: { logic: (typeof logic === 'string' && logic) ? logic : 'AND' }
  }, options);
}

export function setDiagnosticLabelsVisibility(visible, options = {}) {
  dispatch({
    type: 'SET_DIAGNOSTIC_LABEL_VISIBILITY',
    payload: { visible: !!visible }
  }, options);
}

/* Selection Wrapper Commands (history-visible user intents) */

export function selectAllCommand(options = {}) {
  dispatch({ type: 'SELECT_ALL' }, options);
}

export function deselectAllCommand(options = {}) {
  dispatch({ type: 'DESELECT_ALL' }, options);
}
