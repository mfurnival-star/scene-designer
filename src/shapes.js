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
import { AppState } from './state.js';

/**
 * Make a point shape (crosshair/halo/transparent hit area).
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });

  // Read settings for point shape visuals
  const hitRadius = AppState.settings?.pointHitRadius ?? 16;
  const haloRadius = AppState.settings?.pointHaloRadius ?? 12;
  const crossLen = AppState.settings?.pointCrossLen ?? 14;
  const strokeColor = AppState.settings?.defaultStrokeColor ?? '#2176ff';
  const fillColor = AppState.settings?.defaultFillColor ?? '#00000000';

  log("TRACE", "[shapes] makePointShape settings", {
    hitRadius, haloRadius, crossLen, strokeColor, fillColor
  });

  const group = new Konva.Group({ x, y, draggable: true });

  // Invisible hit area for easy selection/tap
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: hitRadius,
    fill: "#fff",
    opacity: 0,
    listening: true
  });

  // Halo (faint circle for visibility)
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: haloRadius,
    stroke: strokeColor,
    strokeWidth: 1.5,
    fill: fillColor,
    opacity: 0.4,
    listening: false
  });

  // Crosshairs
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: strokeColor,
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  const crossV = new Konva.Line({
    points: [0, -crossLen / 2, 0, crossLen / 2],
    stroke: strokeColor,
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

  log("TRACE", "[shapes] makePointShape: before attachSelectionHandlers", {
    group,
    type: group._type,
    label: group._label,
  });
  attachSelectionHandlers(group);
  log("TRACE", "[shapes] makePointShape: after attachSelectionHandlers", {
    group,
    type: group._type,
    label: group._label,
  });

  setShapeState(group, 'default');
  log("TRACE", "[shapes] makePointShape exit", { group });

  return group;
}

/**
 * Make a rectangle shape.
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });

  // Read settings for rect shape defaults
  const strokeColor = AppState.settings?.defaultStrokeColor ?? '#2176ff';
  const fillColor = AppState.settings?.defaultFillColor ?? '#00000000';

  log("TRACE", "[shapes] makeRectShape settings", {
    strokeColor, fillColor
  });

  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: w,
    height: h,
    stroke: strokeColor,
    strokeWidth: 1,
    fill: fillColor,
    draggable: true
  });
  rect._type = 'rect';
  rect._label = 'Rect';
  rect.locked = false;

  log("TRACE", "[shapes] makeRectShape: before attachSelectionHandlers", {
    rect,
    type: rect._type,
    label: rect._label,
  });
  attachSelectionHandlers(rect);
  log("TRACE", "[shapes] makeRectShape: after attachSelectionHandlers", {
    rect,
    type: rect._type,
    label: rect._label,
  });

  setShapeState(rect, 'default');
  log("TRACE", "[shapes] makeRectShape exit", { rect });

  return rect;
}

/**
 * Make a circle shape.
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape entry", { x, y, r });

  // Read settings for circle shape defaults
  const strokeColor = AppState.settings?.defaultStrokeColor ?? '#2176ff';
  const fillColor = AppState.settings?.defaultFillColor ?? '#00000000';

  log("TRACE", "[shapes] makeCircleShape settings", {
    strokeColor, fillColor
  });

  const circle = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    stroke: strokeColor,
    strokeWidth: 1,
    fill: fillColor,
    draggable: true
  });
  circle._type = 'circle';
  circle._label = 'Circle';
  circle.locked = false;

  log("TRACE", "[shapes] makeCircleShape: before attachSelectionHandlers", {
    circle,
    type: circle._type,
    label: circle._label,
  });
  attachSelectionHandlers(circle);
  log("TRACE", "[shapes] makeCircleShape: after attachSelectionHandlers", {
    circle,
    type: circle._type,
    label: circle._label,
  });

  setShapeState(circle, 'default');
  log("TRACE", "[shapes] makeCircleShape exit", { circle });

  return circle;
}

