/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (Fabric.js Migration, Zustand Refactor, ESM ONLY)
 * - Centralizes all Fabric.js shape construction, event attachment, and per-shape config.
 * - Exports: makePointShape, makeRectShape, makeCircleShape, fixStrokeWidthAfterTransform.
 * - Every shape/group gets a unique _id at creation for sidebar/selection robustness.
 * - NO selection event handlers are attached to shapes (handled centrally in canvas.js).
 * - Handles per-shape config, label, lock, and transformer events.
 * - No global variables, no window.* usage.
 * - Logging via log.js (DEEP TRACE logging for creation and handler attachment).
 * - Stroke width: always stays at 1px regardless of scaling or transform.
 * -----------------------------------------------------------
 */

import { Canvas, Rect, Circle, Line, Group, Image } from './fabric-wrapper.js';
import { log } from './log.js';
import { setShapeState } from './shape-state.js';
import {
  getState,
  setShapes,
  setSelectedShapes,
  addShape,
  removeShape
} from './state.js';

// Default stroke width for all shapes
let currentStrokeWidth = 1;

/**
 * Set the stroke width for all selected shapes.
 * This is a helper for future UI integration.
 * For now, always sets to 1px.
 */
export function setStrokeWidthForSelectedShapes(width = 1) {
  log("DEBUG", "[shapes] setStrokeWidthForSelectedShapes", { width });
  currentStrokeWidth = width;
  (getState().selectedShapes || []).forEach(shape => {
    setShapeStrokeWidth(shape, width);
  });
  if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
}

/**
 * Ensure stroke width is always 1px for all shape types, even after scaling/transform.
 * Call this after any transform event, selection change, or shape resize.
 */
export function fixStrokeWidthAfterTransform() {
  log("DEBUG", "[shapes] fixStrokeWidthAfterTransform called");
  (getState().selectedShapes || []).forEach(shape => {
    setShapeStrokeWidth(shape, 1);
  });
  if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
}

/**
 * Helper: forcibly set stroke width for a shape (rect, circle, point group).
 */
function setShapeStrokeWidth(shape, width = 1) {
  if (shape._type === 'rect' || shape._type === 'circle') {
    shape.set({ strokeWidth: width });
  } else if (shape._type === 'point') {
    // For points: update crosshair and halo lines if present
    if (shape._objects && Array.isArray(shape._objects)) {
      shape._objects.forEach(obj => {
        if (obj.type === 'line' || obj.type === 'circle') obj.set({ strokeWidth: width });
      });
    }
  }
}

/**
 * Make a point shape (crosshair/halo/transparent hit area, for annotation).
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape ENTRY", { x, y });

  // Settings for point visuals
  const settings = getState().settings || {};
  const hitRadius = settings.pointHitRadius ?? 16;
  const haloRadius = settings.pointHaloRadius ?? 12;
  const crossLen = settings.pointCrossLen ?? 14;
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';

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
    strokeWidth: currentStrokeWidth,
    fill: fillColor,
    opacity: 0.4,
    selectable: false,
    evented: false
  });

  // Crosshair lines
  const crossH = new Line(
    [x - crossLen / 2, y, x + crossLen / 2, y],
    { stroke: strokeColor, strokeWidth: currentStrokeWidth, selectable: false, evented: false }
  );
  const crossV = new Line(
    [x, y - crossLen / 2, x, y + crossLen / 2],
    { stroke: strokeColor, strokeWidth: currentStrokeWidth, selectable: false, evented: false }
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
  pointGroup._id = generateShapeId('point');

  log("TRACE", "[shapes] makePointShape: creation", {
    type: pointGroup._type,
    label: pointGroup._label,
    _id: pointGroup._id
  });

  // Listen for transform events and forcibly reset strokeWidth to 1px
  pointGroup.on("modified", () => {
    setShapeStrokeWidth(pointGroup, 1);
    if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  });

  setShapeState(pointGroup, 'default');
  log("TRACE", "[shapes] makePointShape EXIT", {
    type: pointGroup._type,
    label: pointGroup._label,
    _id: pointGroup._id
  });

  return pointGroup;
}

/**
 * Make a rectangle shape.
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape ENTRY", { x, y, w, h });

  // Read settings for rect shape defaults
  const settings = getState().settings || {};
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';

  log("TRACE", "[shapes] makeRectShape settings", {
    strokeColor, fillColor
  });

  const rect = new Rect({
    left: x,
    top: y,
    width: w,
    height: h,
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    fill: fillColor,
    selectable: true,
    evented: true
  });
  rect._type = 'rect';
  rect._label = 'Rect';
  rect.locked = false;
  rect._id = generateShapeId('rect');

  log("TRACE", "[shapes] makeRectShape: creation", {
    type: rect._type,
    label: rect._label,
    _id: rect._id
  });

  // Listen for transform events and forcibly reset strokeWidth to 1px
  rect.on("modified", () => {
    setShapeStrokeWidth(rect, 1);
    if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  });

  setShapeState(rect, 'default');
  log("TRACE", "[shapes] makeRectShape EXIT", {
    type: rect._type,
    label: rect._label,
    _id: rect._id
  });

  return rect;
}

/**
 * Make a circle shape.
 */
export function makeCircleShape(x, y, r) {
  log("TRACE", "[shapes] makeCircleShape ENTRY", { x, y, r });

  // Read settings for circle shape defaults
  const settings = getState().settings || {};
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';

  log("TRACE", "[shapes] makeCircleShape settings", {
    strokeColor, fillColor
  });

  const circle = new Circle({
    left: x - r,
    top: y - r,
    radius: r,
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    fill: fillColor,
    selectable: true,
    evented: true
  });
  circle._type = 'circle';
  circle._label = 'Circle';
  circle.locked = false;
  circle._id = generateShapeId('circle');

  log("TRACE", "[shapes] makeCircleShape: creation", {
    type: circle._type,
    label: circle._label,
    _id: circle._id
  });

  // Listen for transform events and forcibly reset strokeWidth to 1px
  circle.on("modified", () => {
    setShapeStrokeWidth(circle, 1);
    if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  });

  setShapeState(circle, 'default');
  log("TRACE", "[shapes] makeCircleShape EXIT", {
    type: circle._type,
    label: circle._label,
    _id: circle._id
  });

  return circle;
}

/**
 * Helper for generating unique shape IDs.
 */
function generateShapeId(type = "shape") {
  return `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

