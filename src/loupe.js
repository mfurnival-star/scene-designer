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

  const overlay = document.createElement('canvas');
  overlay.className = 'loupe-overlay';
  overlay.style.position = 'absolute';
  overlay.style.left = '0';
  overlay.style.top = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '20';
  clipHost.appendChild(overlay);

  const ctx = overlay.getContext('2d');

  let liveEnabled = !!enabled;
  let lensSize = Math.max(40, Number(sizePx) || 160);
  let mag = Math.max(1, Number(magnification) || 2);
  let crosshair = !!showCrosshair;
  let lensBorderColor = borderColor || '#2176ff';
  let lensBorderWidth = Math.max(0, Number(borderWidthPx) || 2);
  let lensShadow = !!shadow;
  let lensOffsetX = Number.isFinite(offsetXPx) ? offsetXPx : 140;
  let lensOffsetY = Number.isFinite(offsetYPx) ? offsetYPx : -140;
  let useSmartTether = !!smartTether;
  let drawTether = !!showTether;
  let mode = anchorMode === 'canvasPoint' ? 'canvasPoint' : 'pointer';
  let anchorX = (anchor && Number.isFinite(anchor.x)) ? Number(anchor.x) : 0;
  let anchorY = (anchor && Number.isFinite(anchor.y)) ? Number(anchor.y) : 0;
  let px = -1;
  let py = -1;
  let inside = false;
  let rafId = 0;

  function resizeOverlayToHost() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const wCss = Math.max(1, Math.floor(clipHost.clientWidth || 0));
    const hCss = Math.max(1, Math.floor(clipHost.clientHeight || 0));
    overlay.width = Math.max(1, Math.floor(wCss * dpr));
    overlay.height = Math.max(1, Math.floor(hCss * dpr));
    if (ctx && typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (ctx) ctx.clearRect(0, 0, wCss, hCss);
  }

  resizeOverlayToHost();

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

  function computeSampleCenterCSS() {
    const rect = lower.getBoundingClientRect();
    const hostRect = clipHost.getBoundingClientRect();

    if (mode === 'pointer') {
      return [px, py, rect, hostRect];
    }

    const scale = getScale(canvas);
    const relX = anchorX * scale;
    const relY = anchorY * scale;
    const sx = (rect.left - hostRect.left) + relX;
    const sy = (rect.top - hostRect.top) + relY;
    return [sx, sy, rect, hostRect];
  }

  function computeLensCenterFromOffset(sx, sy, hostWidth, hostHeight) {
    const r = lensSize / 2;
    const candidates = [
      { cx: sx + lensOffsetX, cy: sy + lensOffsetY },
      { cx: sx - lensOffsetX, cy: sy + lensOffsetY },
      { cx: sx + lensOffsetX, cy: sy - lensOffsetY },
      { cx: sx - lensOffsetX, cy: sy - lensOffsetY }
    ];
    function fits(c) {
      return c.cx - r >= 0 && c.cy - r >= 0 && c.cx + r <= hostWidth && c.cy + r <= hostHeight;
    }
    if (useSmartTether) {
      for (const cand of candidates) {
        if (fits(cand)) return cand;
      }
    }
    return {
      cx: Math.min(Math.max(sx + lensOffsetX, r), Math.max(r, hostWidth - r)),
      cy: Math.min(Math.max(sy + lensOffsetY, r), Math.max(r, hostHeight - r))
    };
  }

  function drawLens() {
    rafId = 0;
    if (!ctx) return;

    const wCss = overlay.clientWidth || clipHost.clientWidth || 0;
    const hCss = overlay.clientHeight || clipHost.clientHeight || 0;
    ctx.clearRect(0, 0, wCss, hCss);

    if (!liveEnabled) return;

    const [sx, sy, rect] = computeSampleCenterCSS();
    if (mode === 'pointer') {
      if (!inside) return;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
    }
    const { cx, cy } = computeLensCenterFromOffset(sx, sy, wCss, hCss);
    const scaleX = rect.width > 0 ? (lower.width / rect.width) : 1;
    const scaleY = rect.height > 0 ? (lower.height / rect.height) : 1;
    const relX = sx - (rect.left - clipHost.getBoundingClientRect().left);
    const relY = sy - (rect.top - clipHost.getBoundingClientRect().top);
    const srcX = Math.round(relX * scaleX);
    const srcY = Math.round(relY * scaleY);
    const srcW = Math.max(1, Math.round(lensSize / mag * scaleX));
    const srcH = Math.max(1, Math.round(lensSize / mag * scaleY));
    const sx0 = Math.max(0, Math.min(lower.width - srcW, Math.round(srcX - srcW / 2)));
    const sy0 = Math.max(0, Math.min(lower.height - srcH, Math.round(srcY - srcH / 2)));
    const dx = Math.round(cx - lensSize / 2);
    const dy = Math.round(cy - lensSize / 2);
    const dw = Math.round(lensSize);
    const dh = Math.round(lensSize);

    ctx.save();
    try {
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
      ctx.beginPath();
      ctx.arc(cx, cy, lensSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(lower, sx0, sy0, srcW, srcH, dx, dy, dw, dh);
      if (crosshair) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - lensSize * 0.4, cy);
        ctx.lineTo(cx + lensSize * 0.4, cy);
        ctx.moveTo(cx, cy - lensSize * 0.4);
        ctx.lineTo(cx, cy + lensSize * 0.4);
        ctx.stroke();
        ctx.restore();
      }
    } finally {
      ctx.restore();
    }

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

    if (drawTether) {
      const dxv = sx - cx;
      const dyv = sy - cy;
      const len = Math.hypot(dxv, dyv) || 1;
      const r = lensSize / 2;
      const tx = cx + (dxv / len) * r;
      const ty = cy + (dyv / len) * r;

      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function queueDraw() {
    if (!rafId) rafId = requestAnimationFrame(drawLens);
  }

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

  wrapper.addEventListener('pointermove', onMove);
  wrapper.addEventListener('pointerenter', onEnter);
  wrapper.addEventListener('pointerleave', onLeave);

  const onWindowChange = () => {
    resizeOverlayToHost();
    queueDraw();
  };
  window.addEventListener('resize', onWindowChange);
  window.addEventListener('orientationchange', onWindowChange);

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
      queueDraw();
    },
    setAnchorCanvasPoint(x, y) {
      mode = 'canvasPoint';
      anchorX = Number(x) || 0;
      anchorY = Number(y) || 0;
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

  if (mode === 'canvasPoint') {
    inside = true;
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
