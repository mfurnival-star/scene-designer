/**
 * actions.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Business Logic for Scene Actions (Full TRACE Logging Edition)
 * - All toolbar/UI intents for delete, duplicate, lock, unlock, etc. are handled here.
 * - Ensures separation of concerns and robust state mutation.
 * - Uses Zustand-style store from state.js.
 * - No direct mutation from UI modules.
 * - Exports: deleteSelectedShapes, duplicateSelectedShapes, lockSelectedShapes, unlockSelectedShapes.
 * - **EXHAUSTIVE TRACE logging at all entry/exit points, state dumps, and shape operations.**
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState, setShapes, setSelectedShapes, removeShape, addShape } from './state.js';
import { setSelectedShape, selectAllShapes, deselectAll } from './selection.js';
import { setShapeState, lockShape, unlockShape } from './shape-state.js';

/**
 * Delete all selected shapes (unlocked only).
 * Called by toolbar and keyboard shortcut.
 * Logs all entry/exit, state, and shape IDs before/after.
 */
export function deleteSelectedShapes() {
  log("TRACE", "[actions] deleteSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    })),
    shapesInStore: getState().shapes.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label,
      locked: s.locked
    }))
  });

  const unlockedToDelete = getState().selectedShapes.filter(s => !s.locked);
  log("TRACE", "[actions] deleteSelectedShapes: unlocked shapes to delete", {
    unlockedToDelete: unlockedToDelete.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label
    }))
  });

  // Remove from shapes array in store
  unlockedToDelete.forEach(s => {
    log("TRACE", "[actions] deleteSelectedShapes: removing shape", {
      _id: s._id,
      _type: s._type,
      _label: s._label
    });
    removeShape(s);
  });

  // Deselect all after deletion
  deselectAll();

  log("TRACE", "[actions] deleteSelectedShapes EXIT", {
    shapesInStoreAfter: getState().shapes.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label,
      locked: s.locked
    })),
    selectedShapesAfter: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });
}

/**
 * Duplicate all selected shapes (unlocked only).
 * Creates new shapes with offset and new IDs.
 * Logs every step.
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

  const unlockedToDuplicate = getState().selectedShapes.filter(s => !s.locked);
  const offset = 20;
  let newShapes = [];

  unlockedToDuplicate.forEach(orig => {
    let clone;
    const type = orig._type;
    log("TRACE", "[actions] duplicateSelectedShapes: duplicating shape", {
      _id: orig._id,
      type,
      label: orig._label
    });

    // Clone shape based on type
    if (type === "rect") {
      clone = { ...orig };
      clone.left = (orig.left || 0) + offset;
      clone.top = (orig.top || 0) + offset;
      clone._id = `rect_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      clone._label = orig._label + "_copy";
      clone.locked = false;
    } else if (type === "circle") {
      clone = { ...orig };
      clone.left = (orig.left || 0) + offset;
      clone.top = (orig.top || 0) + offset;
      clone._id = `circle_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      clone._label = orig._label + "_copy";
      clone.locked = false;
    } else if (type === "point") {
      clone = { ...orig };
      clone.left = (orig.left || 0) + offset;
      clone.top = (orig.top || 0) + offset;
      clone._id = `point_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      clone._label = orig._label + "_copy";
      clone.locked = false;
    }
    if (clone) {
      addShape(clone);
      newShapes.push(clone);
      log("TRACE", "[actions] duplicateSelectedShapes: new shape added", {
        _id: clone._id,
        type: clone._type,
        label: clone._label
      });
    }
  });

  // Select all newly duplicated shapes
  setSelectedShapes(newShapes);

  log("TRACE", "[actions] duplicateSelectedShapes EXIT", {
    newShapes: newShapes.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label,
      locked: s.locked
    })),
    shapesInStoreAfter: getState().shapes.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label,
      locked: s.locked
    }))
  });
}

/**
 * Lock all selected shapes.
 * Updates lock property and disables drag/transform.
 * Logs all state changes.
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

  getState().selectedShapes.forEach(s => {
    log("TRACE", "[actions] lockSelectedShapes: locking shape", {
      _id: s._id,
      _type: s._type,
      _label: s._label
    });
    lockShape(s);
  });

  log("TRACE", "[actions] lockSelectedShapes EXIT", {
    selectedShapesAfter: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });
}

/**
 * Unlock all selected shapes.
 * Updates lock property and enables drag/transform.
 * Logs all state changes.
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

  getState().selectedShapes.forEach(s => {
    log("TRACE", "[actions] unlockSelectedShapes: unlocking shape", {
      _id: s._id,
      _type: s._type,
      _label: s._label
    });
    unlockShape(s);
  });

  log("TRACE", "[actions] unlockSelectedShapes EXIT", {
    selectedShapesAfter: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      locked: s?.locked
    }))
  });
}


</code>
