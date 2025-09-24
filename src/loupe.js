/**
 * loupe.js
 * -----------------------------------------------------------
 * Scene Designer – Loupe (Magnifier) Overlay (ESM ONLY)
 *
 * Purpose:
 * - Provide a magnifying "loupe" lens that follows the pointer over the Fabric canvas.
 * - Renders on an independent overlay canvas stacked above Fabric's upperCanvasEl.
 * - Samples pixels from Fabric's lowerCanvasEl (full scene render) and magnifies them.
 * - Fully DPI- and responsive-zoom aware.
 *
 * Public Export:
 * - installLoupe(canvas, options?) -> detachFn
 *
 * Options (all optional):
 * {
 *   enabled: boolean             // default true
 *   sizePx: number               // lens diameter in CSS px (default 160)
 *   magnification: number        // scale factor (default 2.0)
 *   showCrosshair: boolean       // draw a crosshair in the lens (default true)
 *   borderColor: string          // CSS color for lens border (default '#2176ff')
 *   borderWidthPx: number        // lens border width in CSS px (default 2)
 *   shadow: boolean              // lens shadow (default true)
 * }
 *
 * Behavior:
 * - Pointer tracking attaches to Fabric wrapper (.canvas-container), not the overlay
 *   (overlay has pointer-events:none so Fabric interactions pass through).
 * - Uses getBoundingClientRect() to convert client (CSS) coords to device px source coords
 *   in lowerCanvasEl, accounting for retina scaling safely.
 * - Uses requestAnimationFrame for smooth redraws without spamming on every mouse event.
 * - Non-destructive install: tracks its own listeners and DOM node; multiple calls will
 *   detach any prior loupe before attaching anew.
 *
 * Dependencies:
 * - log.js (log)
 *
 * Notes:
 * - The overlay canvas automatically resizes with the clip host via ResizeObserver.
 * - The loupe can be hidden when the pointer exits the canvas area.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

const META_KEY = '__sceneDesignerLoupe__';

function getWrapper(canvas) {
  return canvas?.lowerCanvasEl?.parentElement || null;
}
function getClipHost(canvas) {
  const w = getWrapper(canvas);
  return w?.parentElement?.classList?.contains('canvas-clip-host') ? w.parentElement : null;
}
function getLowerCanvas(canvas) {
  return canvas?.lowerCanvasEl || null;
}

/**
 * Install the loupe overlay for the given Fabric canvas.
 * Returns a detach function to clean up.
 */
export function installLoupe(canvas, options = {}) {
  const {
    enabled = true,
    sizePx = 160,
    magnification = 2.0,
    showCrosshair = true,
    borderColor = '#2176ff',
    borderWidthPx = 2,
    shadow = true
  } = options || {};

  if (!canvas) {
    log("ERROR", "[loupe] installLoupe: canvas is null/undefined");
    return () => {};
  }

  // If an existing loupe is installed, detach it first
  try {
    const prev = canvas[META_KEY];
    if (prev && typeof prev.detach === 'function') {
      prev.detach();
    }
  } catch {}

  const wrapper = getWrapper(canvas);
  const clipHost = getClipHost(canvas);
  const lower = getLowerCanvas(canvas);

  if (!wrapper || !clipHost || !lower) {
    log("WARN", "[loupe] Missing wrapper/clipHost/lowerCanvas; loupe not installed", {
      hasWrapper: !!wrapper, hasClipHost: !!clipHost, hasLower: !!lower
    });
    return () => {};
  }

  // Create overlay canvas in clip host (above Fabric upper canvas)
  const overlay = document.createElement('canvas');
  overlay.className = 'loupe-overlay';
  overlay.style.position = 'absolute';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '20'; // above Fabric's upperCanvasEl (z-index:1) and wrapper (10)
  clipHost.appendChild(overlay);

  const ctx = overlay.getContext('2d');

  // State
  let liveEnabled = !!enabled;
  let lensSize = Math.max(40, Number(sizePx) || 160); // diameter in CSS px
  let mag = Math.max(1, Number(magnification) || 2);
  let crosshair = !!showCrosshair;
  let lensBorderColor = borderColor || '#2176ff';
  let lensBorderWidth = Math.max(0, Number(borderWidthPx) || 2);
  let lensShadow = !!shadow;

  // Pointer state (CSS px within overlay/clipHost)
  let px = -1;
  let py = -1;
  let inside = false;
  let rafId = 0;

  // Maintain device pixel size of overlay
  function resizeOverlayToHost() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const wCss = Math.max(1, Math.floor(clipHost.clientWidth || 0));
    const hCss = Math.max(1, Math.floor(clipHost.clientHeight || 0));
    overlay.width = Math.max(1, Math.floor(wCss * dpr));
    overlay.height = Math.max(1, Math.floor(hCss * dpr));
    // We will draw in CSS units by pre-scaling the context
    if (ctx && typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Clear
    if (ctx) ctx.clearRect(0, 0, wCss, hCss);
  }

  // Initial size
  resizeOverlayToHost();

  // Observe host resizing to keep overlay in sync
  let ro = null;
  try {
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => resizeOverlayToHost());
      ro.observe(clipHost);
    }
  } catch {}

  // Helpers: draw the lens at current px,py
  function drawLens() {
    rafId = 0;
    if (!ctx) return;

    const wCss = overlay.clientWidth || clipHost.clientWidth || 0;
    const hCss = overlay.clientHeight || clipHost.clientHeight || 0;

    // Clear full overlay in CSS units (ctx is scaled to DPR)
    ctx.clearRect(0, 0, wCss, hCss);

    if (!liveEnabled || !inside) return;

    // Clamp pointer to host bounds (CSS coords)
    const cx = Math.max(0, Math.min(px, wCss));
    const cy = Math.max(0, Math.min(py, hCss));

    // Compute source rect in DEVICE pixels for lowerCanvasEl
    const rect = lower.getBoundingClientRect();
    const scaleX = rect.width > 0 ? (lower.width / rect.width) : 1;
    const scaleY = rect.height > 0 ? (lower.height / rect.height) : 1;

    // Pointer relative to lowerCanvas CSS box
    const relX = cx - (rect.left - clipHost.getBoundingClientRect().left);
    const relY = cy - (rect.top - clipHost.getBoundingClientRect().top);

    // Convert to device pixels (source coords)
    const srcX = Math.round(relX * scaleX);
    const srcY = Math.round(relY * scaleY);

    // Source region size (device px) corresponding to the magnified lens
    const srcW = Math.max(1, Math.round(lensSize / mag * scaleX)); // careful: scaleX applied twice? No – lensSize is CSS; srcW must be device px
    const srcH = Math.max(1, Math.round(lensSize / mag * scaleY));

    // Source top-left (device px), centered on pointer
    const sx = Math.max(0, Math.min(lower.width - srcW, Math.round(srcX - srcW / 2)));
    const sy = Math.max(0, Math.min(lower.height - srcH, Math.round(srcY - srcH / 2)));

    // Destination rect (CSS px) for the lens content (centered at cx,cy)
    const dx = Math.round(cx - lensSize / 2);
    const dy = Math.round(cy - lensSize / 2);
    const dw = Math.round(lensSize);
    const dh = Math.round(lensSize);

    // Draw magnified image in a circular clip
    ctx.save();
    try {
      // Lens shadow/border pre-setup
      if (lensShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Circular clipping path for the lens
      ctx.beginPath();
      ctx.arc(cx, cy, lensSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw the magnified source into the clipped area
      // Note: drawImage() expects source rect in DEVICE px and dest rect in CSS px (our ctx is CSS-units because of setTransform(dpr,...))
      ctx.drawImage(lower, sx, sy, srcW, srcH, dx, dy, dw, dh);

      // Optional crosshair
      if (crosshair) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // Horizontal
        ctx.moveTo(cx - lensSize * 0.4, cy);
        ctx.lineTo(cx + lensSize * 0.4, cy);
        // Vertical
        ctx.moveTo(cx, cy - lensSize * 0.4);
        ctx.lineTo(cx, cy + lensSize * 0.4);
        ctx.stroke();
        ctx.restore();
      }

      // Border ring (outside the clip; re-stroke path)
      ctx.restore(); // remove clip + shadow for clean border
      if (lensBorderWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, lensSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.strokeStyle = lensBorderColor;
        ctx.lineWidth = lensBorderWidth;
        ctx.stroke();
        ctx.restore();
      }
    } catch (e) {
      ctx.restore();
    }
  }

  // Schedule redraw via RAF
  function queueDraw() {
    if (!rafId) rafId = requestAnimationFrame(drawLens);
  }

  // Pointer handlers on wrapper (not on overlay, to avoid blocking Fabric)
  function onMove(e) {
    try {
      const hostRect = clipHost.getBoundingClientRect();
      px = e.clientX - hostRect.left;
      py = e.clientY - hostRect.top;
      inside = px >= 0 && py >= 0 && px <= hostRect.width && py <= hostRect.height;
      queueDraw();
    } catch {}
  }
  function onEnter() {
    inside = true;
    queueDraw();
  }
  function onLeave() {
    inside = false;
    queueDraw();
  }

  // Attach listeners
  wrapper.addEventListener('pointermove', onMove);
  wrapper.addEventListener('pointerenter', onEnter);
  wrapper.addEventListener('pointerleave', onLeave);

  // Window DPI/responsive changes
  const onWindowChange = () => {
    resizeOverlayToHost();
    queueDraw();
  };
  window.addEventListener('resize', onWindowChange);
  window.addEventListener('orientationchange', onWindowChange);

  // Store meta for non-destructive re-installs
  const meta = {
    overlay,
    detach: cleanup,
    setEnabled(v) { liveEnabled = !!v; queueDraw(); },
    setSize(pxVal) { lensSize = Math.max(40, Number(pxVal) || lensSize); queueDraw(); },
    setMagnification(m) { mag = Math.max(1, Number(m) || mag); queueDraw(); },
    setCrosshair(v) { crosshair = !!v; queueDraw(); },
    setStyle({ borderColor, borderWidthPx, shadow } = {}) {
      if (borderColor) lensBorderColor = borderColor;
      if (borderWidthPx !== undefined) lensBorderWidth = Math.max(0, Number(borderWidthPx) || 0);
      if (shadow !== undefined) lensShadow = !!shadow;
      queueDraw();
    }
  };
  canvas[META_KEY] = meta;

  log("INFO", "[loupe] Installed loupe overlay", {
    sizePx: lensSize,
    magnification: mag,
    crosshair
  });

  // Initial draw (hidden until pointer enters)
  queueDraw();

  function cleanup() {
    try {
      if (rafId) cancelAnimationFrame(rafId);
    } catch {}
    try {
      wrapper.removeEventListener('pointermove', onMove);
      wrapper.removeEventListener('pointerenter', onEnter);
      wrapper.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('orientationchange', onWindowChange);
    } catch {}
    try {
      if (ro) ro.disconnect();
    } catch {}
    try {
      overlay && overlay.remove();
    } catch {}
    try {
      if (canvas[META_KEY]) delete canvas[META_KEY];
    } catch {}
    log("INFO", "[loupe] Loupe overlay detached");
  }

  return cleanup;
}
