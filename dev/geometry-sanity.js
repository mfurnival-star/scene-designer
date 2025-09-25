import { log } from '../src/log.js';
import { getState } from '../src/state.js';
import { getShapeBoundingBox } from '../src/geometry/shape-rect.js';

function fabricBBox(shape) {
  if (!shape || typeof shape.getBoundingRect !== 'function') return null;
  try {
    const r = shape.getBoundingRect(true, true);
    if (!r) return null;
    return {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height
    };
  } catch (e) {
    log("WARN", "[geometry-sanity] fabricBBox failed", { id: shape?._id, error: e });
    return null;
  }
}

function diffMetrics(unified, fabric) {
  if (!unified || !fabric) return null;
  return {
    widthDelta: Math.abs((unified.width ?? 0) - (fabric.width ?? 0)),
    heightDelta: Math.abs((unified.height ?? 0) - (fabric.height ?? 0))
  };
}

export function runGeometrySanityCheck(options = {}) {
  const {
    tolerance = 0.5,
    includeActiveSelection = true,
    logPerShape = false
  } = options;

  const state = getState();
  const shapes = Array.isArray(state.shapes) ? state.shapes.filter(Boolean) : [];
  const canvas = state.fabricCanvas;

  if (!shapes.length) {
    log("INFO", "[geometry-sanity] No shapes in store");
    return { shapesCompared: 0 };
  }

  log("INFO", "[geometry-sanity] Start", {
    shapeCount: shapes.length,
    tolerance,
    includeActiveSelection,
    logPerShape
  });

  const results = [];
  let mismatchCount = 0;
  let rotatedInfoCount = 0;
  let maxWidthDelta = 0;
  let maxHeightDelta = 0;

  for (const shape of shapes) {
    const unified = getShapeBoundingBox(shape);
    const fabric = fabricBBox(shape);
    const metrics = diffMetrics(unified, fabric);
    const angle = Number.isFinite(shape.angle) ? shape.angle : 0;

    let status = "ok";
    let reason = "";

    if (!unified || !fabric || !metrics) {
      status = "skip";
      reason = "missing-bbox";
    } else {
      maxWidthDelta = Math.max(maxWidthDelta, metrics.widthDelta);
      maxHeightDelta = Math.max(maxHeightDelta, metrics.heightDelta);

      const exceeds = metrics.widthDelta > tolerance || metrics.heightDelta > tolerance;

      if (angle !== 0 && exceeds) {
        status = "info";
        reason = "angle!=0";
        rotatedInfoCount++;
      } else if (exceeds) {
        status = "mismatch";
        mismatchCount++;
      }
    }

    const row = {
      id: shape._id,
      type: shape._type,
      angle,
      unified: unified ? {
        left: Math.round(unified.left * 100) / 100,
        top: Math.round(unified.top * 100) / 100,
        width: Math.round(unified.width * 100) / 100,
        height: Math.round(unified.height * 100) / 100,
        source: unified.source
      } : null,
      fabric: fabric ? {
        left: Math.round(fabric.left * 100) / 100,
        top: Math.round(fabric.top * 100) / 100,
        width: Math.round(fabric.width * 100) / 100,
        height: Math.round(fabric.height * 100) / 100
      } : null,
      deltas: metrics ? {
        width: Math.round(metrics.widthDelta * 100) / 100,
        height: Math.round(metrics.heightDelta * 100) / 100
      } : null,
      status,
      reason
    };

    results.push(row);
    if (logPerShape) {
      if (status === "mismatch") {
        log("WARN", "[geometry-sanity] shape mismatch", row);
      } else {
        log("DEBUG", "[geometry-sanity] shape", row);
      }
    }
  }

  let activeSelectionHull = null;
  if (includeActiveSelection && canvas && typeof canvas.getActiveObject === 'function') {
    const active = canvas.getActiveObject();
    if (active && active.type === 'activeSelection') {
      activeSelectionHull = fabricBBox(active);
      log("DEBUG", "[geometry-sanity] ActiveSelection hull", {
        hull: activeSelectionHull,
        memberCount: Array.isArray(active._objects) ? active._objects.length : 0
      });
    }
  }

  const summary = {
    shapesCompared: shapes.length,
    mismatchCount,
    rotatedInfoCount,
    maxWidthDelta: Math.round(maxWidthDelta * 100) / 100,
    maxHeightDelta: Math.round(maxHeightDelta * 100) / 100,
    tolerance,
    includeActiveSelection,
    activeSelectionHull,
    timestamp: new Date().toISOString()
  };

  log("INFO", "[geometry-sanity] Summary", summary);
  return { summary, details: results };
}

if (typeof window !== "undefined") {
  window.__geomCheck = {
    run: runGeometrySanityCheck
  };
  log("DEBUG", "[geometry-sanity] window.__geomCheck.run() available");
}
