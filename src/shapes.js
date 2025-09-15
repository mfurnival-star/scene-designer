/**
 * shapes.js
 * -----------------------------------------------------------
 * Shape Factory Module for Scene Designer (ESM only)
 * - Exports: makePointShape(x, y), makeRectShape(x, y, w, h), makeCircleShape(x, y, r)
 * - Centralizes all Konva shape construction and property/event attachment.
 * - Used by toolbar, canvas, sidebar, and all shape-creation features.
 * - All shapes returned are guaranteed to be Konva objects.
 * - Logs all major creation and event attachment actions.
 * - No window/global code; all imports/exports are ES module only.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { log } from './log.js';
import { attachSelectionHandlers } from './selection.js';

/**
 * Utility: Dump shape diagnostic info for debugging.
 */
function dumpShapeDebug(shape, tag = "") {
  log("TRACE", `[shapes] ${tag} shape diagnostic`, {
    typeofShape: typeof shape,
    constructorName: shape?.constructor?.name,
    isKonva: shape instanceof Konva.Shape,
    isGroup: shape instanceof Konva.Group,
    isRect: shape instanceof Konva.Rect,
    isCircle: shape instanceof Konva.Circle,
    isObject: shape && typeof shape === "object" && !(shape instanceof Konva.Shape),
    attrs: shape?.attrs,
    className: shape?.className,
    _type: shape?._type,
    _label: shape?._label,
    keys: shape ? Object.keys(shape) : []
  });
}

/**
 * Create a point shape (Konva.Group with crosshair and halo)
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });

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

  attachSelectionHandlers(group);

  dumpShapeDebug(group, "makePointShape exit");
  return group;
}

/**
 * Create a rectangle shape (Konva.Rect)
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });

  const rect = new Konva.Rect({
    x,
    y,
    width: w,
    height: h,
    stroke: '#2176ff',
    strokeWidth: 1,
    fill: '#00000000',
    draggable: true
  });

  rect._type = 'rect';
  rect._label = 'Rectangle';
  rect.locked = false;

  attachSelectionHandlers(rect);

  dumpShapeDebug(rect, "makeRectShape exit");
  return rect;
}

/**
 * Create a circle shape (Konva.Circle)
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape entry", { x, y, r });

  const circle = new Konva.Circle({
    x,
    y,
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

  dumpShapeDebug(circle, "makeCircleShape exit");
  return circle;
}

