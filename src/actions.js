/**
 * actions.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Business Logic for Scene Actions (ESM ONLY, Zustand Refactor)
 * - All toolbar/keyboard/intent actions are routed here: delete, duplicate, lock, unlock, etc.
 * - No direct mutation of state or shapes from UI. Only emit actions via this module.
 * - All state via Zustand store (state.js), all logging via log.js.
 * - Robust selection handling: always operate on selectedShapes array, never stale references.
 * - Extra TRACE logging for all action entry/exit, shape ids, shape references, and state after each operation.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  getState,
  setShapes,
  setSelectedShapes,
  removeShape,
  addShape,
} from './state.js';
import { deselectShape } from './shape-state.js';
import { attachSelectionHandlers } from './selection.js';

/**
 * Delete all selected shapes (unlocked only).
 * Always operates on latest selectedShapes array from state.js.
 * Extra TRACE logging for all state transitions and shape references.
 */
export function deleteSelectedShapes() {
  log("TRACE", "[actions] deleteSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    })),
    shapesStore: getState().shapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });

  const selected = getState().selectedShapes;
  if (!selected || selected.length === 0) {
    log("WARN", "[actions] No shapes selected for deletion");
    log("TRACE", "[actions] deleteSelectedShapes EXIT (no selection)");
    return;
  }

  // Filter unlocked shapes only
  const unlocked = selected.filter(s => !s.locked);
  if (unlocked.length === 0) {
    log("WARN", "[actions] No unlocked shapes to delete");
    log("TRACE", "[actions] deleteSelectedShapes EXIT (all selected locked)");
    return;
  }

  // Remove each unlocked selected shape by _id
  unlocked.forEach(shape => {
    log("TRACE", "[actions] Removing shape", {
      shapeId: shape._id,
      shapeType: shape._type,
      shapeLabel: shape._label,
      locked: shape.locked
    });
    removeShape(shape);
    deselectShape(shape);
  });

  // After deletion, clear selection
  setSelectedShapes([]);

  // Extra TRACE: Dump shapes store after delete
  log("TRACE", "[actions] deleteSelectedShapes - shapes after delete", {
    shapesStore: getState().shapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });

  log("INFO", "[actions] Deleted selected shapes", {
    deletedIds: unlocked.map(s => s._id),
    deletedTypes: unlocked.map(s => s._type),
    deletedLabels: unlocked.map(s => s._label)
  });

  log("TRACE", "[actions] deleteSelectedShapes EXIT");
}

/**
 * Duplicate selected shapes (unlocked only).
 * Each duplicate gets a new _id and label.
 * Extra TRACE logging for all duplication steps.
 */
export function duplicateSelectedShapes() {
  log("TRACE", "[actions] duplicateSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });

  const selected = getState().selectedShapes;
  if (!selected || selected.length === 0) {
    log("WARN", "[actions] No shapes selected for duplication");
    log("TRACE", "[actions] duplicateSelectedShapes EXIT (no selection)");
    return;
  }

  const unlocked = selected.filter(s => !s.locked);
  if (unlocked.length === 0) {
    log("WARN", "[actions] No unlocked shapes to duplicate");
    log("TRACE", "[actions] duplicateSelectedShapes EXIT (all selected locked)");
    return;
  }

  const offset = 18;
  const newShapes = [];

  unlocked.forEach(orig => {
    let clone = null;
    if (orig._type === "rect") {
      clone = orig.clone();
      clone.left = orig.left + offset;
      clone.top = orig.top + offset;
    } else if (orig._type === "circle") {
      clone = orig.clone();
      clone.left = orig.left + offset;
      clone.top = orig.top + offset;
    } else if (orig._type === "point") {
      // For points: use shape factory to create a new one
      const { left, top } = orig;
      import('./shapes.js').then(({ makePointShape }) => {
        const point = makePointShape(left + offset, top + offset);
        point._label = orig._label + "-copy";
        point.locked = orig.locked;
        addShape(point);
        attachSelectionHandlers(point);
        newShapes.push(point);
        setSelectedShapes(newShapes);
      });
      return; // points handled async
    }
    if (!clone) return;
    clone._id = `${orig._type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    let baseLabel = orig._label.replace(/-copy(\d*)$/, '');
    let newLabel = baseLabel + "-copy";
    let labelIndex = 1;
    // Ensure unique label
    while (getState().shapes.concat(newShapes).some(s => s._label === newLabel)) {
      labelIndex++;
      newLabel = baseLabel + "-copy" + labelIndex;
    }
    clone._label = newLabel;
    clone.locked = orig.locked;
    addShape(clone);
    attachSelectionHandlers(clone);
    newShapes.push(clone);
  });

  if (newShapes.length > 0) {
    setSelectedShapes(newShapes);
    log("INFO", "[actions] Duplicated shapes", {
      newIds: newShapes.map(s => s._id),
      newTypes: newShapes.map(s => s._type),
      newLabels: newShapes.map(s => s._label)
    });
  }

  log("TRACE", "[actions] duplicateSelectedShapes EXIT");
}

/**
 * Lock all selected shapes.
 * Extra TRACE logging.
 */
export function lockSelectedShapes() {
  log("TRACE", "[actions] lockSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });

  const selected = getState().selectedShapes;
  if (!selected || selected.length === 0) {
    log("WARN", "[actions] No shapes selected for locking");
    log("TRACE", "[actions] lockSelectedShapes EXIT (no selection)");
    return;
  }

  selected.forEach(shape => {
    shape.locked = true;
    shape.selectable = false;
    shape.evented = false;
  });

  log("INFO", "[actions] Locked selected shapes", {
    lockedIds: selected.map(s => s._id)
  });

  log("TRACE", "[actions] lockSelectedShapes EXIT");
}

/**
 * Unlock all selected shapes.
 * Extra TRACE logging.
 */
export function unlockSelectedShapes() {
  log("TRACE", "[actions] unlockSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });

  const selected = getState().selectedShapes;
  if (!selected || selected.length === 0) {
    log("WARN", "[actions] No shapes selected for unlocking");
    log("TRACE", "[actions] unlockSelectedShapes EXIT (no selection)");
    return;
  }

  selected.forEach(shape => {
    shape.locked = false;
    shape.selectable = true;
    shape.evented = true;
  });

  log("INFO", "[actions] Unlocked selected shapes", {
    unlockedIds: selected.map(s => s._id)
  });

  log("TRACE", "[actions] unlockSelectedShapes EXIT");
}

