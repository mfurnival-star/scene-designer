/**
 * shapes.js
 * -----------------------------------------------------------
 * Shape Factory Module for Scene Designer (ESM only)
 * - Exports: makePointShape(x, y), makeRectShape(x, y, w, h), makeCircleShape(x, y, r)
 * - All Konva shape construction, selection logic, and property/event attachment.
 * - Used by toolbar, canvas, sidebar, and all shape-creation features.
 * - Ensures all shapes have _type, _label, locked, and ES module event handlers.
 * - No window/global code; all state flows via AppState.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { log } from './log.js';
import { attachShapeEvents } from './selection.js';

/**
 * Create a Point shape (crosshair, halo, invisible hit area for easy selection/drag)
 * @param {number} x
 * @param {number} y
 * @returns {Konva.Group}
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });
  // Configurable settings; you can import these from settings.js if needed
  const crossLen = 14;
  const haloR = 12;
  const hitR = 16;

  const group = new Konva.Group({ x, y, draggable: true });

  // Invisible hit area (for easy tap/drag)
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: hitR,
    fill: "#fff",
    opacity: 0, // fully transparent
    listening: true
  });

  // Halo (faint circle for visibility/selection)
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: haloR,
    stroke: '#2176ff',
    strokeWidth: 1.5,
    opacity: 0.4,
    listening: false
  });

  // Horizontal crosshair line
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Vertical crosshair line
  const crossV = new Konva.Line({
    points: [0, -crossLen / 2, 0, crossLen / 2],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Selection halo
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

  group.showSelection = function (isSelected) {
    selHalo.visible(isSelected);
  };

  attachShapeEvents(group);

  log("TRACE", "[shapes] makePointShape exit", group);
  return group;
}

/**
 * Create a Rectangle shape.
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
    fill: "#00000000", // Transparent fill by default
    draggable: true
  });
  rect._type = "rect";
  rect._label = "Rectangle";
  rect.locked = false;

  attachShapeEvents(rect);

  log("TRACE", "[shapes] makeRectShape exit", rect);
  return rect;
}

/**
 * Create a Circle shape.
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
    fill: "#00000000", // Transparent fill by default
    draggable: true
  });
  circle._type = "circle";
  circle._label = "Circle";
  circle.locked = false;

  attachShapeEvents(circle);

  log("TRACE", "[shapes] makeCircleShape exit", circle);
  return circle;
}
