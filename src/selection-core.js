/**
 * selection-core.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Shape Selection Logic (Core, ESM ONLY)
 * Purpose:
 * - Manage single/multi-shape selection state for Fabric.js objects.
 * - Own the transformer lifecycle (attach/detach/update) using transformer.js.
 * - Integrate shape-state.js and shape-defs.js for per-shape behavior.
 * - Delegate multi-select dashed outline drawing to selection-outlines.js.
 *
 * Exports (public API):
 * - setSelectedShape(shape|null)
 * - setSelectedShapes(arrayOfShapes)
 * - selectAllShapes()
 * - deselectAll()
 * - attachSelectionHandlers(shape)   // currently a no-op, kept for compatibility
 * - isShapeSelected(shape) : boolean
 * - getSelectedShapes() : array
 * - getSelectedShape() : shape|null
 *
 * Dependencies:
 * - log.js (log)
 * - transformer.js (attachTransformerForShape, detachTransformer)
 * - shape-state.js (setShapeState, selectShape, deselectShape, setMultiSelected)
 * - shape-defs.js (getShapeDef)
 * - shapes.js (fixStrokeWidthAfterTransform)
 * - state.js (sceneDesignerStore, getState)
 * - selection-outlines.js (refreshMultiSelectOutlines, clearAllSelectionOutlines)
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { attachTransformerForShape, detachTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';
import { fixStrokeWidthAfterTransform } from './shapes.js';
import {
  refreshMultiSelectOutlines,
  clearAllSelectionOutlines
} from './selection-outlines.js';

import {
  sceneDesignerStore,
  getState
} from './state.js';

/**
 * Resolve a canonical shape reference from the store by _id.
 * @param {Object} shapeLike
 * @returns {Object|null}
 */
function getCanonicalShapeById(shapeLike) {
  if (!shapeLike || !shapeLike._id) return null;
  const shapes = getState().shapes || [];
  const result = shapes.find(s => s._id === shapeLike._id) || null;
  log("TRACE", "[selection-core] getCanonicalShapeById", {
    inputId: shapeLike?._id,
    found: !!result,
    ids: shapes.map(s => s._id)
  });
  return result;
}

/**
 * Set a single selected shape (or clear selection with null).
 * Always attaches transformer for single, unlocked, editable shapes.
 * Clears multi-select outlines.
 */
export function setSelectedShape(shape) {
  log("DEBUG", "[selection-core] setSelectedShape ENTRY", {
    incomingId: shape?._id,
    prevSelectedId: getState().selectedShape?._id
  });

  const canonicalShape = getCanonicalShapeById(shape);

  // Deselect any previously selected single
  if (getState().selectedShape) {
    deselectShape(getState().selectedShape);
  }

  // Reset flags
  (getState().shapes || []).forEach(s => { s._selected = false; });
  if (canonicalShape) canonicalShape._selected = true;

  // Commit to store
  sceneDesignerStore.setState({
    selectedShape: canonicalShape,
    selectedShapes: canonicalShape ? [canonicalShape] : []
  });

  if (canonicalShape) {
    selectShape(canonicalShape);
    const def = getShapeDef(canonicalShape);
    if (def && def.editable && !canonicalShape.locked) {
      attachTransformerForShape(canonicalShape);
    } else {
      detachTransformer();
    }
    fixStrokeWidthAfterTransform();
  } else {
    detachTransformer();
  }

  // Single selection uses transformer; clear multi-select outlines
  clearAllSelectionOutlines();

  notifySelectionChanged();
  log("DEBUG", "[selection-core] setSelectedShape EXIT", {
    selectedShape: getState().selectedShape?._id,
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Set the current multi-selection (array of shapes).
 * Resolves all shapes to canonical references by _id first.
 * Attaches transformer only when exactly one unlocked, editable shape is selected.
 * Updates multi-select outlines via selection-outlines.js.
 */
export function setSelectedShapes(arr) {
  log("DEBUG", "[selection-core] setSelectedShapes ENTRY", {
    inputIds: Array.isArray(arr) ? arr.map(s => s?._id) : []
  });

  const all = getState().shapes || [];
  const newArr = Array.isArray(arr)
    ? arr.map(shape => getCanonicalShapeById(shape)).filter(Boolean)
    : [];

  // Deselect shapes that are no longer selected
  if (Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        deselectShape(s);
      }
    });
  }

  // Refresh selected flags
  all.forEach(s => { s._selected = false; });
  newArr.forEach(s => { s._selected = true; });

  // Commit to store
  sceneDesignerStore.setState({
    selectedShapes: newArr,
    selectedShape: newArr.length === 1 ? newArr[0] : null
  });

  // Update per-shape state machine flags
  newArr.forEach(shape => {
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) selectShape(shape);
  });

  // Transformer logic: only for single, unlocked, editable
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    if (def && def.editable) {
      attachTransformerForShape(newArr[0]);
    } else {
      detachTransformer();
    }
    fixStrokeWidthAfterTransform();
  } else {
    detachTransformer();
    fixStrokeWidthAfterTransform();
  }

  // Multi-select dashed outlines
  refreshMultiSelectOutlines(newArr);

  notifySelectionChanged();
  log("DEBUG", "[selection-core] setSelectedShapes EXIT", {
    selectedShape: getState().selectedShape?._id,
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Select all shapes in the store (multi-select).
 */
export function selectAllShapes() {
  log("DEBUG", "[selection-core] selectAllShapes ENTRY");
  setSelectedShapes((getState().shapes || []).slice());
  log("DEBUG", "[selection-core] selectAllShapes EXIT");
}

/**
 * Deselect all shapes, detach transformer, and clear outlines.
 */
export function deselectAll() {
  log("DEBUG", "[selection-core] deselectAll ENTRY");
  if (Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => deselectShape(s));
  }

  (getState().shapes || []).forEach(s => { s._selected = false; });

  sceneDesignerStore.setState({
    selectedShape: null,
    selectedShapes: []
  });

  detachTransformer();
  clearAllSelectionOutlines();
  notifySelectionChanged();
  log("DEBUG", "[selection-core] deselectAll EXIT");
}

/**
 * Currently unused; selection logic is centralized.
 * Kept for backward compatibility with any existing attachments.
 */
export function attachSelectionHandlers(shape) {
  log("DEBUG", "[selection-core] attachSelectionHandlers NO-OP", {
    shapeId: shape?._id, type: shape?._type
  });
}

/**
 * Returns true if the shape is currently selected.
 */
export function isShapeSelected(shape) {
  const result = !!shape && !!shape._selected;
  log("DEBUG", "[selection-core] isShapeSelected", { id: shape?._id, result });
  return result;
}

/**
 * Get array of currently selected shapes.
 */
export function getSelectedShapes() {
  const arr = getState().selectedShapes || [];
  log("DEBUG", "[selection-core] getSelectedShapes", { ids: arr.map(s => s?._id) });
  return arr;
}

/**
 * Get the single selected shape (or null).
 */
export function getSelectedShape() {
  const s = getState().selectedShape || null;
  log("DEBUG", "[selection-core] getSelectedShape", { id: s?._id });
  return s;
}

/**
 * Internal: notify subscribers that selection changed.
 */
function notifySelectionChanged() {
  log("DEBUG", "[selection-core] notifySelectionChanged", {
    selectedShape: getState().selectedShape?._id,
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
}

// Optional debugging helpers (dev only)
if (typeof window !== "undefined") {
  window.__sel = {
    setSelectedShape,
    setSelectedShapes,
    selectAllShapes,
    deselectAll,
    isShapeSelected,
    getSelectedShape,
    getSelectedShapes
  };
}
