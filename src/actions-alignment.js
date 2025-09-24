import { getState } from './state.js';
import { log } from './log.js';
import {
  getAbsoluteRectsForSelection
} from './geometry/selection-rects.js';

/**
 * Clamp a new bbox (left/top computed by delta) within background image bounds.
 * Returns adjusted delta values { dx, dy }.
 */
function clampDeltaToImage(bbox, dx, dy, img) {
  if (!img || !bbox) return { dx, dy };
  try {
    const imgW = img.width;
    const imgH = img.height;

    const newLeft = bbox.left + dx;
    const newTop = bbox.top + dy;

    const minLeft = 0;
    const minTop = 0;
    const maxLeft = Math.max(0, imgW - bbox.width);
    const maxTop = Math.max(0, imgH - bbox.height);

    const clampedLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);
    const clampedTop = Math.min(Math.max(newTop, minTop), maxTop);

    return {
      dx: clampedLeft - bbox.left,
      dy: clampedTop - bbox.top
    };
  } catch (e) {
    log("WARN", "[align] clampDeltaToImage failed; applying unclamped delta", e);
    return { dx, dy };
  }
}

/**
 * Find the reference value for alignment among selected shapes' absolute bboxes.
 * - left: min left
 * - centerX: horizontal center of the leftmost shape
 * - right: max right
 * - top: min top
 * - middleY: vertical center of the topmost shape
 * - bottom: max bottom
 */
function getReferenceValue(bboxes, mode) {
  if (!Array.isArray(bboxes) || bboxes.length === 0) return 0;

  switch (mode) {
    case "left": {
      return Math.min(...bboxes.map(b => b.left));
    }
    case "centerX": {
      const leftmost = bboxes.reduce((min, b) => (b.left < min.left ? b : min), bboxes[0]);
      return leftmost.left + leftmost.width / 2;
    }
    case "right": {
      return Math.max(...bboxes.map(b => b.left + b.width));
    }
    case "top": {
      return Math.min(...bboxes.map(b => b.top));
    }
    case "middleY": {
      const topmost = bboxes.reduce((min, b) => (b.top < min.top ? b : min), bboxes[0]);
      return topmost.top + topmost.height / 2;
    }
    case "bottom": {
      return Math.max(...bboxes.map(b => b.top + b.height));
    }
    default:
      return 0;
  }
}

/**
 * Align currently selected shapes.
 * @param {"left"|"centerX"|"right"|"top"|"middleY"|"bottom"} mode
 * @param {"selection"|"canvas"} ref
 */
export function alignSelected(mode, ref = 'selection') {
  const validModes = new Set(["left", "centerX", "right", "top", "middleY", "bottom"]);
  const refMode = ref === 'canvas' ? 'canvas' : 'selection';

  log("DEBUG", "[align] alignSelected ENTRY", { mode, ref: refMode });

  if (!validModes.has(mode)) {
    log("WARN", "[align] Invalid mode; no-op", { mode });
    return;
  }

  const store = getState();
  const selected = Array.isArray(store.selectedShapes) ? store.selectedShapes.filter(Boolean) : [];
  if (selected.length < 2) {
    log("INFO", "[align] Requires 2+ selected shapes; no-op", { selectedCount: selected.length });
    return;
  }

  // Use centralized geometry utility for robust bounding box logic
  const bboxes = getAbsoluteRectsForSelection(selected, store.fabricCanvas);

  // Guard: if any bbox is null, filter it out (still allow moving others + computing reference).
  const existingBboxes = bboxes.filter(Boolean);
  if (existingBboxes.length < 2) {
    log("WARN", "[align] Not enough valid bounding boxes; no-op", { have: existingBboxes.length });
    return;
  }

  // Determine reference value
  let referenceValue;
  if (refMode === 'canvas') {
    const img = store.bgFabricImage;
    if (img && Number.isFinite(img.width) && Number.isFinite(img.height)) {
      switch (mode) {
        case "left": referenceValue = 0; break;
        case "centerX": referenceValue = img.width / 2; break;
        case "right": referenceValue = img.width; break;
        case "top": referenceValue = 0; break;
        case "middleY": referenceValue = img.height / 2; break;
        case "bottom": referenceValue = img.height; break;
        default: referenceValue = 0;
      }
    } else {
      // Fallback to selection-based reference if no bg image
      referenceValue = getReferenceValue(existingBboxes, mode);
      log("WARN", "[align] Canvas ref requested but no bg image; falling back to selection reference");
    }
  } else {
    referenceValue = getReferenceValue(existingBboxes, mode);
  }

  const bgImg = store.bgFabricImage;
  const canvas = store.fabricCanvas;

  let movedCount = 0;

  selected.forEach((shape, idx) => {
    if (!shape) return;

    // Use the corresponding bbox (skip if missing). Locked shapes contribute to reference but don't move.
    const bbox = bboxes[idx];
    if (!bbox) return;
    if (shape.locked) return;

    let dx = 0;
    let dy = 0;

    switch (mode) {
      case "left":
        dx = referenceValue - bbox.left;
        break;
      case "centerX":
        dx = referenceValue - (bbox.left + bbox.width / 2);
        break;
      case "right":
        dx = referenceValue - (bbox.left + bbox.width);
        break;
      case "top":
        dy = referenceValue - bbox.top;
        break;
      case "middleY":
        dy = referenceValue - (bbox.top + bbox.height / 2);
        break;
      case "bottom":
        dy = referenceValue - (bbox.top + bbox.height);
        break;
      default:
        break;
    }

    // Clamp to image bounds, but only apply along the aligned axis
    const clamped = clampDeltaToImage(bbox, dx, dy, bgImg);
    if (mode === "left" || mode === "centerX" || mode === "right") {
      dx = clamped.dx;
      dy = 0; // preserve Y on horizontal align
    } else {
      dx = 0; // preserve X on vertical align
      dy = clamped.dy;
    }

    if (dx === 0 && dy === 0) return;

    try {
      const newLeft = (shape.left ?? 0) + dx;
      const newTop = (shape.top ?? 0) + dy;
      shape.set({ left: newLeft, top: newTop });
      if (typeof shape.setCoords === "function") shape.setCoords();
      movedCount++;
      log("DEBUG", "[align] moved shape", {
        id: shape._id, type: shape._type, dx, dy, newLeft, newTop
      });
    } catch (e) {
      log("ERROR", "[align] Failed to move shape", { id: shape._id, error: e });
    }
  });

  if (movedCount > 0 && canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }

  log("INFO", "[align] alignSelected complete", {
    mode, ref: refMode, movedCount, selectedCount: selected.length
  });
  log("DEBUG", "[align] alignSelected EXIT");
}

