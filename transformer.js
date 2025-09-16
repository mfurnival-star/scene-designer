/**
 * transformer.js
 * -----------------------------------------------------------
 * Centralized Transformer Logic for Scene Designer
 * - Manages Konva.Transformer nodes, anchors, and resizing for shapes.
 * - Rectangle: 8 anchors (corners + sides), resize freely.
 * - Circle: 4 anchors (corners only), aspect ratio enforced (circle stays circle).
 * - Point: no anchors/transform (not resizeable).
 * - Invoked by canvas.js and selection.js, consumes AppState.
 * - All logging via log.js.
 * - No global/window code; ES module only.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { AppState } from './state.js';
import { log } from './log.js';

/**
 * Attach a Konva.Transformer to the given shape.
 * Only single selection is supported for transform.
 * @param {Konva.Shape|Konva.Group} shape - The Konva shape to attach transformer to.
 */
export function attachTransformerForShape(shape) {
  log("TRACE", "[transformer] attachTransformerForShape entry", { shape });
  const layer = AppState.konvaLayer;
  if (!layer || !shape) {
    log("WARN", "[transformer] attachTransformerForShape: missing layer or shape", { layer, shape });
    log("TRACE", "[transformer] attachTransformerForShape exit (missing layer/shape)");
    return;
  }

  // Remove any existing transformer
  detachTransformer();

  // Determine allowed anchors by shape type/lock status
  let anchors = [];
  let rotateEnabled = false;
  if (!shape.locked) {
    if (shape._type === "rect") {
      anchors = ['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'];
      rotateEnabled = true;
    } else if (shape._type === "circle") {
      anchors = ['top-left','top-right','bottom-left','bottom-right'];
      rotateEnabled = true;
    }
    // Points: no anchors/transform
  }

  if (anchors.length === 0) {
    log("DEBUG", "[transformer] No anchors for shape type", shape._type);
    log("TRACE", "[transformer] attachTransformerForShape exit (no anchors)");
    return;
  }

  // Create transformer
  const transformer = new Konva.Transformer({
    nodes: [shape],
    enabledAnchors: anchors,
    rotateEnabled
  });

  // Handle transformend event (resize logic)
  transformer.on('transformend.transformer', () => {
    log("DEBUG", "[transformer] transformend event", { shape });
    // Normalize scale and update dimensions
    const scaleX = shape.scaleX();
    const scaleY = shape.scaleY();
    if (shape._type === "rect") {
      shape.width(shape.width() * scaleX);
      shape.height(shape.height() * scaleY);
    } else if (shape._type === "circle") {
      // Constrain to aspect ratio (circle stays circle)
      const avgScale = (scaleX + scaleY) / 2;
      shape.radius(shape.radius() * avgScale);
    }
    shape.scaleX(1);
    shape.scaleY(1);
    if (typeof shape.strokeWidth === "function") shape.strokeWidth(1);
    layer.batchDraw();
  });

  // Attach to layer and AppState
  layer.add(transformer);
  AppState.transformer = transformer;
  layer.batchDraw();
  log("INFO", "[transformer] Transformer attached for shape", { shape, anchors, rotateEnabled });
  log("TRACE", "[transformer] attachTransformerForShape exit");
}

/**
 * Detach and destroy any active transformer.
 */
export function detachTransformer() {
  log("TRACE", "[transformer] detachTransformer entry");
  const layer = AppState.konvaLayer;
  const transformer = AppState.transformer;
  if (transformer && typeof transformer.destroy === "function") {
    transformer.destroy();
    AppState.transformer = null;
    if (layer) layer.batchDraw();
    log("INFO", "[transformer] Transformer detached");
  }
  log("TRACE", "[transformer] detachTransformer exit");
}

/**
 * Update the transformer for the current selection.
 * Single selection: attach.
 * Multi-selection or none: detach.
 */
export function updateTransformer() {
  log("TRACE", "[transformer] updateTransformer entry");
  const sel = AppState.selectedShapes;
  if (Array.isArray(sel) && sel.length === 1 && !sel[0].locked) {
    attachTransformerForShape(sel[0]);
  } else {
    detachTransformer();
  }
  log("TRACE", "[transformer] updateTransformer exit");
}

