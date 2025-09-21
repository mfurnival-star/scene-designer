/**
 * canvas-core.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric.js Canvas Core (ESM ONLY)
 * Purpose:
 * - Create and manage the Fabric.js canvas panel (MiniLayout component).
 * - Handle background image loading/sizing and keep shapes in front of the image.
 * - Subscribe to app state and synchronize canvas objects (add/remove/render).
 * - Install Fabric selection lifecycle syncing (selection:created/updated/cleared).
 * - Install movement constraints/clamping and multi-select lock guards.
 * - Draw multi-select dashed outlines as an overlay (no Fabric objects).
 * - Suppress iOS Safari double‑tap zoom within the canvas interaction area.
 *
 * Exports:
 * - buildCanvasPanel({ element, title, componentName })
 *
 * Dependencies:
 * - fabric-wrapper.js (Canvas, Image)
 * - state.js (getState, setFabricCanvas, setBgFabricImage, sceneDesignerStore)
 * - log.js (log)
 * - canvas-events.js (installFabricSelectionSync)
 * - canvas-constraints.js (installCanvasConstraints)
 * - selection-outlines.js (installSelectionOutlines)
 *
 * Notes:
 * - Selection is synchronized via Fabric's selection events.
 * - Background image sits at index 0; shapes are moved to the front on every sync.
 * - Movement clamped to image bounds; multi-drag blocked if any selected is locked.
 * - iOS suppression: touch-action: manipulation + double-tap cancel and gesture* preventDefault.
 * - Multi-select outlines are painted on the top context to avoid "ghost boxes".
 */

import { Canvas, Image } from './fabric-wrapper.js';
import {
  getState,
  setFabricCanvas,
  setBgFabricImage,
  sceneDesignerStore,
} from './state.js';
import { log } from './log.js';
import { installFabricSelectionSync } from './canvas-events.js';
import { installCanvasConstraints } from './canvas-constraints.js';
import { installSelectionOutlines } from './selection-outlines.js';

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
 * Utility: dump all canvas objects for diagnostics.
 */
function dumpCanvasObjects(tag = "") {
  const canvas = getState().fabricCanvas;
  if (!canvas) {
    log("DEBUG", `[canvas][${tag}] No Fabric.js canvas present.`);
    return;
  }
  const objs = canvas.getObjects();
  log("DEBUG", `[canvas][${tag}] Canvas objects:`,
    objs.map((obj, i) => ({
      idx: i,
      label: obj?._label,
      type: obj?._type,
      _id: obj?._id,
      left: obj?.left,
      top: obj?.top,
      locked: obj?.locked,
      refEqStore: getState().shapes.some(s => s === obj),
      refEqById: getState().shapes.some(s => s._id === obj._id)
    }))
  );
}

/**
 * Ensure all shapes render above the background image (index 0).
 */
function moveShapesToFront() {
  const store = getState();
  log("DEBUG", "[canvas] moveShapesToFront ENTRY", { store });
  if (!store.fabricCanvas) {
    log("DEBUG", "[canvas] moveShapesToFront EXIT (no canvas)");
    return;
  }
  const objs = store.fabricCanvas.getObjects();
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

/**
 * Load/update the background image and resize canvas/panel to match.
 */
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
 * iOS Safari double‑tap zoom suppression within the canvas container.
 * - touch-action: manipulation
 * - Cancel double-tap via touchend timing
 * - Prevent legacy gesture* defaults inside container
 */
function installIosTouchSuppression(containerEl) {
  if (!containerEl || !containerEl.style) return () => {};
  try {
    containerEl.style.touchAction = 'manipulation';
  } catch {
    // no-op
  }

  let lastTouchEnd = 0;

  const onTouchEnd = (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) {
      // Likely a double-tap → prevent page zoom
      try { e.preventDefault(); } catch {}
    }
    lastTouchEnd = now;
  };
  const onGesture = (e) => {
    try { e.preventDefault(); } catch {}
  };

  // Use passive: false so preventDefault is honored
  containerEl.addEventListener('touchend', onTouchEnd, { passive: false });
  containerEl.addEventListener('gesturestart', onGesture, { passive: false });
  containerEl.addEventListener('gesturechange', onGesture, { passive: false });

  log("INFO", "[canvas] iOS touch suppression installed");

  return function detachIosTouchSuppression() {
    try {
      containerEl.removeEventListener('touchend', onTouchEnd, { passive: false });
      containerEl.removeEventListener('gesturestart', onGesture, { passive: false });
      containerEl.removeEventListener('gesturechange', onGesture, { passive: false });
    } catch {}
    log("INFO", "[canvas] iOS touch suppression detached");
  };
}

/**
 * MiniLayout panel factory: Build the Canvas panel.
 */
export function buildCanvasPanel({ element, title, componentName }) {
  log("DEBUG", "[canvas] buildCanvasPanel ENTRY", {
    elementType: element?.tagName,
    title,
    componentName,
    stateBefore: {...getState()}
  });
  let detachConstraints = null;
  let detachIos = null;
  let detachOutlines = null;

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
    // touch-action for iOS (and generally good practice)
    try { containerDiv.style.touchAction = 'manipulation'; } catch {}
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
    // Defensive: set touch-action on the canvas element too
    try { canvasEl.style.touchAction = 'manipulation'; } catch {}
    containerDiv.appendChild(canvasEl);

    const canvas = new Canvas(canvasEl, {
      width,
      height,
      selection: true,
      backgroundColor: "#f7f9fc"
    });
    setFabricCanvas(canvas);
    log("DEBUG", "[canvas] buildCanvasPanel: Fabric.js canvas created", { width, height, canvas });

    // Install Fabric selection lifecycle syncing (fix for defect1)
    installFabricSelectionSync(canvas);
    log("DEBUG", "[canvas] buildCanvasPanel: Fabric selection sync installed");

    // Install overlay painter for multi-select dashed outlines (no Fabric objects)
    detachOutlines = installSelectionOutlines(canvas);
    log("DEBUG", "[canvas] buildCanvasPanel: Selection outlines overlay installed");

    // Install movement constraints (clamping + multi-lock guard) — defect14/15
    detachConstraints = installCanvasConstraints(canvas);

    // Install iOS Safari double‑tap suppression within the canvas container — defect19
    detachIos = installIosTouchSuppression(containerDiv);

    // --- Sync shapes on canvas panel creation ---
    log("DEBUG", "[canvas] buildCanvasPanel: Syncing shapes on init", { shapes: getState().shapes });
    const shapes = getState().shapes;
    if (Array.isArray(shapes) && shapes.length > 0) {
      shapes.forEach((shape, idx) => {
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
      dumpAllShapes("store.subscribe");
      dumpCanvasObjects("store.subscribe");
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
      // Remove shapes (never remove bg image)
      (state.fabricCanvas?.getObjects() || []).forEach(obj => {
        if (!stateShapes.includes(obj) && obj !== state.bgFabricImage) {
          log("DEBUG", "[canvas] subscribe: removing shape from canvas", { obj });
          state.fabricCanvas.remove(obj);
        }
      });
      state.fabricCanvas?.renderAll();
      log("DEBUG", "[canvas] store.subscribe: canvas.renderAll called");
      dumpCanvasObjects("store.subscribe-after-sync");
    });

    if (getState().imageObj) {
      log("DEBUG", "[canvas] buildCanvasPanel: imageObj present, loading background image", { imageObj: getState().imageObj });
      updateBackgroundImage(containerDiv, element);
      prevImageObj = getState().imageObj;
      prevImageURL = getState().imageURL;
    }

    // Cleanup on panel destroy (if MiniLayout provides an event API)
    if (typeof element.on === "function") {
      element.on("destroy", () => {
        try { detachOutlines && detachOutlines(); } catch {}
        try { detachConstraints && detachConstraints(); } catch {}
        try { detachIos && detachIos(); } catch {}
        try { canvas.dispose && canvas.dispose(); } catch {}
        log("INFO", "[canvas] Canvas panel destroyed (outlines, constraints, iOS suppression detached)");
      });
    }

    log("INFO", "[canvas] Canvas panel initialized (Fabric.js, selection sync, outlines, constraints, iOS suppression)");

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
