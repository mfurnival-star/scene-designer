/**
 * actions-alignment.js
 * -----------------------------------------------------------
 * Scene Designer – Alignment Actions (ESM ONLY, Manifesto-compliant)
 * Purpose:
 * - Provide alignment operations for selected shapes:
 *     left, centerX, right, top, middleY, bottom
 * - Reference modes:
 *     - "selection" (default): aligns to the selection hull (all selected, locked included in hull)
 *     - "canvas": aligns to canvas/image bounds (bgFabricImage)
 * - Behavior:
 *     - Requires 2+ selected shapes (INFO no-op otherwise).
 *     - Locked shapes are not moved (but still contribute to "selection" hull).
 *     - Resulting positions are clamped to image bounds when a background image exists.
 *     - Preserves shape sizes/angles; translates via left/top.
 *
 * Export:
 * - alignSelected(mode, ref = 'selection')
 *
 * Dependencies:
 * - state.js (getState)
 * - log.js (log)
 *
 * Notes:
 * - Uses Fabric getBoundingRect(true, true) for absolute bounding boxes.
 * - Updates coords after movement and triggers a single render at the end.
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';

/**
 * Compute absolute bounding rectangle for a Fabric object.
 * Returns { left, top, width, height } or null.
 */
function absBBox(obj) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    return obj.getBoundingRect(true, true);
  } catch (e) {
    log("ERROR", "[align] getBoundingRect failed", e);
    return null;
  }
}

/**
 * Compute the selection hull across provided objects (by absolute bounding rects).
 */
function selectionHull(objs) {
  const rects = [];
  for (const o of objs) {
    const r = absBBox(o);
    if (r && Number.isFinite(r.left) && Number.isFinite(r.top) && Number.isFinite(r.width) && Number.isFinite(r.height)) {
      rects.push(r);
    }
  }
  if (rects.length === 0) return null;
  const minLeft = Math.min(...rects.map(r => r.left));
  const minTop = Math.min(...rects.map(r => r.top));
  const maxRight = Math.max(...rects.map(r => r.left + r.width));
  const maxBottom = Math.max(...rects.map(r => r.top + r.height));
  return {
    left: minLeft,
    top: minTop,
    width: maxRight - minLeft,
    height: maxBottom - minTop
  };
}

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

  // Determine reference rectangle
  let refRect = null;
  if (refMode === 'canvas') {
    const img = store.bgFabricImage;
    if (img && Number.isFinite(img.width) && Number.isFinite(img.height)) {
      refRect = { left: 0, top: 0, width: img.width, height: img.height };
    } else {
      // Fallback to selection when no bg image
      refRect = selectionHull(selected);
      log("WARN", "[align] Canvas ref requested but no bg image; falling back to selection hull");
    }
  } else {
    refRect = selectionHull(selected);
  }
  if (!refRect) {
    log("WARN", "[align] Reference rectangle unavailable; no-op", { ref: refMode });
    return;
  }

  const refLeft = refRect.left;
  const refRight = refRect.left + refRect.width;
  const refTop = refRect.top;
  const refBottom = refRect.top + refRect.height;
  const refCenterX = refRect.left + refRect.width / 2;
  const refCenterY = refRect.top + refRect.height / 2;

  const bgImg = store.bgFabricImage;
  const canvas = store.fabricCanvas;

  let movedCount = 0;
  selected.forEach(shape => {
    if (!shape || shape.locked) return;
    const bbox = absBBox(shape);
    if (!bbox) return;

    let dx = 0;
    let dy = 0;

    switch (mode) {
      case "left":
        dx = refLeft - bbox.left;
        break;
      case "centerX":
        dx = refCenterX - (bbox.left + bbox.width / 2);
        break;
      case "right":
        dx = refRight - (bbox.left + bbox.width);
        break;
      case "top":
        dy = refTop - bbox.top;
        break;
      case "middleY":
        dy = refCenterY - (bbox.top + bbox.height / 2);
        break;
      case "bottom":
        dy = refBottom - (bbox.top + bbox.height);
        break;
      default:
        break;
    }

    // Clamp deltas to image bounds when available
    const clamped = clampDeltaToImage(bbox, dx, dy, bgImg);
    dx = clamped.dx;
    dy = clamped.dy;

    if (dx === 0 && dy === 0) return;

    try {
      const newLeft = (shape.left ?? 0) + dx;
      const newTop = (shape.top ?? 0) + dy;
      shape.set({ left: newLeft, top: newTop });
      if (typeof shape.setCoords === "function") shape.setCoords();
      movedCount++;
      log("TRACE", "[align] moved shape", {
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

