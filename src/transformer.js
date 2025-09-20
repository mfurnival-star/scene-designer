/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Transformer Handler (ESM ONLY, Reentrancy-Safe)
 * - Pure transformer logic: attach, detach, update for all shape types.
 * - Only called by selection.js (never by canvas.js or sidebar.js).
 * - All config from shape-defs.js.
 * - Resize/rotate controls per shape type and locked state.
 * - Logging via log.js.
 * - Reentrancy-safe: avoids redundant discard/setActive cycles and log spam.
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';
import { getShapeDef } from './shape-defs.js';

/**
 * Internal: safe accessor for current Fabric active object.
 */
function getActiveObject() {
  const canvas = getState().fabricCanvas;
  if (!canvas || typeof canvas.getActiveObject !== "function") return null;
  return canvas.getActiveObject();
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

  // Update control flags every time (in case lock/def changed)
  shape.set({
    hasControls: def.resizable && !shape.locked,
    hasBorders: true,
    lockScalingX: shape.locked,
    lockScalingY: shape.locked,
    lockRotation: !def.rotateEnabled || shape.locked,
    lockUniScaling: shape._type === "circle" && !!def.keepRatio,
    selectable: true
  });

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

  // Reduce log verbosity here to avoid spam during programmatic clears
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
