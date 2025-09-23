/**
 * canvas-core.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric Canvas Core (ESM ONLY, Phase 1 – Image render fix)
 * Purpose:
 * - Build the Canvas panel and keep it fully functional while we refactor.
 * - Creates Fabric canvas, installs selection sync, constraints, and overlays.
 * - Syncs with store:
 *    - Background image: set/clear/resize on setImage + settings changes
 *    - Shapes: add/remove/replace on store mutations
 * - Exports:
 *    - buildCanvasPanel({ element, title, componentName })
 *
 * Key change (fix):
 * - Render the background as canvas.backgroundImage via canvas.setBackgroundImage(...)
 *   using a Fabric.Image built from the already-loaded HTMLImageElement from state.
 *   This avoids any ambiguity with objects list and has been the most reliable path.
 * - Strong diagnostics to confirm membership and scale each step.
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
  c.style.width = `${c.width}px`;
  c.style.height = `${c.height}px`;
  c.style.background = '#f8fbff';
  host.appendChild(c);
  return c;
}

/**
 * Remove all non-null objects from Fabric canvas (leave background alone).
 */
function clearAllObjects(canvas) {
  try {
    const objs = canvas.getObjects() || [];
    if (objs.length) {
      objs.slice().forEach(o => canvas.remove(o));
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
 * Compute scale to fit the current canvas size (axis-independent scaling).
 */
function computeScaleForCanvas(canvas, naturalW, naturalH) {
  const cw = canvas.getWidth();
  const ch = canvas.getHeight();
  const iw = Number(naturalW) || 1;
  const ih = Number(naturalH) || 1;
  return { scaleX: cw / iw, scaleY: ch / ih };
}

/**
 * Set or clear the background image via canvas.backgroundImage.
 * - Uses an already-loaded HTMLImageElement (state.imageObj); no extra fetch.
 * - Scales to current canvas size.
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
    try {
      canvas.setBackgroundImage(null, () => {
        setBgFabricImage(null);
        if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
        else canvas.renderAll();
        log("INFO", "[canvas-core] Background cleared (canvas.backgroundImage=null)");
      });
    } catch (e) {
      log("ERROR", "[canvas-core] Clearing background image failed", e);
    }
    log("DEBUG", "[canvas-core] applyBackgroundImage EXIT (cleared)");
    return;
  }

  // Ensure provided image element is ready
  if (!imgObj.complete || imgObj.naturalWidth <= 0 || imgObj.naturalHeight <= 0) {
    log("WARN", "[canvas-core] Provided HTMLImageElement is not ready; skipping", {
      complete: imgObj?.complete,
      naturalWidth: imgObj?.naturalWidth,
      naturalHeight: imgObj?.naturalHeight
    });
    return;
  }

  try {
    // Construct a Fabric.Image from the HTMLImageElement (no network)
    const bg = new FabricImage(imgObj, {
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false
    });

    // Scale to the canvas size
    const { scaleX, scaleY } = computeScaleForCanvas(canvas, imgObj.naturalWidth, imgObj.naturalHeight);
    bg.set({ left: 0, top: 0, scaleX, scaleY });

    // Apply as background image
    canvas.setBackgroundImage(bg, () => {
      const applied = canvas.backgroundImage || bg;
      // Ensure our store holds the active background image instance from canvas
      setBgFabricImage(applied);

      // Diagnostics
      const d = {
        url,
        imgW: imgObj.naturalWidth,
        imgH: imgObj.naturalHeight,
        canvasW: canvas.getWidth(),
        canvasH: canvas.getHeight(),
        scaleX: applied.scaleX,
        scaleY: applied.scaleY,
        objectsCount: canvas.getObjects().length
      };

      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();

      log("INFO", "[canvas-core] Background image set via canvas.backgroundImage", d);
    });
  } catch (e) {
    log("ERROR", "[canvas-core] Failed to set background via canvas.setBackgroundImage", e);
  }

  log("DEBUG", "[canvas-core] applyBackgroundImage EXIT");
}

/**
 * Update canvas dimension from settings and re-scale background image.
 */
function applyCanvasSizeFromSettings(canvas) {
  try {
    const w = getState().settings?.canvasMaxWidth ?? 600;
    const h = getState().settings?.canvasMaxHeight ?? 400;

    // Update DOM canvas element css size as well to avoid ambiguous client sizes
    canvas.setWidth(w);
    canvas.setHeight(h);
    if (canvas.lowerCanvasEl) {
      canvas.lowerCanvasEl.style.width = `${w}px`;
      canvas.lowerCanvasEl.style.height = `${h}px`;
    }
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.width = `${w}px`;
      canvas.upperCanvasEl.style.height = `${h}px`;
    }

    // Re-scale current bg image (if any) to new size
    const bg = canvas.backgroundImage || getState().bgFabricImage;
    const imgObj = getState().imageObj;
    if (bg && imgObj && imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
      const { scaleX, scaleY } = computeScaleForCanvas(canvas, imgObj.naturalWidth, imgObj.naturalHeight);
      bg.set({ left: 0, top: 0, scaleX, scaleY });
      try { if (typeof bg.setCoords === "function") bg.setCoords(); } catch {}
    }

    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();

    log("INFO", "[canvas-core] Canvas size applied", {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      objectsCount: canvas.getObjects().length
    });
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
          // Replace all shape objects on canvas with the new array (bg is independent — not in objects list)
          clearAllObjects(canvas);
          addAllStoreShapesToCanvas(canvas);
          break;
        }
        case "setSettings": {
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

