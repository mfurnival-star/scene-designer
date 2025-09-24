/**
 * canvas-core.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric Canvas Core (ESM ONLY, Image Fit + Panel Resize Integration)
 * Purpose:
 * - Build and manage Fabric canvas panel, sync with store, and dynamically resize
 *   the parent MiniLayout panel/container to fit the image.
 * - Uses MiniLayout API to ensure the panel always matches canvas size.
 * - Clip host: wraps Fabric wrapper to guarantee clipping within the Canvas panel body.
 * - Responsive mode: optionally scales the canvas content (Fabric zoom) to fit the
 *   available panel width on small screens, without breaking input coordinates.
 *
 * Exports:
 *    buildCanvasPanel({ element, title, componentName })
 *
 * Dependencies:
 * - log.js
 * - fabric-wrapper.js ({ Canvas, Image })
 * - state.js
 * - canvas-events.js, canvas-constraints.js, selection-outlines.js
 * - loupe-controller.js (loupe overlay anchored to selected Point via settings)
 * - minilayout.js (for panel resizing API)
 *
 * Logging Policy (reduced noise):
 * - INFO: key lifecycle (panel init/cleanup, background set/cleared).
 * - DEBUG: responsive zoom changes, fallback resize path, store setState (uncommon).
 * - WARN/ERROR: unchanged for failure paths.
 * - No entry/exit spam in hot paths.
 */

import { log } from './log.js';
import { Canvas, Image as FabricImage } from './fabric-wrapper.js';
import {
  getState,
  sceneDesignerStore,
  setFabricCanvas,
  setBgFabricImage,
  setSetting
} from './state.js';
import { installFabricSelectionSync } from './canvas-events.js';
import { installCanvasConstraints } from './canvas-constraints.js';
import { installSelectionOutlines } from './selection-outlines.js';
import { installLoupeController } from './loupe-controller.js';
import { MiniLayout } from './minilayout.js';

/**
 * Remove all previous canvas DOM elements and containers from the panel.
 * Ensures only one Fabric canvas and wrapper exist per panel.
 */
function removeAllCanvasElements(element) {
  if (!element) return;
  // Remove canvases
  element.querySelectorAll('canvas').forEach(c => c.parentNode && c.parentNode.removeChild(c));
  // Remove Fabric wrappers
  element.querySelectorAll('.canvas-container').forEach(div => div.parentNode && div.parentNode.removeChild(div));
  // Remove clip hosts
  element.querySelectorAll('.canvas-clip-host').forEach(div => div.parentNode && div.parentNode.removeChild(div));
}

/**
 * Create a dedicated clipping host to contain Fabric's wrapper and canvases.
 * Ensures the canvas visuals cannot bleed into sibling panels (iOS Safari-safe).
 */
function createClipHost(parent, width, height) {
  const div = document.createElement('div');
  div.className = 'canvas-clip-host';
  div.style.position = 'relative';
  div.style.overflow = 'hidden';
  div.style.width = `${Math.max(1, Number(width) || 600)}px`;
  div.style.height = `${Math.max(1, Number(height) || 400)}px`;
  div.style.maxWidth = '100%';
  div.style.maxHeight = '100%';
  div.style.contain = 'paint';
  div.style.isolation = 'isolate';
  div.style.zIndex = '10';
  parent.appendChild(div);
  return div;
}

/**
 * Create the initial <canvas> that Fabric will wrap.
 * Append to the provided host (clip host).
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
 * Helpers to locate important DOM nodes relative to the Fabric canvas.
 */
function getWrapper(canvas) {
  return canvas?.lowerCanvasEl?.parentElement || null; // .canvas-container
}
function getClipHost(canvas) {
  const w = getWrapper(canvas);
  return w?.parentElement?.classList?.contains('canvas-clip-host') ? w.parentElement : null;
}
function getCanvasPanelBody(canvas) {
  const w = getWrapper(canvas);
  return w?.closest('.minilayout-panel-body') || null;
}

/**
 * Resize MiniLayout panel and .canvas-container to match the canvas.
 * Uses the new API if available; also adjusts our clip host if present.
 */
function resizeMiniLayoutPanel(canvas, width, height) {
  try {
    let layoutInstance = null;
    if (typeof window !== "undefined" && window.layout instanceof MiniLayout) {
      layoutInstance = window.layout;
    }
    if (layoutInstance && typeof layoutInstance.resizePanelBody === "function") {
      layoutInstance.resizePanelBody('CanvasPanel', width, height);
      // Reduced to DEBUG: may be called frequently on image/apply
      log("DEBUG", "[canvas-core] resizePanelBody(CanvasPanel)", { width, height });
    } else {
      // Fallback: resize the wrapper, clip host, and panel body directly
      if (canvas && canvas.lowerCanvasEl) {
        const wrapper = getWrapper(canvas);
        if (wrapper) {
          wrapper.style.width = `${width}px`;
          wrapper.style.height = `${height}px`;
        }
        const clipHost = getClipHost(canvas);
        if (clipHost) {
          clipHost.style.width = `${width}px`;
          clipHost.style.height = `${height}px`;
        }
        const panelBody = getCanvasPanelBody(canvas);
        if (panelBody) {
          panelBody.style.width = `${width}px`;
          panelBody.style.height = `${height}px`;
        }
        const panel = panelBody?.closest('.minilayout-panel');
        if (panel) {
          panel.style.width = `${width}px`;
          panel.style.height = `${height}px`;
          panel.style.flex = "0 0 auto";
        }
        log("DEBUG", "[canvas-core] Fallback panel/container resize", { width, height });
      }
    }
  } catch (e) {
    log("ERROR", "[canvas-core] resizeMiniLayoutPanel failed", e);
  }
}

/**
 * Keep Fabric wrapper and clip host CSS in sync with canvas size.
 * Silent on success; WARN on failure.
 */
function syncWrapperAndHostSizes(canvas) {
  try {
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const wrapper = getWrapper(canvas);
    if (wrapper) {
      wrapper.style.width = `${w}px`;
      wrapper.style.height = `${h}px`;
      // Enforce clipping and stacking
      wrapper.style.position = 'relative';
      wrapper.style.overflow = 'hidden';
      wrapper.style.zIndex = '10';
      wrapper.style.maxWidth = '100%';
      wrapper.style.maxHeight = '100%';
      wrapper.style.contain = 'paint';
      wrapper.style.isolation = 'isolate';
    }
    const clipHost = getClipHost(canvas);
    if (clipHost) {
      clipHost.style.width = `${w}px`;
      clipHost.style.height = `${h}px`;
      clipHost.style.overflow = 'hidden';
      clipHost.style.zIndex = '10';
    }
  } catch (e) {
    log("WARN", "[canvas-core] syncWrapperAndHostSizes failed", e);
  }
}

/**
 * Set upper/lower canvas visual layering to avoid bleeding.
 * Silent on success; WARN on failure.
 */
function enforceLayerZOrder(canvas) {
  try {
    if (canvas.lowerCanvasEl) {
      canvas.lowerCanvasEl.style.position = 'absolute';
      canvas.lowerCanvasEl.style.left = '0';
      canvas.lowerCanvasEl.style.top = '0';
      canvas.lowerCanvasEl.style.zIndex = '0';
    }
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.position = 'absolute';
      canvas.upperCanvasEl.style.left = '0';
      canvas.upperCanvasEl.style.top = '0';
      canvas.upperCanvasEl.style.zIndex = '1';
      canvas.upperCanvasEl.style.background = 'transparent';
    }
    const wrapper = getWrapper(canvas);
    if (wrapper) {
      wrapper.style.position = 'relative';
      wrapper.style.overflow = 'hidden';
      wrapper.style.zIndex = '10';
    }
  } catch (e) {
    log("WARN", "[canvas-core] enforceLayerZOrder failed", e);
  }
}

/**
 * Responsive: scale canvas content to fit panel body width (mobile).
 * - Uses Fabric zoom so pointer math remains correct.
 * - Does NOT change logical canvas width/height.
 * - Adjusts wrapper/clipHost and panel body height to the scaled height.
 * DEBUG only when scale actually changes.
 */
function applyResponsiveViewport(canvas, reason = "") {
  try {
    const settings = getState().settings || {};
    const enabled = settings.canvasResponsive !== false; // default true
    const body = getCanvasPanelBody(canvas);
    const wrapper = getWrapper(canvas);
    const clipHost = getClipHost(canvas);
    if (!body || !wrapper || !clipHost) return;

    const canvasW = canvas.getWidth();
    const canvasH = canvas.getHeight();

    // Available width is body clientWidth (respecting layout column)
    const availableW = Math.max(0, body.clientWidth || body.offsetWidth || 0);
    if (!availableW || !canvasW) return;

    const scale = enabled ? Math.min(1, availableW / canvasW) : 1;

    // Apply Fabric zoom (around origin). Keep translation zero; wrapper clips excess.
    if (typeof canvas.setZoom === "function") {
      const prev = canvas.__responsiveScale || 1;
      if (Math.abs(prev - scale) > 0.0001) {
        canvas.setZoom(scale);
        // Normalize viewportTransform to pure scale (0,0 origin)
        if (Array.isArray(canvas.viewportTransform) && canvas.viewportTransform.length >= 6) {
          canvas.viewportTransform[0] = scale; // a
          canvas.viewportTransform[3] = scale; // d
          canvas.viewportTransform[4] = 0;     // e (x)
          canvas.viewportTransform[5] = 0;     // f (y)
        }
        canvas.__responsiveScale = scale;
        log("DEBUG", "[canvas-core] Responsive zoom applied", { reason, scale, availableW, canvasW });
      }
    }

    // Size the visual host to the scaled height; width follows panel body (100%)
    const scaledH = Math.round(canvasH * (canvas.__responsiveScale || 1));

    // Let the panel/body be fluid in width; hard-set heights to scaledH to avoid overflow
    body.style.width = "100%";
    body.style.height = `${scaledH}px`;

    // Clip host and wrapper follow the body width and scaled height
    clipHost.style.width = "100%";
    clipHost.style.height = `${scaledH}px`;

    wrapper.style.width = "100%";
    wrapper.style.height = `${scaledH}px`;
    wrapper.style.overflow = "hidden";

    // Upper canvas must remain transparent; request a render to honor new zoom
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.background = "transparent";
    }
    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();
  } catch (e) {
    log("ERROR", "[canvas-core] applyResponsiveViewport failed", e);
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

  const maxW = getState().settings?.canvasMaxWidth ?? 600;
  const maxH = getState().settings?.canvasMaxHeight ?? 400;

  if (!url || !imgObj) {
    try {
      canvas.setBackgroundImage(null, () => {
        setBgFabricImage(null);
        if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
        else canvas.renderAll();
        log("INFO", "[canvas-core] Background cleared");
      });
    } catch (e) {
      log("ERROR", "[canvas-core] Clearing background image failed", e);
    }
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

  // Keep layers properly stacked and clipped
  enforceLayerZOrder(canvas);
  syncWrapperAndHostSizes(canvas);

  // Resize the panel and container to fit (non-responsive baseline)
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

      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();

      log("INFO", "[canvas-core] Background image set", {
        imgW: imgObj.naturalWidth,
        imgH: imgObj.naturalHeight,
        canvasW: canvas.getWidth(),
        canvasH: canvas.getHeight()
      });
    });
  } catch (e) {
    log("ERROR", "[canvas-core] Failed to set background via canvas.setBackgroundImage", e);
  }

  // Finally, apply responsive zoom to fit current panel width (if enabled)
  applyResponsiveViewport(canvas, "applyBackgroundImage");
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

    // Keep layers properly stacked and clipped
    enforceLayerZOrder(canvas);
    syncWrapperAndHostSizes(canvas);

    // Resize the panel/container to fit new canvas size (baseline)
    resizeMiniLayoutPanel(canvas, w, h);

    // Scale background image (if present) to 1:1
    const bg = canvas.backgroundImage || getState().bgFabricImage;
    if (bg && imgObj && imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
      bg.set({ left: 0, top: 0, scaleX: 1, scaleY: 1 });
      try { if (typeof bg.setCoords === "function") bg.setCoords(); } catch {}
    }

    if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
    else canvas.renderAll();

    // Responsive pass (after baseline sizes are set)
    applyResponsiveViewport(canvas, "applyCanvasSizeFromSettings");

    log("INFO", "[canvas-core] Canvas size applied", {
      width: canvas.getWidth(),
      height: canvas.getHeight()
    });
  } catch (e) {
    log("ERROR", "[canvas-core] applyCanvasSizeFromSettings failed", e);
  }
}

export function buildCanvasPanel({ element, title, componentName }) {
  if (!element) {
    log("ERROR", "[canvas-core] buildCanvasPanel: element is null/undefined");
    return;
  }

  // Remove all previous canvas elements, wrappers, and clip hosts to guarantee only one canvas per panel
  removeAllCanvasElements(element);

  // Root of this panel body
  element.innerHTML = "";
  element.style.background = "#eaf2fc";
  element.style.overflow = "hidden";
  element.style.position = "relative";

  const initialW = getState().settings?.canvasMaxWidth ?? 600;
  const initialH = getState().settings?.canvasMaxHeight ?? 400;

  // Create a clip host that will contain the Fabric wrapper and clip any overflow
  const clipHost = createClipHost(element, initialW, initialH);

  // Create initial DOM canvas inside the clip host
  const domCanvas = createCanvasElement(clipHost, initialW, initialH);

  // Instantiate Fabric
  const canvas = new Canvas(domCanvas, {
    preserveObjectStacking: true,
    selection: true,
    backgroundColor: 'transparent'
  });

  // Ensure transparent and correctly layered top
  setTimeout(() => {
    enforceLayerZOrder(canvas);
    syncWrapperAndHostSizes(canvas);
  }, 0);

  setFabricCanvas(canvas);

  // Install integrations
  installFabricSelectionSync(canvas);
  const detachConstraints = installCanvasConstraints(canvas);
  const detachOutlines = installSelectionOutlines(canvas);
  const detachLoupe = installLoupeController(canvas); // Loupe overlay controlled by settings + selection (Point anchor)

  // Apply initial sizing from settings (and enforce clipping/stacking)
  applyCanvasSizeFromSettings(canvas);

  const s0 = getState();
  if (s0.imageURL && s0.imageObj) {
    applyBackgroundImage(canvas, s0.imageURL, s0.imageObj);
  }

  if (Array.isArray(s0.shapes) && s0.shapes.length) {
    addAllStoreShapesToCanvas(canvas);
  }

  // Responsive: re-apply on window resize and on setting change
  const onWindowResize = () => applyResponsiveViewport(canvas, "window-resize");
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('orientationchange', onWindowResize);

  let ro = null;
  try {
    // If supported, observe the panel body for width changes
    const body = getCanvasPanelBody(canvas);
    if (body && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => applyResponsiveViewport(canvas, "ResizeObserver"));
      ro.observe(body);
    }
  } catch {}

  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;
    try {
      switch (details.type) {
        case "setImage": {
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
          // Also re-apply responsive (in case canvasResponsive changed)
          applyResponsiveViewport(canvas, "store-setSettings");
          break;
        }
        case "setSetting": {
          if (details.key === "canvasMaxWidth" || details.key === "canvasMaxHeight") {
            applyCanvasSizeFromSettings(canvas);
          } else if (details.key === "canvasResponsive") {
            applyResponsiveViewport(canvas, "store-setSetting");
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
    try { detachLoupe && detachLoupe(); } catch {}
    try {
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onWindowResize);
      if (ro) ro.disconnect();
    } catch {}
    log("INFO", "[canvas-core] Panel cleanup complete");
  };
  if (typeof element.on === "function") {
    try { element.on("destroy", cleanup); } catch {}
  }
  window.addEventListener('beforeunload', cleanup, { once: true });

  log("INFO", "[canvas-core] Canvas panel initialized");
}
