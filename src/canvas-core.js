/**
 * canvas-core.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric Canvas Core (ESM ONLY, Phase 1 – No Regression, Safari-safe background)
 * Purpose:
 * - Build the Canvas panel, wire selection sync, constraints, overlays.
 * - Render background image as a non-selectable Fabric.Image object at z-index 0
 *   instead of using setBackgroundImage (more reliable across Safari/iOS).
 * - Sync store with fabricCanvas and bgFabricImage.
 * - React to state changes: image, shapes, settings.
 *
 * Exports:
 * - buildCanvasPanel({ element, title, componentName })
 *
 * Dependencies:
 * - log.js (logging)
 * - fabric-wrapper.js ({ Canvas, Image })
 * - state.js (getState, sceneDesignerStore, setFabricCanvas, setBgFabricImage)
 * - canvas-events.js (installFabricSelectionSync)
 * - canvas-constraints.js (installCanvasConstraints)
 * - selection-outlines.js (installSelectionOutlines)
 */

import { log } from './log.js';
import { Canvas, Image as FabricImage } from './fabric-wrapper.js';
import {
  getState,
  sceneDesignerStore,
  setFabricCanvas,
  setBgFabricImage
} from './state.js';
import { installFabricSelectionSync } from './canvas-events.js';
import { installCanvasConstraints } from './canvas-constraints.js';
import { installSelectionOutlines } from './selection-outlines.js';

/**
 * Create a child <canvas> element inside the host panel element.
 */
function createCanvasElement(host, width, height) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Number(width) || 600);
  c.height = Math.max(1, Number(height) || 400);
  c.style.display = 'block';
  c.style.width = '100%';
  c.style.height = '100%';
  c.style.background = '#f8fbff';
  host.appendChild(c);
  return c;
}

/**
 * Remove all non-null objects from Fabric canvas (leave only background layer if present).
 */
function clearAllObjects(canvas) {
  try {
    const objs = canvas.getObjects() || [];
    if (!objs.length) return;
    // Keep background layer if we use an object for background
    const keep = objs.filter(o => o && o._isBackgroundLayer);
    const drop = objs.filter(o => !o || !o._isBackgroundLayer);
    drop.forEach(o => canvas.remove(o));
    // Reinsert the kept background at index 0 to be safe
    if (keep.length) {
      keep.forEach(k => {
        try {
          canvas.remove(k);
        } catch {}
      });
      keep.forEach(k => {
        try {
          canvas.insertAt(k, 0, true);
        } catch {}
      });
    }
  } catch {}
}

/**
 * Add all shapes from store to canvas (in order).
 */
function addAllStoreShapesToCanvas(canvas) {
  const shapes = getState().shapes || [];
  shapes.forEach(shape => {
    try {
      if (shape && !canvas.getObjects().includes(shape)) {
        canvas.add(shape);
      }
    } catch (e) {
      log("WARN", "[canvas-core] addAllStoreShapesToCanvas: failed to add shape", { id: shape?._id, error: e });
    }
  });
  if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
  else canvas.renderAll();
}

/**
 * Scale a Fabric image to fill the current canvas size (axis-independent scale).
 */
function scaleImageToCanvas(canvas, img, naturalW, naturalH) {
  try {
    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const iw = Number(naturalW) || img?.width || img?._element?.naturalWidth || 1;
    const ih = Number(naturalH) || img?.height || img?._element?.naturalHeight || 1;
    const scaleX = cw / iw;
    const scaleY = ch / ih;
    img.set({
      left: 0,
      top: 0,
      scaleX,
      scaleY,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false
    });
  } catch (e) {
    log("WARN", "[canvas-core] scaleImageToCanvas failed", e);
  }
}

/**
 * Ensure the background layer object is at z-index 0.
 */
function sendBgToBack(canvas, bg) {
  try {
    if (!canvas || !bg) return;
    // Remove then insert at 0 to guarantee ordering
    canvas.remove(bg);
    canvas.insertAt(bg, 0, true);
  } catch (e) {
    log("WARN", "[canvas-core] sendBgToBack failed", e);
  }
}

/**
 * Clear any background layer object from the canvas and store.
 */
function clearBackgroundLayer(canvas) {
  const curBg = getState().bgFabricImage;
  try {
    if (canvas && curBg && canvas.getObjects().includes(curBg)) {
      canvas.remove(curBg);
    }
  } catch {}
  setBgFabricImage(null);
  if (canvas) {
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  }
  log("INFO", "[canvas-core] Background layer cleared");
}

/**
 * Set or clear the background image as a Fabric.Image object at z-index 0.
 * - Uses the already-loaded HTMLImageElement from state (no extra fetch).
 */
function applyBackgroundImage(canvas, url, imgObj) {
  if (!canvas) return;

  log("DEBUG", "[canvas-core] applyBackgroundImage ENTRY", {
    url,
    hasImgObj: !!imgObj,
    imgComplete: !!(imgObj && imgObj.complete),
    imgNatural: imgObj ? { w: imgObj.naturalWidth, h: imgObj.naturalHeight } : null
  });

  // Clear background
  if (!url || !imgObj) {
    clearBackgroundLayer(canvas);
    log("DEBUG", "[canvas-core] applyBackgroundImage EXIT (cleared)");
    return;
  }

  // Ensure the provided image element is fully loaded
  if (!imgObj.complete || imgObj.naturalWidth <= 0 || imgObj.naturalHeight <= 0) {
    log("WARN", "[canvas-core] Provided HTMLImageElement is not ready; skipping", {
      complete: imgObj?.complete,
      naturalWidth: imgObj?.naturalWidth,
      naturalHeight: imgObj?.naturalHeight
    });
    return;
  }

  // Remove any existing background layer first
  clearBackgroundLayer(canvas);

  try {
    // Build a Fabric image directly from the provided HTMLImageElement
    const bg = new FabricImage(imgObj, {
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false
    });
    bg._isBackgroundLayer = true;
    bg.excludeFromExport = true;

    // Scale to canvas
    scaleImageToCanvas(canvas, bg, imgObj.naturalWidth, imgObj.naturalHeight);

    // Insert at back
    canvas.add(bg);
    sendBgToBack(canvas, bg);

    // Publish to store
    setBgFabricImage(bg);

    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();

    log("INFO", "[canvas-core] Background layer set (object at z=0, no extra fetch)", {
      url,
      imgW: imgObj.naturalWidth,
      imgH: imgObj.naturalHeight,
      canvasW: canvas.getWidth(),
      canvasH: canvas.getHeight()
    });
  } catch (e) {
    log("ERROR", "[canvas-core] Failed to set background layer", e);
  }

  log("DEBUG", "[canvas-core] applyBackgroundImage EXIT");
}

/**
 * Update canvas dimension from settings and re-scale background image layer.
 */
function applyCanvasSizeFromSettings(canvas) {
  try {
    const w = getState().settings?.canvasMaxWidth ?? 600;
    const h = getState().settings?.canvasMaxHeight ?? 400;
    canvas.setWidth(w);
    canvas.setHeight(h);

    // Re-scale current bg image (if any) to new size
    const bg = getState().bgFabricImage;
    const imgObj = getState().imageObj;
    if (bg && imgObj && imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
      scaleImageToCanvas(canvas, bg, imgObj.naturalWidth, imgObj.naturalHeight);
      sendBgToBack(canvas, bg);
    }

    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();

    log("INFO", "[canvas-core] Canvas size applied", { width: canvas.getWidth(), height: canvas.getHeight() });
  } catch (e) {
    log("ERROR", "[canvas-core] applyCanvasSizeFromSettings failed", e);
  }
}

/**
 * Build the main Canvas panel (MiniLayout component factory).
 * Accepts: { element, title, componentName }
 */
export function buildCanvasPanel({ element, title, componentName }) {
  log("INFO", "[canvas-core] buildCanvasPanel ENTRY", {
    elementType: element?.tagName, title, componentName
  });

  if (!element) {
    log("ERROR", "[canvas-core] buildCanvasPanel: element is null/undefined");
    return;
  }

  // Clean host
  element.innerHTML = "";
  element.style.background = "#eaf2fc";
  element.style.overflow = "hidden";
  element.style.position = "relative";

  // Create inner canvas element and Fabric canvas
  const initialW = getState().settings?.canvasMaxWidth ?? 600;
  const initialH = getState().settings?.canvasMaxHeight ?? 400;
  const domCanvas = createCanvasElement(element, initialW, initialH);

  const canvas = new Canvas(domCanvas, {
    preserveObjectStacking: true,
    selection: true,
    backgroundColor: '#f8fbff'
  });

  // Publish canvas to store
  setFabricCanvas(canvas);

  // Install integrations
  installFabricSelectionSync(canvas);
  const detachConstraints = installCanvasConstraints(canvas);
  const detachOutlines = installSelectionOutlines(canvas);

  // Apply size from settings (ensures consistency)
  applyCanvasSizeFromSettings(canvas);

  // Populate initial background image if present
  const s0 = getState();
  if (s0.imageURL && s0.imageObj) {
    log("DEBUG", "[canvas-core] Initial state has image → applying", {
      url: s0.imageURL,
      imgComplete: !!s0.imageObj?.complete,
      imgNatural: { w: s0.imageObj?.naturalWidth, h: s0.imageObj?.naturalHeight }
    });
    applyBackgroundImage(canvas, s0.imageURL, s0.imageObj);
  }

  // Populate initial shapes if present
  if (Array.isArray(s0.shapes) && s0.shapes.length) {
    addAllStoreShapesToCanvas(canvas);
  }

  // Subscribe to store changes
  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;
    try {
      switch (details.type) {
        case "setImage": {
          log("DEBUG", "[canvas-core] Store: setImage received", {
            url: state.imageURL,
            hasImgObj: !!state.imageObj,
            imgComplete: !!state.imageObj?.complete,
            imgNatural: { w: state.imageObj?.naturalWidth, h: state.imageObj?.naturalHeight }
          });
          applyBackgroundImage(canvas, state.imageURL, state.imageObj);
          break;
        }
        case "addShape": {
          const shape = details.shape;
          if (shape) {
            try { canvas.add(shape); } catch (e) {
              log("ERROR", "[canvas-core] Failed to add shape on addShape", e);
            }
            // Keep bg at back
            const bg = getState().bgFabricImage;
            if (bg) sendBgToBack(canvas, bg);
            if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
            else canvas.renderAll();
          }
          break;
        }
        case "removeShape": {
          const shape = details.shape;
          if (shape) {
            try { canvas.remove(shape); } catch {}
            if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
            else canvas.renderAll();
          }
          break;
        }
        case "setShapes": {
          // Replace all shape objects on canvas with the new array (preserve bg layer)
          clearAllObjects(canvas);
          addAllStoreShapesToCanvas(canvas);
          // Ensure bg at back after re-add
          const bg = getState().bgFabricImage;
          if (bg) sendBgToBack(canvas, bg);
          break;
        }
        case "setSettings": {
          // Size might have changed
          applyCanvasSizeFromSettings(canvas);
          break;
        }
        case "setSetting": {
          if (details.key === "canvasMaxWidth" || details.key === "canvasMaxHeight") {
            applyCanvasSizeFromSettings(canvas);
          }
          break;
        }
        default:
          // ignore others
          break;
      }
    } catch (e) {
      log("ERROR", "[canvas-core] Store subscription handler error", e);
    }
  });

  // Cleanup on panel destroy/hot-reload if MiniLayout provides a hook
  const cleanup = () => {
    try { unsub && unsub(); } catch {}
    try { detachConstraints && detachConstraints(); } catch {}
    try { detachOutlines && detachOutlines(); } catch {}
    log("INFO", "[canvas-core] Panel cleanup complete");
  };
  if (typeof element.on === "function") {
    try { element.on("destroy", cleanup); } catch {}
  }
  window.addEventListener('beforeunload', cleanup, { once: true });

  log("INFO", "[canvas-core] Canvas panel built and initialized");
  log("DEBUG", "[canvas-core] buildCanvasPanel EXIT");
}

