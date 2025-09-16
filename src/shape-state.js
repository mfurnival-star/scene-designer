/**
 * shape-state.js
 * -----------------------------------------------------------
 * Scene Designer – Per-Shape State Machine (ESM ONLY)
 * - Provides a state machine for each shape instance (rect, circle, point, future group).
 * - States: 'unselected', 'selected', 'dragging', 'resizing', 'locked', 'multi-selected', 'editing-label', 'color-sampling'
 * - Exports helper functions for state transitions and queries.
 * - Uses shared logger (log.js) for all transitions.
 * - All other modules (canvas.js, shapes.js, selection.js) should call these helpers instead of ad-hoc state mutations.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

// Valid states for a shape
export const SHAPE_STATES = [
  'unselected',
  'selected',
  'dragging',
  'resizing',
  'locked',
  'multi-selected',
  'editing-label',
  'color-sampling'
];

/**
 * Initialize state for a new shape.
 * @param {Object} shape - Konva shape/group
 * @param {string} initialState - One of SHAPE_STATES
 */
export function initShapeState(shape, initialState = 'unselected') {
  shape._state = initialState;
  log('TRACE', '[shape-state] Initialized shape state', { shape, state: initialState });
}

/**
 * Get the current state of a shape.
 * @param {Object} shape
 * @returns {string}
 */
export function getShapeState(shape) {
  return shape._state || 'unselected';
}

/**
 * Set the state of a shape. Enforces valid transitions.
 * @param {Object} shape
 * @param {string} newState - One of SHAPE_STATES
 */
export function setShapeState(shape, newState) {
  if (!SHAPE_STATES.includes(newState)) {
    log('ERROR', '[shape-state] Invalid state transition', { shape, newState });
    return;
  }
  const prevState = shape._state || 'unselected';
  shape._state = newState;
  log('DEBUG', '[shape-state] Shape state changed', { shape, prevState, newState });
}

/**
 * Transition helpers for common events.
 * These can be called from event handlers (mousedown, dragstart, etc).
 */
export function selectShape(shape) {
  setShapeState(shape, 'selected');
}

export function deselectShape(shape) {
  setShapeState(shape, 'unselected');
}

export function startDraggingShape(shape) {
  setShapeState(shape, 'dragging');
}

export function stopDraggingShape(shape) {
  // Restore to selected or multi-selected depending on context
  setShapeState(shape, shape._multiSelected ? 'multi-selected' : 'selected');
}

export function startResizingShape(shape) {
  setShapeState(shape, 'resizing');
}

export function stopResizingShape(shape) {
  setShapeState(shape, 'selected');
}

export function lockShape(shape) {
  setShapeState(shape, 'locked');
}

export function unlockShape(shape) {
  // If shape was previously selected, restore; otherwise, unselected
  setShapeState(shape, shape._wasSelected ? 'selected' : 'unselected');
}

export function setMultiSelected(shape, isMulti) {
  shape._multiSelected = !!isMulti;
  setShapeState(shape, isMulti ? 'multi-selected' : 'selected');
}

/**
 * Utility: Is shape in a given state?
 * @param {Object} shape
 * @param {string} state
 * @returns {boolean}
 */
export function isShapeInState(shape, state) {
  return getShapeState(shape) === state;
}
