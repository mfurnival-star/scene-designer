/**
 * selection.js
 * -----------------------------------------------------------
 * Centralized Shape Selection Logic for Scene Designer (Refactored)
 * - Manages single and multi-shape selection state.
 * - Solely responsible for transformer lifecycle (attach/detach/update).
 * - Integrates per-shape state machine from shape-state.js for robust state transitions.
 * - Integrates per-shape config from shape-defs.js for transformer/anchors.
 * - Exports selection API for all panels and canvas.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { AppState } from './state.js';
import { log } from './log.js';
import { attachTransformerForShape, detachTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';

/**
 * Set the currently selected shape (single selection).
 * Only selection.js manages transformer lifecycle.
 * @param {Object|null} shape - Shape object or null to clear.
 */
export function setSelectedShape(shape) {
  log("TRACE", "[selection] setSelectedShape entry", { shape });
  // Deselect previous selection
  if (AppState.selectedShape && AppState.selectedShape !== shape && typeof deselectShape === "function") {
    deselectShape(AppState.selectedShape);
  }
  // Set new selection and state
  AppState.selectedShape = shape;
  AppState.selectedShapes = shape ? [shape] : [];
  if (shape) {
    selectShape(shape);
    // Attach transformer for single unlocked, editable shape
    const def = getShapeDef(shape);
    if (def && def.editable && !shape.locked) {
      attachTransformerForShape(shape);
    } else {
      detachTransformer();
    }
  } else {
    detachTransformer();
  }
  log("INFO", "[selection] Single shape selected", { id: shape?._id, type: shape?._type });
  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShape exit");
}

/**
 * Set the current multi-selection.
 * Only selection.js manages transformer lifecycle.
 * @param {Array} arr - Array of shape objects.
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[selection] setSelectedShapes entry", { arr });
  const newArr = Array.isArray(arr) ? arr : [];
  // Deselect previous selection
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => {
      if (!newArr.includes(s)) deselectShape(s);
    });
  }
  // Set new selection and state
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
  log("INFO", "[selection] Multi-selection changed", {
    ids: AppState.selectedShapes.map(s => s._id),
    types: AppState.selectedShapes.map(s => s._type)
  });
  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShapes exit");
}

/**
 * Select all shapes currently in AppState.
 */
export function selectAllShapes() {
  log("TRACE", "[selection] selectAllShapes entry");
  log("INFO", "[selection] selectAllShapes called");
  setSelectedShapes(AppState.shapes.slice());
  log("TRACE", "[selection] selectAllShapes exit");
}

/**
 * Deselect all shapes.
 * Only selection.js manages transformer lifecycle.
 */
export function deselectAll() {
  log("TRACE", "[selection] deselectAll entry");
  log("INFO", "[selection] deselectAll called");
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => deselectShape(s));
  }
  AppState.selectedShape = null;
  AppState.selectedShapes = [];
  detachTransformer();
  notifySelectionChanged();
  log("TRACE", "[selection] deselectAll exit");
}

/**
 * Notify subscribers of selection change.
 */
function notifySelectionChanged() {
  log("TRACE", "[selection] notifySelectionChanged entry");
  log("DEBUG", "[selection] notifySelectionChanged", {
    selectedShape: AppState.selectedShape,
    selectedShapes: AppState.selectedShapes
  });
  if (typeof AppState._subscribers === "object" && Array.isArray(AppState._subscribers)) {
    AppState._subscribers.forEach(fn => {
      try {
        fn(AppState, { type: "selection", selectedShape: AppState.selectedShape, selectedShapes: AppState.selectedShapes });
      } catch (e) {
        log("ERROR", "[selection] Subscriber error", e);
      }
    });
  }
  log("TRACE", "[selection] notifySelectionChanged exit");
}

/**
 * Attach selection event handlers to a shape.
 * Only calls selection.js APIs, never transformer directly.
 * @param {Object} shape - Shape object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  log("TRACE", "[selection] attachSelectionHandlers entry", { shape });
  if (!shape || typeof shape.on !== "function") {
    log("WARN", "[selection] attachSelectionHandlers: not a valid shape", { shape });
    log("TRACE", "[selection] attachSelectionHandlers exit (not valid)");
    return;
  }
  // Remove old handlers to avoid duplicate listeners
  shape.off("mousedown.selection");
  shape.on("mousedown.selection", function(evt) {
    log("INFO", "[selection] Shape mousedown", { id: shape._id, evt });
    if (evt.evt && (evt.evt.ctrlKey || evt.evt.metaKey)) {
      // Toggle multi-selection if control/meta key held
      const idx = AppState.selectedShapes.indexOf(shape);
      if (idx === -1) {
        setSelectedShapes([...AppState.selectedShapes, shape]);
      } else {
        const newArr = AppState.selectedShapes.slice();
        newArr.splice(idx, 1);
        setSelectedShapes(newArr);
      }
    } else {
      setSelectedShape(shape);
    }
  });
  log("TRACE", "[selection] attachSelectionHandlers exit");
}

/**
 * Utility: Check if a shape is currently selected.
 * @param {Object} shape
 * @returns {boolean}
 */
export function isShapeSelected(shape) {
  log("TRACE", "[selection] isShapeSelected entry", { shape });
  const result = !!shape && AppState.selectedShapes.includes(shape);
  log("TRACE", "[selection] isShapeSelected exit", { result });
  return result;
}

/**
 * Utility: Get currently selected shapes.
 * @returns {Array}
 */
export function getSelectedShapes() {
  log("TRACE", "[selection] getSelectedShapes entry");
  const result = AppState.selectedShapes;
  log("TRACE", "[selection] getSelectedShapes exit", { result });
  return result;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  log("TRACE", "[selection] getSelectedShape entry");
  const result = AppState.selectedShape;
  log("TRACE", "[selection] getSelectedShape exit", { result });
  return result;
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

