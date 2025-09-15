/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module
 * - Exports shape creation functions for Point, Rectangle, Circle.
 * - Ensures each shape is a valid Konva object with required properties.
 * - Attaches selection handlers and event listeners.
 * - Used by toolbar, canvas, sidebar, and all shape-creation features.
 * - All code uses ES module imports/exports.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { log } from './log.js';
import { attachSelectionHandlers } from './selection.js';

/**
 * Create a Point shape (Konva.Group with crosshair, halo, hit area).
 * @param {number} x
 * @param {number} y
 * @returns {Konva.Group}
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });
  // Settings for point visual/interaction
  const crossLen = 14;
  const haloR = 12;
  const hitR = 16;

  const group = new Konva.Group({ x, y, draggable: true });

  // Invisible hit area
  const hitCircle = new Konva.Circle({
    x: 0, y: 0, radius: hitR,
    fill: "#fff", opacity: 0, listening: true
  });

  // Halo for selection
  const halo = new Konva.Circle({
    x: 0, y: 0, radius: haloR,
    stroke: '#2176ff', strokeWidth: 1.5, opacity: 0.4, listening: false
  });

  // Crosshair lines
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: '#2176ff', strokeWidth: 2.5, lineCap: 'round', listening: false
  });
  const crossV = new Konva.Line({
    points: [0, -crossLen / 2, 0, crossLen / 2],
    stroke: '#2176ff', strokeWidth: 2.5, lineCap: 'round', listening: false
  });

  // Selection halo
  const selHalo = new Konva.Circle({
    x: 0, y: 0, radius: haloR + 3,
    stroke: "#0057d8", strokeWidth: 2, opacity: 0.8, visible: false, listening: false
  });

  group.add(hitCircle);
  group.add(selHalo);
  group.add(halo);
  group.add(crossH);
  group.add(crossV);

  group._type = 'point';
  group._label = 'Point';
  group.locked = false;

  group.getSampleCoords = function() {
    log("TRACE", "[shapes] getSampleCoords called", { group });
    return { x: group.x(), y: group.y() };
  };

  group.showSelection = function(isSelected) {
    log("TRACE", "[shapes] showSelection called", { isSelected });
    selHalo.visible(isSelected);
  };

  group.on('mouseenter', () => {
    log("TRACE", "[shapes] point mouseenter", { group });
    if (group.getStage() && group.getStage().container())
      group.getStage().container().style.cursor = 'pointer';
  });
  group.on('mouseleave', () => {
    log("TRACE", "[shapes] point mouseleave", { group });
    if (group.getStage() && group.getStage().container())
      group.getStage().container().style.cursor = '';
  });

  attachSelectionHandlers(group);

  log("TRACE", "[shapes] makePointShape exit", group);
  return group;
}

/**
 * Create a Rectangle shape (Konva.Rect).
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @returns {Konva.Rect}
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });
  const stroke = "#2176ff";
  const fill = "#00000000";
  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: w,
    height: h,
    stroke,
    strokeWidth: 1,
    fill,
    draggable: true
  });
  rect._type = 'rect';
  rect._label = 'Rectangle';
  rect.locked = false;

  attachSelectionHandlers(rect);

  log("TRACE", "[shapes] makeRectShape exit", rect);
  return rect;
}

/**
 * Create a Circle shape (Konva.Circle).
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @returns {Konva.Circle}
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape entry", { x, y, r });
  const stroke = "#2176ff";
  const fill = "#00000000";
  const circle = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    stroke,
    strokeWidth: 1,
    fill,
    draggable: true
  });
  circle._type = 'circle';
  circle._label = 'Circle';
  circle.locked = false;

  attachSelectionHandlers(circle);

  log("TRACE", "[shapes] makeCircleShape exit", circle);
  return circle;
}
