import { log } from './log.js';
import {
  makePointShape,
  makeRectShape,
  makeCircleShape,
  makeEllipseShape,
  setStrokeWidthForSelectedShapes
} from './shapes.js';
import {
  getState
} from './state.js';
import {
  setSelectedShapes as selectionSetSelectedShapes,
  deselectAll
} from './selection.js';
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

  // Note: factories already use default stroke width from settings on creation.
  // We no longer re-apply stroke width here (keeps behavior deterministic).
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
