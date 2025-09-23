/**
 * actions-alignment.js
 * -----------------------------------------------------------
 * Scene Designer – Alignment Actions (ESM ONLY, Manifesto-compliant)
 * Purpose:
 * - Provide alignment operations for selected shapes:
 *     left, centerX, right, top, middleY, bottom
 * - Reference modes:
 *     - "selection" (default): aligns to the selection set (locked contribute but don't move)
 *     - "canvas": aligns to canvas/image bounds (bgFabricImage)
 * - Behavior:
 *     - Requires 2+ selected shapes (INFO no-op otherwise).
 *     - Locked shapes are not moved (but still contribute to reference calculation).
 *     - Only the aligned axis is changed (X for left/centerX/right, Y for top/middleY/bottom).
 *     - Clamps resulting motion to image bounds on the changed axis if a background image exists.
 *
 * Export:
 * - alignSelected(mode, ref = 'selection')
 *
 * Dependencies:
 * - state.js (getState)
 * - log.js (log)
 *
 * Notes:
 * - Fabric peculiarity: when an ActiveSelection exists, some builds report member bounding boxes
 *   relative to the group's CENTER for getBoundingRect(false, true). To get absolute member rects,
 *   compose them as:
 *     activeAbs = active.getBoundingRect(true, true)
 *     center = { x: activeAbs.left + activeAbs.width/2, y: activeAbs.top + activeAbs.height/2 }
 *     memberRel = member.getBoundingRect(false, true)
 *     memberAbs = { left: center.x + memberRel.left, top: center.y + memberRel.top, width: memberRel.width, height: memberRel.height }
 * - If no ActiveSelection is present, fall back to member.getBoundingRect(true, true) safely.
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';

/**
 * Safe absolute bbox via Fabric API (absolute=true, calc=true).
 */
function safeAbsBBox(obj) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    const r = obj.getBoundingRect(true, true);
    if (!r) return null;
    return {
      left: Number(r.left) || 0,
      top: Number(r.top) || 0,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0
    };
  } catch (e) {
    log("WARN", "[align] safeAbsBBox getBoundingRect(true,true) failed", { id: obj?._id, e });
    return null;
  }
}

/**
 * Safe relative bbox (relative to current group's center when activeSelection), calc=true.
 */
function safeRelBBox(obj) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    const r = obj.getBoundingRect(false, true);
    if (!r) return null;
    return {
      left: Number(r.left) || 0,
      top: Number(r.top) || 0,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0
    };
  } catch (e) {
    log("WARN", "[align] safeRelBBox getBoundingRect(false,true) failed", { id: obj?._id, e });
    return null;
  }
}

/**
 * If an ActiveSelection exists, compose true absolute member rects from its center + member-relative rects.
 * Returns a Map keyed by object reference with absolute rects. If no ActiveSelection, returns null.
 */
function collectMemberAbsRectsFromActiveSelection() {
  const canvas = getState().fabricCanvas;
  if (!canvas || typeof canvas.getActiveObject !== 'function') return null;

  const active = canvas.getActiveObject();
  if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects) || active._objects.length < 2) {
    return null;
  }

  try {
    if (typeof active.setCoords === 'function') { try { active.setCoords(); } catch {} }
    const activeAbs = safeAbsBBox(active);
    if (!activeAbs) return null;

    const centerX = activeAbs.left + activeAbs.width / 2;
    const centerY = activeAbs.top + activeAbs.height / 2;

    const map = new Map();
    for (const m of active._objects) {
      if (!m) continue;
      try { if (typeof m.setCoords === 'function') { try { m.setCoords(); } catch {} } } catch {}
      const rel = safeRelBBox(m);
      if (!rel) continue;
      const abs = {
        left: centerX + rel.left,
        top: centerY + rel.top,
        width: rel.width,
        height: rel.height
      };
      map.set(m, abs);
    }
    return map;
  } catch (e) {
    log("WARN", "[align] collectMemberAbsRectsFromActiveSelection failed; falling back", e);
    return null;
  }
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

  // Build absolute bboxes for every selected shape, robust under ActiveSelection.
  // Prefer ActiveSelection-derived absolute rects if available for accuracy.
  const fromActiveMap = collectMemberAbsRectsFromActiveSelection();
  const bboxes = selected.map(s => {
    // Try by object identity first (when store and canvas share references, which they should)
    let rect = fromActiveMap ? fromActiveMap.get(s) : null;
    // If not found by reference, attempt a fallback to absolute bbox
    if (!rect) rect = safeAbsBBox(s);
    return rect;
  });

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


