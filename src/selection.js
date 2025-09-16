/**
 * selection.js
 * -----------------------------------------------------------
 * Centralized Shape Selection Logic for Scene Designer (Refactored)
 * - Manages single and multi-shape selection state.
 * - Solely responsible for transformer lifecycle (attach/detach/update).
 * - Integrates per-shape state machine from shape-state.js for robust state transitions.
 * - Integrates per-shape config from shape-defs.js for transformer/anchors.
 * - Exports selection API for all panels and canvas.
 * - Logging via log.js. TRACE level is extremely verbose for deep diagnostics.
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
 * TRACE logs for before/after, reference checks, stack trace if needed.
 * Only selection.js manages transformer lifecycle.
 * @param {Object|null} shape - Shape object or null to clear.
 */
export function setSelectedShape(shape) {
  log("TRACE", "[selection] setSelectedShape ENTRY", {
    incomingShapeId: shape?._id,
    incomingShapeType: shape?._type,
    incomingShapeLabel: shape?._label,
    prevSelectedShapeId: AppState.selectedShape?._id,
    prevSelectedShapeType: AppState.selectedShape?._type,
    prevSelectedShapeLabel: AppState.selectedShape?._label,
    prevSelectedShapeRefEq: AppState.selectedShape === shape,
    stack: (new Error()).stack
  });

  // Deselect previous selection (always, even if selecting same shape)
  if (AppState.selectedShape && typeof deselectShape === "function") {
    log("TRACE", "[selection] setSelectedShape: Deselecting previous shape", {
      prevId: AppState.selectedShape?._id,
      prevType: AppState.selectedShape?._type,
      prevLabel: AppState.selectedShape?._label,
      prevRefEq: AppState.selectedShape === shape
    });
    deselectShape(AppState.selectedShape);
  }

  // Set new selection and state
  AppState.selectedShape = shape;
  AppState.selectedShapes = shape ? [shape] : [];
  log("TRACE", "[selection] setSelectedShape: Assigned new selectedShape(s)", {
    newSelectedShapeId: AppState.selectedShape?._id,
    newSelectedShapeType: AppState.selectedShape?._type,
    newSelectedShapeLabel: AppState.selectedShape?._label,
    selectedShapes: AppState.selectedShapes.map(s => s?._id)
  });

  if (shape) {
    selectShape(shape);
    // Attach transformer for single unlocked, editable shape
    const def = getShapeDef(shape);
    log("TRACE", "[selection] setSelectedShape: ShapeDef", {
      def,
      editable: def && def.editable,
      locked: shape.locked
    });
    if (def && def.editable && !shape.locked) {
      log("TRACE", "[selection] setSelectedShape: Attaching transformer", {
        shapeId: shape._id, shapeType: shape._type, shapeLabel: shape._label
      });
      attachTransformerForShape(shape);
    } else {
      log("TRACE", "[selection] setSelectedShape: Detaching transformer (not editable or locked)", {
        shapeId: shape._id, shapeType: shape._type, shapeLabel: shape._label
      });
      detachTransformer();
    }
  } else {
    log("TRACE", "[selection] setSelectedShape: Detaching transformer (no shape)");
    detachTransformer();
  }

  log("INFO", "[selection] Single shape selected", {
    id: shape?._id, type: shape?._type, label: shape?._label
  });

  notifySelectionChanged();

  log("TRACE", "[selection] setSelectedShape EXIT", {
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapes: AppState.selectedShapes.map(s => s?._id)
  });
}

/**
 * Set the current multi-selection.
 * TRACE logs for entry, shape refs, after state.
 * Only selection.js manages transformer lifecycle.
 * @param {Array} arr - Array of shape objects.
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[selection] setSelectedShapes ENTRY", {
    arr: arr,
    arrTypes: arr && arr.map ? arr.map(s => s?._type) : [],
    arrIds: arr && arr.map ? arr.map(s => s?._id) : [],
    prevSelectedShapes: AppState.selectedShapes && AppState.selectedShapes.map ? AppState.selectedShapes.map(s => s?._id) : [],
    stack: (new Error()).stack
  });
  const newArr = Array.isArray(arr) ? arr : [];

  // Deselect previous selection (always, ensures robust transformer logic)
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => {
      if (!newArr.includes(s)) {
        log("TRACE", "[selection] setSelectedShapes: Deselecting previous shape", {
          shapeId: s?._id,
          shapeType: s?._type,
          shapeLabel: s?._label
        });
        deselectShape(s);
      }
    });
  }

  // Set new selection and state
  AppState.selectedShapes = newArr;
  AppState.selectedShape = newArr.length === 1 ? newArr[0] : null;
  log("TRACE", "[selection] setSelectedShapes: Assigned selectedShape(s)", {
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapes: AppState.selectedShapes.map(s => s?._id)
  });

  newArr.forEach((shape, idx) => {
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) selectShape(shape);
  });

  // Transformer only for single unlocked, editable shape
  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    log("TRACE", "[selection] setSelectedShapes: ShapeDef", {
      def,
      editable: def && def.editable
    });
    if (def && def.editable) {
      log("TRACE", "[selection] setSelectedShapes: Attaching transformer", {
        shapeId: newArr[0]._id, shapeType: newArr[0]._type
      });
      attachTransformerForShape(newArr[0]);
    } else {
      log("TRACE", "[selection] setSelectedShapes: Detaching transformer (not editable)");
      detachTransformer();
    }
  } else {
    log("TRACE", "[selection] setSelectedShapes: Detaching transformer (multi or locked)");
    detachTransformer();
  }

  log("INFO", "[selection] Multi-selection changed", {
    ids: AppState.selectedShapes.map(s => s._id),
    types: AppState.selectedShapes.map(s => s._type)
  });

  notifySelectionChanged();

  log("TRACE", "[selection] setSelectedShapes EXIT", {
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapes: AppState.selectedShapes.map(s => s?._id)
  });
}

/**
 * Select all shapes currently in AppState.
 */
export function selectAllShapes() {
  log("TRACE", "[selection] selectAllShapes ENTRY", {
    allShapes: AppState.shapes.map(s => ({ id: s._id, type: s._type, label: s._label }))
  });
  setSelectedShapes(AppState.shapes.slice());
  log("TRACE", "[selection] selectAllShapes EXIT");
}

/**
 * Deselect all shapes.
 * TRACE logs for before/after.
 * Only selection.js manages transformer lifecycle.
 */
export function deselectAll() {
  log("TRACE", "[selection] deselectAll ENTRY", {
    prevSelectedShapeId: AppState.selectedShape?._id,
    prevSelectedShapes: AppState.selectedShapes.map(s => s?._id)
  });
  if (AppState.selectedShapes && Array.isArray(AppState.selectedShapes)) {
    AppState.selectedShapes.forEach(s => deselectShape(s));
  }
  AppState.selectedShape = null;
  AppState.selectedShapes = [];
  detachTransformer();
  notifySelectionChanged();
  log("TRACE", "[selection] deselectAll EXIT", {
    selectedShape: AppState.selectedShape,
    selectedShapes: AppState.selectedShapes
  });
}

/**
 * Notify subscribers of selection change.
 * TRACE logs for entry/exit, shape refs, stack.
 */
function notifySelectionChanged() {
  log("TRACE", "[selection] notifySelectionChanged ENTRY", {
    selectedShapeId: AppState.selectedShape?._id,
    selectedShapes: AppState.selectedShapes.map(s => s?._id),
    stack: (new Error()).stack
  });
  if (typeof AppState._subscribers === "object" && Array.isArray(AppState._subscribers)) {
    AppState._subscribers.forEach(fn => {
      try {
        fn(AppState, { type: "selection", selectedShape: AppState.selectedShape, selectedShapes: AppState.selectedShapes });
      } catch (e) {
        log("ERROR", "[selection] Subscriber error", e, { stack: (new Error()).stack });
      }
    });
  }
  log("TRACE", "[selection] notifySelectionChanged EXIT");
}

/**
 * Attach selection event handlers to a shape.
 * TRACE logs for handler wiring, handler firing, pointer event details, shape reference.
 * Only calls selection.js APIs, never transformer directly.
 * @param {Object} shape - Shape object to attach handlers to.
 */
export function attachSelectionHandlers(shape) {
  log("TRACE", "[selection] attachSelectionHandlers ENTRY", {
    shapeId: shape?._id,
    shapeType: shape?._type,
    shapeLabel: shape?._label,
    refInAppStateShapes: Array.isArray(AppState.shapes) ? AppState.shapes.includes(shape) : false
  });
  if (!shape || typeof shape.on !== "function") {
    log("WARN", "[selection] attachSelectionHandlers: Not a valid shape", { shape });
    log("TRACE", "[selection] attachSelectionHandlers EXIT (not valid)");
    return;
  }
  // Remove old handlers to avoid duplicate listeners
  shape.off("mousedown.selection");
  shape.on("mousedown.selection", function(evt) {
    const pointer = evt.evt
      ? { x: evt.evt.clientX, y: evt.evt.clientY, type: evt.evt.type }
      : {};

    log("TRACE", "[selection] Shape mousedown.selection handler FIRED", {
      eventType: pointer.type,
      pointer,
      shapeId: shape._id,
      shapeType: shape._type,
      shapeLabel: shape._label,
      shapeRefEq: AppState.shapes.includes(shape),
      selectedShapes: AppState.selectedShapes.map(s => s?._id),
      selectedShape: AppState.selectedShape?._id
    });

    if (evt.evt && (evt.evt.ctrlKey || evt.evt.metaKey)) {
      // Toggle multi-selection if control/meta key held
      const idx = AppState.selectedShapes.indexOf(shape);
      if (idx === -1) {
        const newArr = [...AppState.selectedShapes, shape];
        log("TRACE", "[selection] Shape mousedown.selection: Adding to multi-selection", {
          newArr: newArr.map(s => s?._id)
        });
        setSelectedShapes(newArr);
      } else {
        const newArr = AppState.selectedShapes.slice();
        newArr.splice(idx, 1);
        log("TRACE", "[selection] Shape mousedown.selection: Removing from multi-selection", {
          newArr: newArr.map(s => s?._id)
        });
        setSelectedShapes(newArr);
      }
    } else {
      log("TRACE", "[selection] Shape mousedown.selection: Single select", {
        shapeId: shape._id,
        shapeType: shape._type,
        shapeLabel: shape._label
      });
      setSelectedShape(shape);
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
  const result = AppState.selectedShapes;
  log("TRACE", "[selection] getSelectedShapes EXIT", { result: result.map(s => s?._id) });
  return result;
}

/**
 * Utility: Get currently selected shape (single).
 * @returns {Object|null}
 */
export function getSelectedShape() {
  log("TRACE", "[selection] getSelectedShape ENTRY");
  const result = AppState.selectedShape;
  log("TRACE", "[selection] getSelectedShape EXIT", { resultId: result?._id });
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

