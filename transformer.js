/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Konva Transformer Handler (ESM ONLY)
 * - Centralized logic for attaching, detaching, and updating Konva.Transformers for all shape types.
 * - All per-shape transformer config comes from shape-defs.js.
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
import { getShapeDef } from './shape-defs.js';

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

  // Get per-shape config from shape-defs.js
  const def = getShapeDef(shape);
  if (!def) {
    log("ERROR", "[transformer] No shape definition found", { type: shape._type });
    return;
  }

  const anchors = def.enabledAnchors;
  const rotateEnabled = def.rotateEnabled && !shape.locked;
  const keepRatio = def.keepRatio;

  // Defensive: always pass an array for enabledAnchors
  const transformer = new Konva.Transformer({
    nodes: [shape],
    enabledAnchors: Array.isArray(anchors) ? anchors : [],
    rotateEnabled: rotateEnabled,
    keepRatio: !!keepRatio
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

  // Always make transformer events robust (destroy/recreate on selection change)
  // Normalize scale after transformend for aspect shapes
  transformer.on('transformend', () => {
    log("DEBUG", "[transformer] transformend event", { shape });
    if (shape._type === 'rect') {
      // Apply scale to width/height, then reset scale
      const scaleX = shape.scaleX();
      const scaleY = shape.scaleY();
      shape.width(shape.width() * scaleX);
      shape.height(shape.height() * scaleY);
      shape.scaleX(1);
      shape.scaleY(1);
    } else if (shape._type === 'circle') {
      // Only scale radius, keep aspect
      const scaleX = shape.scaleX();
      shape.radius(shape.radius() * scaleX);
      shape.scaleX(1);
      shape.scaleY(1);
    }
    if (AppState.konvaLayer) AppState.konvaLayer.draw();
  });

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
