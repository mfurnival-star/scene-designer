import { log } from './log.js';

export function initShapeState(shape) {
  if (!shape) return;
  shape._state = 'default';
}

export function setShapeState(shape, newState) {
  if (!shape) return;
  shape._state = newState || 'default';
}

export function getShapeState(shape) {
  return shape?._state || 'default';
}

export function selectShape(shape) {
  setShapeState(shape, 'selected');
}

export function deselectShape(shape) {
  setShapeState(shape, 'default');
}

export function startDraggingShape(shape) {
  setShapeState(shape, 'dragging');
}

export function stopDraggingShape(shape) {
  setShapeState(shape, 'selected');
}

export function lockShape(shape) {
  if (!shape) return;
  setShapeState(shape, 'locked');
  shape.locked = true;
}

export function unlockShape(shape) {
  if (!shape) return;
  setShapeState(shape, 'default');
  shape.locked = false;
}

export function setMultiSelected(shape, enable = true) {
  setShapeState(shape, enable ? 'multi-selected' : 'default');
}

export function isShapeInState(shape, state) {
  return !!shape && shape._state === state;
}
