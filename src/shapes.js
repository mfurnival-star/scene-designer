/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory and State Logic (ESM ONLY)
 * - Centralizes creation of shape objects (rect, circle, point).
 * - Integrates per-shape state machine via shape-state.js.
 * - Handles attach/detach of Konva events and selection logic.
 * - All shape creation, duplication, locking, and event wiring here.
 * - Used by canvas.js, toolbar.js, sidebar.js, and any shape-creation features.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { log } from './log.js';
import { initShapeState, selectShape, deselectShape, startDraggingShape, stopDraggingShape, lockShape, unlockShape, setMultiSelected } from './shape-state.js';

// --- Shape Factory Functions ---

/**
 * Create a new point shape (crosshair + halo + hit area).
 * @param {number} x
 * @param {number} y
 * @returns {Konva.Group}
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });
  const crossLen = 14;
  const haloR = 12;
  const hitR = 16;
  const group = new Konva.Group({ x: x, y: y, draggable: true });

  // Invisible hit area (for easy tap/drag)
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: hitR,
    fill: "#fff",
    opacity: 0,
    listening: true
  });

  // Halo for selection feedback
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: haloR,
    stroke: '#2176ff',
    strokeWidth: 1.5,
    opacity: 0.4,
    listening: false
  });

  // Crosshair lines
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  const crossV = new Konva.Line({
    points: [0, -crossLen / 2, 0, crossLen / 2],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Selection halo (visible only when selected)
  const selHalo = new Konva.Circle({
    x: 0, y: 0,
    radius: haloR + 3,
    stroke: "#0057d8",
    strokeWidth: 2,
    opacity: 0.8,
    visible: false,
    listening: false
  });

  group.add(hitCircle);
  group.add(selHalo);
  group.add(halo);
  group.add(crossH);
  group.add(crossV);

  group._type = 'point';
  group._label = 'Point';
  group.locked = false;

  // State machine init
  initShapeState(group, 'unselected');

  group.getSampleCoords = function() {
    log("TRACE", "[shapes] point.getSampleCoords", { group });
    return { x: group.x(), y: group.y() };
  };

  group.showSelection = function(isSelected) {
    selHalo.visible(isSelected);
  };

  // Attach events for selection and drag
  attachShapeEvents(group);
  log("TRACE", "[shapes] makePointShape exit");
  return group;
}

/**
 * Create a new rectangle shape.
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {Konva.Rect}
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });
  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: w,
    height: h,
    stroke: "#2176ff",
    strokeWidth: 1,
    fill: "#00000000",
    draggable: true
  });

  rect._type = 'rect';
  rect._label = 'Rect';
  rect.locked = false;

  // State machine init
  initShapeState(rect, 'unselected');

  attachShapeEvents(rect);
  log("TRACE", "[shapes] makeRectShape exit");
  return rect;
}

/**
 * Create a new circle shape.
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @returns {Konva.Circle}
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape entry", { x, y, r });
  const circle = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    stroke: "#2176ff",
    strokeWidth: 1,
    fill: "#00000000",
    draggable: true
  });

  circle._type = 'circle';
  circle._label = 'Circle';
  circle.locked = false;

  // State machine init
  initShapeState(circle, 'unselected');

  attachShapeEvents(circle);
  log("TRACE", "[shapes] makeCircleShape exit");
  return circle;
}

// --- Shape Events and State Machine Integration ---

/**
 * Attach selection, drag, and lock events to a shape.
 * Updates per-shape state using shape-state.js.
 * @param {Konva.Shape|Konva.Group} shape
 */
export function attachShapeEvents(shape) {
  log("TRACE", "[shapes] attachShapeEvents entry", { shape });
  // Remove previous handlers
  shape.off('mousedown.shape dragstart.shape dragmove.shape dragend.shape');

  // Selection logic
  shape.on('mousedown.shape', (e) => {
    log("DEBUG", "[shapes] mousedown.shape event", { shape });
    if (shape.locked) return;
    selectShape(shape); // State machine transition
    shape.getLayer() && shape.getLayer().batchDraw();
  });

  // Drag start
  shape.on('dragstart.shape', () => {
    log("DEBUG", "[shapes] dragstart.shape event", { shape });
    if (shape.locked) {
      shape.stopDrag();
      lockShape(shape);
      return;
    }
    startDraggingShape(shape);
  });

  // Drag end
  shape.on('dragend.shape', () => {
    log("DEBUG", "[shapes] dragend.shape event", { shape });
    stopDraggingShape(shape);
    shape.getLayer() && shape.getLayer().batchDraw();
  });

  // Lock/unlock event (for future multi-select logic)
  shape.on('lock.shape', () => {
    log("DEBUG", "[shapes] lock.shape event", { shape });
    lockShape(shape);
  });
  shape.on('unlock.shape', () => {
    log("DEBUG", "[shapes] unlock.shape event", { shape });
    unlockShape(shape);
  });

  log("TRACE", "[shapes] attachShapeEvents exit", { shape });
}
