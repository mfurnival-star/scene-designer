/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Fabric.js Panel (Debug Logging Edition)
 * - Fabric.js canvas creation, image background, shape management.
 * - All selection/deselection/multiselect handled in a single canvas event handler.
 * - State is managed via Zustand store from state.js.
 * - Exports: buildCanvasPanel({ element, title, componentName })
 * - Panel factory for MiniLayout; renders the main canvas panel.
 * - DEBUG logging everywhere for robust bug diagnosis—especially selection!
 * -----------------------------------------------------------
 */

import { Canvas, Rect, Circle, Line, Group, Image } from './fabric-wrapper.js';
import {
  getState,
  setShapes,
  addShape,
  removeShape,
  setImage,
  setSelectedShapes,
  setFabricCanvas,
  setBgFabricImage,
  sceneDesignerStore,
} from './state.js';
import { log } from './log.js';
import { setShapeState, selectShape, deselectShape } from './shape-state.js';

/**
 * Utility: get canonical shape reference from state.shapes by _id.
 * @param {Object} shapeLike - shape-like object (from event or store)
 * @returns {Object|null} shape from state.shapes, or null
 */
function getCanonicalShapeById(shapeLike) {
  if (!shapeLike || !shapeLike._id) return null;
  const shapes = getState().shapes || [];
  return shapes.find(s => s._id === shapeLike._id) || null;
}

/**
 * Utility: dump all shapes in store for diagnostics.
 */
function dumpAllShapes(tag = "") {
  const shapes = getState().shapes || [];
  log("DEBUG", `[canvas][${tag}] All shapes in store:`,
    shapes.map((s, i) => ({
      idx: i,
      label: s?._label,
      type: s?._type,
      _id: s?._id,
      left: s?.left,
      top: s?.top,
      locked: s?.locked
    }))
  );
}

/**
 * Utility: dump selectedShapes for diagnostics.
 */
function dumpSelectedShapes(tag = "") {
  const sel = getState().selectedShapes || [];
  log("DEBUG", `[canvas][${tag}] Selected shapes:`,
    sel.map((s, i) => ({
      idx: i,
      label: s?._label,
      type: s?._type,
      _id: s?._id,
      left: s?.left,
      top: s?.top,
      locked: s?.locked
    }))
  );
}

function moveShapesToFront() {
  const store = getState();
  log("DEBUG", "[canvas] moveShapesToFront ENTRY", { store });
  if (!store.fabricCanvas) {
    log("DEBUG", "[canvas] moveShapesToFront EXIT (no canvas)");
    return;
  }
  const objs = store.fabricCanvas.getObjects();
  log("DEBUG", "[canvas] moveShapesToFront: canvas objects", objs);
  if (!objs.length) {
    log("DEBUG", "[canvas] moveShapesToFront EXIT (no objects)");
    return;
  }
  const bgImg = store.bgFabricImage;
  objs.forEach((obj) => {
    if (obj !== bgImg) {
      obj.moveTo(store.fabricCanvas.getObjects().length - 1);
      log("DEBUG", "[canvas] moveShapesToFront: moved", {
        objType: obj._type, objId: obj._id
      });
    }
  });
  store.fabricCanvas.renderAll();
  log("DEBUG", "[canvas] moveShapesToFront EXIT");
}

function updateBackgroundImage(containerDiv, element) {
  log("DEBUG", "[canvas] updateBackgroundImage ENTRY", {
    containerDiv, element, state: getState()
  });
  const store = getState();
  const canvas = store.fabricCanvas;
  if (!canvas) {
    log("DEBUG", "[canvas] updateBackgroundImage EXIT (no canvas)");
    return;
  }
  if (store.bgFabricImage) {
    log("DEBUG", "[canvas] updateBackgroundImage: removing old bg image", { bgImg: store.bgFabricImage });
    canvas.remove(store.bgFabricImage);
    setBgFabricImage(null);
    canvas.renderAll();
  }
  if (store.imageObj) {
    const imgObj = store.imageObj;
    log("DEBUG", "[canvas] updateBackgroundImage: loading new image", { imgObj });
    Image.fromURL(imgObj.src || store.imageURL, function(img) {
      log("DEBUG", "[canvas] updateBackgroundImage: Image.fromURL loaded", { img });
      img.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        hasBorders: false,
        hasControls: false,
        hoverCursor: 'default'
      });
      // Set canvas and container to image size
      canvas.setWidth(img.width);
      canvas.setHeight(img.height);
      containerDiv.style.width = img.width + "px";
      containerDiv.style.height = img.height + "px";
      // Clamp parent panel body to panel size, overflow: auto
      if (element) {
        element.style.overflow = "auto";
        element.style.width = "100%";
        element.style.height = "100%";
      }
      setBgFabricImage(img);
      canvas.add(img);
      img.moveTo(0);
      moveShapesToFront();
      canvas.renderAll();
      log("DEBUG", "[canvas] updateBackgroundImage: image added", {
        type: img.type, width: img.width, height: img.height
      });
      log("DEBUG", "[canvas] updateBackgroundImage EXIT (image loaded)");
    });
  } else {
    log("DEBUG", "[canvas] updateBackgroundImage EXIT (no imageObj)");
  }
}

/**
 * Centralized canvas pointer event handler for selection/deselection/multiselect.
 * Now with extra logging for shape selection debugging!
 */
function centralizedCanvasPointerHandler(e) {
  log("DEBUG", "[canvas] centralizedCanvasPointerHandler FIRED", {
    event: e,
    pointerType: e.pointerType,
    eventType: e.e?.type,
    ctrlKey: e.e?.ctrlKey,
    metaKey: e.e?.metaKey,
    target: e.target,
    currentSelectedShape: getState().selectedShape,
    currentSelectedShapes: getState().selectedShapes.map(s=>s?._id)
  });
  dumpAllShapes("before-selection");
  dumpSelectedShapes("before-selection");

  const state = getState();
  const canvas = state.fabricCanvas;
  const shapes = state.shapes || [];

  // If background is clicked (no shape), deselect all
  if (!e.target) {
    log("DEBUG", "[canvas] centralized handler: background clicked", {
      stateBefore: {...state}
    });
    setSelectedShapes([]);
    canvas.discardActiveObject();
    canvas.renderAll();
    log("DEBUG", "[canvas] centralized handler: background deselect complete", {
      stateAfter: {...getState()}
    });
    dumpSelectedShapes("after-deselect");
    return;
  }

  // If a shape is clicked
  const shapeEventObj = e.target;
  log("DEBUG", "[canvas] centralized handler: shape clicked", {
    shapeType: shapeEventObj._type,
    shapeLabel: shapeEventObj._label,
    shapeId: shapeEventObj._id,
    left: shapeEventObj.left,
    top: shapeEventObj.top,
    locked: shapeEventObj.locked,
    stateBefore: {...state}
  });

  // --- Always resolve to canonical reference from state.shapes via _id ---
  const shape = getCanonicalShapeById(shapeEventObj);
  if (!shape) {
    log("ERROR", "[canvas] centralized handler: shape clicked, but could not resolve canonical reference", {
      eventObj: shapeEventObj
    });
    return;
  }

  log("DEBUG", "[canvas] centralized handler: canonical shape resolved", {
    shapeType: shape._type,
    shapeLabel: shape._label,
    shapeId: shape._id,
    left: shape.left,
    top: shape.top,
    locked: shape.locked
  });

  const isMulti = e.e && (e.e.ctrlKey || e.e.metaKey);

  if (isMulti) {
    // If shape is already selected, remove; else add
    const idx = state.selectedShapes.findIndex(s => s._id === shape._id);
    log("DEBUG", "[canvas] centralized handler: multi-select toggle", {
      idx, selectedShapes: state.selectedShapes.map(s=>s._id)
    });
    if (idx === -1) {
      setSelectedShapes([...state.selectedShapes, shape]);
    } else {
      const arr = state.selectedShapes.slice();
      arr.splice(idx, 1);
      setSelectedShapes(arr);
    }
    log("DEBUG", "[canvas] centralized handler: multi-select complete", {
      shapeType: shape._type,
      shapeLabel: shape._label,
      shapeId: shape._id,
      selectedShapes: getState().selectedShapes.map(sh => sh._id),
      stateAfter: {...getState()}
    });
  } else {
    setSelectedShapes([shape]);
    log("DEBUG", "[canvas] centralized handler: single selection complete", {
      shapeType: shape._type,
      shapeLabel: shape._label,
      shapeId: shape._id,
      selectedShapes: getState().selectedShapes.map(sh => sh._id),
      stateAfter: {...getState()}
    });
  }
  dumpSelectedShapes("after-selection");

  canvas.setActiveObject(shape);
  canvas.renderAll();
  log("DEBUG", "[canvas] centralized handler: canvas.setActiveObject/renderAll DONE", {
    activeObject: canvas.getActiveObject(),
    stateAfter: {...getState()}
  });
}

export function buildCanvasPanel({ element, title, componentName }) {
  log("DEBUG", "[canvas] buildCanvasPanel ENTRY", {
    elementType: element?.tagName,
    title,
    componentName,
    stateBefore: {...getState()}
  });
  try {
    log("INFO", "[canvas] buildCanvasPanel called", {
      elementType: element?.tagName,
      title,
      componentName
    });

    const store = getState();
    if (store.fabricCanvas && typeof store.fabricCanvas.dispose === "function") {
      log("DEBUG", "[canvas] buildCanvasPanel: disposing previous canvas", { canvas: store.fabricCanvas });
      store.fabricCanvas.dispose();
      log("DEBUG", "[canvas] buildCanvasPanel: previous canvas disposed");
    }

    const width = store.settings?.canvasMaxWidth || 600;
    const height = store.settings?.canvasMaxHeight || 400;

    const containerDiv = document.createElement('div');
    containerDiv.id = "fabric-canvas-div";
    containerDiv.style.position = "relative";
    containerDiv.style.background = "#f7f9fc";
    // NOTE: Do NOT set width/height here; let image size dictate after load
    containerDiv.style.overflow = "visible"; // allow child to overflow, panel body will scroll
    element.innerHTML = "";
    element.style.overflow = "auto";
    element.style.width = "100%";
    element.style.height = "100%";
    element.appendChild(containerDiv);

    const canvasEl = document.createElement('canvas');
    canvasEl.id = "fabric-main-canvas";
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.style.display = "block";
    canvasEl.style.position = "absolute";
    canvasEl.style.left = "0";
    canvasEl.style.top = "0";
    containerDiv.appendChild(canvasEl);

    const canvas = new Canvas(canvasEl, {
      width,
      height,
      selection: true,
      backgroundColor: "#f7f9fc"
    });
    setFabricCanvas(canvas);
    log("DEBUG", "[canvas] buildCanvasPanel: Fabric.js canvas created", { width, height, canvas });

    // --- Centralized selection/deselection handler ---
    canvas.off("mouse:down.centralized");
    canvas.on("mouse:down.centralized", centralizedCanvasPointerHandler);
    log("DEBUG", "[canvas] buildCanvasPanel: centralizedCanvasPointerHandler attached");

    // --- Sync shapes on canvas panel creation ---
    log("DEBUG", "[canvas] buildCanvasPanel: Syncing shapes on init", { shapes: getState().shapes });
    const shapes = getState().shapes;
    if (Array.isArray(shapes) && shapes.length > 0) {
      log("DEBUG", "[canvas] Syncing existing shapes to canvas on panel build", { shapes });
      shapes.forEach((shape, idx) => {
        log("DEBUG", `[canvas] buildCanvasPanel: Shape ${idx} sync`, {
          type: shape?._type,
          label: shape?._label,
          id: shape?._id
        });
        if (getState().fabricCanvas && !getState().fabricCanvas.getObjects().includes(shape)) {
          getState().fabricCanvas.add(shape);
          moveShapesToFront();
          log("DEBUG", `[canvas] buildCanvasPanel: Shape ${idx} added to canvas`, {
            type: shape?._type,
            label: shape?._label,
            id: shape?._id
          });
        } else {
          log("WARN", `[canvas] buildCanvasPanel: Shape ${idx} already on canvas or canvas missing`, {
            type: shape?._type,
            label: shape?._label,
            id: shape?._id
          });
        }
      });
      getState().fabricCanvas.renderAll();
      log("DEBUG", "[canvas] buildCanvasPanel: All shapes rendered");
    } else {
      log("DEBUG", "[canvas] buildCanvasPanel: No shapes to sync on init");
    }

    // Subscribe to store for image and shape changes (FILTERED)
    log("DEBUG", "[canvas] Subscribing to store state changes");

    let prevImageObj = null;
    let prevImageURL = null;

    sceneDesignerStore.subscribe(() => {
      const state = getState();
      log("DEBUG", "[canvas] store.subscribe fired", { state });
      if (state.imageObj !== prevImageObj || state.imageURL !== prevImageURL) {
        log("DEBUG", "[canvas] store.subscribe: imageObj/imageURL changed", {
          prevImageObj, prevImageURL, stateImageObj: state.imageObj, stateImageURL: state.imageURL
        });
        updateBackgroundImage(containerDiv, element);
        prevImageObj = state.imageObj;
        prevImageURL = state.imageURL;
      }
      // Add shapes
      const canvasShapes = state.fabricCanvas?.getObjects() || [];
      const stateShapes = state.shapes || [];
      log("DEBUG", "[canvas] store.subscribe: shape sync", { canvasShapes, stateShapes });
      stateShapes.forEach(shape => {
        if (state.fabricCanvas && !canvasShapes.includes(shape)) {
          state.fabricCanvas.add(shape);
          moveShapesToFront();
          log("DEBUG", "[canvas] subscribe: shape added to canvas", {
            type: shape._type,
            label: shape._label,
            id: shape._id
          });
        }
      });
      // Remove shapes
      canvasShapes.forEach(obj => {
        if (!stateShapes.includes(obj) && obj !== state.bgFabricImage) {
          log("DEBUG", "[canvas] subscribe: removing shape from canvas", { obj });
          state.fabricCanvas.remove(obj);
        }
      });
      state.fabricCanvas?.renderAll();
      log("DEBUG", "[canvas] store.subscribe: canvas.renderAll called");
    });

    if (getState().imageObj) {
      log("DEBUG", "[canvas] buildCanvasPanel: imageObj present, loading background image", { imageObj: getState().imageObj });
      updateBackgroundImage(containerDiv, element);
      prevImageObj = getState().imageObj;
      prevImageURL = getState().imageURL;
    }

    log("INFO", "[canvas] Canvas panel initialized (Fabric.js only, centralized event handler, DEBUG logging)");

  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
  log("DEBUG", "[canvas] buildCanvasPanel EXIT", {
    elementType: element?.tagName,
    title,
    componentName,
    stateAfter: {...getState()}
  });
}
