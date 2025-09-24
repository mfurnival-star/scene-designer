/**
 * shapes-core.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Core (Fabric.js, ESM ONLY)
 * Purpose:
 * - Core helpers used by shape factories (IDs, labels, stroke/fill/width).
 * - Implements non-point shapes (rect, circle, ellipse).
 * - Diagnostic label visibility management for all shapes.
 *
 * Enhancements (2025-09-24):
 * - Initial placement clamp: newly created Rect / Circle / Ellipse groups are clamped so their
 *   top-left never starts with negative coordinates (prevents partially off-canvas
 *   objects when start percentages or offsets yield < 0). Children retain correct
 *   relative positioning after clamp.
 * - Added Ellipse shape (freely resizable & rotatable – defined in shape-defs.js).
 * - Circle remains aspect-locked & non-rotatable (handled in shape-defs + transformer).
 *
 * Exports:
 * - Public:
 *    setStrokeWidthForSelectedShapes,
 *    fixStrokeWidthAfterTransform,
 *    setStrokeColorForSelectedShapes,
 *    setFillColorForSelectedShapes,
 *    makeRectShape,
 *    makeCircleShape,
 *    makeEllipseShape,
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
 * - fabric-wrapper.js (Rect, Circle, Ellipse, Group, Text)
 * - state.js (getState)
 * - log.js (log)
 * - shape-state.js (setShapeState)
 * -----------------------------------------------------------
 */

import { Rect, Circle, Ellipse, Group, Text } from './fabric-wrapper.js';
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
  // Stored format: #RRGGBB or #RRGGBBAA; we keep as-is for stroke
  return getState().settings?.defaultStrokeColor ?? '#2176ff';
}
export function getFillColor() {
  // Stored format: #RRGGBB or #RRGGBBAA; factories convert to rgba() when needed
  return getState().settings?.defaultFillColor ?? '#00000000';
}
export function getShowDiagnosticLabels() {
  return !!getState().settings?.showDiagnosticLabels;
}

// ---------- Color helpers ----------
function clamp01(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
function hexToRGBA(hex) {
  if (typeof hex !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  let h = hex.trim().toLowerCase();
  if (!h.startsWith('#')) return { r: 0, g: 0, b: 0, a: 1 };
  h = h.slice(1);
  if (h.length === 3) {
    // #rgb → #rrggbb
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16) / 255;
    return { r, g, b, a: clamp01(a) };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
function rgbaStringFromHex(hex, alphaOverridePct = null) {
  const { r, g, b, a } = hexToRGBA(hex);
  const aOut = alphaOverridePct === null || alphaOverridePct === undefined
    ? a
    : clamp01(Number(alphaOverridePct) / 100);
  return `rgba(${r},${g},${b},${aOut})`;
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
      if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line' || obj.type === 'ellipse') {
        // Skip diagnostic labels
        if (obj._isDiagnosticLabel) return;
        applyToObj(obj);
      }
    });
  }
  log("DEBUG", "[shapes] setShapeStrokeWidth EXIT", { id: shape?._id, type: shape?._type, width: w });
}

// ---------- New: stroke/fill color application ----------
/**
 * Apply stroke color to all unlocked selected shapes.
 * - Rect/Circle/Ellipse: stroke on main primitive; strokeUniform true.
 * - Point handled separately in shapes-point.js.
 */
export function setStrokeColorForSelectedShapes(hexColor) {
  const color = typeof hexColor === "string" ? hexColor : "#000000";
  const selected = (getState().selectedShapes || []).filter(s => s && !s.locked);
  log("DEBUG", "[shapes] setStrokeColorForSelectedShapes ENTRY", {
    color, selectedIds: selected.map(s => s._id)
  });

  selected.forEach(shape => {
    if (!Array.isArray(shape._objects)) return;
    shape._objects.forEach(obj => {
      if (!obj || obj._isDiagnosticLabel) return;
      if (obj.type === 'line' || obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse') {
        if ('stroke' in obj) obj.set({ stroke: color });
        if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
      }
    });
  });

  const canvas = getState().fabricCanvas;
  if (canvas) (typeof canvas.requestRenderAll === "function" ? canvas.requestRenderAll() : canvas.renderAll());
  log("INFO", "[shapes] Stroke color applied to selection", {
    color, count: selected.length
  });
}

/**
 * Apply fill color (with alpha) to all unlocked selected shapes.
 * - Rect/Circle/Ellipse: set fill to rgba(...) computed from hex + alpha slider value.
 * - Point: handled by shapes-point.js (only halo elements).
 */
export function setFillColorForSelectedShapes(hexColor, alphaPercent = null) {
  const rgba = rgbaStringFromHex(hexColor || "#000000", alphaPercent);
  const selected = (getState().selectedShapes || []).filter(s => s && !s.locked);
  log("DEBUG", "[shapes] setFillColorForSelectedShapes ENTRY", {
    hexColor, alphaPercent, rgba, selectedIds: selected.map(s => s._id)
  });

  selected.forEach(shape => {
    if (!Array.isArray(shape._objects)) return;
    const isPoint = shape._type === 'point';

    shape._objects.forEach(obj => {
      if (!obj || obj._isDiagnosticLabel) return;

      if (!isPoint) {
        // Rect/Circle/Ellipse shapes: set fill on main primitive(s)
        if ((obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse') && 'fill' in obj) {
          obj.set({ fill: rgba });
        }
      } else {
        // (Point handled elsewhere; skip here.)
      }
    });
  });

  const canvas = getState().fabricCanvas;
  if (canvas) (typeof canvas.requestRenderAll === "function" ? canvas.requestRenderAll() : canvas.renderAll());
  log("INFO", "[shapes] Fill color applied to selection", {
    rgba, count: selected.length
  });
}

// ---------- Diagnostic label helpers ----------
export function makeDiagnosticLabel(label, id, x, y) {
  const text = new Text(`${label}\n${id}`, {
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

// Shared modification handler for shapes to re-apply stroke width
function installModifiedHandler(group) {
  group.on("modified", () => {
    setShapeStrokeWidth(group, getDefaultStrokeWidth());
    const canvas = getState().fabricCanvas;
    if (canvas) {
      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();
    }
  });
}

// Clamp top-left if negative
function clampInitialPlacement(group, label) {
  const originalLeft = group.left;
  const originalTop = group.top;
  const clampedLeft = Math.max(0, originalLeft);
  const clampedTop = Math.max(0, originalTop);
  if (clampedLeft !== originalLeft || clampedTop !== originalTop) {
    group.set({ left: clampedLeft, top: clampedTop });
    if (typeof group.setCoords === 'function') {
      try { group.setCoords(); } catch {}
    }
    log("INFO", `[shapes] ${label}: initial placement clamped`, {
      id: group._id,
      from: { left: originalLeft, top: originalTop },
      to: { left: clampedLeft, top: clampedTop }
    });
  }
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
    fill: rgbaStringFromHex(fillColor)
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

  clampInitialPlacement(group, 'makeRectShape');
  installModifiedHandler(group);

  setShapeState(group, 'default');
  log("DEBUG", "[shapes] makeRectShape EXIT", { id: group._id });
  return group;
}

// ---------- Circle (Aspect Locked) ----------
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
    fill: rgbaStringFromHex(fillColor)
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

  clampInitialPlacement(group, 'makeCircleShape');
  installModifiedHandler(group);

  setShapeState(group, 'default');
  log("DEBUG", "[shapes] makeCircleShape EXIT", { id: group._id });
  return group;
}

// ---------- Ellipse (Free Aspect, Rotatable) ----------
/**
 * Create an Ellipse shape.
 * @param {number} x - center X
 * @param {number} y - center Y
 * @param {number} w - width of ellipse
 * @param {number} h - height of ellipse
 *
 * NOTE:
 * - Fabric Ellipse uses rx / ry, with left/top typically at the bounding box origin.
 * - We normalize so caller passes center (x,y) like circle; we offset left/top by w/2,h/2.
 */
export function makeEllipseShape(x, y, w, h) {
  const strokeW = getDefaultStrokeWidth();
  currentStrokeWidth = strokeW;
  const strokeColor = getStrokeColor();
  const fillColor = getFillColor();
  const showLabels = getShowDiagnosticLabels();

  log("DEBUG", "[shapes] makeEllipseShape ENTRY", {
    x, y, w, h, strokeW, strokeColor, fillColor, showLabels
  });

  const rx = Math.max(1, w / 2);
  const ry = Math.max(1, h / 2);

  const ellipseId = generateShapeId('ellipse');
  const ellipse = new Ellipse({
    left: x - rx,
    top: y - ry,
    rx,
    ry,
    stroke: strokeColor,
    strokeWidth: strokeW,
    fill: rgbaStringFromHex(fillColor)
  });
  ellipse.selectable = false;
  ellipse.evented = false;
  ellipse.strokeUniform = true;

  const labelObj = makeDiagnosticLabel("Ellipse", ellipseId, x, y - ry);

  const group = new Group([ellipse, labelObj], {
    left: x - rx,
    top: y - ry,
    selectable: true,
    evented: true
  });
  group._type = 'ellipse';
  group._label = 'Ellipse';
  group.locked = false;
  group._id = ellipseId;
  group._diagLabel = labelObj;

  if (!showLabels) {
    setGroupDiagnosticLabelVisible(group, false);
  }

  clampInitialPlacement(group, 'makeEllipseShape');
  installModifiedHandler(group);

  setShapeState(group, 'default');
  log("DEBUG", "[shapes] makeEllipseShape EXIT", { id: group._id, rx, ry });
  return group;
}

