22
/**
 * selection-core.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized Shape Selection Logic (Core, ESM ONLY, PHASED ARCHITECTURE v1)
 * Purpose:
 * - Manage single/multi-shape selection state for Fabric.js objects.
 * - Own the transformer lifecycle (attach/detach/update) using transformer.js.
 * - Integrate shape-state.js and shape-defs.js for per-shape behavior.
 * - Multi-select dashed outlines are rendered by the overlay painter installed in canvas-core.js.
 * - Now uses tokenized (transactional) selection sync for programmatic changes.
 *
 * Exports (public API):
 * - setSelectedShape(shape|null)
 * - setSelectedShapes(arrayOfShapes)
 * - selectAllShapes()
 * - deselectAll()
 * - attachSelectionHandlers(shape)
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
 * - fabric-wrapper.js (default fabric namespace for ActiveSelection)
 * - canvas-events.js (tokenized selection sync via selectionSyncToken)
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { attachTransformerForShape, detachTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';
import { fixStrokeWidthAfterTransform } from './shapes.js';
import {
  sceneDesignerStore,
  getState
} from './state.js';
import fabric from './fabric-wrapper.js';

// --- PHASE 1: Transactional Selection Sync Token ---
// This token is incremented for every programmatic selection change.
// Fabric event handlers in canvas-events.js ignore events with the current token.
export let selectionSyncToken = 0;

/**
 * Internal: run a selection change transaction and stamp the token.
 * Used for programmatic selection changes only.
 */
function withSelectionTransaction(fn) {
  selectionSyncToken++;
  try {
    fn();
  } finally {
    // No-op: token is incremented and stays current until next transaction.
  }
}

/**
 * Resolve a canonical shape reference from the store by _id.
 */
function getCanonicalShapeById(shapeLike) {
  if (!shapeLike || !shapeLike._id) return null;
  const shapes = getState().shapes || [];
  const result = shapes.find(s => s._id === shapeLike._id) || null;
  log("DEBUG", "[selection-core] getCanonicalShapeById", {
    inputId: shapeLike?._id,
    found: !!result,
    ids: shapes.map(s => s._id)
  });
  return result;
}

/**
 * Ensure Fabric has an ActiveSelection for the given shapes when multi-selected.
 * Deterministic: discards prior active object, builds new ActiveSelection, and activates it.
 * Uses transactional selection token for programmatic changes.
 */
function ensureFabricActiveSelection(shapes) {
  const canvas = getState().fabricCanvas;
  if (!canvas || !Array.isArray(shapes) || shapes.length <= 1) return;

  // Quick id set compare to avoid churn
  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  const wantIds = shapes.map(s => s && s._id).filter(Boolean).sort();

  if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
    const activeIds = active._objects.map(o => o && o._id).filter(Boolean).sort();
    if (activeIds.length === wantIds.length && activeIds.every((v, i) => v === wantIds[i])) {
      log("DEBUG", "[selection-core] ActiveSelection already matches; no-op");
      return;
    }
  }

  // PHASE 1: Use selection transaction token for programmatic selection changes
  withSelectionTransaction(() => {
    try {
      // Discard anything currently active to avoid mixed states
      if (typeof canvas.discardActiveObject === 'function') canvas.discardActiveObject();

      // Build a fresh ActiveSelection with the exact members
      const sel = new fabric.ActiveSelection(shapes, { canvas });

      // UX: hull visible, but no transform controls for group drag
      sel.set({
        hasControls: false,
        hasBorders: true,
        selectable: true
      });

      canvas.setActiveObject(sel);

      // Update coords to keep aCoords fresh for overlay
      if (typeof sel.setCoords === 'function') sel.setCoords();
      shapes.forEach(s => { if (typeof s.setCoords === 'function') s.setCoords(); });

      if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
      else canvas.renderAll();

      log("DEBUG", "[selection-core] Fabric ActiveSelection set", { ids: wantIds });
    } catch (e) {
      log("ERROR", "[selection-core] Failed to create/set ActiveSelection", e);
    }
  });
}

/**
 * Set a single selected shape (or clear selection with null).
 * Uses transactional selection token for programmatic changes.
 */
export function setSelectedShape(shape) {
  log("DEBUG", "[selection-core] setSelectedShape ENTRY", {
    incomingId: shape?._id,
    prevSelectedId: getState().selectedShape?._id
  });

  const canonicalShape = getCanonicalShapeById(shape);

  withSelectionTransaction(() => {
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
        attachTransformerForShape(canonicalShape); // sets Fabric active object
      } else {
        detachTransformer();
      }
      fixStrokeWidthAfterTransform();
    } else {
      detachTransformer();
    }

    notifySelectionChanged();
  });

  log("DEBUG", "[selection-core] setSelectedShape EXIT", {
    selectedShape: getState().selectedShape?._id,
    selectedShapes: getState().selectedShapes.map(s => s?._id)
  });
}

/**
 * Set the current selection (array of shapes).
 * - Single selection: attach transformer and set Fabric active object.
 * - Multi selection: ensure Fabric ActiveSelection exists (so group drag works).
 * - Uses transactional selection token for programmatic changes.
 */
export function setSelectedShapes(arr) {
  log("DEBUG", "[selection-core] setSelectedShapes ENTRY", {
    inputIds: Array.isArray(arr) ? arr.map(s => s?._id) : []
  });

  const all = getState().shapes || [];
  const newArr = Array.isArray(arr)
    ? arr.map(shape => getCanonicalShapeById(shape)).filter(Boolean)
    : [];

  withSelectionTransaction(() => {
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

    // Update per-shape state machine flags
    newArr.forEach(shape => {
      setMultiSelected(shape, newArr.length > 1);
      if (newArr.length === 1) selectShape(shape);
    });

    if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
      // Single selection → attach transformer (sets Fabric active object)
      const def = getShapeDef(newArr[0]);
      if (def && def.editable) {
        attachTransformerForShape(newArr[0]);
      } else {
        detachTransformer();
      }
      fixStrokeWidthAfterTransform();
    } else if (newArr.length > 1) {
      // Multi selection → ensure a Fabric ActiveSelection exists
      ensureFabricActiveSelection(newArr);
    } else {
      // None selected
      detachTransformer();
    }

    notifySelectionChanged();
  });

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
 * Deselect all shapes and detach transformer.
 * Uses transactional selection token for programmatic changes.
 */
export function deselectAll() {
  log("DEBUG", "[selection-core] deselectAll ENTRY");
  withSelectionTransaction(() => {
    if (Array.isArray(getState().selectedShapes)) {
      getState().selectedShapes.forEach(s => deselectShape(s));
    }

    (getState().shapes || []).forEach(s => { s._selected = false; });

    sceneDesignerStore.setState({
      selectedShape: null,
      selectedShapes: []
    });

    detachTransformer(); // discards any Fabric active/selection hull
    notifySelectionChanged();
  });
  log("DEBUG", "[selection-core] deselectAll EXIT");
}

/**
 * Currently unused; kept for compatibility.
 */
export function attachSelectionHandlers(shape) {
  log("DEBUG", "[selection-core] attachSelectionHandlers NO-OP", {
    shapeId: shape?._id, type: shape?._type
  });
}

/** Utils */
export function isShapeSelected(shape) {
  const result = !!shape && !!shape._selected;
  log("DEBUG", "[selection-core] isShapeSelected", { id: shape?._id, result });
  return result;
}
export function getSelectedShapes() {
  const arr = getState().selectedShapes || [];
  log("DEBUG", "[selection-core] getSelectedShapes", { ids: arr.map(s => s?._id) });
  return arr;
}
export function getSelectedShape() {
  const s = getState().selectedShape || null;
  log("DEBUG", "[selection-core] getSelectedShape", { id: s?._id });
  return s;
}

function notifySelectionChanged() {
  log("DEBUG", "[selection-core] notifySelectionChanged", {
    selectedShape: getState().selectedShape?._id,
    selectedShapes: getState().selectedShapes.map(s => s?._id),
    syncToken: selectionSyncToken
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

