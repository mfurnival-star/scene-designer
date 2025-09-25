import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';
import { installLoupe } from './loupe.js';
import { getShapeCenter } from './geometry/shape-rect.js';

const META_KEY = '__sceneDesignerLoupe__';
const HANDLERS_KEY = '__sceneDesignerLoupeControllerHandlers__';

function getLoupeMeta(canvas) {
  return canvas ? canvas[META_KEY] : null;
}

function ensureLoupeInstalled(canvas, initialOptions) {
  const meta = getLoupeMeta(canvas);
  if (meta && typeof meta.detach === 'function') {
    return meta;
  }
  try {
    installLoupe(canvas, initialOptions || {});
    return getLoupeMeta(canvas);
  } catch (e) {
    log("ERROR", "[loupe-controller] Failed to install loupe", e);
    return null;
  }
}

function findFirstSelectedPoint() {
  const sel = getState().selectedShapes || [];
  for (const s of sel) {
    if (s && s._type === 'point') return s;
  }
  return null;
}

function resolveShapeCenter(shape) {
  if (!shape) return null;
  const center = getShapeCenter(shape);
  if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
    return center;
  }
  const left = Number.isFinite(shape.left) ? shape.left : 0;
  const top = Number.isFinite(shape.top) ? shape.top : 0;
  const w = typeof shape.getScaledWidth === 'function'
    ? Number(shape.getScaledWidth()) || 0
    : (Number(shape.width) || 0);
  const h = typeof shape.getScaledHeight === 'function'
    ? Number(shape.getScaledHeight()) || 0
    : (Number(shape.height) || 0);
  return { x: left + w / 2, y: top + h / 2 };
}

function applyVisualSettingsToLoupe(meta, settings) {
  if (!meta) return;
  const size = Number(settings?.loupeSizePx) || 160;
  const mag = Number(settings?.loupeMagnification) || 2;
  const cross = settings?.loupeCrosshair !== false;

  if (typeof meta.setSize === 'function') meta.setSize(size);
  if (typeof meta.setMagnification === 'function') meta.setMagnification(mag);
  if (typeof meta.setCrosshair === 'function') meta.setCrosshair(cross);
}

function applyOffsetAndTetherToLoupe(meta, settings) {
  if (!meta) return;
  const offX = Number.isFinite(settings?.loupeOffsetXPx) ? Number(settings.loupeOffsetXPx) : 140;
  const offY = Number.isFinite(settings?.loupeOffsetYPx) ? Number(settings.loupeOffsetYPx) : -140;
  const smart = settings?.loupeSmartTether !== false;
  const showTether = settings?.loupeShowTether !== false;

  if (typeof meta.setOffset === 'function') meta.setOffset(offX, offY);
  if (typeof meta.setSmartTether === 'function') meta.setSmartTether(!!smart);
  if (typeof meta.setShowTether === 'function') meta.setShowTether(!!showTether);
}

function applyAllLoupeSettings(meta, settings) {
  applyVisualSettingsToLoupe(meta, settings);
  applyOffsetAndTetherToLoupe(meta, settings);
}

let warnedNoAnchorOnce = false;

function detachOurHandlers(canvas) {
  try {
    const list = canvas && canvas[HANDLERS_KEY];
    if (Array.isArray(list)) {
      list.forEach(({ event, fn }) => {
        try { canvas.off(event, fn); } catch {}
      });
      canvas[HANDLERS_KEY] = [];
    }
  } catch (e) {
    log("WARN", "[loupe-controller] Failed detaching prior Fabric handlers", e);
  }
}

export function installLoupeController(canvas) {
  if (!canvas) {
    log("ERROR", "[loupe-controller] installLoupeController: canvas is null/undefined");
    return () => {};
  }

  const s0 = getState().settings || {};
  const initialEnabled = !!s0.loupeEnabled;
  if (initialEnabled) {
    const meta = ensureLoupeInstalled(canvas, {
      enabled: true,
      sizePx: Number(s0.loupeSizePx) || 160,
      magnification: Number(s0.loupeMagnification) || 2,
      showCrosshair: s0.loupeCrosshair !== false,
      offsetXPx: Number.isFinite(s0.loupeOffsetXPx) ? Number(s0.loupeOffsetXPx) : 140,
      offsetYPx: Number.isFinite(s0.loupeOffsetYPx) ? Number(s0.loupeOffsetYPx) : -140,
      smartTether: s0.loupeSmartTether !== false,
      showTether: s0.loupeShowTether !== false
    });
    if (meta) {
      applyAllLoupeSettings(meta, s0);
      const point = findFirstSelectedPoint();
      if (point) {
        const center = resolveShapeCenter(point);
        if (center && typeof meta.setAnchorCanvasPoint === 'function') {
          meta.setAnchorCanvasPoint(center.x, center.y);
          meta.setEnabled(true);
        } else {
          if (!warnedNoAnchorOnce && typeof meta.setAnchorCanvasPoint !== 'function') {
            warnedNoAnchorOnce = true;
            log("WARN", "[loupe-controller] Loupe missing anchor APIs; using pointer mode only (update loupe.js to anchor-capable to attach to Point).");
          }
          meta.setEnabled(true);
        }
      } else {
        meta.setEnabled(false);
      }
    }
  }

  detachOurHandlers(canvas);
  const localHandlers = [];
  const on = (event, fn) => {
    canvas.on(event, fn);
    localHandlers.push({ event, fn });
  };

  const onObjectMoveOrModify = (opt) => {
    try {
      const settings = getState().settings || {};
      if (!settings.loupeEnabled) return;

      const meta = getLoupeMeta(canvas);
      if (!meta) return;

      const point = findFirstSelectedPoint();
      if (!point) {
        meta.setEnabled(false);
        return;
      }

      const target = opt?.target;
      if (target && target !== point) {
        if (target._type !== 'point') return;
      }

      applyOffsetAndTetherToLoupe(meta, settings);

      const center = resolveShapeCenter(point);
      if (center && typeof meta.setAnchorCanvasPoint === 'function') {
        meta.setAnchorCanvasPoint(center.x, center.y);
        meta.setEnabled(true);
      } else {
        if (!warnedNoAnchorOnce && typeof meta.setAnchorCanvasPoint !== 'function') {
          warnedNoAnchorOnce = true;
          log("WARN", "[loupe-controller] Loupe missing anchor APIs; using pointer mode only (update loupe.js).");
        }
        meta.setEnabled(true);
      }
    } catch (e) {
      log("ERROR", "[loupe-controller] onObjectMoveOrModify failed", e);
    }
  };

  on('object:moving', onObjectMoveOrModify);
  on('object:modified', onObjectMoveOrModify);
  canvas[HANDLERS_KEY] = localHandlers;

  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;

    try {
      const settings = state.settings || {};
      const meta = getLoupeMeta(canvas);

      if (details.type === 'setSettings' || details.type === 'setSetting') {
        if (details.type === 'setSetting' && details.key === 'loupeEnabled') {
          const enabled = !!details.value;
          if (enabled) {
            const m = ensureLoupeInstalled(canvas, {
              enabled: true,
              sizePx: Number(settings.loupeSizePx) || 160,
              magnification: Number(settings.loupeMagnification) || 2,
              showCrosshair: settings.loupeCrosshair !== false,
              offsetXPx: Number.isFinite(settings.loupeOffsetXPx) ? Number(settings.loupeOffsetXPx) : 140,
              offsetYPx: Number.isFinite(settings.loupeOffsetYPx) ? Number(settings.loupeOffsetYPx) : -140,
              smartTether: settings.loupeSmartTether !== false,
              showTether: settings.loupeShowTether !== false
            });
            if (m) {
              applyAllLoupeSettings(m, settings);
              const point = findFirstSelectedPoint();
              if (point) {
                const center = resolveShapeCenter(point);
                if (center && typeof m.setAnchorCanvasPoint === 'function') {
                  m.setAnchorCanvasPoint(center.x, center.y);
                  m.setEnabled(true);
                } else {
                  if (!warnedNoAnchorOnce && typeof m.setAnchorCanvasPoint !== 'function') {
                    warnedNoAnchorOnce = true;
                    log("WARN", "[loupe-controller] Loupe missing anchor APIs; using pointer mode only (update loupe.js).");
                  }
                  m.setEnabled(true);
                }
              } else {
                m.setEnabled(false);
              }
            }
          } else {
            if (meta && typeof meta.detach === 'function') {
              meta.detach();
            }
          }
          return;
        }

        const relevantKeys = new Set([
          'loupeSizePx', 'loupeMagnification', 'loupeCrosshair',
          'loupeOffsetXPx', 'loupeOffsetYPx', 'loupeSmartTether', 'loupeShowTether'
        ]);
        const isRelevant =
          (details.type === 'setSetting' && relevantKeys.has(details.key)) ||
          details.type === 'setSettings';

        if (isRelevant && meta) {
          applyAllLoupeSettings(meta, settings);
        }
      }

      if (details.type === 'setSelectedShapes' || details.type === 'setState') {
        const enabled = !!settings.loupeEnabled;
        if (!enabled) {
          if (meta) meta.setEnabled(false);
          return;
        }

        const m = getLoupeMeta(canvas) || ensureLoupeInstalled(canvas, {
          enabled: true,
          sizePx: Number(settings.loupeSizePx) || 160,
          magnification: Number(settings.loupeMagnification) || 2,
          showCrosshair: settings.loupeCrosshair !== false,
          offsetXPx: Number.isFinite(settings.loupeOffsetXPx) ? Number(settings.loupeOffsetXPx) : 140,
          offsetYPx: Number.isFinite(settings.loupeOffsetYPx) ? Number(settings.loupeOffsetYPx) : -140,
          smartTether: settings.loupeSmartTether !== false,
          showTether: settings.loupeShowTether !== false
        });
        if (!m) return;

        applyAllLoupeSettings(m, settings);

        const point = findFirstSelectedPoint();
        if (point) {
          const center = resolveShapeCenter(point);
          if (center && typeof m.setAnchorCanvasPoint === 'function') {
            m.setAnchorCanvasPoint(center.x, center.y);
            m.setEnabled(true);
          } else {
            if (!warnedNoAnchorOnce && typeof m.setAnchorCanvasPoint !== 'function') {
              warnedNoAnchorOnce = true;
              log("WARN", "[loupe-controller] Loupe missing anchor APIs; using pointer mode only (update loupe.js).");
            }
            m.setEnabled(true);
          }
        } else {
          m.setEnabled(false);
        }
      }
    } catch (e) {
      log("ERROR", "[loupe-controller] Subscription handler failed", e);
    }
  });

  log("INFO", "[loupe-controller] Installed (listening to settings + selection + move)");
  return function detach() {
    try { unsub && unsub(); } catch {}
    try { detachOurHandlers(canvas); } catch {}
    try {
      const meta = getLoupeMeta(canvas);
      if (meta && typeof meta.detach === 'function') meta.detach();
    } catch {}
    log("INFO", "[loupe-controller] Detached");
  };
}
