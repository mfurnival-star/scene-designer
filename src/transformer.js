/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Transformer Handler (ESM ONLY, Reentrancy-Safe)
 * Purpose:
 * - Attach / detach / update Fabric "controls" (transform handles) for a SINGLE selected shape.
 * - Enforce per-shape edit capabilities defined in shape-defs.js (anchors, rotation enable, ratio lock).
 * - Hide all controls for multi-selection (handled visually via overlay painter).
 * - Remain idempotent and avoid unnecessary churn (discard/setActive only when needed).
 *
 * Exports:
 * - attachTransformerForShape(shape)
 * - detachTransformer()
 * - updateTransformer()
 *
 * Dependencies:
 * - state.js (getState – provides fabricCanvas, selection info)
 * - log.js (log)
 * - shape-defs.js (getShapeDef for per-shape config)
 *
 * 2025-09-24 Updates:
 * - Added applyControlsForDef(): central logic to honor SHAPE_DEFS.enabledAnchors & rotateEnabled.
 * - Circle: only 4 corner anchors (tl,tr,bl,br) + no rotation handle.
 * - Ellipse / Rect: all 8 anchors + rotation (if rotateEnabled).
 * - Point: no controls (handled by defs + selection logic).
 *
 * Phase 1 Completion Patch (2025-09-24):
 * - Added DEFENSIVE circle uniform-scaling guard:
 *     Regardless of shape-defs keepRatio, a circle selection re-applies lockUniScaling = true and
 *     normalizes scaleX/scaleY if they differ (tolerates minor float drift).
 *     This ensures future accidental unlocks / external mutations cannot distort circles.
 * - Added DEBUG log for any enforced normalization event.
 *
 * Notes:
 * - We do NOT handle multi-selection here; multi-select hull logic is in selection-core + overlays.
 * - This module purposefully does NOT read boundingRect geometry (Phase 1 single-shape geometry is centralized elsewhere).
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';
import { getShapeDef } from './shape-defs.js';

// Mapping from our logical anchor tokens → Fabric control keys
const ANCHOR_TO_FABRIC_KEY = {
  'top-left': 'tl',
  'top-center': 'mt',
  'top-right': 'tr',
  'middle-left': 'ml',
  'middle-right': 'mr',
  'bottom-left': 'bl',
  'bottom-center': 'mb',
  'bottom-right': 'br'
};

/**
 * Internal: safe accessor for current Fabric active object.
 */
function getActiveObject() {
  const canvas = getState().fabricCanvas;
  if (!canvas || typeof canvas.getActiveObject !== "function") return null;
  return canvas.getActiveObject();
}

/**
 * Apply per-shape control visibility & rotation handle based on def + lock state.
 * - Hides all controls first, then enables only those listed in def.enabledAnchors.
 * - Rotation handle (mtr) only if def.rotateEnabled AND shape not locked.
 * - If def.resizable === false OR shape.locked → all scaling handles hidden.
 */
function applyControlsForDef(shape, def) {
  if (!shape || !def) return;

  const visibility = {
    tl: false, tr: false, bl: false, br: false,
    ml: false, mt: false, mr: false, mb: false,
    mtr: false // rotation handle
  };

  if (def.resizable && !shape.locked) {
    (def.enabledAnchors || []).forEach(anchor => {
      const key = ANCHOR_TO_FABRIC_KEY[anchor];
      if (key && key in visibility) {
        visibility[key] = true;
      }
    });
  }

  if (def.rotateEnabled && !shape.locked) {
    visibility.mtr = true;
  }

  try {
    if (typeof shape.setControlsVisibility === 'function') {
      shape.setControlsVisibility(visibility);
    } else if (shape.controls) {
      // Fallback (older Fabric versions)
      Object.keys(visibility).forEach(k => {
        if (shape.controls[k]) {
          shape.controls[k].visible = visibility[k];
        }
      });
    }
  } catch (e) {
    log("WARN", "[transformer] applyControlsForDef: setControlsVisibility failed", e);
  }

  if (typeof shape.setCoords === "function") {
    try { shape.setCoords(); } catch {}
  }

  log("DEBUG", "[transformer] applyControlsForDef", {
    id: shape._id,
    type: shape._type,
    visibility
  });
}

/**
 * DEFENSIVE: Ensure circle remains uniformly scaled.
 * - lockUniScaling must stay true.
 * - If scaleX / scaleY differ beyond epsilon, normalize them (choose min to avoid visual blow‑up).
 */
function enforceCircleUniformScaling(shape) {
  if (!shape || shape._type !== 'circle') return;
  try {
    // Force lockUniScaling hard regardless of def (belt + suspenders).
    shape.lockUniScaling = true;

    const sx = typeof shape.scaleX === 'number' ? shape.scaleX : 1;
    const sy = typeof shape.scaleY === 'number' ? shape.scaleY : 1;
    const EPS = 0.001;
    if (Math.abs(sx - sy) > EPS) {
      const uniform = Math.min(sx, sy); // choose the smaller to prevent unexpected growth
      shape.scaleX = uniform;
      shape.scaleY = uniform;
      if (typeof shape.setCoords === 'function') {
        try { shape.setCoords(); } catch {}
      }
      log("DEBUG", "[transformer] enforceCircleUniformScaling: normalized non-uniform circle scale", {
        id: shape._id,
        prev: { sx, sy },
        newScale: uniform
      });
    } else {
      log("DEBUG", "[transformer] enforceCircleUniformScaling: already uniform", {
        id: shape._id, sx, sy
      });
    }
  } catch (e) {
    log("WARN", "[transformer] enforceCircleUniformScaling failed (non-fatal)", {
      id: shape?._id,
      error: e
    });
  }
}

/**
 * Attach Fabric.js controls to a shape (single selection only).
 * - Idempotent: if already active, just update control flags.
 * - Minimal churn: only discards previous active if it differs.
 * @param {Object} shape - Fabric group (our wrapped shape), not a primitive child
 */
export function attachTransformerForShape(shape) {
  log("DEBUG", "[transformer] attachTransformerForShape entry", {
    id: shape?._id,
    type: shape?._type,
    locked: shape?.locked
  });

  const canvas = getState().fabricCanvas;
  if (!canvas || !shape) {
    log("DEBUG", "[transformer] attachTransformerForShape: no canvas or shape");
    return null;
  }
  if (shape.locked) {
    log("DEBUG", "[transformer] Not attaching controls (locked shape)");
    detachTransformer();
    return null;
  }

  const def = getShapeDef(shape);
  if (!def) {
    log("WARN", "[transformer] No shape definition found", { type: shape._type });
    detachTransformer();
    return null;
  }

  const active = getActiveObject();

  // If a different object is active, discard it first
  if (active && active !== shape) {
    canvas.discardActiveObject();
  }

  // If not already active, set this shape as the active object
  if (active !== shape) {
    canvas.setActiveObject(shape);
  }

  // Core transform flags
  shape.set({
    hasControls: def.resizable && !shape.locked,
    hasBorders: true,
    lockScalingX: shape.locked,
    lockScalingY: shape.locked,
    lockRotation: !def.rotateEnabled || shape.locked,
    lockUniScaling: shape._type === "circle" ? true : !!def.keepRatio,
    selectable: true
  });

  // Additional defensive enforcement for circle uniformity
  if (shape._type === 'circle') {
    enforceCircleUniformScaling(shape);
  }

  // Apply per-anchor control visibility & rotation handle
  applyControlsForDef(shape, def);

  // Render minimal
  if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  else canvas.renderAll();

  log("DEBUG", "[transformer] Controls attached/updated", {
    id: shape._id,
    type: shape._type,
    resizable: def.resizable,
    rotateEnabled: def.rotateEnabled,
    keepRatio: def.keepRatio,
    circleUniformGuard: shape._type === 'circle'
  });

  return shape;
}

/**
 * Detach controls from current shape.
 * - Idempotent: only discards if an active object exists.
 */
export function detachTransformer() {
  const canvas = getState().fabricCanvas;
  log("DEBUG", "[transformer] detachTransformer entry");

  if (!canvas) {
    log("DEBUG", "[transformer] detachTransformer: no canvas");
    return;
  }

  const active = getActiveObject();
  if (!active) {
    log("DEBUG", "[transformer] detachTransformer: no active object to discard");
    return;
  }

  canvas.discardActiveObject();
  if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  else canvas.renderAll();

  log("DEBUG", "[transformer] Controls detached");
  log("DEBUG", "[transformer] detachTransformer exit");
}

/**
 * Update controls when selection or lock state changes.
 * - Only attaches controls for single, unlocked, editable shapes.
 * - Otherwise, detaches controls.
 */
export function updateTransformer() {
  log("DEBUG", "[transformer] updateTransformer entry");
  const canvas = getState().fabricCanvas;
  const sel = getState().selectedShapes;

  if (!canvas || !Array.isArray(sel) || sel.length !== 1 || !sel[0]) {
    detachTransformer();
    log("DEBUG", "[transformer] updateTransformer exit (no valid single selection)");
    return;
  }

  const shape = sel[0];
  if (shape.locked) {
    detachTransformer();
    log("DEBUG", "[transformer] updateTransformer exit (locked shape)");
    return;
  }

  attachTransformerForShape(shape);
  log("DEBUG", "[transformer] updateTransformer exit (attached/updated)");
}
