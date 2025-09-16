/**
 * shape-state.js
 * -----------------------------------------------------------
 * Scene Designer – Per-Shape State Machine (ESM ONLY)
 * - Centralizes all shape state transitions: selected, dragging, locked, multi-selected.
 * - Used by shapes.js, canvas.js, selection.js, transformer.js for robust state flows.
 * - No globals, no window.* usage.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

/**
 * Initialize shape state on creation.
 * @param {Object} shape
 */
export function initShapeState(shape) {
  log("TRACE", "[shape-state] initShapeState entry", { shape });
  shape._state = "default";
  log("TRACE", "[shape-state] initShapeState exit");
}

/**
 * Set shape state to a new state.
 * @param {Object} shape
 * @param {string} newState
 */
export function setShapeState(shape, newState) {
  log("TRACE", "[shape-state] setShapeState entry", { shape, newState });
  const prevState = shape._state;
  shape._state = newState;
  log("DEBUG", "[shape-state] Shape state changed", { shape: safeShapeSummary(shape), prevState, newState });
  log("TRACE", "[shape-state] setShapeState exit");
}

/**
 * Mark shape as selected.
 * @param {Object} shape
 */
export function selectShape(shape) {
  log("TRACE", "[shape-state] selectShape entry", { shape });
  setShapeState(shape, 'selected');
  log("TRACE", "[shape-state] selectShape exit");
}

/**
 * Mark shape as deselected.
 * @param {Object} shape
 */
export function deselectShape(shape) {
  log("TRACE", "[shape-state] deselectShape entry", { shape });
  setShapeState(shape, 'default');
  log("TRACE", "[shape-state] deselectShape exit");
}

/**
 * Mark shape as being dragged.
 * @param {Object} shape
 */
export function startDraggingShape(shape) {
  log("TRACE", "[shape-state] startDraggingShape entry", { shape });
  setShapeState(shape, 'dragging');
  log("TRACE", "[shape-state] startDraggingShape exit");
}

/**
 * Mark shape as done dragging (returns to selected).
 * @param {Object} shape
 */
export function stopDraggingShape(shape) {
  log("TRACE", "[shape-state] stopDraggingShape entry", { shape });
  setShapeState(shape, 'selected');
  log("TRACE", "[shape-state] stopDraggingShape exit");
}

/**
 * Lock a shape (cannot move, transform, or interact).
 * @param {Object} shape
 */
export function lockShape(shape) {
  log("TRACE", "[shape-state] lockShape entry", { shape });
  setShapeState(shape, 'locked');
  shape.locked = true;
  log("TRACE", "[shape-state] lockShape exit");
}

/**
 * Unlock a shape (can move, transform, interact).
 * @param {Object} shape
 */
export function unlockShape(shape) {
  log("TRACE", "[shape-state] unlockShape entry", { shape });
  setShapeState(shape, 'default');
  shape.locked = false;
  log("TRACE", "[shape-state] unlockShape exit");
}

/**
 * Mark shape as multi-selected (for multi-select group).
 * @param {Object} shape
 * @param {boolean} enable
 */
export function setMultiSelected(shape, enable = true) {
  log("TRACE", "[shape-state] setMultiSelected entry", { shape, enable });
  setShapeState(shape, enable ? "multi-selected" : "default");
  log("TRACE", "[shape-state] setMultiSelected exit");
}

/**
 * Returns true if shape is in the given state.
 * @param {Object} shape
 * @param {string} state
 * @returns {boolean}
 */
export function isShapeInState(shape, state) {
  log("TRACE", "[shape-state] isShapeInState entry", { shape, state });
  const result = shape._state === state;
  log("TRACE", "[shape-state] isShapeInState exit", { result });
  return result;
}

/**
 * Debug summary for logs.
 */
function safeShapeSummary(shape) {
  if (!shape) return shape;
  return {
    type: shape._type,
    id: shape._id,
    label: shape._label,
    state: shape._state,
    locked: shape.locked,
    x: typeof shape.x === "function" ? shape.x() : shape.x,
    y: typeof shape.y === "function" ? shape.y() : shape.y
  };
}
