/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (ESM ONLY)
 * - Centralizes all Konva shape construction, labeling, and event attachment.
 * - Exports: makePointShape(x, y), makeRectShape(x, y, w, h), makeCircleShape(x, y, r)
 * - No direct Konva layer addition; shape addition handled in canvas.js subscriber only.
 * - All dependencies imported as ES modules.
 * - No window/global code except optional debug helpers (remove for production).
 * - All logging via log.js.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { log } from './log.js';
import { attachSelectionHandlers } from './selection.js';
import { AppState, getSetting } from './state.js';

/**
 * Factory: Point shape (crosshair + halo + hit area)
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });

  const crossLen = getSetting("pointCrossLen") ?? 14;
  const haloR = getSetting("pointHaloRadius") ?? 12;
  const hitR = getSetting("pointHitRadius") ?? 16;

  const group = new Konva.Group({ x, y, draggable: true });

  // Invisible hit area
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: hitR,
    fill: "#fff",
    opacity: 0,
    listening: true
  });

  // Halo (faint circle for selection)
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: haloR,
    stroke: '#2176ff',
    strokeWidth: 1.5,
    opacity: 0.4,
    listening: false
  });

  // Horizontal crosshair
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Vertical crosshair
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
  group._label = 'Point' + (AppState.shapes.filter(s => s._type === 'point').length + 1);
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
    if (typeof document !== "undefined") {
      group.getStage()?.container().style.cursor = 'pointer';
    }
  });
  group.on('mouseleave', () => {
    log("TRACE", "[shapes] point mouseleave", { group });
    if (typeof document !== "undefined") {
      group.getStage()?.container().style.cursor = '';
    }
  });

  // Attach selection handlers for selection logic
  attachSelectionHandlers(group);

  log("TRACE", "[shapes] makePointShape exit shape diagnostic", {
    typeofShape: typeof group,
    constructorName: group?.constructor?.name,
    isKonva: group instanceof Konva.Group,
    isRect: false,
    isCircle: false,
    isObject: group && typeof group === "object" && !(group instanceof Konva.Shape),
    attrs: group?.attrs,
    className: group?.className,
    _type: group?._type,
    _label: group?._label,
    keys: group ? Object.keys(group) : []
  });

  return group;
}

/**
 * Factory: Rectangle shape
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });

  const stroke = getSetting("defaultStrokeColor") ?? "#000";
  const fill = getSetting("defaultFillColor") ?? "#0000";

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
  rect._type = "rect";
  rect._label = "Rectangle" + (AppState.shapes.filter(s => s._type === 'rect').length + 1);
  rect.locked = false;

  attachSelectionHandlers(rect);

  log("TRACE", "[shapes] makeRectShape exit shape diagnostic", {
    typeofShape: typeof rect,
    constructorName: rect?.constructor?.name,
    isKonva: rect instanceof Konva.Rect,
    isRect: true,
    isCircle: false,
    isObject: rect && typeof rect === "object" && !(rect instanceof Konva.Shape),
    attrs: rect?.attrs,
    className: rect?.className,
    _type: rect?._type,
    _label: rect?._label,
    keys: rect ? Object.keys(rect) : []
  });

  return rect;
}

/**
 * Factory: Circle shape
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape entry", { x, y, r });

  const stroke = getSetting("defaultStrokeColor") ?? "#000";
  const fill = getSetting("defaultFillColor") ?? "#0000";

  const circle = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    stroke,
    strokeWidth: 1,
    fill,
    draggable: true
  });
  circle._type = "circle";
  circle._label = "Circle" + (AppState.shapes.filter(s => s._type === 'circle').length + 1);
  circle.locked = false;

  attachSelectionHandlers(circle);

  log("TRACE", "[shapes] makeCircleShape exit shape diagnostic", {
    typeofShape: typeof circle,
    constructorName: circle?.constructor?.name,
    isKonva: circle instanceof Konva.Circle,
    isRect: false,
    isCircle: true,
    isObject: circle && typeof circle === "object" && !(circle instanceof Konva.Shape),
    attrs: circle?.attrs,
    className: circle?.className,
    _type: circle?._type,
    _label: circle?._label,
    keys: circle ? Object.keys(circle) : []
  });

  return circle;
}

// Optionally attach to window for debugging (remove in production!)
if (typeof window !== "undefined") {
  window.makePointShape = makePointShape;
  window.makeRectShape = makeRectShape;
  window.makeCircleShape = makeCircleShape;
}


