/**
 * actions.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Business Logic for Scene Actions (ESM ONLY, Manifesto-compliant, DEBUG Logging Sweep)
 * - Centralizes all scene actions: add shape, delete, duplicate, lock, unlock, select, reset rotation, etc.
 * - All business rules (selection, stroke width, transformer handling) are here.
 * - UI (toolbars, keyboard, etc.) emit only intents and never mutate state or selection directly.
 * - Exports:
 *    addShapeOfType,
 *    deleteSelectedShapes,
 *    duplicateSelectedShapes,
 *    lockSelectedShapes,
 *    unlockSelectedShapes,
 *    resetRotationForSelectedShapes,
 *    alignSelected
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
  setShapes,
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
  log("DEBUG", "[actions] addShapeOfType ENTRY", { type, opts, stateBefore: {...getState()} });
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
    log("DEBUG", "[actions] addShapeOfType: shape created", { type, shape, shapeId: shape._id });
    addShape(shape);
    log("DEBUG", "[actions] addShapeOfType: shape added to store", { shapesAfter: getState().shapes.map(s=>s._id) });
    // Always select and enter edit mode for new shape (only here, not in toolbar)
    selectionSetSelectedShapes([shape]);
    log("DEBUG", "[actions] addShapeOfType: selection set", { selectedShape: shape._id, selectedShapes: getState().selectedShapes.map(s=>s._id) });
    // Set stroke width as a business rule (from settings or default)
    const strokeWidth = store.settings?.defaultStrokeWidth ?? 1;
    setStrokeWidthForSelectedShapes(strokeWidth);
    log("INFO", `[actions] Added ${type} shape`, shape);
  } else {
    log("WARN", "[actions] addShapeOfType: Failed to create shape", { type, opts });
  }
  log("DEBUG", "[actions] addShapeOfType EXIT", { stateAfter: {...getState()} });
}

/**
 * Delete all currently selected, unlocked shapes.
 * Always clears selection and detaches transformer after deletion.
 * Now guarded: if nothing is selected, do nothing.
 * **FIXED: Removes all selected unlocked shapes in a batch, avoiding mutation-during-iteration bugs.**
 */
export function deleteSelectedShapes() {
  log("DEBUG", "[actions] deleteSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id, _type: s?._type, _label: s?._label
    })),
    shapesBefore: getState().shapes.map(s => ({
      _id: s?._id, _type: s?._type, _label: s?._label
    }))
  });
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] deleteSelectedShapes: No shapes selected, nothing to delete.");
    log("DEBUG", "[actions] deleteSelectedShapes EXIT (no action)", { shapesAfter: getState().shapes.map(s=>s._id) });
    return; // EARLY RETURN: do nothing if none selected
  }
  const unlockedToDeleteIds = selected.filter(s => !s.locked).map(s => s._id);
  log("DEBUG", "[actions] deleteSelectedShapes: unlocked shapes to delete", { unlockedToDeleteIds });
  // Remove all shapes by _id at once
  const newShapes = getState().shapes.filter(s => !unlockedToDeleteIds.includes(s._id));
  log("DEBUG", "[actions] deleteSelectedShapes: newShapes array after filter", { newShapesIds: newShapes.map(s=>s._id) });
  setShapes(newShapes);
  // Always deselect all after deletion
  deselectAll();
  log("INFO", "[actions] deleteSelectedShapes: Deleted shapes, selection cleared");
  log("DEBUG", "[actions] deleteSelectedShapes EXIT", {
    shapesInStoreAfter: getState().shapes.map(s => ({
      _id: s._id, _type: s._type, _label: s._label
    })),
    selectedShapesAfter: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Internal: Generate a new unique shape id based on type.
 */
function _newIdFor(type = "shape") {
  return `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/**
 * Duplicate all currently selected, unlocked shapes.
 * The new shapes are selected after duplication.
 * - Preserves all visual properties (size, rotation, stroke/fill, reticle style, etc.).
 * - Offsets position by a small nudge.
 */
export function duplicateSelectedShapes() {
  log("DEBUG", "[actions] duplicateSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id, _type: s?._type, _label: s?._label
    })),
    shapesBefore: getState().shapes.map(s => ({
      _id: s?._id, _type: s?._type, _label: s?._label
    }))
  });

  const selected = getState().selectedShapes || [];
  const unlockedToDuplicate = selected.filter(s => !s.locked);
  const offset = 20;

  if (unlockedToDuplicate.length === 0) {
    log("INFO", "[actions] duplicateSelectedShapes: No unlocked shapes selected");
    return;
  }

  const canvas = getState().fabricCanvas;
  let promises = unlockedToDuplicate.map(orig => new Promise((resolve) => {
    if (typeof orig.clone === "function") {
      try {
        orig.clone((cloned) => {
          try {
            // Offset and ensure unlocked/selectable
            cloned.left = (orig.left ?? 0) + offset;
            cloned.top = (orig.top ?? 0) + offset;
            cloned.locked = false;
            cloned.selectable = true;
            cloned.evented = true;
            // Ensure all movement/transform locks are cleared on the clone
            cloned.lockMovementX = false;
            cloned.lockMovementY = false;
            cloned.lockScalingX = false;
            cloned.lockScalingY = false;
            cloned.lockRotation = false;
            cloned.hoverCursor = 'move';

            // New id, keep label/type
            cloned._type = orig._type;
            cloned._label = orig._label;
            cloned._id = _newIdFor(orig._type || "shape");

            // Remove any selection-outline artifacts from clone, ensure strokeUniform on primitives
            if (Array.isArray(cloned._objects)) {
              // Filter out any outlines (if ever cloned)
              cloned._objects = cloned._objects.filter(obj => !obj._isSelectionOutline);
              // Re-apply strokeUniform where applicable
              cloned._objects.forEach(obj => {
                if ('strokeUniform' in obj) obj.strokeUniform = true;
              });
              // Update diagnostic label text to reflect the new id
              const labelChild = cloned._objects.find(o => o && o._isDiagnosticLabel);
              if (labelChild && typeof labelChild.set === 'function') {
                const base = cloned._label || (cloned._type ? (cloned._type[0].toUpperCase() + cloned._type.slice(1)) : "Shape");
                labelChild.set({ text: `${base}\n${cloned._id}` });
              }
            }

            // Add to store; canvas sync will render
            addShape(cloned);
            // Keep diagnostic log small
            log("DEBUG", "[actions] duplicateSelectedShapes: cloned shape added", { cloneId: cloned._id, type: cloned._type });
            resolve(cloned);
          } catch (e) {
            log("ERROR", "[actions] duplicateSelectedShapes: post-clone adjust failed", e);
            resolve(null);
          }
        });
      } catch (e) {
        log("ERROR", "[actions] duplicateSelectedShapes: clone() threw", e);
        resolve(null);
      }
    } else {
      // Fallback: create via factory (less fidelity). Should rarely happen.
      let clone = null;
      if (orig._type === "rect") {
        clone = makeRectShape(orig.left + offset, orig.top + offset, orig.width, orig.height);
      } else if (orig._type === "circle") {
        clone = makeCircleShape(orig.left + offset + (orig.radius || 0), orig.top + offset + (orig.radius || 0), orig.radius);
      } else if (orig._type === "point") {
        clone = makePointShape(orig.left + offset, orig.top + offset);
      }
      if (clone) {
        // Ensure unlocked/selectable defaults
        clone.locked = false;
        clone.selectable = true;
        clone.evented = true;
        clone.lockMovementX = false;
        clone.lockMovementY = false;
        clone.lockScalingX = false;
        clone.lockScalingY = false;
        clone.lockRotation = false;
        clone.hoverCursor = 'move';

        addShape(clone);
        log("WARN", "[actions] duplicateSelectedShapes: used fallback factory clone", { cloneId: clone._id, type: clone._type });
      }
      resolve(clone);
    }
  }));

  Promise.all(promises).then(newShapes => {
    const created = newShapes.filter(Boolean);
    if (created.length > 0) {
      selectionSetSelectedShapes(created);
      // Do NOT override stroke widths here; preserve cloned visuals
      log("INFO", "[actions] duplicateSelectedShapes: Duplicated shapes and selected new", {
        newShapes: created.map(s => s._id)
      });
    }
    log("DEBUG", "[actions] duplicateSelectedShapes EXIT", {
      shapesInStoreAfter: getState().shapes.map(s => ({
        _id: s._id, _type: s._type, _label: s._label
      })),
      selectedShapesAfter: getState().selectedShapes.map(s => s?._id)
    });
  });
}

/**
 * Lock all currently selected shapes.
 * - Keeps selection so the Unlock button can act on them.
 * - Shapes remain selectable (for sidebar/marquee) but are non-movable/non-transformable.
 * - Applies Fabric locks: lockMovementX/Y, lockScalingX/Y, lockRotation = true.
 * - Sets hover cursor to 'not-allowed'.
 */
export function lockSelectedShapes() {
  log("DEBUG", "[actions] lockSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id, _type: s?._type, _label: s?._label
    }))
  });
  const selected = getState().selectedShapes || [];
  const canvas = getState().fabricCanvas;

  selected.forEach(shape => {
    // Business flag
    shape.locked = true;
    // Keep selectable for UX (so users can reselect to unlock)
    shape.selectable = true;
    shape.evented = true;
    // Fabric movement/transform locks
    shape.lockMovementX = true;
    shape.lockMovementY = true;
    shape.lockScalingX = true;
    shape.lockScalingY = true;
    shape.lockRotation = true;
    // UX hint
    shape.hoverCursor = 'not-allowed';

    if (typeof shape.setCoords === "function") {
      try { shape.setCoords(); } catch {}
    }
    log("DEBUG", "[actions] lockSelectedShapes: shape locked", { shapeId: shape._id, type: shape._type, label: shape._label });
  });

  // Keep selection; refresh selection module to update outlines/transformer
  selectionSetSelectedShapes(selected.slice());

  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }

  log("INFO", "[actions] lockSelectedShapes: Locked shapes (selection preserved)", {
    lockedShapes: selected.map(s => s._id)
  });
  log("DEBUG", "[actions] lockSelectedShapes EXIT", {
    shapesInStoreAfter: getState().shapes.map(s => ({
      _id: s._id, _type: s._type, _label: s._label
    })),
    selectedShapesAfter: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Unlock selected shapes; if none selected, unlock all locked shapes in store.
 * - Clears Fabric movement/transform locks.
 * - Restores hover cursor to 'move'.
 */
export function unlockSelectedShapes() {
  log("DEBUG", "[actions] unlockSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id, _type: s?._type, _label: s?._label
    }))
  });
  const selected = getState().selectedShapes || [];
  const canvas = getState().fabricCanvas;

  let targets = selected.length > 0
    ? selected.filter(Boolean)
    : (getState().shapes || []).filter(s => s.locked);

  targets.forEach(shape => {
    // Business flag
    shape.locked = false;
    // Keep selectable and interactive
    shape.selectable = true;
    shape.evented = true;
    // Clear Fabric movement/transform locks
    shape.lockMovementX = false;
    shape.lockMovementY = false;
    shape.lockScalingX = false;
    shape.lockScalingY = false;
    shape.lockRotation = false;
    // UX cursor
    shape.hoverCursor = 'move';

    if (typeof shape.setCoords === "function") {
      try { shape.setCoords(); } catch {}
    }
    log("DEBUG", "[actions] unlockSelectedShapes: shape unlocked", { shapeId: shape._id, type: shape._type, label: shape._label });
  });

  if (targets.length === 0) {
    log("INFO", "[actions] unlockSelectedShapes: No shapes to unlock");
  } else {
    // Refresh selection to update transformer/outlines; preserve current selection
    const preserve = getState().selectedShapes.slice();
    selectionSetSelectedShapes(preserve);
    if (canvas) {
      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();
    }
    log("INFO", "[actions] unlockSelectedShapes: Unlocked shapes", {
      unlockedShapes: targets.map(s => s._id),
      selectionPreserved: preserve.map(s => s._id)
    });
  }

  log("DEBUG", "[actions] unlockSelectedShapes EXIT", {
    shapesInStoreAfter: getState().shapes.map(s => ({
      _id: s._id, _type: s._type, _label: s._label
    })),
    selectedShapesAfter: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Reset rotation (angle) to 0° for all currently selected, unlocked Rect/Circle shapes.
 * - NOP for Point shapes.
 * - Preserves the visual center position during the rotation reset (keeps pivot).
 * - Calls canvas.requestRenderAll() once at the end.
 */
export function resetRotationForSelectedShapes() {
  const stateBefore = getState();
  const selected = stateBefore.selectedShapes || [];
  log("DEBUG", "[actions] resetRotationForSelectedShapes ENTRY", {
    selected: selected.map(s => ({ id: s?._id, type: s?._type, locked: s?.locked, angle: s?.angle }))
  });

  const targets = selected.filter(s =>
    s && !s.locked && (s._type === 'rect' || s._type === 'circle')
  );

  if (targets.length === 0) {
    log("INFO", "[actions] resetRotationForSelectedShapes: No eligible shapes (need unlocked rect/circle)");
    return;
  }

  const canvas = getState().fabricCanvas;

  targets.forEach(shape => {
    try {
      // Capture current center in canvas coordinates
      const center = (typeof shape.getCenterPoint === "function")
        ? shape.getCenterPoint()
        : {
            x: (shape.left ?? 0) + ((typeof shape.getScaledWidth === "function" ? shape.getScaledWidth() : shape.width) || 0) / 2,
            y: (shape.top ?? 0) + ((typeof shape.getScaledHeight === "function" ? shape.getScaledHeight() : shape.height) || 0) / 2
          };

      // Reset rotation around its center
      shape.set({ angle: 0 });

      // Reposition so the center stays invariant
      if (typeof shape.setPositionByOrigin === "function") {
        shape.setPositionByOrigin(center, 'center', 'center');
      } else {
        // Fallback: compute top-left from center and current dimensions
        const w = typeof shape.getScaledWidth === "function" ? shape.getScaledWidth() : (shape.width || 0);
        const h = typeof shape.getScaledHeight === "function" ? shape.getScaledHeight() : (shape.height || 0);
        shape.set({ left: center.x - w / 2, top: center.y - h / 2 });
      }

      if (typeof shape.setCoords === "function") shape.setCoords();

      log("DEBUG", "[actions] resetRotationForSelectedShapes: angle set to 0 and center preserved", {
        id: shape._id, type: shape._type, center
      });
    } catch (e) {
      log("ERROR", "[actions] resetRotationForSelectedShapes: failed to reset angle", { shapeId: shape._id, error: e });
    }
  });

  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }

  log("INFO", "[actions] resetRotationForSelectedShapes: Rotation reset to 0° (center preserved) for", {
    ids: targets.map(t => t._id)
  });
  log("DEBUG", "[actions] resetRotationForSelectedShapes EXIT", {
    selectedAfter: getState().selectedShapes.map(s => ({ id: s?._id, angle: s?.angle }))
  });
}

/**
 * Alignment (left/centerX/right/top/middleY/bottom) for selected shapes.
 * - Reference: 'selection' (default) or 'canvas'
 * - Implementation located in actions-alignment.js
 */
export { alignSelected } from './actions-alignment.js';

