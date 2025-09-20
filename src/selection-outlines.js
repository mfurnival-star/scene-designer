/**
 * selection-outlines.js
 * -----------------------------------------------------------
 * Scene Designer – Multi-select Outlines (ESM ONLY)
 * Purpose:
 * - Render and manage dashed outlines for multi-selection.
 * - Blue dashed outline for selected shapes; red for locked ones.
 * - Outlines are non-interactive and excluded from export/clone.
 *
 * Exports:
 * - refreshMultiSelectOutlines(selectedArr)
 * - clearAllSelectionOutlines()
 *
 * Dependencies:
 * - state.js (getState)
 * - fabric-wrapper.js (Rect)
 * - log.js (log)
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { Rect } from './fabric-wrapper.js';
import { log } from './log.js';

// Internal registry of outline rects, keyed by shape _id
const _outlineById = new Map();

function _getCanvas() {
  return getState().fabricCanvas || null;
}

function _outlineColorFor(shape) {
  return shape && shape.locked ? '#e53935' /* red */ : '#2176ff' /* blue */;
}

function _updateOrCreateOutlineForShape(shape, pad = 4) {
  const canvas = _getCanvas();
  if (!canvas || !shape) return;

  // Compute bounding rect with transformations applied
  let br;
  try {
    // true,true → include transformations and stroke
    br = shape.getBoundingRect(true, true);
  } catch (e) {
    log("WARN", "[selection-outlines] getBoundingRect failed; falling back to raw props", { id: shape?._id, e });
    br = { left: shape.left ?? 0, top: shape.top ?? 0, width: (shape.width ?? 0), height: (shape.height ?? 0) };
  }

  const left = Math.max(0, Math.round(br.left - pad));
  const top = Math.max(0, Math.round(br.top - pad));
  const width = Math.max(0, Math.round(br.width + pad * 2));
  const height = Math.max(0, Math.round(br.height + pad * 2));

  let outline = _outlineById.get(shape._id);
  const strokeColor = _outlineColorFor(shape);

  if (!outline) {
    outline = new Rect({
      left,
      top,
      width,
      height,
      fill: 'rgba(0,0,0,0)',
      stroke: strokeColor,
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false
    });
    outline.strokeUniform = true;
    outline._isSelectionOutline = true;
    outline.excludeFromExport = true;

    canvas.add(outline);
    try { outline.bringToFront && outline.bringToFront(); } catch {}
    _outlineById.set(shape._id, outline);

    log("DEBUG", "[selection-outlines] created", {
      forId: shape._id, forType: shape._type, left, top, width, height, strokeColor
    });
  } else {
    outline.set({ left, top, width, height, stroke: strokeColor });
    outline.strokeUniform = true;
    try {
      outline.setCoords && outline.setCoords();
      outline.bringToFront && outline.bringToFront();
    } catch {}
  }
}

function _removeOutlineForShapeId(id) {
  const canvas = _getCanvas();
  const outline = _outlineById.get(id);
  if (outline && canvas) {
    try {
      canvas.remove(outline);
      canvas.requestRenderAll ? canvas.requestRenderAll() : canvas.renderAll();
    } catch (e) {
      log("WARN", "[selection-outlines] remove failed", { id, e });
    }
  }
  _outlineById.delete(id);
}

/**
 * Clear all multi-select outlines from the canvas.
 */
export function clearAllSelectionOutlines() {
  const ids = Array.from(_outlineById.keys());
  ids.forEach(_removeOutlineForShapeId);
  log("DEBUG", "[selection-outlines] cleared all", { count: ids.length });
}

/**
 * Update multi-select outlines to match the given selected array.
 * If not a multi-select (0 or 1), clears all outlines.
 * @param {Array} selectedArr - Array of selected shapes
 */
export function refreshMultiSelectOutlines(selectedArr) {
  const canvas = _getCanvas();
  if (!canvas) return;

  // If not a multi-select, clear all and exit
  if (!Array.isArray(selectedArr) || selectedArr.length <= 1) {
    clearAllSelectionOutlines();
    return;
  }

  // Create/update outlines for selected shapes
  const selIds = new Set(selectedArr.map(s => s._id));
  selectedArr.forEach(s => _updateOrCreateOutlineForShape(s));

  // Remove outlines for shapes no longer selected
  Array.from(_outlineById.keys()).forEach(id => {
    if (!selIds.has(id)) _removeOutlineForShapeId(id);
  });

  canvas.requestRenderAll ? canvas.requestRenderAll() : canvas.renderAll();
}
