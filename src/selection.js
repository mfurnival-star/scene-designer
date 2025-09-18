/**
 * selection.js
 * -----------------------------------------------------------
 * Centralized Shape Selection Logic for Scene Designer (Full TRACE Logging Edition)
 * - Manages single/multi-shape selection state for Fabric.js objects.
 * - Sole authority for transformer lifecycle (attach/detach/update).
 * - Integrates shape state machine (shape-state.js).
 * - Integrates per-shape config (shape-defs.js).
 * - NO shape-level selection event handlers for selection/deselection.
 * - All selection logic is routed via canvas.js centralized event handler.
 * - **EXHAUSTIVE TRACE logging for all entry/exit, selection state transitions, shape arrays, and events.**
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
    incomingShapeId: shape?._id,
    prevSelectedShapeType: getState().selectedShape?._type,
    prevSelectedShapeLabel: getState().selectedShape?._label,
    prevSelectedShapeId: getState().selectedShape?._id,
    prevSelectedShapes: getState().selectedShapes.map(s => s?._id)
  });

  // Always deselect previous selection, even if reselecting
  if (getState().selectedShape) {
    log("TRACE", "[selection] setSelectedShape - Deselecting previous shape", {
      prevSelectedShapeType: getState().selectedShape?._type,
      prevSelectedShapeLabel: getState().selectedShape?._label,
      prevSelectedShapeId: getState().selectedShape?._id
    });
    deselectShape(getState().selectedShape);
  }

  // --- Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });
  if (shape) shape._selected = true;

  sceneDesignerStore.setState({
    selectedShape: shape,
    selectedShapes: shape ? [shape] : []
  });

  log("TRACE", "[selection] setSelectedShape - State updated", {
    selectedShapeType: getState().selectedShape?._type,
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapeId: getState().selectedShape?._id,
    selectedShapesIds: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });

  if (shape) {
    log("TRACE", "[selection] setSelectedShape - Calling selectShape()", { shape, id: shape?._id });
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

  // EXTRA TRACE: dump selectedShapes array and shape references
  log("TRACE", "[selection] setSelectedShape - selectedShapes array after update", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      refEq: s === shape
    }))
  });

  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShape EXIT", {
    selectedShape: getState().selectedShape,
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
}

/**
 * Set the current multi-selection.
 * @param {Array} arr - Array of Fabric.js objects.
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[selection] setSelectedShapes ENTRY", {
    arrTypes: arr && arr.map ? arr.map(s => s?._type) : [],
    arrLabels: arr && arr.map ? arr.map(s => s?._label) : [],
    arrIds: arr && arr.map ? arr.map(s => s?._id) : [],
    prevSelectedShapes: getState().selectedShapes?.map ? getState().selectedShapes.map(s => s?._label) : [],
    prevSelectedShapesIds: getState().selectedShapes?.map ? getState().selectedShapes.map(s => s?._id) : [],
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });

  const newArr = Array.isArray(arr) ? arr : [];

  // Always deselect previous selection
  if (getState().selectedShapes && Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        log("TRACE", "[selection] setSelectedShapes - Deselecting shape", { shapeLabel: s?._label, shapeId: s?._id });
        deselectShape(s);
      }
    });
  }

  // --- Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });
  newArr.forEach(s => { s._selected = true; });

  sceneDesignerStore.setState({
    selectedShapes: newArr,
    selectedShape: newArr.length === 1 ? newArr[0] : null
  });

  log("TRACE", "[selection] setSelectedShapes - State updated", {
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapeId: getState().selectedShape?._id,
    selectedShapesLabels: getState().selectedShapes.map(s => s?._label),
    selectedShapesIds: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });

  newArr.forEach((shape, idx) => {
    log("TRACE", "[selection] setSelectedShapes - setMultiSelected", { shapeLabel: shape._label, shapeId: shape._id, enable: newArr.length > 1 });
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) {
      log("TRACE", "[selection] setSelectedShapes - selectShape()", { shapeLabel: shape._label, shapeId: shape._id });
      selectShape(shape);
    }
  });

  // Transformer only for single unlocked, editable shape
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    log("TRACE", "[selection] setSelectedShapes - ShapeDef", { def });
    if (def && def.editable) {
      log("TRACE", "[selection] setSelectedShapes - Attaching transformer", { shapeLabel: newArr[0]._label, shapeId: newArr[0]._id });
      attachTransformerForShape(newArr[0]);
    } else {
      log("TRACE", "[selection] setSelectedShapes - Detaching transformer (not editable)", { shapeLabel: newArr[0]._label, shapeId: newArr[0]._id });
      detachTransformer();
    }
    fixStrokeWidthAfterTransform();
  } else {
    log("TRACE", "[selection] setSelectedShapes - Detaching transformer (multi/no selection)");
    detachTransformer();
    fixStrokeWidthAfterTransform();
  }

  // EXTRA TRACE: dump selectedShapes array and all shape IDs in store
  log("TRACE", "[selection] setSelectedShapes - selectedShapes array after update", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label
    })),
    storeShapes: getState().shapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label
    }))
  });

  notifySelectionChanged();
  log("TRACE", "[selection] setSelectedShapes EXIT", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    selectedShape: getState().selectedShape?._id,
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
}

/**
 * Select all shapes currently in state.
 */
export function selectAllShapes() {
  log("TRACE", "[selection] selectAllShapes ENTRY", {
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });
  const allShapes = getState().shapes.slice();
  setSelectedShapes(allShapes);
  log("TRACE", "[selection] selectAllShapes EXIT", {
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Deselect all shapes.
 */
export function deselectAll() {
  log("TRACE", "[selection] deselectAll ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  const stateShapes = getState().selectedShapes;
  if (stateShapes && Array.isArray(stateShapes)) {
    stateShapes.forEach(s => {
      log("TRACE", "[selection] deselectAll - Deselecting shape", { shapeLabel: s?._label, shapeId: s?._id });
      deselectShape(s);
    });
  }
  // --- Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });

  sceneDesignerStore.setState({
    selectedShape: null,
    selectedShapes: []
  });
  detachTransformer();
  notifySelectionChanged();

  // EXTRA TRACE: dump selectedShapes and store shapes after deselect
  log("TRACE", "[selection] deselectAll - selectedShapes/shape store after update", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label
    })),
    storeShapes: getState().shapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label
    }))
  });

  log("TRACE", "[selection] deselectAll EXIT", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
}

/**
 * Notify subscribers of selection change.
 */
function notifySelectionChanged() {
  log("TRACE", "[selection] notifySelectionChanged ENTRY", {
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapeId: getState().selectedShape?._id,
    selectedShapesLabels: getState().selectedShapes.map(s => s?._label),
    selectedShapesIds: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  // Zustand store listeners (if any)
  // (If you want to implement custom listeners, do so here.)
  log("TRACE", "[selection] notifySelectionChanged EXIT");
}

/**
 * NO LONGER USED: Attach selection event handlers to a Fabric.js shape.
 * Selection is now handled only via canvas.js centralized handler.
 * This function is retained only for backward compatibility with drag/transform handlers.
 * @param {Object} shape - Fabric.js object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  log("TRACE", "[selection] attachSelectionHandlers NO-OP (centralized handler edition)", {
    shapeType: shape?._type,
    shapeLabel: shape?._label,
    shapeId: shape?._id
  });
  // No-op: selection handled in canvas.js centralized handler
}

/**
 * Utility: Check if a shape is currently selected.
 * @param {Object} shape
 * @returns {boolean}
 */
export function isShapeSelected(shape) {
  log("TRACE", "[selection] isShapeSelected ENTRY", { shapeLabel: shape?._label, shapeId: shape?._id });
  // Use ._selected property for consistency
  const result = !!shape && !!shape._selected;
  log("TRACE", "[selection] isShapeSelected EXIT", { result });
  return result;
}

/**
 * Utility: Get currently selected shapes.
 * @returns {Array}
 */
export function getSelectedShapes() {
  log("TRACE", "[selection] getSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  const arr = getState().selectedShapes;
  log("TRACE", "[selection] getSelectedShapes EXIT", { arr });
  return arr;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  log("TRACE", "[selection] getSelectedShape ENTRY", {
    selectedShape: getState().selectedShape,
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
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

