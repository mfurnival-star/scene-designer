/**
 * actions.js
 * -----------------------------------------------------------
 * Centralized Scene Actions for Scene Designer (ESM ONLY, Zustand Refactor)
 * - All business logic for shape management, deletion, duplication, locking, unlocking, etc.
 * - UI modules (e.g., toolbar.js) call these action functions with intents.
 * - Ensures separation of concerns; makes toolbars swappable/testable.
 * - Logging via log.js.
 * - All state flows via state.js store and shape modules.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  getState,
  setSelectedShapes,
  removeShape,
  addShape
} from './state.js';

import { setStrokeWidthForSelectedShapes, makeRectShape, makeCircleShape, makePointShape } from './shapes.js';

/**
 * Delete all currently selected, unlocked shapes.
 */
export function deleteSelectedShapes() {
  log("INFO", "[actions] deleteSelectedShapes called");
  const selected = (getState().selectedShapes || []).filter(s => !s.locked);
  if (!selected.length) {
    log("INFO", "[actions] No unlocked shapes selected for deletion");
    return;
  }
  selected.forEach(shape => {
    removeShape(shape);
    if (getState().fabricCanvas) {
      getState().fabricCanvas.remove(shape);
    }
  });
  setSelectedShapes([]);
  log("INFO", "[actions] Deleted selected unlocked shapes", { count: selected.length });
}

/**
 * Duplicate all currently selected shapes (offset new shapes slightly).
 */
export function duplicateSelectedShapes() {
  log("INFO", "[actions] duplicateSelectedShapes called");
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] No shapes selected for duplication");
    return;
  }
  const offset = 20;
  let newShapes = [];
  selected.forEach(orig => {
    let shape = null;
    if (orig._type === 'rect') {
      shape = makeRectShape(orig.left + offset, orig.top + offset, orig.width, orig.height);
    } else if (orig._type === 'circle') {
      shape = makeCircleShape(orig.left + offset, orig.top + offset, orig.radius);
    } else if (orig._type === 'point') {
      shape = makePointShape(orig.left + offset, orig.top + offset);
    }
    if (!shape) return;
    shape.locked = orig.locked;
    addShape(shape);
    newShapes.push(shape);
    if (getState().fabricCanvas) {
      getState().fabricCanvas.add(shape);
    }
  });
  setSelectedShapes(newShapes);
  setStrokeWidthForSelectedShapes(1);
  log("INFO", "[actions] Duplicated shapes", { count: newShapes.length });
}

/**
 * Lock all currently selected shapes.
 */
export function lockSelectedShapes() {
  log("INFO", "[actions] lockSelectedShapes called");
  const selected = getState().selectedShapes || [];
  selected.forEach(shape => {
    shape.locked = true;
    shape.selectable = false;
    shape.evented = false;
  });
  setSelectedShapes(selected);
  if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  log("INFO", "[actions] Locked selected shapes", { count: selected.length });
}

/**
 * Unlock all currently selected shapes.
 */
export function unlockSelectedShapes() {
  log("INFO", "[actions] unlockSelectedShapes called");
  const selected = getState().selectedShapes || [];
  selected.forEach(shape => {
    shape.locked = false;
    shape.selectable = true;
    shape.evented = true;
  });
  setSelectedShapes(selected);
  if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  log("INFO", "[actions] Unlocked selected shapes", { count: selected.length });
}

