/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Transformer Handler (Fabric Migration, ESM ONLY)
 * - Pure transformer logic: attach, detach, update for all shape types.
 * - Only called by selection.js (never by canvas.js or sidebar.js).
 * - All config from shape-defs.js.
 * - Resize/rotate controls per shape type and locked state.
 * - Logging via log.js.
 * - No direct event handling or canvas logic.
 * -----------------------------------------------------------
 */

import { Canvas, Rect, Circle, Line, Group, Image } from 'fabric';
import { AppState } from './state.js';
import { log } from './log.js';
import { getShapeDef } from './shape-defs.js';

/**
 * Attach Fabric.js controls to a shape (single selection only).
 * Always removes previous controls and adds new ones.
 * Called only by selection.js.
 * @param {Object|Group} shape
 */
export function attachTransformerForShape(shape) {
  log("TRACE", "[transformer] attachTransformerForShape entry", { shape });
  if (!shape || shape.locked) {
    log("DEBUG", "[transformer] Not attaching controls (null or locked)", { shape });
    detachTransformer();
    return null;
  }

  // Remove previous active object if present
  if (AppState.fabricCanvas) {
    AppState.fabricCanvas.discardActiveObject();
    AppState.fabricCanvas.renderAll();
  }

  // Get per-shape config from shape-defs.js
  const def = getShapeDef(shape);
  if (!def) {
    log("ERROR", "[transformer] No shape definition found", { type: shape._type });
    detachTransformer();
    return null;
  }

  // Set the shape as active object
  if (AppState.fabricCanvas) {
    AppState.fabricCanvas.setActiveObject(shape);
    // Enable/disable controls per shape definition
    shape.set({
      hasControls: def.resizable && !shape.locked,
      hasBorders: true,
      lockScalingX: shape.locked,
      lockScalingY: shape.locked,
      lockRotation: !def.rotateEnabled || shape.locked,
      selectable: true
    });

    // For circles: enforce aspect ratio if keepRatio is true
    if (shape._type === "circle" && def.keepRatio) {
      shape.set({
        lockUniScaling: true
      });
    } else {
      shape.set({
        lockUniScaling: false
      });
    }
    AppState.fabricCanvas.renderAll();

    log("DEBUG", "[transformer] Controls attached (Fabric.js)", {
      shapeType: shape._type,
      resizable: def.resizable,
      rotateEnabled: def.rotateEnabled,
      keepRatio: def.keepRatio
    });
  }
}

/**
 * Detach controls from current shape.
 * Only called by selection.js.
 */
export function detachTransformer() {
  log("TRACE", "[transformer] detachTransformer entry");
  if (AppState.fabricCanvas) {
    AppState.fabricCanvas.discardActiveObject();
    AppState.fabricCanvas.renderAll();
    log("INFO", "[transformer] Controls detached");
  } else {
    log("DEBUG", "[transformer] No canvas to detach controls");
  }
  log("TRACE", "[transformer] detachTransformer exit");
}

/**
 * Update controls when selection or lock state changes.
 * Called only by selection.js.
 * Always removes old controls and adds new ones if needed.
 */
export function updateTransformer() {
  log("TRACE", "[transformer] updateTransformer entry");
  const canvas = AppState.fabricCanvas;
  // Only attach controls for single selection, not locked, not point
  const sel = AppState.selectedShapes;
  if (!canvas || !Array.isArray(sel) || sel.length !== 1 || !sel[0] || sel[0].locked) {
    detachTransformer();
    log("DEBUG", "[transformer] Controls detached (no valid single selection)");
    log("TRACE", "[transformer] updateTransformer exit (detached)");
    return;
  }
  const shape = sel[0];
  // Always force controls re-attach for robustness
  attachTransformerForShape(shape);
  log("TRACE", "[transformer] updateTransformer exit (attached)");
}

