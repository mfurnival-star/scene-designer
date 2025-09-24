/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Transformer Handler (ESM ONLY, Reentrancy-Safe)
 * - Pure transformer logic: attach, detach, update for all shape types.
 * - Only called by selection-core.js (never by canvas.js or sidebar.js).
 * - All config from shape-defs.js.
 * - Resize/rotate controls per shape type and locked state.
 * - Enforces per-shape enabledAnchors (circle now only 4 corners) and rotation flag.
 * - Maintains aspect lock for circle via lockUniScaling.
 * - Logging via log.js.
 * - Reentrancy-safe: avoids redundant discard/setActive cycles and log spam.
 *
 * 2025-09-24 Update:
 * - Added applyControlsForDef(): honors SHAPE_DEFS.enabledAnchors and rotateEnabled.
 * - Circle now shows only 4 corner anchors (tl,tr,bl,br) and no rotation handle.
 * - Ellipse / Rect retain all 8 anchors + rotation (if rotateEnabled).
 * - Point shapes still get no controls (handled by selection logic & defs).
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
 * - If shape.resizable === false (or def.resizable false) all scaling handles hidden.
 */
function applyControlsForDef(shape, def) {
  if (!shape || !def) return;

  // Fabric control keys we manage
  const visibility = {
    tl: false, tr: false, bl: false, br: false,
    ml: false, mt: false, mr: false, mb: false,
    mtr: false // rotate
  };

  if (def.resizable && !shape.locked) {
    (def.enabledAnchors || []).forEach(anchor => {
      const key = ANCHOR_TO_FABRIC_KEY[anchor];
      if (key && key in visibility) {
        visibility[key] = true;
      }
    });
  }

  // Rotation handle
  if (def.rotateEnabled && !shape.locked) {
    visibility.mtr = true;
  }

  try {
    if (typeof shape.setControlsVisibility === 'function') {
      shape.setControlsVisibility(visibility);
    } else if (shape.controls) {
      // Fallback (shouldn't be needed in current Fabric versions)
      Object.keys(visibility).forEach(k => {
        if (shape.controls[k]) {
          shape.controls[k].visible = visibility[k];
        }
      });
    }
  } catch (e) {
    log("WARN", "[transformer] applyControlsForDef: setControlsVisibility failed", e);
  }

  // Ensure coords updated after visibility changes
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
 * Attach Fabric.js controls to a shape (single selection only).
 * - Idempotent: if already active, just update control flags.
 * - Minimal churn: only discards previous active if it differs.
 * @param {Object} shape
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

  // Get per-shape config from shape-defs.js
  const def = getShapeDef(shape);
  if (!def) {
    log("WARN", "[transformer] No shape definition found", { type: shape._type });
    detachTransformer();
    return null;
  }

  const active = getActiveObject();

  // If a different object is active, discard it first; otherwise skip
  if (active && active !== shape) {
    canvas.discardActiveObject();
  }

  // If not already active, set this shape as the active object
  if (active !== shape) {
    canvas.setActiveObject(shape);
  }

  // Update base transform/lock properties
  shape.set({
    hasControls: def.resizable && !shape.locked,
    hasBorders: true,
    lockScalingX: shape.locked,
    lockScalingY: shape.locked,
    lockRotation: !def.rotateEnabled || shape.locked,
    lockUniScaling: shape._type === "circle" && !!def.keepRatio,
    selectable: true
  });

  // Apply per-anchor control visibility & rotation handle
  applyControlsForDef(shape, def);

  // Render with minimal cost
  if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  else canvas.renderAll();

  log("DEBUG", "[transformer] Controls attached/updated", {
    type: shape._type,
    resizable: def.resizable,
    rotateEnabled: def.rotateEnabled,
    keepRatio: def.keepRatio
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

