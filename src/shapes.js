/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (ESM ONLY)
 * - Centralizes all Konva shape construction and event attachment.
 * - Exports: makePointShape, makeRectShape, makeCircleShape.
 * - All shapes have selection event handlers from selection.js and shape-state.js.
 * - Handles per-shape config, label, lock, and transformer events.
 * - No global variables, no window.* usage.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { log } from './log.js';
import { attachSelectionHandlers } from './selection.js';
import { setShapeState } from './shape-state.js';

/**
 * Make a point shape (crosshair/halo/transparent hit area).
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });
  const group = new Konva.Group({ x, y, draggable: true });

  // Invisible hit area for easy selection/tap
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: 16,
    fill: "#fff",
    opacity: 0,
    listening: true
  });

  // Halo (faint circle for visibility)
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: 12,
    stroke: '#2176ff',
    strokeWidth: 1.5,
    opacity: 0.4,
    listening: false
  });

  // Crosshairs
  const crossH = new Konva.Line({
    points: [-7, 0, 7, 0],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  const crossV = new Konva.Line({
    points: [0, -7, 0, 7],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  group.add(hitCircle);
  group.add(halo);
  group.add(crossH);
  group.add(crossV);

  group._type = 'point';
  group._label = 'Point';
  group.locked = false;

  attachSelectionHandlers(group);
  setShapeState(group, 'default');

  log("TRACE", "[shapes] makePointShape exit");
  return group;
}

/**
 * Make a rectangle shape.
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });
  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: w,
    height: h,
    stroke: '#2176ff',
    strokeWidth: 1,
    fill: '#00000000',
    draggable: true
  });
  rect._type = 'rect';
  rect._label = 'Rect';
  rect.locked = false;

  attachSelectionHandlers(rect);
  setShapeState(rect, 'default');

  log("TRACE", "[shapes] makeRectShape exit");
  return rect;
}

/**
 * Make a circle shape.
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape entry", { x, y, r });
  const circle = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    stroke: '#2176ff',
    strokeWidth: 1,
    fill: '#00000000',
    draggable: true
  });
  circle._type = 'circle';
  circle._label = 'Circle';
  circle.locked = false;

  attachSelectionHandlers(circle);
  setShapeState(circle, 'default');

  log("TRACE", "[shapes] makeCircleShape exit");
  return circle;
}

