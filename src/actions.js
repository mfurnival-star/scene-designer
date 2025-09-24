/**
 * actions.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Business Logic for Scene Actions (ESM ONLY)
 * - Centralizes scene actions: add, delete, duplicate, lock, unlock, reset rotation, align.
 * - UI emits intents; no direct state mutation outside this module.
 *
 * Exports:
 *    addShapeOfType,
 *    deleteSelectedShapes,
 *    duplicateSelectedShapes,
 *    lockSelectedShapes,
 *    unlockSelectedShapes,
 *    resetRotationForSelectedShapes,
 *    alignSelected
 *
 * 2025-09-24:
 * - Ellipse shape support added (free aspect, rotatable).
 * - Duplicate now handles ellipse fallback path.
 *
 * Logging Policy (reduced noise):
 * - INFO for user-visible results (added/removed/duplicated/locked/unlocked/reset).
 * - WARN/ERROR for exceptional cases.
 * - Minimal DEBUG retained; no large state dumps.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  makePointShape,
  makeRectShape,
  makeCircleShape,
  makeEllipseShape,
  setStrokeWidthForSelectedShapes
} from './shapes.js';
import {
  getState,
  addShape,
  removeShape,
  setShapes
} from './state.js';
import {
  setSelectedShapes as selectionSetSelectedShapes,
  deselectAll
} from './selection.js';

/**
 * Add a shape of the given type, apply business rules (select, stroke width).
 * @param {string} type - "point" | "rect" | "circle" | "ellipse"
 * @param {Object} [opts] - Optional settings (x,y overrides)
 */
export function addShapeOfType(type, opts = {}) {
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
  } else if (type === "ellipse") {
    shape = makeEllipseShape(x, y, w, h);
  } else if (type === "point") {
    shape = makePointShape(x, y);
  }

  if (!shape) {
    log("WARN", "[actions] addShapeOfType: failed to create shape", { type });
    return;
  }

  addShape(shape);
  selectionSetSelectedShapes([shape]);

  // Apply default stroke width to the new selection
  const strokeWidth = store.settings?.defaultStrokeWidth ?? 1;
  setStrokeWidthForSelectedShapes(strokeWidth);

  log("INFO", "[actions] Shape added", { type, id: shape._id });
}

/**
 * Delete all currently selected, unlocked shapes.
 * Clears selection after deletion.
 */
export function deleteSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] deleteSelectedShapes: nothing selected");
    return;
  }
  const unlockedIds = selected.filter(s => !s.locked).map(s => s._id);
  if (unlockedIds.length === 0) {
    log("INFO", "[actions] deleteSelectedShapes: all selected shapes are locked");
    return;
  }
  const newShapes = getState().shapes.filter(s => !unlockedIds.includes(s._id));
  setShapes(newShapes);
  deselectAll();
  log("INFO", "[actions] Deleted shapes", { count: unlockedIds.length, ids: unlockedIds });
}

/**
 * Internal: Generate a new unique shape id based on type.
 */
function _newIdFor(type = "shape") {
  return `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/**
 * Duplicate all currently selected, unlocked shapes.
 * New shapes are selected after duplication.
 */
export function duplicateSelectedShapes() {
  const selected = getState().selectedShapes || [];
  const unlocked = selected.filter(s => !s.locked);
  const offset = 20;

  if (unlocked.length === 0) {
    log("INFO", "[actions] duplicateSelectedShapes: no unlocked shapes selected");
    return;
  }

  const promises = unlocked.map(orig => new Promise((resolve) => {
    if (typeof orig.clone === "function") {
      try {
        orig.clone((cloned) => {
          try {
            cloned.left = (orig.left ?? 0) + offset;
            cloned.top = (orig.top ?? 0) + offset;
            cloned.locked = false;
            cloned.selectable = true;
            cloned.evented = true;
            cloned.lockMovementX = false;
            cloned.lockMovementY = false;
            cloned.lockScalingX = false;
            cloned.lockScalingY = false;
            cloned.lockRotation = false;
            cloned.hoverCursor = 'move';

            cloned._type = orig._type;
            cloned._label = orig._label;
            cloned._id = _newIdFor(orig._type || "shape");

            if (Array.isArray(cloned._objects)) {
              cloned._objects = cloned._objects.filter(obj => !obj._isSelectionOutline);
              cloned._objects.forEach(obj => {
                if ('strokeUniform' in obj) obj.strokeUniform = true;
              });
              const labelChild = cloned._objects.find(o => o && o._isDiagnosticLabel);
              if (labelChild && typeof labelChild.set === 'function') {
                const base = cloned._label ||
                  (cloned._type ? (cloned._type[0].toUpperCase() + cloned._type.slice(1)) : "Shape");
                labelChild.set({ text: `${base}\n${cloned._id}` });
              }
            }

            addShape(cloned);
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
      // Fallback: factory-based (lower fidelity)
      let clone = null;
      if (orig._type === "rect") {
        clone = makeRectShape(orig.left + offset, orig.top + offset, orig.width, orig.height);
      } else if (orig._type === "circle") {
        clone = makeCircleShape(
          (orig.left ?? 0) + offset + (orig.radius || 0),
          (orig.top ?? 0) + offset + (orig.radius || 0),
          orig.radius
        );
      } else if (orig._type === "ellipse") {
        const w = orig.width || ((orig.getScaledWidth && orig.getScaledWidth()) || 50);
        const h = orig.height || ((orig.getScaledHeight && orig.getScaledHeight()) || 30);
        const centerX = (orig.left ?? 0) + w / 2 + offset;
        const centerY = (orig.top ?? 0) + h / 2 + offset;
        clone = makeEllipseShape(centerX, centerY, w, h);
      } else if (orig._type === "point") {
        clone = makePointShape(orig.left + offset, orig.top + offset);
      }

      if (clone) {
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
        log("WARN", "[actions] duplicateSelectedShapes: used fallback factory clone", {
          cloneId: clone._id, type: clone._type
        });
      }
      resolve(clone);
    }
  }));

  Promise.all(promises).then(newShapes => {
    const created = newShapes.filter(Boolean);
    if (created.length > 0) {
      selectionSetSelectedShapes(created);
      log("INFO", "[actions] Duplicated shapes", { count: created.length, ids: created.map(s => s._id) });
    } else {
      log("INFO", "[actions] duplicateSelectedShapes: no clones created");
    }
  });
}

/**
 * Lock all currently selected shapes (selection preserved).
 */
export function lockSelectedShapes() {
  const selected = getState().selectedShapes || [];
  if (!selected.length) {
    log("INFO", "[actions] lockSelectedShapes: nothing selected");
    return;
  }

  const affected = [];
  selected.forEach(shape => {
    if (!shape) return;
    if (shape.locked) return;
    shape.locked = true;
    shape.selectable = true;
    shape.evented = true;
    shape.lockMovementX = true;
    shape.lockMovementY = true;
    shape.lockScalingX = true;
    shape.lockScalingY = true;
    shape.lockRotation = true;
    shape.hoverCursor = 'not-allowed';
    if (typeof shape.setCoords === "function") {
      try { shape.setCoords(); } catch {}
    }
    affected.push(shape._id);
  });

  if (!affected.length) {
    log("INFO", "[actions] lockSelectedShapes: no unlocked shapes to lock");
    return;
  }

  // Preserve selection
  selectionSetSelectedShapes(selected.slice());
  const canvas = getState().fabricCanvas;
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }

  log("INFO", "[actions] Locked shapes", { count: affected.length, ids: affected });
}

/**
 * Unlock selected shapes; if none selected, unlock all locked shapes.
 */
export function unlockSelectedShapes() {
  const selected = getState().selectedShapes || [];
  const shapes = getState().shapes || [];

  const targets = selected.length > 0
    ? selected.filter(Boolean)
    : shapes.filter(s => s.locked);

  if (!targets.length) {
    log("INFO", "[actions] unlockSelectedShapes: no shapes to unlock");
    return;
  }

  const affected = [];
  targets.forEach(shape => {
    shape.locked = false;
    shape.selectable = true;
    shape.evented = true;
    shape.lockMovementX = false;
    shape.lockMovementY = false;
    shape.lockScalingX = false;
    shape.lockScalingY = false;
    shape.lockRotation = false;
    shape.hoverCursor = 'move';
    if (typeof shape.setCoords === "function") {
      try { shape.setCoords(); } catch {}
    }
    affected.push(shape._id);
  });

  // Preserve selection as-is (or none if unlocking all locked without selection)
  const preserve = getState().selectedShapes.slice();
  selectionSetSelectedShapes(preserve);

  const canvas = getState().fabricCanvas;
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }

  log("INFO", "[actions] Unlocked shapes", { count: affected.length, ids: affected });
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

  targets.forEach(shape => {
    try {
      const center = (typeof shape.getCenterPoint === "function")
        ? shape.getCenterPoint()
        : {
            x: (shape.left ?? 0) + ((typeof shape.getScaledWidth === "function"
                  ? shape.getScaledWidth()
                  : shape.width) || 0) / 2,
            y: (shape.top ?? 0) + ((typeof shape.getScaledHeight === "function"
                  ? shape.getScaledHeight()
                  : shape.height) || 0) / 2
          };

      shape.set({ angle: 0 });

      if (typeof shape.setPositionByOrigin === "function") {
        shape.setPositionByOrigin(center, 'center', 'center');
      } else {
        const w = typeof shape.getScaledWidth === "function"
          ? shape.getScaledWidth()
          : (shape.width || 0);
        const h = typeof shape.getScaledHeight === "function"
          ? shape.getScaledHeight()
          : (shape.height || 0);
        shape.set({ left: center.x - w / 2, top: center.y - h / 2 });
      }

      if (typeof shape.setCoords === "function") shape.setCoords();
    } catch (e) {
      log("ERROR", "[actions] resetRotationForSelectedShapes: failed to reset angle", {
        id: shape._id, error: e
      });
    }
  });

  const canvas = getState().fabricCanvas;
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }

  log("INFO", "[actions] Rotation reset to 0°", { ids: targets.map(t => t._id) });
}

/**
 * Alignment (left/centerX/right/top/middleY/bottom) for selected shapes.
 */
export { alignSelected } from './actions-alignment.js';
