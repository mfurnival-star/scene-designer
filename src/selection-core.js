import { log } from './log.js';
import { attachTransformerForShape, detachTransformer } from './transformer.js';
import { setShapeState, selectShape, deselectShape, setMultiSelected } from './shape-state.js';
import { getShapeDef } from './shape-defs.js';
import {
  sceneDesignerStore,
  getState
} from './state.js';
import fabric from './fabric-wrapper.js';

function getCanonicalShapeById(shapeLike) {
  if (!shapeLike || !shapeLike._id) return null;
  const shapes = getState().shapes || [];
  return shapes.find(s => s._id === shapeLike._id) || null;
}

function ensureFabricActiveSelection(shapes) {
  const canvas = getState().fabricCanvas;
  if (!canvas || !Array.isArray(shapes) || shapes.length <= 1) return;

  const active = typeof canvas.getActiveObject === 'function' ? canvas.getActiveObject() : null;
  const wantIds = shapes.map(s => s && s._id).filter(Boolean).sort();

  if (active && active.type === 'activeSelection' && Array.isArray(active._objects)) {
    const activeIds = active._objects.map(o => o && o._id).filter(Boolean).sort();
    if (activeIds.length === wantIds.length && activeIds.every((v, i) => v === wantIds[i])) {
      return;
    }
  }

  try {
    if (typeof canvas.discardActiveObject === 'function') canvas.discardActiveObject();

    const sel = new fabric.ActiveSelection(shapes, { canvas });
    sel.set({ hasControls: false, hasBorders: true, selectable: true });

    canvas.setActiveObject(sel);

    if (typeof sel.setCoords === 'function') sel.setCoords();
    shapes.forEach(s => { if (typeof s.setCoords === 'function') s.setCoords(); });

    if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
    else canvas.renderAll();
  } catch (e) {
    log("ERROR", "[selection-core] Failed to create/set ActiveSelection", e);
  }
}

export function setSelectedShape(shape) {
  const canonicalShape = getCanonicalShapeById(shape);

  if (getState().selectedShape) {
    deselectShape(getState().selectedShape);
  }

  (getState().shapes || []).forEach(s => { s._selected = false; });
  if (canonicalShape) canonicalShape._selected = true;

  sceneDesignerStore.setState({
    selectedShape: canonicalShape,
    selectedShapes: canonicalShape ? [canonicalShape] : []
  });

  if (canonicalShape) {
    selectShape(canonicalShape);
    const def = getShapeDef(canonicalShape);
    if (def && def.editable && !canonicalShape.locked) {
      attachTransformerForShape(canonicalShape);
    } else {
      detachTransformer();
    }
  } else {
    detachTransformer();
  }
}

export function setSelectedShapes(arr) {
  const all = getState().shapes || [];
  const newArr = Array.isArray(arr)
    ? arr.map(shape => getCanonicalShapeById(shape)).filter(Boolean)
    : [];

  if (Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => {
      if (!newArr.includes(s)) deselectShape(s);
    });
  }

  all.forEach(s => { s._selected = false; });
  newArr.forEach(s => { s._selected = true; });

  sceneDesignerStore.setState({
    selectedShapes: newArr,
    selectedShape: newArr.length === 1 ? newArr[0] : null
  });

  newArr.forEach(shape => {
    setMultiSelected(shape, newArr.length > 1);
    if (newArr.length === 1) selectShape(shape);
  });

  if (newArr.length === 1 && newArr[0] && !newArr[0].locked) {
    const def = getShapeDef(newArr[0]);
    if (def && def.editable) {
      attachTransformerForShape(newArr[0]);
    } else {
      detachTransformer();
    }
  } else if (newArr.length > 1) {
    ensureFabricActiveSelection(newArr);
  } else {
    detachTransformer();
  }
}

export function selectAllShapes() {
  setSelectedShapes((getState().shapes || []).slice());
}

export function deselectAll() {
  if (Array.isArray(getState().selectedShapes)) {
    getState().selectedShapes.forEach(s => deselectShape(s));
  }

  (getState().shapes || []).forEach(s => { s._selected = false; });

  sceneDesignerStore.setState({
    selectedShape: null,
    selectedShapes: []
  });

  detachTransformer();
}

export function attachSelectionHandlers(_shape) {}

export function isShapeSelected(shape) {
  return !!shape && !!shape._selected;
}
export function getSelectedShapes() {
  return getState().selectedShapes || [];
}
export function getSelectedShape() {
  return getState().selectedShape || null;
}

if (typeof window !== "undefined") {
  window.__sel = {
    setSelectedShape,
    setSelectedShapes,
    selectAllShapes,
    deselectAll,
    isShapeSelected,
    getSelectedShape,
    getSelectedShapes
  };
}
