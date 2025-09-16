/**
 * selection.js
 * -----------------------------------------------------------
 * Centralized Shape Selection Logic for Scene Designer (Fabric.js Migration)
 * - Manages single/multi-shape selection state for Fabric.js objects.
 * - Sole authority for transformer lifecycle (attach/detach/update).
 * - Integrates shape state machine (shape-state.js).
 * - Integrates per-shape config (shape-defs.js).
 * - Always attaches selection event handlers; never removes except on shape destroy.
 * - Always re-attaches transformer on selection, even if selecting same shape.
 * - DEEP TRACE logging for all entry/exit, event handler attach/fired, selection state transitions.
 * -----------------------------------------------------------
 */

import { AppState } from './state.js';
import { log } from './log.js';
import { attachTransformerForShape, detachTransformer, updateTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';

/**
 * Set the currently selected shape (single selection).
 * Always runs full selection logic, even if shape is already selected.
 * @param {Object|null} shape - Fabric.js object or null to clear.
 */
export function setSelectedShape(shape) {
  log("TRACE", "[selection] setSelectedShape ENTRY", {
    incomingShapeType: shape?._type,
    incomingShapeLabel: shape?._label,
    prevSelectedShapeType: AppState.selectedShape?._type,
    prevSelectedShapeLabel: AppState.selectedShape?._label
  });

  // Always deselect previous selection, even if reselecting
  if (AppState.selectedShape) {
    log("TRACE", "[selection] setSelectedShape - Deselecting previous shape", {
      prevSelectedShapeType: AppState.selectedShape?._type,
      prevSelectedShapeLabel: AppState.selectedShape?._label
    });
    deselectShape(AppState.selectedShape);
  }

  AppState.selectedShape = shape;
  AppState.selectedShapes = shape ? [shape] : [];

  log("TRACE", "[selection] setSelectedShape - AppState updated", {
    selectedShapeType: AppState.selectedShape?._type,
    selectedShapeLabel: AppState.selectedShape?._label
  });

  if (shape) {
    log("TRACE", "[selection] setSelectedShape - Calling selectShape()", { shape });
    selectShape(shape);

    // Always attach transformer for valid shapes; never skip if same shape
    const def = getShapeDef(shape);
    log("TRACE", "[selection] setSelectedShape - ShapeDef", { def });
    if (def && def.editable && !shape.locked) {
      log("TRACE", "[selection] setSelectedShape - Attaching transformer", { shapeLabel: shape._label });
      attachTransformerForShape(shape);
    } else {
      log("TRACE", "[selection] setSelectedShape - Detaching transformer (not editable or locked)", { shapeLabel: shape._label });
      detachTransformer();
    }
  } else {
    log("TRACE", "[selection] setSelectedShape - No shape, detaching transformer");
    detachTransformer();
  }

  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShape EXIT");
}

/**
 * Set the current multi-selection.
 * @param {Array} arr - Array of Fabric.js objects.
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[selection] setSelectedShapes ENTRY", {
    arrTypes: arr && arr.map ? arr.map(s => s?._type) : [],
    arrLabels: arr && arr.map ? arr.map(s => s?._label) : [],
    prevSelectedShapes: AppState.selectedShapes && AppState.selectedShapes.map ? AppState.selectedShapes.map(s => s?._label) : []
  });

  const newArr = Array.isArray(arr) ? arr : [];

  // Always deselect previous selection
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        log("TRACE", "[selection] setSelectedShapes - Deselecting shape", { shapeLabel: s?._label });
        deselectShape(s);
      }
    });
  }

  AppState.selectedShapes = newArr;
  AppState.selectedShape = newArr.length === 1 ? newArr[0] : null;

  log("TRACE", "[selection] setSelectedShapes - AppState updated", {
    selectedShapeLabel: AppState.selectedShape?._label,
    selectedShapesLabels: AppState.selectedShapes.map(s=>s?._label)
  });

  newArr.forEach((shape, idx) => {
    log("TRACE", "[selection] setSelectedShapes - setMultiSelected", { shapeLabel: shape._label, enable: newArr.length > 1 });
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) {
      log("TRACE", "[selection] setSelectedShapes - selectShape()", { shapeLabel: shape._label });
      selectShape(shape);
    }
  });

  // Transformer only for single unlocked, editable shape
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    log("TRACE", "[selection] setSelectedShapes - ShapeDef", { def });
    if (def && def.editable) {
      log("TRACE", "[selection] setSelectedShapes - Attaching transformer", { shapeLabel: newArr[0]._label });
      attachTransformerForShape(newArr[0]);
    } else {
      log("TRACE", "[selection] setSelectedShapes - Detaching transformer (not editable)", { shapeLabel: newArr[0]._label });
      detachTransformer();
    }
  } else {
    log("TRACE", "[selection] setSelectedShapes - Detaching transformer (multi/no selection)");
    detachTransformer();
  }

  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShapes EXIT");
}

/**
 * Select all shapes currently in AppState.
 */
export function selectAllShapes() {
  log("TRACE", "[selection] selectAllShapes ENTRY");
  setSelectedShapes(AppState.shapes.slice());
  log("TRACE", "[selection] selectAllShapes EXIT");
}

/**
 * Deselect all shapes.
 */
export function deselectAll() {
  log("TRACE", "[selection] deselectAll ENTRY");
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => {
      log("TRACE", "[selection] deselectAll - Deselecting shape", { shapeLabel: s?._label });
      deselectShape(s);
    });
  }
  AppState.selectedShape = null;
  AppState.selectedShapes = [];
  detachTransformer();
  notifySelectionChanged();
  log("TRACE", "[selection] deselectAll EXIT");
}

/**
 * Notify subscribers of selection change.
 */
function notifySelectionChanged() {
  log("TRACE", "[selection] notifySelectionChanged ENTRY", {
    selectedShapeLabel: AppState.selectedShape?._label,
    selectedShapesLabels: AppState.selectedShapes.map(s=>s?._label)
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
  log("TRACE", "[selection] notifySelectionChanged EXIT");
}

/**
 * Attach selection event handlers to a Fabric.js shape.
 * Always attaches; never removes except on shape destroy.
 * Pointer event bubbling blocked for robustness.
 * @param {Object} shape - Fabric.js object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  log("TRACE", "[selection] attachSelectionHandlers ENTRY", {
    shapeType: shape?._type,
    shapeLabel: shape?._label
  });
  if (!shape || typeof shape.on !== "function") {
    log("WARN", "[selection] attachSelectionHandlers: Not a valid Fabric.js shape", { shape });
    log("TRACE", "[selection] attachSelectionHandlers EXIT (invalid shape)");
    return;
  }
  // Remove previous mousedown.selection handler to avoid duplicates
  shape.off("mousedown.selection");
  shape.on("mousedown.selection", function(evt) {
    log("TRACE", "[selection] Shape mousedown.selection handler FIRED", {
      shapeType: shape?._type,
      shapeLabel: shape?._label,
      pointer: evt?.pointer,
      event: evt
    });
    // Block event bubbling for robustness
    if (evt && evt.cancelBubble !== undefined) evt.cancelBubble = true;

    // Ctrl/Meta for multi-select toggle
    if (evt.e && (evt.e.ctrlKey || evt.e.metaKey)) {
      log("TRACE", "[selection] mousedown.selection: multi-select toggle", { shapeLabel: shape._label });
      const idx = AppState.selectedShapes.indexOf(shape);
      if (idx === -1) {
        setSelectedShapes([...AppState.selectedShapes, shape]);
      } else {
        const newArr = AppState.selectedShapes.slice();
        newArr.splice(idx, 1);
        setSelectedShapes(newArr);
      }
    } else {
      log("TRACE", "[selection] mousedown.selection: single selection", { shapeLabel: shape._label });
      setSelectedShape(shape); // Always triggers full selection logic, even if same shape
    }
  });
  log("TRACE", "[selection] attachSelectionHandlers EXIT", {
    shapeType: shape?._type,
    shapeLabel: shape?._label
  });
}

/**
 * Utility: Check if a shape is currently selected.
 * @param {Object} shape
 * @returns {boolean}
 */
export function isShapeSelected(shape) {
  log("TRACE", "[selection] isShapeSelected ENTRY", { shapeLabel: shape?._label });
  const result = !!shape && AppState.selectedShapes.includes(shape);
  log("TRACE", "[selection] isShapeSelected EXIT", { result });
  return result;
}

/**
 * Utility: Get currently selected shapes.
 * @returns {Array}
 */
export function getSelectedShapes() {
  log("TRACE", "[selection] getSelectedShapes ENTRY");
  const arr = AppState.selectedShapes;
  log("TRACE", "[selection] getSelectedShapes EXIT", { arr });
  return arr;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  log("TRACE", "[selection] getSelectedShape ENTRY");
  const s = AppState.selectedShape;
  log("TRACE", "[selection] getSelectedShape EXIT", { s });
  return s;
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

