import { log } from './log.js';
import { getState } from './state.js';
import { dispatch } from './commands/command-bus.js';

/**
 * Add a shape via command bus.
 * @param {string} type - "point" | "rect" | "circle" | "ellipse"
 * @param {Object} [opts] - Optional settings (x,y overrides)
 */
export function addShapeOfType(type, opts = {}) {
  const valid = new Set(["point", "rect", "circle", "ellipse"]);
  const shapeType = valid.has(type) ? type : "point";

  dispatch({
    type: 'ADD_SHAPE',
    payload: { shapeType, opts }
  });
}

/**
 * Delete all currently selected, unlocked shapes using the command bus.
 */
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

/**
 * Duplicate all currently selected, unlocked shapes via command bus.
 * New shapes are selected after duplication.
 */
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

/**
 * Lock all currently selected, unlocked shapes (selection preserved).
 */
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

/**
 * Unlock selected shapes; if none selected, unlock all locked shapes.
 */
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
    // No selection: let command unlock all locked shapes
    dispatch({ type: 'UNLOCK_SHAPES' });
  }
}

/**
 * Reset rotation (angle) to 0° for all currently selected, unlocked Rect/Circle/Ellipse shapes.
 * NOP for Point shapes.
 */
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

/**
 * Alignment (left/centerX/right/top/middleY/bottom) for selected shapes.
 */
export { alignSelected } from './actions-alignment.js';
