/**
 * canvas-core.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric Canvas Core (ESM ONLY, Image Fit + Panel Resize Integration)
 * Purpose:
 * - Build and manage Fabric canvas panel, sync with store, and dynamically resize
 *   the parent MiniLayout panel/container to fit the image.
 * - Uses MiniLayout API to ensure the panel always matches canvas size.
 * - No snippets, full file, Manifesto-compliant.
 *
 * Exports:
 *    buildCanvasPanel({ element, title, componentName })
 *
 * Dependencies:
 * - log.js
 * - fabric-wrapper.js ({ Canvas, Image })
 * - state.js
 * - canvas-events.js, canvas-constraints.js, selection-outlines.js
 * - minilayout.js (for panel resizing API)
 */

import { log } from './log.js';
import { Canvas, Image as FabricImage } from './fabric-wrapper.js';
import {
  getState,
  sceneDesignerStore,
  setFabricCanvas,
  setBgFabricImage,
  setSettings,
  setSetting
} from './state.js';
import { installFabricSelectionSync } from './canvas-events.js';
import { installCanvasConstraints } from './canvas-constraints.js';
import { installSelectionOutlines } from './selection-outlines.js';
import { MiniLayout } from './minilayout.js';

function createCanvasElement(host, width, height) {
  const c = document.createElement('canvas');
  // Initial size; Fabric will manage retina/backing store after it takes over.
  c.width = Math.max(1, Number(width) || 600);
  c.height = Math.max(1, Number(height) || 400);
  c.style.display = 'block';
  c.style.width = `${c.width}px`;
  c.style.height = `${c.height}px`;
  c.style.background = '#f8fbff';
  host.appendChild(c);
  return c;
}

function clearAllObjects(canvas) {
  try {
    const objs = canvas.getObjects() || [];
    if (objs.length) {
      objs.slice().forEach(o => canvas.remove(o));
    }
  } catch {}
}

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
 * Compute canvas size for an image, preserving aspect ratio, within max settings.
 * Returns {width, height, scale}
 */
function fitImageToMax(imageW, imageH, maxW, maxH) {
  let scale = 1;
  let w = imageW;
  let h = imageH;
  if (w > maxW) {
    scale = maxW / w;
    w = maxW;
    h = Math.round(imageH * scale);
  }
  if (h > maxH) {
    scale = maxH / h;
    h = maxH;
    w = Math.round(imageW * scale);
  }
  return { width: w, height: h, scale };
}

/**
 * Resize MiniLayout panel and .canvas-container to match the canvas.
 * Uses the new API if available.
 */
function resizeMiniLayoutPanel(canvas, width, height) {
  try {
    let layoutInstance = null;
    if (typeof window !== "undefined" && window.layout instanceof MiniLayout) {
      layoutInstance = window.layout;
    }
    if (layoutInstance && typeof layoutInstance.resizePanelBody === "function") {
      layoutInstance.resizePanelBody('CanvasPanel', width, height);
      log("INFO", "[canvas-core] resizePanelBody(CanvasPanel)", { width, height });
    } else {
      // Fallback: resize the container and panel body directly
      if (canvas && canvas.lowerCanvasEl) {
        const container = canvas.lowerCanvasEl.parentElement;
        if (container) {
          container.style.width = `${width}px`;
          container.style.height = `${height}px`;
        }
        const panelBody = container?.closest('.minilayout-panel-body');
        if (panelBody) {
          panelBody.style.width = `${width}px`;
          panelBody.style.height = `${height}px`;
        }
        const panel = container?.closest('.minilayout-panel');
        if (panel) {
          panel.style.width = `${width}px`;
          panel.style.height = `${height}px`;
          panel.style.flex = "0 0 auto";
        }
        log("INFO", "[canvas-core] Fallback panel/container resize", { width, height });
      }
    }
  } catch (e) {
    log("ERROR", "[canvas-core] resizeMiniLayoutPanel failed", e);
  }
}

/**
 * Set or clear the background image via canvas.backgroundImage.
 * When image is set, resize canvas AND panel to image's aspect ratio.
 *
 * IMPORTANT: Do NOT manually set lowerCanvasEl/upperCanvasEl width/height attributes.
 * Fabric handles backing store size (retinaScaling) internally; overriding those values
 * causes input/pointer and selection offsets on high-DPI displays (iOS Safari).
 */
function applyBackgroundImage(canvas, url, imgObj) {
  if (!canvas) return;

  log("DEBUG", "[canvas-core] applyBackgroundImage ENTRY", {
    url,
    hasImgObj: !!imgObj,
    imgComplete: !!(imgObj && imgObj.complete),
    imgNatural: imgObj ? { w: imgObj.naturalWidth, h: imgObj.naturalHeight } : null
  });

  const maxW = getState().settings?.canvasMaxWidth ?? 600;
  const maxH = getState().settings?.canvasMaxHeight ?? 400;

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

  if (!imgObj.complete || imgObj.naturalWidth <= 0 || imgObj.naturalHeight <= 0) {
    log("WARN", "[canvas-core] Provided HTMLImageElement is not ready; skipping", {
      complete: imgObj?.complete,
      naturalWidth: imgObj?.naturalWidth,
      naturalHeight: imgObj?.naturalHeight
    });
    return;
  }

  // Compute new canvas size for this image
  const { width: newCanvasW, height: newCanvasH } = fitImageToMax(
    imgObj.naturalWidth,
    imgObj.naturalHeight,
    maxW,
    maxH
  );

  // Let Fabric manage backstore/CSS + retinaScaling via its API
  canvas.setWidth(newCanvasW);
  canvas.setHeight(newCanvasH);

  // Ensure upper canvas remains transparent (don’t touch sizes)
  if (canvas.upperCanvasEl) {
    canvas.upperCanvasEl.style.background = "transparent";
  }

  // Resize the panel and container to fit
  resizeMiniLayoutPanel(canvas, newCanvasW, newCanvasH);

  // Reflect the applied size back into settings (so a rebuild uses the same size)
  setSetting("canvasMaxWidth", newCanvasW);
  setSetting("canvasMaxHeight", newCanvasH);

  try {
    const bg = new FabricImage(imgObj, {
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false
    });

    bg.set({ left: 0, top: 0, scaleX: 1, scaleY: 1 });

    canvas.setBackgroundImage(bg, () => {
      const applied = canvas.backgroundImage || bg;
      setBgFabricImage(applied);

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
 * If an image is present, canvas should keep image's aspect ratio.
 * Also resize MiniLayout panel/container.
 *
 * IMPORTANT: We only use Fabric's setWidth/setHeight. We do NOT write to
 * lowerCanvasEl/upperCanvasEl width/height attributes to preserve retina scaling.
 */
function applyCanvasSizeFromSettings(canvas) {
  try {
    const imgObj = getState().imageObj;
    let w = getState().settings?.canvasMaxWidth ?? 600;
    let h = getState().settings?.canvasMaxHeight ?? 400;

    if (imgObj && imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
      const fit = fitImageToMax(imgObj.naturalWidth, imgObj.naturalHeight, w, h);
      w = fit.width;
      h = fit.height;
    }

    canvas.setWidth(w);
    canvas.setHeight(h);

    // Keep upper canvas transparent; do not change sizes directly
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.background = "transparent";
    }

    // Resize the panel/container to fit new canvas size
    resizeMiniLayoutPanel(canvas, w, h);

    // Scale background image (if present) to 1:1
    const bg = canvas.backgroundImage || getState().bgFabricImage;
    if (bg && imgObj && imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
      bg.set({ left: 0, top: 0, scaleX: 1, scaleY: 1 });
      try { if (typeof bg.setCoords === "function") bg.setCoords(); } catch {}
    }

    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();

    log("INFO", "[canvas-core] Canvas size applied", {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      retinaScaling: (typeof canvas.getRetinaScaling === 'function') ? canvas.getRetinaScaling() : undefined,
      objectsCount: canvas.getObjects().length
    });
  } catch (e) {
    log("ERROR", "[canvas-core] applyCanvasSizeFromSettings failed", e);
  }
}

export function buildCanvasPanel({ element, title, componentName }) {
  log("INFO", "[canvas-core] buildCanvasPanel ENTRY", {
    elementType: element?.tagName, title, componentName
  });

  if (!element) {
    log("ERROR", "[canvas-core] buildCanvasPanel: element is null/undefined");
    return;
  }

  element.innerHTML = "";
  element.style.background = "#eaf2fc";
  element.style.overflow = "hidden";
  element.style.position = "relative";

  const initialW = getState().settings?.canvasMaxWidth ?? 600;
  const initialH = getState().settings?.canvasMaxHeight ?? 400;
  const domCanvas = createCanvasElement(element, initialW, initialH);

  const canvas = new Canvas(domCanvas, {
    preserveObjectStacking: true,
    selection: true,
    backgroundColor: 'transparent'
  });

  // Ensure transparent top layer
  setTimeout(() => {
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.background = "transparent";
    }
  }, 0);

  setFabricCanvas(canvas);

  installFabricSelectionSync(canvas);
  const detachConstraints = installCanvasConstraints(canvas);
  const detachOutlines = installSelectionOutlines(canvas);

  applyCanvasSizeFromSettings(canvas);

  const s0 = getState();
  if (s0.imageURL && s0.imageObj) {
    log("DEBUG", "[canvas-core] Initial state has image → applying", {
      url: s0.imageURL,
      imgComplete: !!s0.imageObj?.complete,
      imgNatural: { w: s0.imageObj?.naturalWidth, h: s0.imageObj?.naturalHeight }
    });
    applyBackgroundImage(canvas, s0.imageURL, s0.imageObj);
  }

  if (Array.isArray(s0.shapes) && s0.shapes.length) {
    addAllStoreShapesToCanvas(canvas);
  }

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

