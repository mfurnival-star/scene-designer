/**
 * selection.js
 * -----------------------------------------------------------
 * Centralized Shape Selection Logic for Scene Designer (Manifesto-Compliant, Prelayout Patterns Applied)
 * - Manages single/multi-shape selection state.
 * - Sole authority for transformer lifecycle (attach/detach/update).
 * - Integrates shape state machine (shape-state.js).
 * - Integrates per-shape config (shape-defs.js).
 * - Always attaches selection event handlers; never removes except on shape destroy.
 * - Always re-attaches transformer on selection, even if selecting same shape.
 * - TRACE logging only for key entry/exit/events.
 * -----------------------------------------------------------
 */

import { AppState } from './state.js';
import { log } from './log.js';
import { attachTransformerForShape, detachTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';

/**
 * Set the currently selected shape (single selection).
 * Always runs full selection logic, even if shape is already selected.
 * @param {Object|null} shape - Shape object or null to clear.
 */
export function setSelectedShape(shape) {
  log("DEBUG", "[selection] setSelectedShape", {
    incomingShapeId: shape?._id,
    incomingShapeType: shape?._type,
    prevSelectedShapeId: AppState.selectedShape?._id,
    prevSelectedShapeType: AppState.selectedShape?._type
  });

  // Always deselect previous selection, even if reselecting
  if (AppState.selectedShape && typeof deselectShape === "function") {
    deselectShape(AppState.selectedShape);
  }

  AppState.selectedShape = shape;
  AppState.selectedShapes = shape ? [shape] : [];

  if (shape) {
    selectShape(shape);

    // Always attach transformer for valid shapes; never skip if same shape
    const def = getShapeDef(shape);
    if (def && def.editable && !shape.locked) {
      attachTransformerForShape(shape);
    } else {
      detachTransformer();
    }
  } else {
    detachTransformer();
  }

  notifySelectionChanged();
}

/**
 * Set the current multi-selection.
 * @param {Array} arr - Array of shape objects.
 */
export function setSelectedShapes(arr) {
  log("DEBUG", "[selection] setSelectedShapes", {
    arrTypes: arr && arr.map ? arr.map(s => s?._type) : [],
    arrIds: arr && arr.map ? arr.map(s => s?._id) : [],
    prevSelectedShapes: AppState.selectedShapes && AppState.selectedShapes.map ? AppState.selectedShapes.map(s => s?._id) : []
  });

  const newArr = Array.isArray(arr) ? arr : [];

  // Always deselect previous selection
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        deselectShape(s);
      }
    });
  }

  AppState.selectedShapes = newArr;
  AppState.selectedShape = newArr.length === 1 ? newArr[0] : null;

  newArr.forEach((shape, idx) => {
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) selectShape(shape);
  });

  // Transformer only for single unlocked, editable shape
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    if (def && def.editable) {
      attachTransformerForShape(newArr[0]);
    } else {
      detachTransformer();
    }
  } else {
    detachTransformer();
  }

  notifySelectionChanged();
}

/**
 * Select all shapes currently in AppState.
 */
export function selectAllShapes() {
  setSelectedShapes(AppState.shapes.slice());
}

/**
 * Deselect all shapes.
 */
export function deselectAll() {
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => deselectShape(s));
  }
  AppState.selectedShape = null;
  AppState.selectedShapes = [];
  detachTransformer();
  notifySelectionChanged();
}

/**
 * Notify subscribers of selection change.
 */
function notifySelectionChanged() {
  if (typeof AppState._subscribers === "object" && Array.isArray(AppState._subscribers)) {
    AppState._subscribers.forEach(fn => {
      try {
        fn(AppState, { type: "selection", selectedShape: AppState.selectedShape, selectedShapes: AppState.selectedShapes });
      } catch (e) {
        log("ERROR", "[selection] Subscriber error", e);
      }
    });
  }
}

/**
 * Attach selection event handlers to a shape.
 * Always attaches; never removes except on shape destroy.
 * Pointer event bubbling blocked for robustness.
 * @param {Object} shape - Shape object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  if (!shape || typeof shape.on !== "function") {
    log("WARN", "[selection] attachSelectionHandlers: Not a valid shape", { shape });
    return;
  }
  // Remove only previous mousedown.selection handler to avoid duplicates
  shape.off("mousedown.selection");
  shape.on("mousedown.selection", function(evt) {
    // Block event bubbling for robustness (legacy pattern)
    if (evt && evt.cancelBubble !== undefined) evt.cancelBubble = true;

    // Ctrl/Meta for multi-select toggle
    if (evt.evt && (evt.evt.ctrlKey || evt.evt.metaKey)) {
      const idx = AppState.selectedShapes.indexOf(shape);
      if (idx === -1) {
        setSelectedShapes([...AppState.selectedShapes, shape]);
      } else {
        const newArr = AppState.selectedShapes.slice();
        newArr.splice(idx, 1);
        setSelectedShapes(newArr);
      }
    } else {
      setSelectedShape(shape); // Always triggers full selection logic, even if same shape
    }
  });
}

/**
 * Utility: Check if a shape is currently selected.
 * @param {Object} shape
 * @returns {boolean}
 */
export function isShapeSelected(shape) {
  return !!shape && AppState.selectedShapes.includes(shape);
}

/**
 * Utility: Get currently selected shapes.
 * @returns {Array}
 */
export function getSelectedShapes() {
  return AppState.selectedShapes;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  return AppState.selectedShape;
}

// Debugging helpers (remove in production!)
if (typeof window !== "undefined") {
  window.setSelectedShape = setSelectedShape;
  window.setSelectedShapes = setSelectedShapes;
  window.selectAllShapes = selectAllShapes;
  window.deselectAll = deselectAll;
  window.isShapeSelected = isShapeSelected;
  window.getSelectedShape = getSelectedShape;
  window.getSelectedShapes = getSelectedShapes;
  window.attachSelectionHandlers = attachSelectionHandlers;
}
