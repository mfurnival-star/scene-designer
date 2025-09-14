/**
 * selection.js
 * -----------------------------------------------------------
 * Shape Selection Logic for Scene Designer
 * - Handles single and multi-shape selection state.
 * - Updates and syncs selection data in AppState.
 * - Exports selection API for use by sidebar, toolbar, and canvas modules.
 * - Logs all selection changes and user actions at appropriate log levels.
 * - Adheres to SCENE_DESIGNER_MANIFESTO.md.
 * -----------------------------------------------------------
 */

import { AppState } from './state.js';
import { log } from './log.js';

/**
 * Set the currently selected shape (single selection).
 * @param {Object|null} shape - Shape object or null to clear.
 */
export function setSelectedShape(shape) {
  log("DEBUG", "[selection] setSelectedShape called", { shape });
  if (AppState.selectedShape === shape) return;
  AppState.selectedShape = shape;
  AppState.selectedShapes = shape ? [shape] : [];
  log("INFO", "[selection] Single shape selected", { id: shape?._id, type: shape?._type });
  notifySelectionChanged();
}

/**
 * Set the current multi-selection.
 * @param {Array} arr - Array of shape objects.
 */
export function setSelectedShapes(arr) {
  log("DEBUG", "[selection] setSelectedShapes called", { arr });
  const newArr = Array.isArray(arr) ? arr : [];
  AppState.selectedShapes = newArr;
  AppState.selectedShape = newArr.length === 1 ? newArr[0] : null;
  log("INFO", "[selection] Multi-selection changed", {
    ids: AppState.selectedShapes.map(s => s._id),
    types: AppState.selectedShapes.map(s => s._type)
  });
  notifySelectionChanged();
}

/**
 * Select all shapes currently in AppState.
 */
export function selectAllShapes() {
  log("INFO", "[selection] selectAllShapes called");
  setSelectedShapes(AppState.shapes.slice());
}

/**
 * Deselect all shapes.
 */
export function deselectAll() {
  log("INFO", "[selection] deselectAll called");
  AppState.selectedShape = null;
  AppState.selectedShapes = [];
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
 * @param {Object} shape - Shape object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  if (!shape || typeof shape.on !== "function") return;
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

// --- Self-test log ---
log("INFO", "[selection] selection.js module loaded and ready.");

// Optionally attach to window for debugging (remove in production!)
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

