/**
 * actions.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Business Logic for Scene Actions (ESM ONLY, Manifesto-compliant)
 * - Centralizes all scene actions: add shape, delete, duplicate, lock, unlock, select, etc.
 * - All business rules (selection, stroke width, transformer handling) are here.
 * - UI (toolbars, keyboard, etc.) emit only intents and never mutate state or selection directly.
 * - Exports: addShapeOfType, deleteSelectedShapes, duplicateSelectedShapes, lockSelectedShapes, unlockSelectedShapes
 * - All logging via log.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  makePointShape,
  makeRectShape,
  makeCircleShape,
  setStrokeWidthForSelectedShapes
} from './shapes.js';
import {
  getState,
  addShape,
  removeShape,
  setSelectedShapes
} from './state.js';
import {
  setSelectedShapes as selectionSetSelectedShapes,
  deselectAll
} from './selection.js';

/**
 * Add a shape of the given type, apply business rules (select, stroke width).
 * Handles creation, addition, selection, and stroke width logic.
 * @param {string} type - "point", "rect", "circle"
 * @param {Object} [opts] - Optional settings override (position, etc)
 */
export function addShapeOfType(type, opts = {}) {
  log("DEBUG", "[actions] addShapeOfType ENTRY", { type, opts });
  const store = getState();
  const w = store.settings?.defaultRectWidth || 50;
  const h = store.settings?.defaultRectHeight || 30;
  const r = store.settings?.defaultCircleRadius || 15;
  const x = opts.x !== undefined
    ? opts.x
    : (store.settings?.canvasMaxWidth || 600) * ((store.settings?.shapeStartXPercent ?? 50) / 100);
  const y = opts.y !== undefined
    ? opts.y
    : (store.settings?.canvasMaxHeight || 400) * ((store.settings?.shapeStartYPercent ?? 50) / 100);

  let shape = null;
  if (type === "rect") {
    shape = makeRectShape(x - w / 2, y - h / 2, w, h);
  } else if (type === "circle") {
    shape = makeCircleShape(x, y, r);
  } else if (type === "point") {
    shape = makePointShape(x, y);
  }
  if (shape) {
    addShape(shape);
    // Always select and enter edit mode for new shape (only here, not in toolbar)
    selectionSetSelectedShapes([shape]);
    // Set stroke width as a business rule (from settings or default)
    const strokeWidth = store.settings?.defaultStrokeWidth ?? 1;
    setStrokeWidthForSelectedShapes(strokeWidth);
    log("INFO", `[actions] Added ${type} shape`, shape);
  } else {
    log("WARN", "[actions] addShapeOfType: Failed to create shape", { type, opts });
  }
  log("DEBUG", "[actions] addShapeOfType EXIT");
}

/**
 * Delete all currently selected, unlocked shapes.
 * Always clears selection and detaches transformer after deletion.
 * Now guarded: if nothing is selected, do nothing.
 */
export function deleteSelectedShapes() {
  log("DEBUG", "[actions] deleteSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] deleteSelectedShapes: No shapes selected, nothing to delete.");
    log("DEBUG", "[actions] deleteSelectedShapes EXIT (no action)");
    return; // EARLY RETURN: do nothing if none selected
  }
  const unlockedToDelete = selected.filter(s => !s.locked);
  log("DEBUG", "[actions] deleteSelectedShapes: unlocked shapes to delete", { unlockedToDelete });
  unlockedToDelete.forEach(shape => {
    removeShape(shape);
  });
  // Always deselect all after deletion
  deselectAll();
  log("INFO", "[actions] deleteSelectedShapes: Deleted shapes, selection cleared");
  log("DEBUG", "[actions] deleteSelectedShapes EXIT", {
    shapesInStoreAfter: getState().shapes.map(s => ({
      _id: s._id, _type: s._type, _label: s._label
    }))
  });
}

/**
 * Duplicate all currently selected, unlocked shapes.
 * The new shapes are selected after duplication.
 */
export function duplicateSelectedShapes() {
  log("DEBUG", "[actions] duplicateSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
  const selected = getState().selectedShapes || [];
  const unlockedToDuplicate = selected.filter(s => !s.locked);
  const offset = 20;
  let newShapes = [];
  unlockedToDuplicate.forEach(orig => {
    let clone;
    if (orig._type === "rect") {
      clone = makeRectShape(orig.left + offset, orig.top + offset, orig.width, orig.height);
    } else if (orig._type === "circle") {
      clone = makeCircleShape(orig.left + offset, orig.top + offset, orig.radius);
    } else if (orig._type === "point") {
      clone = makePointShape(orig.left + offset, orig.top + offset);
    }
    if (clone) {
      addShape(clone);
      newShapes.push(clone);
    }
  });
  if (newShapes.length > 0) {
    selectionSetSelectedShapes(newShapes);
    setStrokeWidthForSelectedShapes(getState().settings?.defaultStrokeWidth ?? 1);
    log("INFO", "[actions] duplicateSelectedShapes: Duplicated shapes and selected new", {
      newShapes: newShapes.map(s => s._id)
    });
  }
  log("DEBUG", "[actions] duplicateSelectedShapes EXIT");
}

/**
 * Lock all currently selected shapes.
 */
export function lockSelectedShapes() {
  log("DEBUG", "[actions] lockSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
  const selected = getState().selectedShapes || [];
  selected.forEach(shape => {
    shape.locked = true;
    shape.selectable = false;
    shape.evented = false;
  });
  selectionSetSelectedShapes([]); // Deselect all after lock
  log("INFO", "[actions] lockSelectedShapes: Locked shapes and cleared selection", {
    lockedShapes: selected.map(s => s._id)
  });
  log("DEBUG", "[actions] lockSelectedShapes EXIT");
}

/**
 * Unlock all currently selected shapes.
 */
export function unlockSelectedShapes() {
  log("DEBUG", "[actions] unlockSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
  const selected = getState().selectedShapes || [];
  selected.forEach(shape => {
    shape.locked = false;
    shape.selectable = true;
    shape.evented = true;
  });
  log("INFO", "[actions] unlockSelectedShapes: Unlocked shapes", {
    unlockedShapes: selected.map(s => s._id)
  });
  log("DEBUG", "[actions] unlockSelectedShapes EXIT");
}
