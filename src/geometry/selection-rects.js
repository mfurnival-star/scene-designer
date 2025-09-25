import { log } from '../log.js';

function safeBBox(obj, absolute = true, calc = true) {
  if (!obj || typeof obj.getBoundingRect !== 'function') return null;
  try {
    return obj.getBoundingRect(absolute, calc);
  } catch (e) {
    log("WARN", "[selection-rects] getBoundingRect failed", { absolute, calc, e });
    return null;
  }
}

function norm(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const r = Math.round(n * 100) / 100;
  const near = Math.round(r);
  return Math.abs(r - near) < 0.01 ? near : r;
}

export function getAbsoluteRectsForSelection(selectedShapes, canvas) {
  if (!Array.isArray(selectedShapes) || selectedShapes.length === 0) return [];
  if (!canvas || typeof canvas.getActiveObject !== 'function') {
    return selectedShapes.map(s => {
      const r = safeBBox(s, true, true);
      return r
        ? { left: norm(r.left), top: norm(r.top), width: norm(r.width), height: norm(r.height) }
        : null;
    }).filter(Boolean);
  }

  const active = canvas.getActiveObject();
  if (active && active.type === 'activeSelection' && Array.isArray(active._objects) && active._objects.length >= 2) {
    try { if (typeof active.setCoords === 'function') active.setCoords(); } catch {}
    const activeAbs = safeBBox(active, true, true);
    if (!activeAbs) return [];
    const centerX = norm(activeAbs.left + activeAbs.width / 2);
    const centerY = norm(activeAbs.top + activeAbs.height / 2);

    return active._objects.map(m => {
      if (!m) return null;
      try { if (typeof m.setCoords === 'function') m.setCoords(); } catch {}
      const rel = safeBBox(m, false, true);
      if (!rel) return null;
      return {
        left: norm(centerX + rel.left),
        top: norm(centerY + rel.top),
        width: norm(rel.width),
        height: norm(rel.height)
      };
    }).filter(Boolean);
  } else {
    return selectedShapes.map(s => {
      const r = safeBBox(s, true, true);
      return r
        ? { left: norm(r.left), top: norm(r.top), width: norm(r.width), height: norm(r.height) }
        : null;
    }).filter(Boolean);
  }
}

export function getSelectionHullRect(selectedShapes, canvas) {
  const rects = getAbsoluteRectsForSelection(selectedShapes, canvas);
  if (!rects.length) return null;
  const minLeft = Math.min(...rects.map(r => r.left));
  const minTop = Math.min(...rects.map(r => r.top));
  const maxRight = Math.max(...rects.map(r => r.left + r.width));
  const maxBottom = Math.max(...rects.map(r => r.top + r.height));
  return {
    left: norm(minLeft),
    top: norm(minTop),
    width: norm(maxRight - minLeft),
    height: norm(maxBottom - minTop)
  };
}

export function getActiveSelectionMemberRects(canvas) {
  if (!canvas || typeof canvas.getActiveObject !== 'function') return [];
  const active = canvas.getActiveObject();
  if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects)) return [];
  try { if (typeof active.setCoords === 'function') active.setCoords(); } catch {}
  const activeAbs = safeBBox(active, true, true);
  if (!activeAbs) return [];
  const centerX = norm(activeAbs.left + activeAbs.width / 2);
  const centerY = norm(activeAbs.top + activeAbs.height / 2);

  return active._objects.map(m => {
    if (!m) return null;
    try { if (typeof m.setCoords === 'function') m.setCoords(); } catch {}
    const rel = safeBBox(m, false, true);
    if (!rel) return null;
    return {
      left: norm(centerX + rel.left),
      top: norm(centerY + rel.top),
      width: norm(rel.width),
      height: norm(rel.height)
    };
  }).filter(Boolean);
}

export function getActiveSelectionHullRect(canvas) {
  const rects = getActiveSelectionMemberRects(canvas);
  if (!rects.length) return null;
  const minLeft = Math.min(...rects.map(r => r.left));
  const minTop = Math.min(...rects.map(r => r.top));
  const maxRight = Math.max(...rects.map(r => r.left + r.width));
  const maxBottom = Math.max(...rects.map(r => r.top + r.height));
  return {
    left: norm(minLeft),
    top: norm(minTop),
    width: norm(maxRight - minLeft),
    height: norm(maxBottom - minTop)
  };
}
