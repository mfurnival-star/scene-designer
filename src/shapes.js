/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (Fabric.js Migration, ESM ONLY)
 * - Centralizes all Fabric.js shape construction and event attachment.
 * - Exports: makePointShape, makeRectShape, makeCircleShape.
 * - All shapes have selection event handlers from selection.js and shape-state.js.
 * - Handles per-shape config, label, lock, and transformer events.
 * - No global variables, no window.* usage.
 * - Logging via log.js (DEEP TRACE logging for creation and handler attachment).
 * -----------------------------------------------------------
 */

import { Canvas, Rect, Circle, Line, Group, Image } from 'fabric';
import { log } from './log.js';
import { attachSelectionHandlers } from './selection.js';
import { setShapeState } from './shape-state.js';
import { AppState } from './state.js';

/**
 * Make a point shape (crosshair/halo/transparent hit area, for annotation).
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });

  // Settings for point visuals
  const hitRadius = AppState.settings?.pointHitRadius ?? 16;
  const haloRadius = AppState.settings?.pointHaloRadius ?? 12;
  const crossLen = AppState.settings?.pointCrossLen ?? 14;
  const strokeColor = AppState.settings?.defaultStrokeColor ?? '#2176ff';
  const fillColor = AppState.settings?.defaultFillColor ?? '#00000000';

  log("TRACE", "[shapes] makePointShape settings", {
    hitRadius, haloRadius, crossLen, strokeColor, fillColor
  });

  // Fabric.js doesn't have groups with hit areas; use a transparent circle as hit area
  const hitCircle = new Circle({
    left: x - hitRadius,
    top: y - hitRadius,
    radius: hitRadius,
    fill: "#fff",
    opacity: 0,
    selectable: true,
    evented: true
  });

  // Halo for visual feedback
  const halo = new Circle({
    left: x - haloRadius,
    top: y - haloRadius,
    radius: haloRadius,
    stroke: strokeColor,
    strokeWidth: 1.5,
    fill: fillColor,
    opacity: 0.4,
    selectable: false,
    evented: false
  });

  // Crosshair lines
  const crossH = new Line(
    [x - crossLen / 2, y, x + crossLen / 2, y],
    { stroke: strokeColor, strokeWidth: 2.5, selectable: false, evented: false }
  );
  const crossV = new Line(
    [x, y - crossLen / 2, x, y + crossLen / 2],
    { stroke: strokeColor, strokeWidth: 2.5, selectable: false, evented: false }
  );

  // Fabric group for point shape
  const pointGroup = new Group([hitCircle, halo, crossH, crossV], {
    left: x,
    top: y,
    selectable: true,
    evented: true
  });

  pointGroup._type = 'point';
  pointGroup._label = 'Point';
  pointGroup.locked = false;

  log("TRACE", "[shapes] makePointShape: before attachSelectionHandlers", {
    pointGroup,
    type: pointGroup._type,
    label: pointGroup._label,
  });
  attachSelectionHandlers(pointGroup);
  log("TRACE", "[shapes] makePointShape: after attachSelectionHandlers", {
    pointGroup,
    type: pointGroup._type,
    label: pointGroup._label,
  });

  setShapeState(pointGroup, 'default');
  log("TRACE", "[shapes] makePointShape exit", { pointGroup });

  return pointGroup;
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

  const rect = new Rect({
    left: x,
    top: y,
    width: w,
    height: h,
    stroke: strokeColor,
    strokeWidth: 1,
    fill: fillColor,
    selectable: true,
    evented: true
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

  const circle = new Circle({
    left: x - r,
    top: y - r,
    radius: r,
    stroke: strokeColor,
    strokeWidth: 1,
    fill: fillColor,
    selectable: true,
    evented: true
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

