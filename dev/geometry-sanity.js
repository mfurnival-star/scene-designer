/**
 * dev/geometry-sanity.js
 * -----------------------------------------------------------
 * Scene Designer – Geometry Sanity Check (DEV-ONLY, ESM)
 *
 * Purpose:
 * - Compare unified single-shape geometry helper (geometry/shape-rect.js)
 *   against Fabric's getBoundingRect(true,true) for each shape currently
 *   in the store to validate Phase 1 geometry consolidation.
 * - Reports mismatches (size deltas beyond tolerance) and aggregates stats.
 * - Optionally inspects the current Fabric ActiveSelection hull.
 *
 * NOT AUTO-LOADED:
 * - Import this module manually in a dev build or run via dynamic import in console:
 *      import('./dev/geometry-sanity.js').then(m => m.runGeometrySanityCheck());
 *
 * Exports:
 * - runGeometrySanityCheck(options?)
 *
 * Dev Console Convenience:
 * - Attaches window.__geomCheck.run() if window is available.
 *
 * Options:
 * {
 *   tolerance: number   // allowed absolute delta (px) for width/height (default 0.5)
 *   includeActiveSelection: boolean // whether to log ActiveSelection hull diff (default true)
 *   logPerShape: boolean // whether to log per-shape comparison rows (default true)
 * }
 *
 * Output:
 * - Logs a summary object (counts, mismatches, max deltas)
 * - Returns the same summary object (for inspection / automation)
 *
 * Dependencies:
 * - log.js (log)
 * - state.js (getState)
 * - geometry/shape-rect.js (getShapeBoundingBox)
 *
 * Notes:
 * - Differences may occur for rotated objects (Fabric's getBoundingRect accounts for angle;
 *   our unified helper currently returns axis-aligned group box without rotation expansion).
 *   Those are flagged with reason: "angle!=0".
 * - For now we treat rotated shapes as informational (not failing) unless the
 *   delta exceeds tolerance *and* angle==0.
 * -----------------------------------------------------------
 */

import { log } from '../src/log.js';
import { getState } from '../src/state.js';
import { getShapeBoundingBox } from '../src/geometry/shape-rect.js';

/**
 * Internal: Safely invoke Fabric getBoundingRect(true,true) on a shape/group.
 */
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

/**
 * Internal: Compute absolute difference metrics.
 */
function diffMetrics(unified, fabric) {
  if (!unified || !fabric) return null;
  return {
    widthDelta: Math.abs((unified.width ?? 0) - (fabric.width ?? 0)),
    heightDelta: Math.abs((unified.height ?? 0) - (fabric.height ?? 0))
  };
}

/**
 * Run the geometry sanity check.
 * @param {Object} options
 *  - tolerance (number)
 *  - includeActiveSelection (boolean)
 *  - logPerShape (boolean)
 * @returns {Object} summary
 */
export function runGeometrySanityCheck(options = {}) {
  const {
    tolerance = 0.5,
    includeActiveSelection = true,
    logPerShape = true
  } = options;

  const state = getState();
  const shapes = Array.isArray(state.shapes) ? state.shapes.filter(Boolean) : [];
  const canvas = state.fabricCanvas;

  if (!shapes.length) {
    log("INFO", "[geometry-sanity] No shapes in store – nothing to compare.");
    return { shapesCompared: 0 };
  }

  log("INFO", "[geometry-sanity] Running geometry sanity check", {
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
        // Accept rotated mismatch as informational for now
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
      const level = status === "mismatch" ? "WARN"
        : status === "info" ? "INFO"
        : status === "skip" ? "DEBUG"
        : "DEBUG";
      log(level, "[geometry-sanity] shape", row);
    }
  }

  // ActiveSelection hull (optional)
  let activeSelectionHull = null;
  if (includeActiveSelection && canvas && typeof canvas.getActiveObject === 'function') {
    const active = canvas.getActiveObject();
    if (active && active.type === 'activeSelection') {
      activeSelectionHull = fabricBBox(active);
      log("INFO", "[geometry-sanity] ActiveSelection hull (Fabric boundingRect only)", {
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

  // Return detailed breakdown (could be large; caller may ignore)
  return { summary, details: results };
}

// Dev console helper
if (typeof window !== "undefined") {
  window.__geomCheck = {
    run: runGeometrySanityCheck
  };
  log("INFO", "[geometry-sanity] window.__geomCheck.run() available");
}

