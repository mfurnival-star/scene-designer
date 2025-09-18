/**
 * actions.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Business Logic for Scene Actions (Delete, Duplicate, Lock, Unlock)
 * - All toolbar/UI panels emit intents here.
 * - Decoupled from toolbar and selection UI.
 * - Only operates on shapes currently selected (via selection.js).
 * - Ensures locked shapes cannot be deleted or modified.
 * - Duplicate creates new shapes offset from originals, assigns new _id.
 * - Lock/unlock toggles locked state and disables/enables transformer/anchors.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  getState,
  setShapes,
  setSelectedShapes,
  removeShape,
  addShape
} from './state.js';
import { setShapeState, lockShape, unlockShape } from './shape-state.js';
import { makePointShape, makeRectShape, makeCircleShape } from './shapes.js';
import { attachSelectionHandlers } from './selection.js';

/**
 * Delete all selected shapes (except locked).
 */
export function deleteSelectedShapes() {
  log("INFO", "[actions] deleteSelectedShapes intent received");
  const selected = getState().selectedShapes || [];
  const unlocked = selected.filter(s => !s.locked);
  if (unlocked.length === 0) {
    log("WARN", "[actions] No unlocked shapes to delete");
    return;
  }
  unlocked.forEach(shape => {
    removeShape(shape);
    log("INFO", "[actions] Shape deleted", {
      type: shape._type,
      label: shape._label,
      id: shape._id
    });
  });
  setSelectedShapes([]);
  log("INFO", "[actions] deleteSelectedShapes complete");
}

/**
 * Duplicate all selected shapes (except locked).
 */
export function duplicateSelectedShapes() {
  log("INFO", "[actions] duplicateSelectedShapes intent received");
  const selected = getState().selectedShapes || [];
  const unlocked = selected.filter(s => !s.locked);
  if (unlocked.length === 0) {
    log("WARN", "[actions] No unlocked shapes to duplicate");
    return;
  }
  let newShapes = [];
  unlocked.forEach(orig => {
    let clone;
    const offset = 20;
    if (orig._type === 'rect') {
      clone = makeRectShape(
        orig.left + offset, orig.top + offset,
        orig.width, orig.height
      );
      clone._label = orig._label + "-copy";
    } else if (orig._type === 'circle') {
      clone = makeCircleShape(
        orig.left + offset, orig.top + offset,
        orig.radius
      );
      clone._label = orig._label + "-copy";
    } else if (orig._type === 'point') {
      clone = makePointShape(orig.left + offset, orig.top + offset);
      clone._label = orig._label + "-copy";
    }
    if (clone) {
      clone.locked = false;
      attachSelectionHandlers(clone);
      addShape(clone);
      newShapes.push(clone);
      log("INFO", "[actions] Shape duplicated", {
        type: clone._type,
        label: clone._label,
        id: clone._id
      });
    }
  });
  setSelectedShapes(newShapes);
  log("INFO", "[actions] duplicateSelectedShapes complete");
}

/**
 * Lock all selected shapes.
 */
export function lockSelectedShapes() {
  log("INFO", "[actions] lockSelectedShapes intent received");
  const selected = getState().selectedShapes || [];
  if (selected.length === 0) {
    log("WARN", "[actions] No shapes selected to lock");
    return;
  }
  selected.forEach(shape => {
    lockShape(shape);
    log("INFO", "[actions] Shape locked", {
      type: shape._type,
      label: shape._label,
      id: shape._id
    });
  });
  setSelectedShapes(selected);
  log("INFO", "[actions] lockSelectedShapes complete");
}

/**
 * Unlock all selected shapes.
 */
export function unlockSelectedShapes() {
  log("INFO", "[actions] unlockSelectedShapes intent received");
  const selected = getState().selectedShapes || [];
  if (selected.length === 0) {
    log("WARN", "[actions] No shapes selected to unlock");
    return;
  }
  selected.forEach(shape => {
    unlockShape(shape);
    log("INFO", "[actions] Shape unlocked", {
      type: shape._type,
      label: shape._label,
      id: shape._id
    });
  });
  setSelectedShapes(selected);
  log("INFO", "[actions] unlockSelectedShapes complete");
}

