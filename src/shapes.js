/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (Fabric.js Migration, Zustand Refactor, ESM ONLY, Full DEBUG Logging Sweep, Diagnostic Labels Edition)
 * - Centralizes all Fabric.js shape construction, event attachment, and per-shape config.
 * - Exports: makePointShape, makeRectShape, makeCircleShape, fixStrokeWidthAfterTransform, setStrokeWidthForSelectedShapes, applyDiagnosticLabelsVisibility
 * - Every shape/group gets a unique _id at creation for sidebar/selection robustness.
 * - NO selection event handlers are attached to shapes (handled centrally in canvas.js).
 * - Handles per-shape config, label, lock, and transformer events.
 * - No global variables, no window.* usage.
 * - Logging via log.js (EXHAUSTIVE DEBUG logging: creation, config, events).
 * - Stroke width: always stays at 1px regardless of scaling or transform.
 * - Diagnostic label: when disabled, the label object is removed from the group so it does not affect bounds.
 * - **FIX: Only the Group is selectable/evented; all children are not.**
 * -----------------------------------------------------------
 */

import { Rect, Circle, Line, Group } from './fabric-wrapper.js';
import { log } from './log.js';
import { setShapeState } from './shape-state.js';
import { getState } from './state.js';

// Default stroke width for all shapes
let currentStrokeWidth = 1;

/**
 * Set the stroke width for all selected shapes.
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
  if (!shape) return;
  if (shape._type === 'rect' || shape._type === 'circle') {
    if (shape._objects && Array.isArray(shape._objects)) {
      shape._objects.forEach(obj => {
        if (obj.type === 'rect' || obj.type === 'circle') obj.set({ strokeWidth: width });
      });
    }
  } else if (shape._type === 'point') {
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
 */
function makeDiagnosticLabel(label, id, x, y) {
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
  text.selectable = false;
  text.evented = false;
  // Not exported, not interactive
  text.excludeFromExport = true;
  text.hasControls = false;
  text.hasBorders = false;
  return text;
}

/**
 * Internal: find the diagnostic label child within a group, if present.
 */
function findLabelChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  return group._objects.find(o => o && o._isDiagnosticLabel) || null;
}

/**
 * Internal: Toggle diagnostic label presence in the group.
 * IMPORTANT: When hiding, we remove the label from the group with removeWithUpdate()
 * so it no longer affects the group bounding box used by Fabric's transformer.
 * When showing, we add it back with addWithUpdate().
 */
function setGroupDiagnosticLabelVisible(group, visible) {
  if (!group) return;
  const canvas = getState().fabricCanvas;
  const child = findLabelChild(group);
  if (visible) {
    // If not in group, add it back (from cached reference)
    if (!child && group._diagLabel) {
      try {
        group._diagLabel.visible = true;
        group.addWithUpdate(group._diagLabel);
        group.setCoords();
        log("DEBUG", "[shapes] setGroupDiagnosticLabelVisible: label added back to group", { id: group._id, type: group._type });
      } catch (e) {
        log("ERROR", "[shapes] setGroupDiagnosticLabelVisible: failed to add label", e);
      }
    } else if (child) {
      child.visible = true; // ensure visible if already present
    }
  } else {
    // If present, remove from group to shrink bounds; cache it on the group for later
    if (child) {
      try {
        group._diagLabel = child;
        group.removeWithUpdate(child);
        group.setCoords();
        log("DEBUG", "[shapes] setGroupDiagnosticLabelVisible: label removed from group", { id: group._id, type: group._type });
      } catch (e) {
        log("ERROR", "[shapes] setGroupDiagnosticLabelVisible: failed to remove label", e);
      }
    } else if (group._diagLabel) {
      group._diagLabel.visible = false;
    }
  }
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }
}

/**
 * Public API: Toggle diagnostic labels visibility across all shapes and re-render.
 */
export function applyDiagnosticLabelsVisibility(visible) {
  log("DEBUG", "[shapes] applyDiagnosticLabelsVisibility ENTRY", { visible });
  try {
    const shapes = getState().shapes || [];
    shapes.forEach(group => setGroupDiagnosticLabelVisible(group, visible));
    log("INFO", "[shapes] Diagnostic labels visibility applied", { visible, shapeCount: shapes.length });
  } catch (e) {
    log("ERROR", "[shapes] applyDiagnosticLabelsVisibility error", e);
  }
  log("DEBUG", "[shapes] applyDiagnosticLabelsVisibility EXIT");
}

/**
 * Make a point shape (crosshair/halo/transparent hit area, for annotation).
 * Only the Group is selectable/evented; children are not.
 */
export function makePointShape(x, y) {
  log("DEBUG", "[shapes] makePointShape ENTRY", { x, y, settings: getState().settings });

  const settings = getState().settings || {};
  const hitRadius = settings.pointHitRadius ?? 16;
  const haloRadius = settings.pointHaloRadius ?? 12;
  const crossLen = settings.pointCrossLen ?? 14;
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';
  const showLabels = !!settings.showDiagnosticLabels;

  log("DEBUG", "[shapes] makePointShape: settings", { hitRadius, haloRadius, crossLen, strokeColor, fillColor, showLabels });

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

  const crossH = new Line([x - crossLen / 2, y, x + crossLen / 2, y], { stroke: strokeColor, strokeWidth: currentStrokeWidth });
  crossH.selectable = false;
  crossH.evented = false;

  const crossV = new Line([x, y - crossLen / 2, x, y + crossLen / 2], { stroke: strokeColor, strokeWidth: currentStrokeWidth });
  crossV.selectable = false;
  crossV.evented = false;

  const pointId = generateShapeId('point');
  const label = makeDiagnosticLabel("Point", pointId, x, y);

  // Build group WITH label, then optionally remove it so bounds are correct immediately
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
  pointGroup._diagLabel = label; // cache ref for toggling

  if (!showLabels) {
    // Remove label from group so it doesn't affect bounds
    setGroupDiagnosticLabelVisible(pointGroup, false);
  }

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
  log("DEBUG", "[shapes] makePointShape EXIT", { type: pointGroup._type, label: pointGroup._label, _id: pointGroup._id });

  return pointGroup;
}

/**
 * Make a rectangle shape.
 * Only the Group is selectable/evented; children are not.
 */
export function makeRectShape(x, y, w, h) {
  log("DEBUG", "[shapes] makeRectShape ENTRY", { x, y, w, h, settings: getState().settings });

  const settings = getState().settings || {};
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';
  const showLabels = !!settings.showDiagnosticLabels;

  log("DEBUG", "[shapes] makeRectShape: settings", { strokeColor, fillColor, showLabels });

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
  rect.selectable = false;
  rect.evented = false;

  const label = makeDiagnosticLabel("Rect", rectId, x + w / 2, y);

  // Build group WITH label, then optionally remove it so bounds are correct
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
  rectGroup._diagLabel = label;

  if (!showLabels) {
    setGroupDiagnosticLabelVisible(rectGroup, false);
  }

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
  log("DEBUG", "[shapes] makeRectShape EXIT", { type: rectGroup._type, label: rectGroup._label, _id: rectGroup._id });

  return rectGroup;
}

/**
 * Make a circle shape.
 * Only the Group is selectable/evented; children are not.
 */
export function makeCircleShape(x, y, r) {
  log("DEBUG", "[shapes] makeCircleShape ENTRY", { x, y, r, settings: getState().settings });

  const settings = getState().settings || {};
  const strokeColor = settings.defaultStrokeColor ?? '#2176ff';
  const fillColor = settings.defaultFillColor ?? '#00000000';
  const showLabels = !!settings.showDiagnosticLabels;

  log("DEBUG", "[shapes] makeCircleShape: settings", { strokeColor, fillColor, showLabels });

  const circleId = generateShapeId('circle');
  const circle = new Circle({
    left: x - r,
    top: y - r,
    radius: r,
    stroke: strokeColor,
    strokeWidth: currentStrokeWidth,
    fill: fillColor
  });
  circle.selectable = false;
  circle.evented = false;

  const label = makeDiagnosticLabel("Circle", circleId, x, y - r);

  // Build group WITH label, then optionally remove it so bounds are correct
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
  circleGroup._diagLabel = label;

  if (!showLabels) {
    setGroupDiagnosticLabelVisible(circleGroup, false);
  }

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
  log("DEBUG", "[shapes] makeCircleShape EXIT", { type: circleGroup._type, label: circleGroup._label, _id: circleGroup._id });

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

