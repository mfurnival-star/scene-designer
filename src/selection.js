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
 * Utility: get canonical shape reference from state.shapes by _id.
 * @param {Object} shapeLike - shape-like object (from event or store)
 * @returns {Object|null} shape from state.shapes, or null
 */
function getCanonicalShapeById(shapeLike) {
  if (!shapeLike || !shapeLike._id) return null;
  const shapes = getState().shapes || [];
  const result = shapes.find(s => s._id === shapeLike._id) || null;
  log("TRACE", "[selection] getCanonicalShapeById", {
    input: shapeLike,
    inputId: shapeLike?._id,
    found: !!result,
    result,
    allStoreIds: shapes.map(s => s._id)
  });
  return result;
}

/**
 * Set the currently selected shape (single selection).
 * Always runs full selection logic, even if shape is already selected.
 * @param {Object|null} shape - Fabric.js object or null to clear.
 */
export function setSelectedShape(shape) {
  log("DEBUG", "[selection] setSelectedShape ENTRY", {
    incomingShapeType: shape?._type,
    incomingShapeLabel: shape?._label,
    incomingShapeId: shape?._id,
    prevSelectedShapeType: getState().selectedShape?._type,
    prevSelectedShapeLabel: getState().selectedShape?._label,
    prevSelectedShapeId: getState().selectedShape?._id,
    prevSelectedShapes: getState().selectedShapes.map(s => s?._id)
  });

  // Always resolve to canonical reference
  const canonicalShape = getCanonicalShapeById(shape);

  // Always deselect previous selection, even if reselecting
  if (getState().selectedShape) {
    log("DEBUG", "[selection] setSelectedShape - Deselecting previous shape", {
      prevSelectedShapeType: getState().selectedShape?._type,
      prevSelectedShapeLabel: getState().selectedShape?._label,
      prevSelectedShapeId: getState().selectedShape?._id
    });
    deselectShape(getState().selectedShape);
  }

  // --- Set _selected flag on all shapes ---
  (getState().shapes || []).forEach(s => { s._selected = false; });
  if (canonicalShape) canonicalShape._selected = true;

  sceneDesignerStore.setState({
    selectedShape: canonicalShape,
    selectedShapes: canonicalShape ? [canonicalShape] : []
  });

  log("DEBUG", "[selection] setSelectedShape - State updated", {
    selectedShapeType: getState().selectedShape?._type,
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapeId: getState().selectedShape?._id,
    selectedShapesIds: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });

  if (canonicalShape) {
    log("DEBUG", "[selection] setSelectedShape - Calling selectShape()", { canonicalShape, id: canonicalShape?._id });
    selectShape(canonicalShape);

    // Always attach transformer for valid shapes; never skip if same shape
    const def = getShapeDef(canonicalShape);
    log("DEBUG", "[selection] setSelectedShape - ShapeDef", { def });
    if (def && def.editable && !canonicalShape.locked) {
      log("DEBUG", "[selection] setSelectedShape - Attaching transformer", { shapeLabel: canonicalShape._label });
      attachTransformerForShape(canonicalShape);
    } else {
      log("DEBUG", "[selection] setSelectedShape - Detaching transformer (not editable or locked)", { shapeLabel: canonicalShape._label });
      detachTransformer();
    }
    fixStrokeWidthAfterTransform();
  } else {
    log("DEBUG", "[selection] setSelectedShape - No shape, detaching transformer");
    detachTransformer();
  }

  // EXTRA DEBUG: dump selectedShapes array and shape references
  log("DEBUG", "[selection] setSelectedShape - selectedShapes array after update", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label,
      refEq: s === canonicalShape
    }))
  });

  notifySelectionChanged();
  log("DEBUG", "[selection] setSelectedShape EXIT", {
    selectedShape: getState().selectedShape,
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
}

/**
 * Set the current multi-selection.
 * ALWAYS resolves all shapes to canonical references by _id.
 * @param {Array} arr - Array of Fabric.js objects.
 */
export function setSelectedShapes(arr) {
  log("DEBUG", "[selection] setSelectedShapes ENTRY", {
    arrTypes: arr && arr.map ? arr.map(s => s?._type) : [],
    arrLabels: arr && arr.map ? arr.map(s => s?._label) : [],
    arrIds: arr && arr.map ? arr.map(s => s?._id) : [],
    prevSelectedShapes: getState().selectedShapes?.map ? getState().selectedShapes.map(s => s?._label) : [],
    prevSelectedShapesIds: getState().selectedShapes?.map ? getState().selectedShapes.map(s => s?._id) : [],
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });

  // Always resolve all arr items to canonical references
  const shapesInStore = getState().shapes || [];
  const newArr = Array.isArray(arr)
    ? arr.map(shape => getCanonicalShapeById(shape)).filter(s => !!s)
    : [];

  log("TRACE", "[selection] setSelectedShapes - canonical resolved array", {
    inputArr: arr,
    resolvedArr: newArr,
    resolvedIds: newArr.map(s => s._id),
    allStoreIds: shapesInStore.map(s => s._id)
  });

  // Always deselect previous selection
  if (getState().selectedShapes && Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        log("DEBUG", "[selection] setSelectedShapes - Deselecting shape", { shapeLabel: s?._label, shapeId: s?._id });
        deselectShape(s);
      }
    });
  }

  // --- Set _selected flag on all shapes ---
  shapesInStore.forEach(s => { s._selected = false; });
  newArr.forEach(s => { s._selected = true; });

  sceneDesignerStore.setState({
    selectedShapes: newArr,
    selectedShape: newArr.length === 1 ? newArr[0] : null
  });

  log("DEBUG", "[selection] setSelectedShapes - State updated", {
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapeId: getState().selectedShape?._id,
    selectedShapesLabels: getState().selectedShapes.map(s => s?._label),
    selectedShapesIds: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });

  newArr.forEach((shape, idx) => {
    log("DEBUG", "[selection] setSelectedShapes - setMultiSelected", { shapeLabel: shape._label, shapeId: shape._id, enable: newArr.length > 1 });
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) {
      log("DEBUG", "[selection] setSelectedShapes - selectShape()", { shapeLabel: shape._label, shapeId: shape._id });
      selectShape(shape);
    }
  });

  // Transformer only for single unlocked, editable shape
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    log("DEBUG", "[selection] setSelectedShapes - ShapeDef", { def });
    if (def && def.editable) {
      log("DEBUG", "[selection] setSelectedShapes - Attaching transformer", { shapeLabel: newArr[0]._label, shapeId: newArr[0]._id });
      attachTransformerForShape(newArr[0]);
    } else {
      log("DEBUG", "[selection] setSelectedShapes - Detaching transformer (not editable)", { shapeLabel: newArr[0]._label, shapeId: newArr[0]._id });
      detachTransformer();
    }
    fixStrokeWidthAfterTransform();
  } else {
    log("DEBUG", "[selection] setSelectedShapes - Detaching transformer (multi/no selection)");
    detachTransformer();
    fixStrokeWidthAfterTransform();
  }

  // EXTRA DEBUG: dump selectedShapes array and all shape IDs in store
  log("DEBUG", "[selection] setSelectedShapes - selectedShapes array after update", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s?._label
    })),
    storeShapes: getState().shapes.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label
    }))
  });

  notifySelectionChanged();
  log("DEBUG", "[selection] setSelectedShapes EXIT", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    selectedShape: getState().selectedShape?._id,
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
}

/**
 * Select all shapes currently in state.
 */
export function selectAllShapes() {
  log("DEBUG", "[selection] selectAllShapes ENTRY", {
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type, _label: s._label}))
  });
  const allShapes = getState().shapes.slice();
  setSelectedShapes(allShapes);
  log("DEBUG", "[selection] selectAllShapes EXIT", {
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Deselect all shapes.
 */
export function deselectAll() {
  log("DEBUG", "[selection] deselectAll ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  const stateShapes = getState().selectedShapes;
  if (stateShapes && Array.isArray(stateShapes)) {
    stateShapes.forEach(s => {
      log("DEBUG", "[selection] deselectAll - Deselecting shape", { shapeLabel: s?._label, shapeId: s?._id });
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

  // EXTRA DEBUG: dump selectedShapes and store shapes after deselect
  log("DEBUG", "[selection] deselectAll - selectedShapes/shape store after update", {
    selectedShapes: getState().selectedShapes.map(s => ({
      _id: s?._id,
      _type: s?._type,
      _label: s._label
    })),
    storeShapes: getState().shapes.map(s => ({
      _id: s._id,
      _type: s._type,
      _label: s._label
    }))
  });

  log("DEBUG", "[selection] deselectAll EXIT", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
}

/**
 * Notify subscribers of selection change.
 */
function notifySelectionChanged() {
  log("DEBUG", "[selection] notifySelectionChanged ENTRY", {
    selectedShapeLabel: getState().selectedShape?._label,
    selectedShapeId: getState().selectedShape?._id,
    selectedShapesLabels: getState().selectedShapes.map(s => s?._label),
    selectedShapesIds: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  // Zustand store listeners (if any)
  // (If you want to implement custom listeners, do so here.)
  log("DEBUG", "[selection] notifySelectionChanged EXIT");
}

/**
 * NO LONGER USED: Attach selection event handlers to a Fabric.js shape.
 * Selection is now handled only via canvas.js centralized handler.
 * This function is retained only for backward compatibility with drag/transform handlers.
 * @param {Object} shape - Fabric.js object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  log("DEBUG", "[selection] attachSelectionHandlers NO-OP (centralized handler edition)", {
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
  log("DEBUG", "[selection] isShapeSelected ENTRY", { shapeLabel: shape?._label, shapeId: shape?._id });
  // Use ._selected property for consistency
  const result = !!shape && !!shape._selected;
  log("DEBUG", "[selection] isShapeSelected EXIT", { result });
  return result;
}

/**
 * Utility: Get currently selected shapes.
 * @returns {Array}
 */
export function getSelectedShapes() {
  log("DEBUG", "[selection] getSelectedShapes ENTRY", {
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  const arr = getState().selectedShapes;
  log("DEBUG", "[selection] getSelectedShapes EXIT", { arr });
  return arr;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  log("DEBUG", "[selection] getSelectedShape ENTRY", {
    selectedShape: getState().selectedShape,
    shapesInStore: getState().shapes.map(s => ({_id: s._id, _type: s._type}))
  });
  const s = getState().selectedShape;
  log("DEBUG", "[selection] getSelectedShape EXIT", { s });
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


