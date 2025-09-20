/**
 * shapes-core.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Core (Fabric.js, ESM ONLY)
 * Purpose:
 * - Core helpers used by shape factories (IDs, labels, stroke width).
 * - Implements non-point shapes (rect, circle).
 * - Diagnostic label visibility management for all shapes.
 *
 * Exports:
 * - Public:
 *    setStrokeWidthForSelectedShapes,
 *    fixStrokeWidthAfterTransform,
 *    makeRectShape,
 *    makeCircleShape,
 *    applyDiagnosticLabelsVisibility
 * - Internal helpers (consumed by shapes-point.js):
 *    getDefaultStrokeWidth,
 *    getStrokeColor,
 *    getFillColor,
 *    getShowDiagnosticLabels,
 *    makeDiagnosticLabel,
 *    generateShapeId,
 *    setShapeStrokeWidth,
 *    setGroupDiagnosticLabelVisible
 *
 * Dependencies:
 * - fabric-wrapper.js (Rect, Circle, Group)
 * - state.js (getState)
 * - log.js (log)
 * - shape-state.js (setShapeState)
 * -----------------------------------------------------------
 */

import { Rect, Circle, Group } from './fabric-wrapper.js';
import { log } from './log.js';
import { setShapeState } from './shape-state.js';
import { getState } from './state.js';

// Track the last applied stroke width for convenience; source of truth is settings.defaultStrokeWidth
let currentStrokeWidth = 1;

// ---------- Settings helpers (public for point module) ----------
export function getDefaultStrokeWidth() {
  const s = getState().settings;
  const val = s && typeof s.defaultStrokeWidth === "number" ? s.defaultStrokeWidth : 1;
  return val > 0 ? val : 1;
}
export function getStrokeColor() {
  return getState().settings?.defaultStrokeColor ?? '#2176ff';
}
export function getFillColor() {
  return getState().settings?.defaultFillColor ?? '#00000000';
}
export function getShowDiagnosticLabels() {
  return !!getState().settings?.showDiagnosticLabels;
}

// ---------- Stroke width control ----------
export function setStrokeWidthForSelectedShapes(width = 1) {
  log("DEBUG", "[shapes] setStrokeWidthForSelectedShapes ENTRY", {
    width,
    selectedShapes: (getState().selectedShapes || []).map(s => s?._id)
  });
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) {
    log("WARN", "[shapes] setStrokeWidthForSelectedShapes: invalid width; ignoring", { width });
    return;
  }
  currentStrokeWidth = w;
  (getState().selectedShapes || []).forEach(shape => {
    setShapeStrokeWidth(shape, w);
  });
  const canvas = getState().fabricCanvas;
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }
  log("DEBUG", "[shapes] setStrokeWidthForSelectedShapes EXIT");
}

export function fixStrokeWidthAfterTransform() {
  const w = getDefaultStrokeWidth();
  log("DEBUG", "[shapes] fixStrokeWidthAfterTransform ENTRY", {
    width: w,
    selectedShapes: (getState().selectedShapes || []).map(s => s?._id)
  });
  (getState().selectedShapes || []).forEach(shape => {
    setShapeStrokeWidth(shape, w);
  });
  const canvas = getState().fabricCanvas;
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }
  log("DEBUG", "[shapes] fixStrokeWidthAfterTransform EXIT");
}

// ---------- Internal: set stroke width on child primitives ----------
export function setShapeStrokeWidth(shape, width = 1) {
  if (!shape) return;
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return;
  log("DEBUG", "[shapes] setShapeStrokeWidth ENTRY", { id: shape?._id, type: shape?._type, width: w });

  const applyToObj = (obj) => {
    if (!obj) return;
    if ('strokeWidth' in obj) obj.set({ strokeWidth: w });
    if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
  };

  if (shape._objects && Array.isArray(shape._objects)) {
    shape._objects.forEach(obj => {
      if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line') {
        applyToObj(obj);
      }
    });
  }
  log("DEBUG", "[shapes] setShapeStrokeWidth EXIT", { id: shape?._id, type: shape?._type, width: w });
}

// ---------- Diagnostic label helpers ----------
export function makeDiagnosticLabel(label, id, x, y) {
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
  text.excludeFromExport = true;
  text.hasControls = false;
  text.hasBorders = false;
  return text;
}

function findLabelChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  return group._objects.find(o => o && o._isDiagnosticLabel) || null;
}

export function setGroupDiagnosticLabelVisible(group, visible) {
  if (!group) return;
  const canvas = getState().fabricCanvas;
  const child = findLabelChild(group);

  if (visible) {
    if (!child && group._diagLabel) {
      try {
        group._diagLabel.visible = true;
        group.addWithUpdate(group._diagLabel);
        group.setCoords();
        log("DEBUG", "[shapes] label added back to group", { id: group._id, type: group._type });
      } catch (e) {
        log("ERROR", "[shapes] add label failed", e);
      }
    } else if (child) {
      child.visible = true;
    }
  } else {
    if (child) {
      try {
        group._diagLabel = child;
        group.removeWithUpdate(child);
        group.setCoords();
        log("DEBUG", "[shapes] label removed from group", { id: group._id, type: group._type });
      } catch (e) {
        log("ERROR", "[shapes] remove label failed", e);
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

export function applyDiagnosticLabelsVisibility(visible) {
  log("DEBUG", "[shapes] applyDiagnosticLabelsVisibility ENTRY", { visible });
  try {
    (getState().shapes || []).forEach(group => setGroupDiagnosticLabelVisible(group, visible));
    log("INFO", "[shapes] Diagnostic labels visibility applied", {
      visible,
      shapeCount: (getState().shapes || []).length
    });
  } catch (e) {
    log("ERROR", "[shapes] applyDiagnosticLabelsVisibility error", e);
  }
  log("DEBUG", "[shapes] applyDiagnosticLabelsVisibility EXIT");
}

// ---------- ID helper (public for point module) ----------
export function generateShapeId(type = "shape") {
  const id = `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  log("DEBUG", "[shapes] generateShapeId", { type, id });
  return id;
}

// ---------- Rectangle ----------
export function makeRectShape(x, y, w, h) {
  const strokeW = getDefaultStrokeWidth();
  currentStrokeWidth = strokeW;
  const strokeColor = getStrokeColor();
  const fillColor = getFillColor();
  const showLabels = getShowDiagnosticLabels();

  log("DEBUG", "[shapes] makeRectShape ENTRY", {
    x, y, w, h, strokeW, strokeColor, fillColor, showLabels
  });

  const rectId = generateShapeId('rect');
  const rect = new Rect({
    left: x,
    top: y,
    width: w,
    height: h,
    stroke: strokeColor,
    strokeWidth: strokeW,
    fill: fillColor
  });
  rect.selectable = false;
  rect.evented = false;
  rect.strokeUniform = true;

  const labelObj = makeDiagnosticLabel("Rect", rectId, x + w / 2, y);

  const group = new Group([rect, labelObj], {
    left: x,
    top: y,
    selectable: true,
    evented: true
  });
  group._type = 'rect';
  group._label = 'Rect';
  group.locked = false;
  group._id = rectId;
  group._diagLabel = labelObj;

  if (!showLabels) {
    setGroupDiagnosticLabelVisible(group, false);
  }

  group.on("modified", () => {
    setShapeStrokeWidth(group, getDefaultStrokeWidth());
    const canvas = getState().fabricCanvas;
    if (canvas) {
      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();
    }
  });

  setShapeState(group, 'default');
  log("DEBUG", "[shapes] makeRectShape EXIT", { id: group._id });
  return group;
}

// ---------- Circle ----------
export function makeCircleShape(x, y, r) {
  const strokeW = getDefaultStrokeWidth();
  currentStrokeWidth = strokeW;
  const strokeColor = getStrokeColor();
  const fillColor = getFillColor();
  const showLabels = getShowDiagnosticLabels();

  log("DEBUG", "[shapes] makeCircleShape ENTRY", {
    x, y, r, strokeW, strokeColor, fillColor, showLabels
  });

  const circleId = generateShapeId('circle');
  const circle = new Circle({
    left: x - r,
    top: y - r,
    radius: r,
    stroke: strokeColor,
    strokeWidth: strokeW,
    fill: fillColor
  });
  circle.selectable = false;
  circle.evented = false;
  circle.strokeUniform = true;

  const labelObj = makeDiagnosticLabel("Circle", circleId, x, y - r);

  const group = new Group([circle, labelObj], {
    left: x - r,
    top: y - r,
    selectable: true,
    evented: true
  });
  group._type = 'circle';
  group._label = 'Circle';
  group.locked = false;
  group._id = circleId;
  group._diagLabel = labelObj;

  if (!showLabels) {
    setGroupDiagnosticLabelVisible(group, false);
  }

  group.on("modified", () => {
    setShapeStrokeWidth(group, getDefaultStrokeWidth());
    const canvas = getState().fabricCanvas;
    if (canvas) {
      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();
    }
  });

  setShapeState(group, 'default');
  log("DEBUG", "[shapes] makeCircleShape EXIT", { id: group._id });
  return group;
}
