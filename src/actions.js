import { log } from './log.js';
import { getState } from './state.js';
import { dispatch } from './commands/command-bus.js';
export { alignSelected } from './actions-alignment.js';

/*
  Batch 5 – Actions Thinning (Hybrid Policy Option B)
  ---------------------------------------------------
  - Removed correctness / domain filtering (locked-shape filtering, payload validation).
  - Command executors (commands-structure.js / commands-style.js / commands-scene.js) are now authoritative.
  - Retained ONLY lightweight early user-facing no-op logs for UX clarity.
  - All functions dispatch directly; executors decide actual effect and log standardized no-op reasons.
  - Future (Phase 2 later batch): May remove even these early logs as we approach fully thin intent registry.

  NOTE:
  - Selection-dependent actions still read current selection to build an ids array; locked shapes are NOT filtered here.
  - Executors safely skip locked or ineligible shapes and return null (no history entry) with reason logging.
*/

/* Shape / Structural Intents */

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
  // If none selected we intentionally dispatch with empty ids so executor uses fallback logic.
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

/* Style Intents (selection only; defaults handled elsewhere like toolbar handlers) */

export function setStrokeColorForSelected(color, options = {}) {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No selection for stroke color");
    return;
  }
  dispatch({
    type: 'SET_STROKE_COLOR',
    payload: {
      ids: selected.map(s => s && s._id).filter(Boolean),
      color
    }
  }, options);
}

export function setFillColorForSelected(fill, options = {}) {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No selection for fill color");
    return;
  }
  dispatch({
    type: 'SET_FILL_COLOR',
    payload: {
      ids: selected.map(s => s && s._id).filter(Boolean),
      fill
    }
  }, options);
}

export function setStrokeWidthForSelected(width, options = {}) {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No selection for stroke width");
    return;
  }
  dispatch({
    type: 'SET_STROKE_WIDTH',
    payload: {
      ids: selected.map(s => s && s._id).filter(Boolean),
      width
    }
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
