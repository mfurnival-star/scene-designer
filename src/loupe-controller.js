/**
 * loupe-controller.js
 * -----------------------------------------------------------
 * Scene Designer – Loupe Controller (ESM ONLY)
 *
 * Purpose:
 * - Manage the loupe (magnifier) overlay lifecycle based on settings and selection.
 * - When enabled via settings.loupeEnabled, the loupe attaches to the currently
 *   selected Point shape's center. If no Point is selected, loupe is hidden.
 * - Reacts to settings changes (size/magnification/crosshair/offset/tether), selection changes,
 *   and live point movement (Fabric object:moving/modified).
 *
 * Public Export:
 * - installLoupeController(canvas) -> detachFn
 *
 * Behavior:
 * - Non-destructive: tracks its own subscription and overlay; detaches cleanly.
 * - Anchoring:
 *   - Prefers selected Point shape (first Point in selectedShapes).
 *   - For Point shapes, uses group.left/top directly as the center (since Point
 *     groups are center-positioned), instead of unified bbox center.
 *   - For non-Point (future) fallback, uses geometry/shape-rect.getShapeCenter().
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * - loupe.js (installLoupe)
 * - geometry/shape-rect.js (getShapeCenter)
 * -----------------------------------------------------------
 */

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
    // Install with initial options; controller will then configure it live
    installLoupe(canvas, initialOptions || {});
    // installLoupe stores meta under META_KEY
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

// Compute anchor center for a shape
function resolveShapeCenter(shape) {
  if (!shape) return null;
  // Points use center-positioned groups (left/top already at center)
  if (shape._type === 'point') {
    const x = Number.isFinite(shape.left) ? shape.left : 0;
    const y = Number.isFinite(shape.top) ? shape.top : 0;
    return { x, y };
  }
  // Fallback to unified bbox center for other types
  return getShapeCenter(shape);
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
  const smart = settings?.loupeSmartTether !== false; // default true
  const showTether = settings?.loupeShowTether !== false; // default true

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
    log("WARN", "[loupe-controller] Failed detaching prior Fabric handlers (safe to ignore)", e);
  }
}

/**
 * Controller installer.
 * - Subscribes to store to react to settings/selection changes.
 * - Anchors loupe to Point center when enabled; hides when disabled or no Point selected.
 * - Listens to Fabric object:moving/modified to keep loupe centered during drags.
 */
export function installLoupeController(canvas) {
  if (!canvas) {
    log("ERROR", "[loupe-controller] installLoupeController: canvas is null/undefined");
    return () => {};
  }

  // Initial apply
  const s0 = getState().settings || {};
  const initialEnabled = !!s0.loupeEnabled;
  if (initialEnabled) {
    const meta = ensureLoupeInstalled(canvas, {
      enabled: true,
      sizePx: Number(s0.loupeSizePx) || 160,
      magnification: Number(s0.loupeMagnification) || 2,
      showCrosshair: s0.loupeCrosshair !== false,
      // If loupe.js supports these options (new version), they will be honored:
      offsetXPx: Number.isFinite(s0.loupeOffsetXPx) ? Number(s0.loupeOffsetXPx) : 140,
      offsetYPx: Number.isFinite(s0.loupeOffsetYPx) ? Number(s0.loupeOffsetYPx) : -140,
      smartTether: s0.loupeSmartTether !== false,
      showTether: s0.loupeShowTether !== false
    });
    if (meta) {
      // Also apply via setters for backwards compatibility
      applyAllLoupeSettings(meta, s0);

      // Anchor if a Point is selected
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
        // No point selected → hide loupe
        meta.setEnabled(false);
      }
    }
  }

  // Fabric event handlers (scoped, non-destructive)
  detachOurHandlers(canvas);
  const localHandlers = [];
  const on = (event, fn) => {
    canvas.on(event, fn);
    localHandlers.push({ event, fn });
  };

  // Keep loupe centered on the moving selected point
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

      // Only update when the point is the moving target; otherwise, just ensure it's enabled
      const target = opt?.target;
      if (target && target !== point) {
        // Non-point or other object moving – we can skip anchor update to reduce churn
        if (target._type !== 'point') return;
      }

      // Re-apply offsets and tethers if settings changed mid-drag (cheap)
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

  // Attach Fabric listeners for live updates while dragging/after drop
  on('object:moving', onObjectMoveOrModify);
  on('object:modified', onObjectMoveOrModify);
  canvas[HANDLERS_KEY] = localHandlers;

  // Store subscription
  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;

    try {
      const settings = state.settings || {};
      const meta = getLoupeMeta(canvas);

      // Settings changes that affect loupe presence or visuals
      if (details.type === 'setSettings' || details.type === 'setSetting') {
        // Toggle install/remove on loupeEnabled
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
          return; // handled
        }

        // Visual + offset/tether tweaks when any relevant setting changes
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

      // Selection changes: update anchor
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

        // Always ensure settings are applied (cheap idempotent)
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
            // If we cannot anchor, keep it enabled (pointer mode), user can hover to inspect
            m.setEnabled(true);
          }
        } else {
          // No point selected → hide loupe
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
