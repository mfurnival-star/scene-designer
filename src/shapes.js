/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (Fabric.js Migration, Zustand Refactor, ESM ONLY)
 * - Centralizes Fabric.js shape construction, per-shape config, and helpers.
 * - Exports:
 *    setStrokeWidthForSelectedShapes,
 *    fixStrokeWidthAfterTransform,
 *    makePointShape,
 *    makeRectShape,
 *    makeCircleShape,
 *    applyDiagnosticLabelsVisibility
 * - Every group gets a unique _id at creation for sidebar/selection robustness.
 * - Only the Group is selectable/evented; children are not.
 * - Diagnostic label is added/removed from the group so it never inflates bounds when hidden.
 * - Stroke width remains constant on scale via strokeUniform=true and reapplying width.
 * - Point reticle styles and size are configurable via settings:
 *    reticleStyle: "crosshair" | "crosshairHalo" | "bullseye" | "dot" | "target"
 *    reticleSize: number (px)
 *   NOTE: This module now tolerates UI labels (e.g., "Target (ring + cross)") by normalizing to canonical tokens.
 * - Default stroke width is configurable via settings.defaultStrokeWidth.
 * -----------------------------------------------------------
 */

import { Rect, Circle, Line, Group } from './fabric-wrapper.js';
import { log } from './log.js';
import { setShapeState } from './shape-state.js';
import { getState } from './state.js';

// Track the last applied stroke width for convenience; source of truth is settings.defaultStrokeWidth
let currentStrokeWidth = 1;

// --- Normalizers for tolerant settings handling (labels → tokens, strings → numbers) ---

/**
 * Normalize a raw reticle style (token or label) to a canonical token.
 * Accepts alternate UI keys and common label strings.
 */
function normalizeReticleStyle(raw) {
  if (raw === undefined || raw === null) return 'crosshairHalo';
  const token = String(raw).trim();
  if (!token) return 'crosshairHalo';

  // Already canonical?
  const canonical = ['crosshair', 'crosshairHalo', 'bullseye', 'dot', 'target'];
  if (canonical.includes(token)) return token;

  // Case-insensitive map of labels/variants → canonical token
  const key = token.toLowerCase();
  const map = {
    'crosshair': 'crosshair',
    'crosshair + halo': 'crosshairHalo',
    'crosshair halo': 'crosshairHalo',
    'halo': 'crosshairHalo',
    'crosshairhalo': 'crosshairHalo',
    'bullseye': 'bullseye',
    "bull's-eye": 'bullseye',
    'bulls eye': 'bullseye',
    'dot': 'dot',
    'target': 'target',
    'target (ring + cross)': 'target',
    'ring + cross': 'target'
  };
  if (map[key]) return map[key];

  // Try to coerce mixed-case canonical (e.g., "CrosshairHalo")
  const lowerFirst = token.charAt(0).toLowerCase() + token.slice(1);
  if (canonical.includes(lowerFirst)) return lowerFirst;

  log("DEBUG", "[shapes] normalizeReticleStyle: unknown style, falling back to crosshairHalo", { raw });
  return 'crosshairHalo';
}

/**
 * Normalize reticle size: accepts numbers, numeric strings, and "Npx".
 * Enforces a sensible minimum to keep visuals usable.
 */
function normalizeReticleSize(raw, fallback = 14) {
  if (raw === undefined || raw === null) return fallback;
  let n = raw;
  if (typeof raw === 'string') {
    // Strip "px" and whitespace, parse int
    const m = raw.trim().match(/^(\d+)(?:\s*px)?$/i);
    if (m) n = parseInt(m[1], 10);
  }
  n = Number(n);
  if (!Number.isFinite(n)) {
    log("DEBUG", "[shapes] normalizeReticleSize: non-numeric size, using fallback", { raw, fallback });
    return fallback;
  }
  if (n < 2) n = 2;
  return n;
}

// Helpers to read settings safely
function getDefaultStrokeWidth() {
  const s = getState().settings;
  const val = s && typeof s.defaultStrokeWidth === "number" ? s.defaultStrokeWidth : 1;
  return val > 0 ? val : 1;
}
function getStrokeColor() {
  return getState().settings?.defaultStrokeColor ?? '#2176ff';
}
function getFillColor() {
  return getState().settings?.defaultFillColor ?? '#00000000';
}
function getShowDiagnosticLabels() {
  return !!getState().settings?.showDiagnosticLabels;
}
/**
 * Read reticle style from settings, tolerate alternate keys and labels.
 * - Canonical key: reticleStyle
 * - Accepted alternates: pointReticleStyle
 * - Accepts labels like "Target (ring + cross)" and normalizes to tokens.
 */
function getReticleStyle() {
  const s = getState().settings || {};
  const raw = (s.reticleStyle ?? s.pointReticleStyle ?? 'crosshairHalo');
  const norm = normalizeReticleStyle(raw);
  if (norm !== raw) {
    log("DEBUG", "[shapes] getReticleStyle normalized label/value", { raw, norm });
  }
  return norm;
}
/**
 * Read reticle size from settings, tolerate alternate keys and "Npx" strings.
 * - Canonical key: reticleSize
 * - Accepted alternates: pointReticleSize
 */
function getReticleSize() {
  const s = getState().settings || {};
  const raw = (s.reticleSize ?? s.pointReticleSize ?? 14);
  const size = normalizeReticleSize(raw, 14);
  if (String(raw).trim() !== String(size)) {
    // Only log when coercion changed representation (e.g., "20px" → 20)
    log("DEBUG", "[shapes] getReticleSize normalized value", { raw, size });
  }
  return size;
}

/**
 * Set the stroke width for all selected shapes (and their children).
 */
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

/**
 * Re-apply constant stroke width after transforms.
 * Uses settings.defaultStrokeWidth (fallback to 1).
 */
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

/**
 * Internal helper: set strokeWidth and strokeUniform=true on child primitives.
 */
function setShapeStrokeWidth(shape, width = 1) {
  if (!shape) return;
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return;
  log("DEBUG", "[shapes] setShapeStrokeWidth ENTRY", { id: shape?._id, type: shape?._type, width: w });

  const applyToObj = (obj) => {
    if (!obj) return;
    if ('strokeWidth' in obj) obj.set({ strokeWidth: w });
    if ('strokeUniform' in obj) obj.set({ strokeUniform: true });
  };

  // Apply to group children
  if (shape._objects && Array.isArray(shape._objects)) {
    shape._objects.forEach(obj => {
      // Only primitives we care about
      if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'line') {
        applyToObj(obj);
      }
    });
  }
  log("DEBUG", "[shapes] setShapeStrokeWidth EXIT", { id: shape?._id, type: shape?._type, width: w });
}

/**
 * Create diagnostic label (Fabric.Text).
 * Note: uses window.fabric.Text due to Fabric wrapper lacking Text export.
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
  text.excludeFromExport = true;
  text.hasControls = false;
  text.hasBorders = false;
  return text;
}

/**
 * Locate the diagnostic label child (if present).
 */
function findLabelChild(group) {
  if (!group || !Array.isArray(group._objects)) return null;
  return group._objects.find(o => o && o._isDiagnosticLabel) || null;
}

/**
 * Add/remove diagnostic label from the group so it doesn't affect bounds when hidden.
 */
function setGroupDiagnosticLabelVisible(group, visible) {
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

/**
 * Public: toggle diagnostic label visibility across all shapes.
 */
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

/**
 * Build point reticle primitives by style.
 */
function buildReticlePrimitives(style, x, y, sizePx, strokeColor, fillColor, strokeW) {
  const objs = [];
  const SW = strokeW;
  const addLine = (x1, y1, x2, y2) => {
    const ln = new Line([x1, y1, x2, y2], { stroke: strokeColor, strokeWidth: SW });
    ln.selectable = false; ln.evented = false; ln.strokeUniform = true;
    objs.push(ln);
    return ln;
  };
  const addCircle = (cx, cy, r, opts = {}) => {
    const c = new Circle({
      left: cx - r,
      top: cy - r,
      radius: r,
      stroke: opts.stroke ?? strokeColor,
      strokeWidth: opts.strokeWidth ?? SW,
      fill: opts.fill ?? 'transparent',
      opacity: opts.opacity ?? 1
    });
    c.selectable = false; c.evented = false; c.strokeUniform = true;
    objs.push(c);
    return c;
  };

  // Crosshair spans sizePx (full length)
  const half = sizePx / 2;
  switch (style) {
    case 'crosshair': {
      addLine(x - half, y, x + half, y);
      addLine(x, y - half, x, y + half);
      break;
    }
    case 'crosshairHalo': {
      addLine(x - half, y, x + half, y);
      addLine(x, y - half, x, y + half);
      addCircle(x, y, sizePx, { opacity: 0.35, fill: fillColor });
      break;
    }
    case 'bullseye': {
      addCircle(x, y, sizePx, { opacity: 1, fill: 'transparent' });
      addCircle(x, y, Math.max(2, sizePx * 0.55), { opacity: 1, fill: 'transparent' });
      // Center dot for visual anchor
      addCircle(x, y, Math.max(1, sizePx * 0.18), { strokeWidth: SW, fill: strokeColor, stroke: strokeColor, opacity: 1 });
      break;
    }
    case 'dot': {
      addCircle(x, y, Math.max(2, sizePx * 0.35), { strokeWidth: SW, fill: strokeColor, stroke: strokeColor, opacity: 1 });
      break;
    }
    case 'target': {
      addCircle(x, y, sizePx, { opacity: 1, fill: 'transparent' });
      addLine(x - half, y, x + half, y);
      addLine(x, y - half, x, y + half);
      break;
    }
    default: {
      // Fallback to crosshairHalo
      addLine(x - half, y, x + half, y);
      addLine(x, y - half, x, y + half);
      addCircle(x, y, sizePx, { opacity: 0.35, fill: fillColor });
    }
  }
  return objs;
}

/**
 * Create a Point shape (reticle).
 */
export function makePointShape(x, y) {
  const strokeW = getDefaultStrokeWidth();
  currentStrokeWidth = strokeW;
  const strokeColor = getStrokeColor();
  const fillColor = getFillColor();
  const showLabels = getShowDiagnosticLabels();
  const style = getReticleStyle();
  const sizePx = getReticleSize();

  log("DEBUG", "[shapes] makePointShape ENTRY", {
    x, y, strokeW, strokeColor, fillColor, showLabels, style, sizePx
  });

  // Invisible hit target (for easier selection)
  const hitRadius = Math.max(16, sizePx + 6);
  const hitCircle = new Circle({
    left: x - hitRadius,
    top: y - hitRadius,
    radius: hitRadius,
    fill: "#fff",
    opacity: 0
  });
  hitCircle.selectable = false;
  hitCircle.evented = false;

  // Build reticle primitives per style
  const reticle = buildReticlePrimitives(style, x, y, sizePx, strokeColor, fillColor, strokeW);

  const pointId = generateShapeId('point');
  const labelObj = makeDiagnosticLabel("Point", pointId, x, y);

  const objs = [hitCircle, ...reticle, labelObj];
  const group = new Group(objs, {
    left: x,
    top: y,
    selectable: true,
    evented: true
  });
  group._type = 'point';
  group._label = 'Point';
  group.locked = false;
  group._id = pointId;
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
  log("DEBUG", "[shapes] makePointShape EXIT", { id: group._id, style, sizePx });
  return group;
}

/**
 * Create a Rectangle shape.
 */
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

/**
 * Create a Circle shape.
 */
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

/**
 * Unique id helper.
 */
function generateShapeId(type = "shape") {
  const id = `${type}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  log("DEBUG", "[shapes] generateShapeId", { type, id });
  return id;
}

