/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Konva Transformer Handler (ESM ONLY)
 * - Centralized logic for attaching, detaching, and updating Konva.Transformers for all shape types.
 * - Rectangle: 8 anchors (corners + sides), rotate enabled unless locked.
 * - Circle: 4 corner anchors only, rotate disabled (no rotate anchor), aspect ratio enforced.
 * - Point: no anchors, rotate disabled.
 * - All config and updates routed to transformer from canvas.js and selection.js.
 * - All logging via log.js.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { AppState } from './state.js';
import { log } from './log.js';

function getAnchorsForShape(shape) {
  // Return the correct anchor set for the shape type and lock state.
  if (!shape || shape.locked) return [];
  if (shape._type === 'rect') {
    return [
      'top-left','top-center','top-right',
      'middle-left','middle-right',
      'bottom-left','bottom-center','bottom-right'
    ];
  }
  if (shape._type === 'circle') {
    // Only corner anchors for circles
    return ['top-left','top-right','bottom-left','bottom-right'];
  }
  // Points: no anchors
  return [];
}

function getRotateEnabledForShape(shape) {
  // Rectangle: rotate allowed if not locked
  if (shape._type === 'rect') return !shape.locked;
  // Circle: rotate always disabled
  if (shape._type === 'circle') return false;
  // Point: rotate always disabled
  if (shape._type === 'point') return false;
  return false;
}

/**
 * Attach a Konva.Transformer to a shape (single selection only).
 * Only one transformer is supported at a time (AppState.transformer).
 * Called from canvas.js and selection.js.
 * @param {Konva.Shape|Konva.Group} shape
 */
export function attachTransformerForShape(shape) {
  log("TRACE", "[transformer] attachTransformerForShape entry", { shape });
  if (!shape || shape.locked) {
    log("DEBUG", "[transformer] Not attaching transformer (null or locked)", { shape });
    return;
  }

  // Remove previous transformer if present
  if (AppState.transformer) {
    AppState.transformer.destroy();
    AppState.transformer = null;
  }

  // Configure anchors and rotate for shape
  const anchors = getAnchorsForShape(shape);
  const rotateEnabled = getRotateEnabledForShape(shape);

  // If shape is a circle, enforce aspect ratio
  let keepRatio = shape._type === 'circle';

  const transformer = new Konva.Transformer({
    nodes: [shape],
    enabledAnchors: anchors,
    rotateEnabled: rotateEnabled,
    keepRatio: keepRatio
  });

  // Attach transformer to layer
  if (AppState.konvaLayer) {
    AppState.konvaLayer.add(transformer);
    AppState.konvaLayer.draw();
  }
  AppState.transformer = transformer;

  // Logging: anchors and rotate enabled
  log("DEBUG", "[transformer] Transformer attached", {
    shapeType: shape._type,
    anchors,
    rotateEnabled,
    keepRatio
  });

  // Remove circle rotate logic: No rotate anchor for circle, no rotateEnabled
  // No additional anchors for circle, no aspect ratio change except via keepRatio

  return transformer;
}

/**
 * Detach and destroy current transformer.
 */
export function detachTransformer() {
  log("TRACE", "[transformer] detachTransformer entry");
  if (AppState.transformer) {
    AppState.transformer.destroy();
    AppState.transformer = null;
    if (AppState.konvaLayer) AppState.konvaLayer.draw();
    log("INFO", "[transformer] Transformer detached");
  }
  log("TRACE", "[transformer] detachTransformer exit");
}

/**
 * Update transformer when selection or lock state changes.
 * Called from selection.js and canvas.js.
 */
export function updateTransformer() {
  log("TRACE", "[transformer] updateTransformer entry");
  if (!AppState.konvaLayer) {
    log("DEBUG", "[transformer] No konvaLayer, cannot update transformer");
    return;
  }
  // Only attach transformer for single selection, not locked, not point
  const sel = AppState.selectedShapes;
  if (!Array.isArray(sel) || sel.length !== 1 || !sel[0] || sel[0].locked) {
    detachTransformer();
    log("DEBUG", "[transformer] Transformer detached (no valid single selection)");
    log("TRACE", "[transformer] updateTransformer exit (detached)");
    return;
  }
  const shape = sel[0];
  attachTransformerForShape(shape);
  log("TRACE", "[transformer] updateTransformer exit (attached)");
}
