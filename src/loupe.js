/**
 * loupe.js
 * -----------------------------------------------------------
 * Scene Designer – Loupe (Magnifier) Overlay (ESM ONLY)
 *
 * Purpose:
 * - Provide a magnifying "loupe" lens either:
 *   a) following the pointer (default), or
 *   b) attached to a canvas point (e.g., a Point shape center).
 * - Renders on an independent overlay canvas stacked above Fabric's upperCanvasEl.
 * - Samples pixels from Fabric's lowerCanvasEl (full scene render) and magnifies them.
 * - Fully DPI- and responsive-zoom aware.
 * - Tethered display: lens can be offset from the sampled point (e.g., away from finger).
 *   Smart-tether keeps the lens fully on-screen by flipping/clamping near edges.
 *   Optional tether line connects lens rim back to the sample point.
 *
 * Public Export:
 * - installLoupe(canvas, options?) -> detachFn
 *
 * Options (all optional):
 * {
 *   enabled: boolean                 // default true
 *   sizePx: number                   // lens diameter in CSS px (default 160)
 *   magnification: number            // scale factor (default 2.0)
 *   showCrosshair: boolean           // draw a crosshair in the lens (default true)
 *   borderColor: string              // CSS color for lens border (default '#2176ff')
 *   borderWidthPx: number            // lens border width in CSS px (default 2)
 *   shadow: boolean                  // lens shadow (default true)
 *   anchorMode: 'pointer'|'canvasPoint' // default 'pointer'
 *   anchor: { x: number, y: number }    // canvas-space point (used when anchorMode='canvasPoint')
 *   offsetXPx: number                // display offset X (CSS px) from sample point (default 140)
 *   offsetYPx: number                // display offset Y (CSS px) from sample point (default -140)
 *   smartTether: boolean             // auto-flip offsets to keep lens in view (default true)
 *   showTether: boolean              // draw a tether line from lens rim to sample (default true)
 * }
 *
 * Runtime Controls (via meta on canvas.__sceneDesignerLoupe__):
 *   detach()                          → remove loupe
 *   setEnabled(boolean)
 *   setSize(numberPx)
 *   setMagnification(number)
 *   setCrosshair(boolean)
 *   setStyle({ borderColor, borderWidthPx, shadow })
 *   setAnchorPointer()                → switch to pointer tracking
 *   setAnchorCanvasPoint(x, y)        → switch to canvas point anchoring
 *   setOffset(dx, dy)                 → set display offset (CSS px)
 *   setSmartTether(boolean)           → enable/disable smart tethering
 *   setShowTether(boolean)            → show/hide tether line
 *
 * Dependencies:
 * - log.js (log)
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
function getScale(canvas) {
  try {
    if (typeof canvas.getZoom === 'function') {
      const z = canvas.getZoom();
      return Number.isFinite(z) && z > 0 ? z : 1;
    }
  } catch {}
  return 1;
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
    shadow = true,
    anchorMode = 'pointer',
    anchor = null,
    offsetXPx = 140,
    offsetYPx = -140,
    smartTether = true,
    showTether = true
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

  // Offsets and tether behavior
  let lensOffsetX = Number.isFinite(offsetXPx) ? offsetXPx : 140;
  let lensOffsetY = Number.isFinite(offsetYPx) ? offsetYPx : -140;
  let useSmartTether = !!smartTether;
  let drawTether = !!showTether;

  // Anchor state
  let mode = anchorMode === 'canvasPoint' ? 'canvasPoint' : 'pointer';
  let anchorX = (anchor && Number.isFinite(anchor.x)) ? Number(anchor.x) : 0; // canvas-space
  let anchorY = (anchor && Number.isFinite(anchor.y)) ? Number(anchor.y) : 0; // canvas-space

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
      ro = new ResizeObserver(() => {
        resizeOverlayToHost();
        queueDraw();
      });
      ro.observe(clipHost);
    }
  } catch {}

  // Compute sample center in CSS px relative to clipHost
  function computeSampleCenterCSS() {
    // Returns [sx, sy, rectLower, rectHost]
    const rect = lower.getBoundingClientRect();
    const hostRect = clipHost.getBoundingClientRect();

    if (mode === 'pointer') {
      // Pointer-relative: already tracked as CSS px within clip host
      return [px, py, rect, hostRect];
    }

    // Canvas point anchoring: convert canvas-space (anchorX,anchorY) → CSS px
    // Given viewportTransform normalized to scale-only (applyResponsiveViewport sets zero translation),
    // CSS position relative to lower rect's top-left ≈ (anchorX * scale, anchorY * scale)
    const scale = getScale(canvas);
    const relX = anchorX * scale;
    const relY = anchorY * scale;

    // Convert to clipHost-relative CSS px
    const sx = (rect.left - hostRect.left) + relX;
    const sy = (rect.top - hostRect.top) + relY;

    return [sx, sy, rect, hostRect];
  }

  // Determine lens center from sample center with offset and smart tethering
  function computeLensCenterFromOffset(sx, sy, hostWidth, hostHeight) {
    const r = lensSize / 2;

    // Candidate centers by quadrant flipping
    const candidates = [
      { cx: sx + lensOffsetX, cy: sy + lensOffsetY },               // default
      { cx: sx - lensOffsetX, cy: sy + lensOffsetY },               // flip X
      { cx: sx + lensOffsetX, cy: sy - lensOffsetY },               // flip Y
      { cx: sx - lensOffsetX, cy: sy - lensOffsetY }                // flip both
    ];

    // Check if lens circle fully inside [0..hostWidth, 0..hostHeight]
    function fits(c) {
      return c.cx - r >= 0 && c.cy - r >= 0 && c.cx + r <= hostWidth && c.cy + r <= hostHeight;
    }

    if (useSmartTether) {
      for (const cand of candidates) {
        if (fits(cand)) return cand;
      }
    }

    // Fallback: clamp to keep lens fully visible
    return {
      cx: Math.min(Math.max(sx + lensOffsetX, r), Math.max(r, hostWidth - r)),
      cy: Math.min(Math.max(sy + lensOffsetY, r), Math.max(r, hostHeight - r))
    };
  }

  // Helpers: draw the lens at computed center, sampling around sample center
  function drawLens() {
    rafId = 0;
    if (!ctx) return;

    const wCss = overlay.clientWidth || clipHost.clientWidth || 0;
    const hCss = overlay.clientHeight || clipHost.clientHeight || 0;

    // Clear full overlay in CSS units (ctx is scaled to DPR)
    ctx.clearRect(0, 0, wCss, hCss);

    if (!liveEnabled) return;

    const [sx, sy, rect] = computeSampleCenterCSS();

    // If pointer mode but cursor is outside host, hide lens
    if (mode === 'pointer') {
      if (!inside) return;
      // Clamp for safety
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
    }

    // Compute lens center with offset and smart tether
    const { cx, cy } = computeLensCenterFromOffset(sx, sy, wCss, hCss);

    // Compute mapping: CSS to device px for lower canvas
    const scaleX = rect.width > 0 ? (lower.width / rect.width) : 1;
    const scaleY = rect.height > 0 ? (lower.height / rect.height) : 1;

    // relX/Y: sample center relative to lower's CSS box
    const relX = sx - (rect.left - clipHost.getBoundingClientRect().left);
    const relY = sy - (rect.top - clipHost.getBoundingClientRect().top);

    // Convert to device pixels (source coords) centered at sample point
    const srcX = Math.round(relX * scaleX);
    const srcY = Math.round(relY * scaleY);

    // Source region size (device px) corresponding to the magnified lens
    const srcW = Math.max(1, Math.round(lensSize / mag * scaleX));
    const srcH = Math.max(1, Math.round(lensSize / mag * scaleY));

    // Source top-left (device px), centered on the sample
    const sx0 = Math.max(0, Math.min(lower.width - srcW, Math.round(srcX - srcW / 2)));
    const sy0 = Math.max(0, Math.min(lower.height - srcH, Math.round(srcY - srcH / 2)));

    // Destination rect (CSS px) for the lens content (centered at lens center)
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

      // Draw the magnified source into the clipped area (sample center aligns to lens center)
      ctx.drawImage(lower, sx0, sy0, srcW, srcH, dx, dy, dw, dh);

      // Optional crosshair (inside the lens, centered)
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
    } catch (e) {
      // Ensure we restore even if drawImage fails
    } finally {
      ctx.restore();
    }

    // Border ring (outside the clip)
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

    // Optional tether line from lens rim to sample point (outside the clip)
    if (drawTether) {
      const dxv = sx - cx;
      const dyv = sy - cy;
      const len = Math.hypot(dxv, dyv) || 1;
      const r = lensSize / 2;
      // Tangent point on lens rim toward the sample point
      const tx = cx + (dxv / len) * r;
      const ty = cy + (dyv / len) * r;

      ctx.save();
      // Tether styling: subtle, readable over varied backgrounds
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      // Small sample dot (for clarity when finger obscures point)
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Schedule redraw via RAF
  function queueDraw() {
    if (!rafId) rafId = requestAnimationFrame(drawLens);
  }

  // Pointer handlers on wrapper (not on overlay, to avoid blocking Fabric)
  function onMove(e) {
    if (mode !== 'pointer') return;
    try {
      const hostRect = clipHost.getBoundingClientRect();
      px = e.clientX - hostRect.left;
      py = e.clientY - hostRect.top;
      inside = px >= 0 && py >= 0 && px <= hostRect.width && py <= hostRect.height;
      queueDraw();
    } catch {}
  }
  function onEnter() {
    if (mode !== 'pointer') return;
    inside = true;
    queueDraw();
  }
  function onLeave() {
    if (mode !== 'pointer') return;
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
    },
    setAnchorPointer() {
      mode = 'pointer';
      // pointer mode uses 'inside' flag to show/hide
      queueDraw();
    },
    setAnchorCanvasPoint(x, y) {
      mode = 'canvasPoint';
      anchorX = Number(x) || 0;
      anchorY = Number(y) || 0;
      // canvasPoint mode always paints if enabled (ignore 'inside')
      inside = true;
      queueDraw();
    },
    setOffset(dx, dy) {
      if (Number.isFinite(dx)) lensOffsetX = dx;
      if (Number.isFinite(dy)) lensOffsetY = dy;
      queueDraw();
    },
    setSmartTether(v) {
      useSmartTether = !!v;
      queueDraw();
    },
    setShowTether(v) {
      drawTether = !!v;
      queueDraw();
    }
  };
  canvas[META_KEY] = meta;

  log("INFO", "[loupe] Installed loupe overlay", {
    sizePx: lensSize,
    magnification: mag,
    crosshair,
    anchorMode: mode,
    offsetXPx: lensOffsetX,
    offsetYPx: lensOffsetY,
    smartTether: useSmartTether,
    showTether: drawTether
  });

  // Initial draw
  if (mode === 'canvasPoint') {
    inside = true; // always visible when anchored to a point
  }
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
