import { getState } from './state.js';
import { log } from './log.js';
import { getShapeDef } from './shape-defs.js';

const ANCHOR_TO_FABRIC_KEY = {
  'top-left': 'tl',
  'top-center': 'mt',
  'top-right': 'tr',
  'middle-left': 'ml',
  'middle-right': 'mr',
  'bottom-left': 'bl',
  'bottom-center': 'mb',
  'bottom-right': 'br'
};

function getActiveObject() {
  const canvas = getState().fabricCanvas;
  if (!canvas || typeof canvas.getActiveObject !== "function") return null;
  return canvas.getActiveObject();
}

function applyControlsForDef(shape, def) {
  if (!shape || !def) return;

  const visibility = {
    tl: false, tr: false, bl: false, br: false,
    ml: false, mt: false, mr: false, mb: false,
    mtr: false
  };

  if (def.resizable && !shape.locked) {
    (def.enabledAnchors || []).forEach(anchor => {
      const key = ANCHOR_TO_FABRIC_KEY[anchor];
      if (key && key in visibility) visibility[key] = true;
    });
  }
  if (def.rotateEnabled && !shape.locked) {
    visibility.mtr = true;
  }

  try {
    if (typeof shape.setControlsVisibility === 'function') {
      shape.setControlsVisibility(visibility);
    } else if (shape.controls) {
      Object.keys(visibility).forEach(k => {
        if (shape.controls[k]) shape.controls[k].visible = visibility[k];
      });
    }
  } catch (e) {
    log("WARN", "[transformer] setControlsVisibility failed", e);
  }

  if (typeof shape.setCoords === "function") {
    try { shape.setCoords(); } catch {}
  }
}

function enforceCircleUniformScaling(shape) {
  if (!shape || shape._type !== 'circle') return;
  try {
    shape.lockUniScaling = true;
    const sx = typeof shape.scaleX === 'number' ? shape.scaleX : 1;
    const sy = typeof shape.scaleY === 'number' ? shape.scaleY : 1;
    const EPS = 0.001;
    if (Math.abs(sx - sy) > EPS) {
      const uniform = Math.min(sx, sy);
      shape.scaleX = uniform;
      shape.scaleY = uniform;
      if (typeof shape.setCoords === 'function') {
        try { shape.setCoords(); } catch {}
      }
      log("INFO", "[transformer] Circle scale normalized", { id: shape._id, from: { sx, sy }, to: uniform });
    }
  } catch (e) {
    log("WARN", "[transformer] enforceCircleUniformScaling failed", { id: shape?._id, error: e });
  }
}

export function attachTransformerForShape(shape) {
  const canvas = getState().fabricCanvas;
  if (!canvas || !shape) return null;
  if (shape.locked) {
    detachTransformer();
    return null;
  }

  const def = getShapeDef(shape);
  if (!def) {
    log("WARN", "[transformer] Missing shape def", { type: shape?._type });
    detachTransformer();
    return null;
  }

  const active = getActiveObject();
  if (active && active !== shape) canvas.discardActiveObject();
  if (active !== shape) canvas.setActiveObject(shape);

  shape.set({
    hasControls: def.resizable && !shape.locked,
    hasBorders: true,
    lockScalingX: shape.locked,
    lockScalingY: shape.locked,
    lockRotation: !def.rotateEnabled || shape.locked,
    lockUniScaling: shape._type === "circle" ? true : !!def.keepRatio,
    selectable: true
  });

  if (shape._type === 'circle') enforceCircleUniformScaling(shape);
  applyControlsForDef(shape, def);

  if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  else canvas.renderAll();

  return shape;
}

export function detachTransformer() {
  const canvas = getState().fabricCanvas;
  if (!canvas) return;
  const active = getActiveObject();
  if (!active) return;
  canvas.discardActiveObject();
  if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  else canvas.renderAll();
}

export function updateTransformer() {
  const canvas = getState().fabricCanvas;
  const sel = getState().selectedShapes;
  if (!canvas || !Array.isArray(sel) || sel.length !== 1 || !sel[0] || sel[0].locked) {
    detachTransformer();
    return;
  }
  attachTransformerForShape(sel[0]);
}
