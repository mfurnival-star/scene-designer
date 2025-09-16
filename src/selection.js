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
 * - DEEP TRACE logging for all entry/exit, event handler attach/fired, selection state transitions.
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
  log("TRACE", "[selection] setSelectedShape ENTRY", {
    incomingShapeId: shape?._id,
    incomingShapeType: shape?._type,
    prevSelectedShapeId: AppState.selectedShape?._id,
    prevSelectedShapeType: AppState.selectedShape?._type,
    stack: (new Error()).stack
  });

  // Always deselect previous selection, even if reselecting
  if (AppState.selectedShape && typeof deselectShape === "function") {
    log("TRACE", "[selection] setSelectedShape - Deselecting previous shape", {
      prevSelectedShapeId: AppState.selectedShape?._id,
      prevSelectedShapeType: AppState.selectedShape?._type
    });
    deselectShape(AppState.selectedShape);
  }

  AppState.selectedShape = shape;
  AppState.selectedShapes = shape ? [shape] : [];

  log("TRACE", "[selection] setSelectedShape - AppState updated", {
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapeType: AppState.selectedShape?._type,
    selectedShapesIds: AppState.selectedShapes.map(s=>s?._id)
  });

  if (shape) {
    log("TRACE", "[selection] setSelectedShape - Calling selectShape()", { shape });
    selectShape(shape);

    // Always attach transformer for valid shapes; never skip if same shape
    const def = getShapeDef(shape);
    log("TRACE", "[selection] setSelectedShape - ShapeDef", { def });
    if (def && def.editable && !shape.locked) {
      log("TRACE", "[selection] setSelectedShape - Attaching transformer", { shapeId: shape._id });
      attachTransformerForShape(shape);
    } else {
      log("TRACE", "[selection] setSelectedShape - Detaching transformer (not editable or locked)", { shapeId: shape._id });
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
 * @param {Array} arr - Array of shape objects.
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[selection] setSelectedShapes ENTRY", {
    arrTypes: arr && arr.map ? arr.map(s => s?._type) : [],
    arrIds: arr && arr.map ? arr.map(s => s?._id) : [],
    prevSelectedShapes: AppState.selectedShapes && AppState.selectedShapes.map ? AppState.selectedShapes.map(s => s?._id) : [],
    stack: (new Error()).stack
  });

  const newArr = Array.isArray(arr) ? arr : [];

  // Always deselect previous selection
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        log("TRACE", "[selection] setSelectedShapes - Deselecting shape", { shapeId: s?._id });
        deselectShape(s);
      }
    });
  }

  AppState.selectedShapes = newArr;
  AppState.selectedShape = newArr.length === 1 ? newArr[0] : null;

  log("TRACE", "[selection] setSelectedShapes - AppState updated", {
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapesIds: AppState.selectedShapes.map(s=>s?._id)
  });

  newArr.forEach((shape, idx) => {
    log("TRACE", "[selection] setSelectedShapes - setMultiSelected", { shapeId: shape._id, enable: newArr.length > 1 });
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) {
      log("TRACE", "[selection] setSelectedShapes - selectShape()", { shapeId: shape._id });
      selectShape(shape);
    }
  });

  // Transformer only for single unlocked, editable shape
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    log("TRACE", "[selection] setSelectedShapes - ShapeDef", { def });
    if (def && def.editable) {
      log("TRACE", "[selection] setSelectedShapes - Attaching transformer", { shapeId: newArr[0]._id });
      attachTransformerForShape(newArr[0]);
    } else {
      log("TRACE", "[selection] setSelectedShapes - Detaching transformer (not editable)", { shapeId: newArr[0]._id });
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
      log("TRACE", "[selection] deselectAll - Deselecting shape", { shapeId: s?._id });
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
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapesIds: AppState.selectedShapes.map(s=>s?._id)
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
 * Attach selection event handlers to a shape.
 * Always attaches; never removes except on shape destroy.
 * Pointer event bubbling blocked for robustness.
 * @param {Object} shape - Shape object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  log("TRACE", "[selection] attachSelectionHandlers ENTRY", {
    shapeId: shape?._id,
    shapeType: shape?._type,
    shapeLabel: shape?._label,
    refInAppStateShapes: (AppState.shapes || []).includes(shape),
    stack: (new Error()).stack
  });
  if (!shape || typeof shape.on !== "function") {
    log("WARN", "[selection] attachSelectionHandlers: Not a valid shape", { shape });
    log("TRACE", "[selection] attachSelectionHandlers EXIT (invalid shape)");
    return;
  }
  // Remove only previous mousedown.selection handler to avoid duplicates
  shape.off("mousedown.selection");
  shape.on("mousedown.selection", function(evt) {
    log("TRACE", "[selection] Shape mousedown.selection handler FIRED", {
      shapeId: shape?._id,
      shapeType: shape?._type,
      pointer: evt?.evt ? { x: evt.evt.clientX, y: evt.evt.clientY, ctrl: evt.evt.ctrlKey, meta: evt.evt.metaKey, target: evt.target } : evt,
      target: evt.target,
      stack: (new Error()).stack
    });
    // Block event bubbling for robustness (legacy pattern)
    if (evt && evt.cancelBubble !== undefined) evt.cancelBubble = true;

    // Ctrl/Meta for multi-select toggle
    if (evt.evt && (evt.evt.ctrlKey || evt.evt.metaKey)) {
      log("TRACE", "[selection] mousedown.selection: multi-select toggle", { shapeId: shape._id });
      const idx = AppState.selectedShapes.indexOf(shape);
      if (idx === -1) {
        setSelectedShapes([...AppState.selectedShapes, shape]);
      } else {
        const newArr = AppState.selectedShapes.slice();
        newArr.splice(idx, 1);
        setSelectedShapes(newArr);
      }
    } else {
      log("TRACE", "[selection] mousedown.selection: single selection", { shapeId: shape._id });
      setSelectedShape(shape); // Always triggers full selection logic, even if same shape
    }
  });
  log("TRACE", "[selection] attachSelectionHandlers EXIT", {
    shapeId: shape?._id,
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
  log("TRACE", "[selection] isShapeSelected ENTRY", { shapeId: shape?._id });
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

