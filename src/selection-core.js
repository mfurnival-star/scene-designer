/**
 * selection-core.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Shape Selection Logic (Core, ESM ONLY)
 * Purpose:
 * - Manage single/multi-shape selection state for Fabric.js objects.
 * - Own the transformer lifecycle (attach/detach/update) using transformer.js.
 * - Integrate shape-state.js and shape-defs.js for per-shape behavior.
 * - Multi-select dashed outlines are rendered by the overlay painter (selection-outlines.js).
 *
 * Public API Exports (re-exported via selection.js facade):
 * - setSelectedShape(shape|null)
 * - setSelectedShapes(arrayOfShapes)
 * - selectAllShapes()
 * - deselectAll()
 * - attachSelectionHandlers(shape)  (currently NO-OP, kept for compatibility)
 * - isShapeSelected(shape) : boolean
 * - getSelectedShapes() : array
 * - getSelectedShape() : shape|null
 *
 * Phase 1 Completion Patch (2025-09-24):
 * - Removed unconditional stroke width reapplication on selection changes.
 *   (shapes-core.js now performs stroke width normalization only after actual
 *    scale/rotate gestures via transform tracking + 'modified' event.)
 *
 * Logging Policy (reduced noise):
 * - WARN/ERROR only for exceptional cases.
 * - No DEBUG spam in hot paths (getters, frequent selection updates).
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { attachTransformerForShape, detachTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';
import {
  sceneDesignerStore,
  getState
} from './state.js';
import fabric from './fabric-wrapper.js';

/**
 * Resolve a canonical shape reference from the store by _id.
 */
function getCanonicalShapeById(shapeLike) {
  if (!shapeLike || !shapeLike._id) return null;
  const shapes = getState().shapes || [];
  return shapes.find(s => s._id === shapeLike._id) || null;
}

/**
 * Ensure Fabric has an ActiveSelection for the given shapes when multi-selected.
 * Deterministic: discards prior active object, builds new ActiveSelection, and activates it.
 */
function ensureFabricActiveSelection(shapes) {
  const canvas = getState().fabricCanvas;
  if (!canvas || !Array.isArray(shapes) || shapes.length <= 1) return;

  // Avoid churn if ActiveSelection already matches desired ids
  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  const wantIds = shapes.map(s => s && s._id).filter(Boolean).sort();

  if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
    const activeIds = active._objects.map(o => o && o._id).filter(Boolean).sort();
    if (activeIds.length === wantIds.length && activeIds.every((v, i) => v === wantIds[i])) {
      return;
    }
  }

  try {
    if (typeof canvas.discardActiveObject === 'function') canvas.discardActiveObject();

    const sel = new fabric.ActiveSelection(shapes, { canvas });

    // UX: hull visible, no transform controls for group drag (overlay handles visuals)
    sel.set({
      hasControls: false,
      hasBorders: true,
      selectable: true
    });

    canvas.setActiveObject(sel);

    if (typeof sel.setCoords === 'function') sel.setCoords();
    shapes.forEach(s => { if (typeof s.setCoords === 'function') s.setCoords(); });

    if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
    else canvas.renderAll();
  } catch (e) {
    log("ERROR", "[selection-core] Failed to create/set ActiveSelection", e);
  }
}

/**
 * Set a single selected shape (or clear selection with null).
 */
export function setSelectedShape(shape) {
  const canonicalShape = getCanonicalShapeById(shape);

  // Deselect previous single if any
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

  // Transformer lifecycle
  if (canonicalShape) {
    selectShape(canonicalShape);
    const def = getShapeDef(canonicalShape);
    if (def && def.editable && !canonicalShape.locked) {
      attachTransformerForShape(canonicalShape);
    } else {
      detachTransformer();
    }
  } else {
    detachTransformer();
  }
}

/**
 * Set the current selection (array of shapes).
 * - Single selection: attach transformer and set Fabric active object.
 * - Multi selection: ensure Fabric ActiveSelection exists (so group drag works).
 * - None: detach transformer.
 */
export function setSelectedShapes(arr) {
  const all = getState().shapes || [];
  const newArr = Array.isArray(arr)
    ? arr.map(shape => getCanonicalShapeById(shape)).filter(Boolean)
    : [];

  // Deselect shapes that are no longer selected
  if (Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => {
      if (!newArr.includes(s)) deselectShape(s);
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

  // Update per-shape state flags and transformer
  newArr.forEach(shape => {
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) selectShape(shape);
  });

  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    if (def && def.editable) {
      attachTransformerForShape(newArr[0]);
    } else {
      detachTransformer();
    }
  } else if (newArr.length > 1) {
    ensureFabricActiveSelection(newArr);
  } else {
    detachTransformer();
  }
}

/**
 * Select all shapes in the store (multi-select).
 */
export function selectAllShapes() {
  setSelectedShapes((getState().shapes || []).slice());
}

/**
 * Deselect all shapes and detach transformer.
 */
export function deselectAll() {
  if (Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => deselectShape(s));
  }

  (getState().shapes || []).forEach(s => { s._selected = false; });

  sceneDesignerStore.setState({
    selectedShape: null,
    selectedShapes: []
  });

  detachTransformer();
}

/**
 * Currently unused; kept for compatibility and future hook injection.
 */
export function attachSelectionHandlers(_shape) {
  // NO-OP by design
}

/** Utils (no logging to keep hot paths quiet) */
export function isShapeSelected(shape) {
  return !!shape && !!shape._selected;
}
export function getSelectedShapes() {
  return getState().selectedShapes || [];
}
export function getSelectedShape() {
  return getState().selectedShape || null;
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
