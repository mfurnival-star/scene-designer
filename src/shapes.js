/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (Fabric.js Migration, Zustand Refactor, ESM ONLY, Full DEBUG Logging Sweep, Diagnostic Labels Edition)
 * - Centralizes all Fabric.js shape construction, event attachment, and per-shape config.
 * - Exports: makePointShape, makeRectShape, makeCircleShape, fixStrokeWidthAfterTransform.
 * - Every shape/group gets a unique _id at creation for sidebar/selection robustness.
 * - NO selection event handlers are attached to shapes (handled centrally in canvas.js).
 * - Handles per-shape config, label, lock, and transformer events.
 * - No global variables, no window.* usage.
 * - Logging via log.js (EXHAUSTIVE DEBUG logging: creation, config, events).
 * - Stroke width: always stays at 1px regardless of scaling or transform.
 * - **NEW: Each shape has a visible diagnostic label displaying its _label and _id.**
 * - **FIX: Only the Group is selectable/evented; all children are not.**
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
  log("DEBUG", "[shapes] setStrokeWidthForSelectedShapes ENTRY", { width, selectedShapes: getState().selectedShapes.map(s => s?._id) });
  currentStrokeWidth = width;
  (getState().selectedShapes || []).forEach(shape => {
    setShapeStrokeWidth(shape, width);
    log("DEBUG", "[shapes] setStrokeWidthForSelectedShapes: shape updated", { shapeId: shape._id, type: shape._type });
  });
  if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  log("DEBUG", "[shapes] setStrokeWidthForSelectedShapes EXIT");
}

/**
 * Ensure stroke width is always 1px for all shape types, even after scaling/transform.
 * Call this after any transform event, selection change, or shape resize.
 */
export function fixStrokeWidthAfterTransform() {
  log("DEBUG", "[shapes] fixStrokeWidthAfterTransform ENTRY", { selectedShapes: getState().selectedShapes.map(s => s?._id) });
  (getState().selectedShapes || []).forEach(shape => {
    setShapeStrokeWidth(shape, 1);
    log("DEBUG", "[shapes] fixStrokeWidthAfterTransform: shape updated", { shapeId: shape._id, type: shape._type });
  });
  if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  log("DEBUG", "[shapes] fixStrokeWidthAfterTransform EXIT");
}

/**
 * Helper: forcibly set stroke width for a shape (rect, circle, point group).
 */
function setShapeStrokeWidth(shape, width = 1) {
  log("DEBUG", "[shapes] setShapeStrokeWidth ENTRY", { shapeId: shape?._id, type: shape?._type, width });
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
  log("DEBUG", "[shapes] setShapeStrokeWidth EXIT", { shapeId: shape?._id, type: shape?._type, width });
}

/**
 * Helper: Create diagnostic label as a Fabric.Text object.
 * @param {string} label
 * @param {string} id
 * @param {number} x
 * @param {number} y
 * @returns {fabric.Text}
 */
function makeDiagnosticLabel(label, id, x, y) {
  // Use Fabric.js Text object; place above shape by default
  // Use small font, grey color, and monospace for clarity
  const text = new window.fabric.Text(`${label}\n${id}`, {
    left: x,
    top: y - 18,
    fontSize: 11,
    fontFamily: 'monospace',
    fill: '#666',
    backgroundColor: 'rgba(255,255,255,0.7)',
    selectable: false,
    evented: false,
    fontWeight: 'normal',
    textAlign: 'center',
    originX: 'center',
    originY: 'top'
  });
  text._isDiagnosticLabel = true;
  // Ensure not selectable/evented
  text.selectable = false;
  text.evented = false;
  return text;
}

/**
 * Make a point shape (crosshair/halo/transparent hit area, for annotation).
 * Only the Group is selectable/evented; children are not.
 */
export function makePointShape(x, y) {
  log("DEBUG", "[shapes] makePointShape ENTRY", { x, y, settings: getState().settings });

  // Settings for point visuals
  const settings = getState().settings || {};
  const hitRadius = settings.pointHitRadius ?? 16;
  const haloRadius = settings.pointHaloRadius ?? 12;
  const crossLen = settings.pointCrossLen ?? 14;
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';

  log("DEBUG", "[shapes] makePointShape: settings", {
    hitRadius, haloRadius, crossLen, strokeColor, fillColor
  });

  const hitCircle = new Circle({
    left: x - hitRadius,
    top: y - hitRadius,
    radius: hitRadius,
    fill: "#fff",
    opacity: 0
  });
  hitCircle.selectable = false;
  hitCircle.evented = false;

  const halo = new Circle({
    left: x - haloRadius,
    top: y - haloRadius,
    radius: haloRadius,
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    fill: fillColor,
    opacity: 0.4
  });
  halo.selectable = false;
  halo.evented = false;

  const crossH = new Line(
    [x - crossLen / 2, y, x + crossLen / 2, y],
    { stroke: strokeColor, strokeWidth: currentStrokeWidth }
  );
  crossH.selectable = false;
  crossH.evented = false;

  const crossV = new Line(
    [x, y - crossLen / 2, x, y + crossLen / 2],
    { stroke: strokeColor, strokeWidth: currentStrokeWidth }
  );
  crossV.selectable = false;
  crossV.evented = false;

  const pointId = generateShapeId('point');
  const label = makeDiagnosticLabel("Point", pointId, x, y);

  const pointGroup = new Group([hitCircle, halo, crossH, crossV, label], {
    left: x,
    top: y,
    selectable: true,
    evented: true
  });

  pointGroup._type = 'point';
  pointGroup._label = 'Point';
  pointGroup.locked = false;
  pointGroup._id = pointId;

  log("DEBUG", "[shapes] makePointShape: creation", {
    type: pointGroup._type,
    label: pointGroup._label,
    _id: pointGroup._id,
    objects: pointGroup._objects
  });

  pointGroup.on("modified", () => {
    log("DEBUG", "[shapes] makePointShape: modified event fired", { shapeId: pointGroup._id });
    setShapeStrokeWidth(pointGroup, 1);
    if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  });

  setShapeState(pointGroup, 'default');
  log("DEBUG", "[shapes] makePointShape EXIT", {
    type: pointGroup._type,
    label: pointGroup._label,
    _id: pointGroup._id
  });

  return pointGroup;
}

/**
 * Make a rectangle shape.
 * Only the Group is selectable/evented; children are not.
 */
export function makeRectShape(x, y, w, h) {
  log("DEBUG", "[shapes] makeRectShape ENTRY", { x, y, w, h, settings: getState().settings });

  // Read settings for rect shape defaults
  const settings = getState().settings || {};
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';

  log("DEBUG", "[shapes] makeRectShape: settings", {
    strokeColor, fillColor
  });

  const rectId = generateShapeId('rect');
  const rect = new Rect({
    left: x,
    top: y,
    width: w,
    height: h,
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    fill: fillColor
  });
  rect._type = 'rect';
  rect._label = 'Rect';
  rect.locked = false;
  rect._id = rectId;
  rect.selectable = false;
  rect.evented = false;

  // Place diagnostic label above center of rect
  const label = makeDiagnosticLabel("Rect", rectId, x + w / 2, y);

  // Group rect + label as one shape
  const rectGroup = new Group([rect, label], {
    left: x,
    top: y,
    selectable: true,
    evented: true
  });
  rectGroup._type = 'rect';
  rectGroup._label = 'Rect';
  rectGroup.locked = false;
  rectGroup._id = rectId;

  log("DEBUG", "[shapes] makeRectShape: creation", {
    type: rectGroup._type,
    label: rectGroup._label,
    _id: rectGroup._id
  });

  rectGroup.on("modified", () => {
    log("DEBUG", "[shapes] makeRectShape: modified event fired", { shapeId: rectGroup._id });
    setShapeStrokeWidth(rectGroup, 1);
    if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  });

  setShapeState(rectGroup, 'default');
  log("DEBUG", "[shapes] makeRectShape EXIT", {
    type: rectGroup._type,
    label: rectGroup._label,
    _id: rectGroup._id
  });

  return rectGroup;
}

/**
 * Make a circle shape.
 * Only the Group is selectable/evented; children are not.
 */
export function makeCircleShape(x, y, r) {
  log("DEBUG", "[shapes] makeCircleShape ENTRY", { x, y, r, settings: getState().settings });

  // Read settings for circle shape defaults
  const settings = getState().settings || {};
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';

  log("DEBUG", "[shapes] makeCircleShape: settings", {
    strokeColor, fillColor
  });

  const circleId = generateShapeId('circle');
  const circle = new Circle({
    left: x - r,
    top: y - r,
    radius: r,
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    fill: fillColor
  });
  circle._type = 'circle';
  circle._label = 'Circle';
  circle.locked = false;
  circle._id = circleId;
  circle.selectable = false;
  circle.evented = false;

  // Place diagnostic label above center of circle
  const label = makeDiagnosticLabel("Circle", circleId, x, y - r);

  // Group circle + label as one shape
  const circleGroup = new Group([circle, label], {
    left: x - r,
    top: y - r,
    selectable: true,
    evented: true
  });
  circleGroup._type = 'circle';
  circleGroup._label = 'Circle';
  circleGroup.locked = false;
  circleGroup._id = circleId;

  log("DEBUG", "[shapes] makeCircleShape: creation", {
    type: circleGroup._type,
    label: circleGroup._label,
    _id: circleGroup._id
  });

  circleGroup.on("modified", () => {
    log("DEBUG", "[shapes] makeCircleShape: modified event fired", { shapeId: circleGroup._id });
    setShapeStrokeWidth(circleGroup, 1);
    if (getState().fabricCanvas) getState().fabricCanvas.renderAll();
  });

  setShapeState(circleGroup, 'default');
  log("DEBUG", "[shapes] makeCircleShape EXIT", {
    type: circleGroup._type,
    label: circleGroup._label,
    _id: circleGroup._id
  });

  return circleGroup;
}

/**
 * Helper for generating unique shape IDs.
 */
function generateShapeId(type = "shape") {
  const id = `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  log("DEBUG", "[shapes] generateShapeId", { type, id });
  return id;
}

