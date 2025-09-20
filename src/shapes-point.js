/**
 * shapes-point.js
 * -----------------------------------------------------------
 * Scene Designer – Point Shape Factory (Fabric.js, ESM ONLY)
 * Purpose:
 * - All point-reticle-specific logic (style/size normalization, primitive builders).
 * - Creates non-resizable, non-rotatable Point groups (selectable/movable only).
 * - Dot style includes a transparent crosshair cutout to reveal exact center pixel.
 *
 * Exports:
 * - makePointShape(x, y)
 *
 * Dependencies:
 * - fabric-wrapper.js (Rect, Circle, Line, Group)
 * - shapes-core.js (helpers: colors, stroke width, labels, ids)
 * - shape-state.js (setShapeState)
 * - state.js (getState)
 * - log.js (log)
 * -----------------------------------------------------------
 */

import { Rect, Circle, Line, Group } from './fabric-wrapper.js';
import {
  getDefaultStrokeWidth,
  getStrokeColor,
  getFillColor,
  getShowDiagnosticLabels,
  makeDiagnosticLabel,
  generateShapeId,
  setShapeStrokeWidth,
  setGroupDiagnosticLabelVisible
} from './shapes-core.js';
import { setShapeState } from './shape-state.js';
import { getState } from './state.js';
import { log } from './log.js';

// --- Normalizers for tolerant settings handling (labels → tokens, strings → numbers) ---
function normalizeReticleStyle(raw) {
  if (raw === undefined || raw === null) return 'crosshairHalo';
  const token = String(raw).trim();
  if (!token) return 'crosshairHalo';
  const canonical = ['crosshair', 'crosshairHalo', 'bullseye', 'dot', 'target'];
  if (canonical.includes(token)) return token;
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
  const lowerFirst = token.charAt(0).toLowerCase() + token.slice(1);
  if (canonical.includes(lowerFirst)) return lowerFirst;
  log("DEBUG", "[shapes-point] normalizeReticleStyle: unknown style, fallback to crosshairHalo", { raw });
  return 'crosshairHalo';
}
function normalizeReticleSize(raw, fallback = 14) {
  if (raw === undefined || raw === null) return fallback;
  let n = raw;
  if (typeof raw === 'string') {
    const m = raw.trim().match(/^(\d+)(?:\s*px)?$/i);
    if (m) n = parseInt(m[1], 10);
  }
  n = Number(n);
  if (!Number.isFinite(n)) {
    log("DEBUG", "[shapes-point] normalizeReticleSize: non-numeric size, using fallback", { raw, fallback });
    return fallback;
  }
  return n < 2 ? 2 : n;
}

// Read settings with tolerance for alternates/labels
function getReticleStyle() {
  const s = getState().settings || {};
  const raw = (s.reticleStyle ?? s.pointReticleStyle ?? 'crosshairHalo');
  const norm = normalizeReticleStyle(raw);
  if (norm !== raw) {
    log("DEBUG", "[shapes-point] getReticleStyle normalized", { raw, norm });
  }
  return norm;
}
function getReticleSize() {
  const s = getState().settings || {};
  const raw = (s.reticleSize ?? s.pointReticleSize ?? 14);
  const size = normalizeReticleSize(raw, 14);
  if (String(raw).trim() !== String(size)) {
    log("DEBUG", "[shapes-point] getReticleSize normalized", { raw, size });
  }
  return size;
}

/**
 * Build point reticle primitives by style.
 * - For 'dot', we render a filled circle then punch a transparent crosshair hole
 *   using thin rectangles with globalCompositeOperation='destination-out'.
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
  // Transparent "hole" rect (reveals background through previous draws)
  const addHoleRect = (left, top, width, height) => {
    const r = new Rect({
      left, top, width, height,
      fill: '#000',
      strokeWidth: 0,
      selectable: false,
      evented: false
    });
    // Fabric honors per-object composite op
    r.globalCompositeOperation = 'destination-out';
    objs.push(r);
    return r;
  };

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
      addCircle(x, y, Math.max(1, sizePx * 0.18), { strokeWidth: SW, fill: strokeColor, stroke: strokeColor, opacity: 1 });
      break;
    }
    case 'dot': {
      const r = Math.max(2, sizePx * 0.35);
      // Base filled dot
      addCircle(x, y, r, { strokeWidth: SW, fill: strokeColor, stroke: strokeColor, opacity: 1 });
      // Transparent crosshair cutout — keep within dot radius
      const holeThickness = Math.max(1, Math.round(SW)); // hairline
      const holeLen = Math.max(4, Math.round(r * 1.6));
      // Horizontal hole
      addHoleRect(x - holeLen / 2, y - holeThickness / 2, holeLen, holeThickness);
      // Vertical hole
      addHoleRect(x - holeThickness / 2, y - holeLen / 2, holeThickness, holeLen);
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
 * - Selectable/movable
 * - Not resizable/rotatable (no anchors; scaling/rotation locked)
 */
export function makePointShape(x, y) {
  const strokeW = getDefaultStrokeWidth();
  const strokeColor = getStrokeColor();
  const fillColor = getFillColor();
  const showLabels = getShowDiagnosticLabels();
  const style = getReticleStyle();
  const sizePx = getReticleSize();

  log("DEBUG", "[shapes-point] makePointShape ENTRY", {
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

  // Disable anchors/resize/rotate for points (still selectable/movable)
  group.set({
    hasControls: false,
    hasBorders: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hoverCursor: 'move'
  });
  log("DEBUG", "[shapes-point] makePointShape: disabled controls and scaling for point", {
    id: group._id, hasControls: group.hasControls
  });

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
  log("DEBUG", "[shapes-point] makePointShape EXIT", { id: group._id, style, sizePx });
  return group;
}

