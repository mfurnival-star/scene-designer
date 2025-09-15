/**
 * transformer.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Transformer/Resize Logic (ESM only)
 * - Centralizes attach/detach/configure of Konva.Transformers for all shape types.
 * - Rectangle: 8 anchors (corners + sides), resize freely and rotatable.
 * - Circle: 4 anchors (corners only), aspect ratio enforced (circle stays circle) and rotatable.
 * - Point: no anchors/transform (not resizeable/rotatable).
 * - Transformer logic is invoked by canvas.js and consumes AppState, selection.
 * - All logging via log.js.
 * - No color logic; color handled by shapes.js/toolbar.js/sidebar.js.
 * - No global/window code.
 * -----------------------------------------------------------
 * Exports:
 *   - attachTransformerForShape(shape)
 *   - detachTransformer()
 *   - updateTransformer()
 * Dependencies:
 *   - Konva (ESM)
 *   - AppState from state.js
 *   - log.js
 */

import Konva from "konva";
import { AppState } from "./state.js";
import { log } from "./log.js";

/**
 * Attach a Konva.Transformer for the given shape, customizing anchors and aspect ratio logic.
 * - Rectangle: 8 anchors, free resize and rotate.
 * - Circle: 4 anchors (corners), aspect ratio locked, rotate enabled.
 * - Point: no anchors (not resizeable/rotatable).
 * - Returns the created Transformer.
 */
export function attachTransformerForShape(shape) {
  log("TRACE", "[transformer] attachTransformerForShape entry", { shapeType: shape?._type, shape });

  if (!AppState.konvaLayer || !shape) {
    log("ERROR", "[transformer] attachTransformerForShape: missing konvaLayer or shape");
    return null;
  }

  // Check that the shape is actually attached to the layer
  const found = AppState.konvaLayer.findOne(node => node === shape);
  if (!found) {
    log("ERROR", "[transformer] Shape is not a child of konvaLayer", { shape });
    return null;
  }

  // Remove any existing transformer
  detachTransformer();

  // Determine anchors and config per shape type
  let anchors = [];
  let rotateEnabled = false;
  let keepAspectRatio = false;

  if (shape._type === "rect") {
    anchors = [
      "top-left", "top-center", "top-right",
      "middle-left", "middle-right",
      "bottom-left", "bottom-center", "bottom-right"
    ];
    rotateEnabled = true;
    keepAspectRatio = false;
  } else if (shape._type === "circle") {
    anchors = ["top-left", "top-right", "bottom-left", "bottom-right"];
    rotateEnabled = true;
    keepAspectRatio = true; // Always keep aspect ratio for circle
  } else if (shape._type === "point") {
    anchors = [];
    rotateEnabled = false;
    keepAspectRatio = false;
  }

  const tr = new Konva.Transformer({
    nodes: [shape],
    enabledAnchors: anchors,
    rotateEnabled,
    keepRatio: keepAspectRatio
  });

  // Aspect ratio lock for circles
  if (shape._type === "circle") {
    tr.on("transform", () => {
      // Always keep scaleX == scaleY for circle, so shape remains a circle
      const sx = shape.scaleX();
      const sy = shape.scaleY();
      if (sx !== sy) {
        const avgScale = (sx + sy) / 2;
        shape.scale({ x: avgScale, y: avgScale });
      }
    });
    tr.on("transformend", () => {
      // Apply scale as radius, reset scale
      const scale = shape.scaleX();
      shape.radius(shape.radius() * scale);
      shape.scale({ x: 1, y: 1 });
      log("INFO", "[transformer] Circle transformed (aspect ratio locked)", {
        newRadius: shape.radius()
      });
    });
  } else if (shape._type === "rect") {
    tr.on("transformend", () => {
      // Apply scale as width/height, reset scale
      const scaleX = shape.scaleX();
      const scaleY = shape.scaleY();
      shape.width(shape.width() * scaleX);
      shape.height(shape.height() * scaleY);
      shape.scale({ x: 1, y: 1 });
      log("INFO", "[transformer] Rectangle transformed", {
        newWidth: shape.width(),
        newHeight: shape.height()
      });
    });
  }

  // No transform for points

  AppState.konvaLayer.add(tr);
  AppState.transformer = tr;
  AppState.konvaLayer.draw();

  log("DEBUG", "[transformer] Transformer attached", {
    shapeType: shape._type,
    anchors,
    rotateEnabled,
    keepAspectRatio
  });
  log("TRACE", "[transformer] attachTransformerForShape exit", tr);

  return tr;
}

/**
 * Detach and destroy any existing Konva.Transformer.
 */
export function detachTransformer() {
  log("TRACE", "[transformer] detachTransformer entry");
  const tr = AppState.transformer;
  if (tr && typeof tr.destroy === "function") {
    tr.destroy();
    AppState.transformer = null;
    if (AppState.konvaLayer) AppState.konvaLayer.draw();
    log("INFO", "[transformer] Transformer detached");
  } else {
    log("DEBUG", "[transformer] No transformer to detach");
  }
  log("TRACE", "[transformer] detachTransformer exit");
}

/**
 * Update the transformer for the currently selected shape.
 * - If no shape or locked, detach transformer.
 * - Otherwise, attach transformer for shape.
 */
export function updateTransformer() {
  log("TRACE", "[transformer] updateTransformer entry");
  const sel = AppState.selectedShapes;
  if (!AppState.konvaLayer || !sel || sel.length !== 1 || sel[0].locked) {
    detachTransformer();
    log("DEBUG", "[transformer] Transformer detached (no valid single selection)");
    log("TRACE", "[transformer] updateTransformer exit");
    return;
  }
  attachTransformerForShape(sel[0]);
  log("TRACE", "[transformer] updateTransformer exit");
}
