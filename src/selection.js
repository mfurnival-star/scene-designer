/**
 * selection.js
 * -----------------------------------------------------------
 * Centralized Shape Selection Logic for Scene Designer (Zustand Migration)
 * - Manages single/multi-shape selection state for Fabric.js objects.
 * - Sole authority for transformer lifecycle (attach/detach/update).
 * - Integrates shape state machine (shape-state.js).
 * - Integrates per-shape config (shape-defs.js).
 * - Always attaches selection event handlers; never removes except on shape destroy.
 * - Always re-attaches transformer on selection, even if selecting same shape.
 * - DEEP TRACE logging for all entry/exit, event handler attach/fired, selection state transitions.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { attachTransformerForShape, detachTransformer, updateTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';
import { fixStrokeWidthAfterTransform } from './shapes.js';

import {
  sceneDesignerStore,
  getState,
  setSelectedShapes as storeSetSelectedShapes
} from './state.js';

/**
 * Set the currently selected shape (single selection).
 * Always runs full selection logic, even if shape is already selected.
 * @param {Object|null} shape - Fabric.js object or null to clear.
 */
export function setSelectedShape(shape) {
  log("TRACE", "[selection] setSelectedShape ENTRY", {
    incomingShapeType: shape?._type,
    incomingShapeLabel: shape?._label,
    prevSelectedShapeType: getState().selectedShape?._type,
    prevSelectedShapeLabel: getState().selectedShape?._label
  });

  // Always deselect previous selection, even if reselecting
  if (getState().selectedShape) {
    log("TRACE", "[selection] setSelectedShape - Deselecting previous shape", {
      prevSelectedShapeType: getState().selectedShape?._type,
      prevSelectedShapeLabel: getState().selectedShape?._label
    });
    deselectShape(getState().selectedShape);
  }

  // --- NEW: Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });
  if (shape) shape._selected = true;

  sceneDesignerStore.setState({
    selectedShape: shape,
    selectedShapes: shape ? [shape] : []
  });

  log("TRACE", "[selection] setSelectedShape - State updated", {
    selectedShapeType: getState().selectedShape?._type,
    selectedShapeLabel: getState().selectedShape?._label
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
    fixStrokeWidthAfterTransform();
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
    prevSelectedShapes: getState().selectedShapes?.map ? getState().selectedShapes.map(s => s?._label) : []
  });

  const newArr = Array.isArray(arr) ? arr : [];

  // Always deselect previous selection
  if (getState().selectedShapes && Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        log("TRACE", "[selection] setSelectedShapes - Deselecting shape", { shapeLabel: s?._label });
        deselectShape(s);
      }
    });
  }

  // --- NEW: Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });
  newArr.forEach(s => { s._selected = true; });

  sceneDesignerStore.setState({
    selectedShapes: newArr,
    selectedShape: newArr.length === 1 ? newArr[0] : null
  });

  log("TRACE", "[selection] setSelectedShapes - State updated", {
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapesLabels: getState().selectedShapes.map(s => s?._label)
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
    fixStrokeWidthAfterTransform();
  } else {
    log("TRACE", "[selection] setSelectedShapes - Detaching transformer (multi/no selection)");
    detachTransformer();
    fixStrokeWidthAfterTransform();
  }

  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShapes EXIT");
}

/**
 * Select all shapes currently in state.
 */
export function selectAllShapes() {
  log("TRACE", "[selection] selectAllShapes ENTRY");
  const allShapes = getState().shapes.slice();
  setSelectedShapes(allShapes);
  log("TRACE", "[selection] selectAllShapes EXIT");
}

/**
 * Deselect all shapes.
 */
export function deselectAll() {
  log("TRACE", "[selection] deselectAll ENTRY");
  const stateShapes = getState().selectedShapes;
  if (stateShapes && Array.isArray(stateShapes)) {
    stateShapes.forEach(s => {
      log("TRACE", "[selection] deselectAll - Deselecting shape", { shapeLabel: s?._label });
      deselectShape(s);
    });
  }
  // --- NEW: Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });

  sceneDesignerStore.setState({
    selectedShape: null,
    selectedShapes: []
  });
  detachTransformer();
  notifySelectionChanged();
  log("TRACE", "[selection] deselectAll EXIT");
}

/**
 * Notify subscribers of selection change.
 */
function notifySelectionChanged() {
  log("TRACE", "[selection] notifySelectionChanged ENTRY", {
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapesLabels: getState().selectedShapes.map(s => s?._label)
  });
  // Zustand store listeners (if any)
  // (If you want to implement custom listeners, do so here.)
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
      const idx = getState().selectedShapes.indexOf(shape);
      if (idx === -1) {
        setSelectedShapes([...getState().selectedShapes, shape]);
      } else {
        const newArr = getState().selectedShapes.slice();
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
  // --- NEW: Use ._selected property for consistency ---
  const result = !!shape && !!shape._selected;
  log("TRACE", "[selection] isShapeSelected EXIT", { result });
  return result;
}

/**
 * Utility: Get currently selected shapes.
 * @returns {Array}
 */
export function getSelectedShapes() {
  log("TRACE", "[selection] getSelectedShapes ENTRY");
  const arr = getState().selectedShapes;
  log("TRACE", "[selection] getSelectedShapes EXIT", { arr });
  return arr;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  log("TRACE", "[selection] getSelectedShape ENTRY");
  const s = getState().selectedShape;
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


