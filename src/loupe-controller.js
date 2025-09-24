/**
 * loupe-controller.js
 * -----------------------------------------------------------
 * Scene Designer – Loupe Controller (ESM ONLY)
 *
 * Purpose:
 * - Manage the loupe (magnifier) overlay lifecycle based on settings and selection.
 * - When enabled via settings.loupeEnabled, the loupe attaches to the currently
 *   selected Point shape's center. If no Point is selected, loupe is hidden.
 * - Reacts to settings changes (size/magnification/crosshair) and selection changes.
 *
 * Public Export:
 * - installLoupeController(canvas) -> detachFn
 *
 * Behavior:
 * - Non-destructive: tracks its own subscription and overlay; detaches cleanly.
 * - Anchoring:
 *   - Prefers selected Point shape (first Point in selectedShapes).
 *   - Computes center via geometry/shape-rect.getShapeCenter().
 *   - Requires an anchor-capable loupe (loupe.js providing setAnchorCanvasPoint).
 *   - If the installed loupe lacks anchor APIs, falls back to enabling/disabling only,
 *     and logs a WARN once.
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
    const detach = installLoupe(canvas, initialOptions || {});
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

function applySettingsToLoupe(meta, settings) {
  if (!meta) return;
  const size = Number(settings?.loupeSizePx) || 160;
  const mag = Number(settings?.loupeMagnification) || 2;
  const cross = settings?.loupeCrosshair !== false;

  if (typeof meta.setSize === 'function') meta.setSize(size);
  if (typeof meta.setMagnification === 'function') meta.setMagnification(mag);
  if (typeof meta.setCrosshair === 'function') meta.setCrosshair(cross);
}

let warnedNoAnchorOnce = false;

/**
 * Controller installer.
 * - Subscribes to store to react to settings/selection changes.
 * - Anchors loupe to Point center when enabled; hides when disabled or no Point selected.
 */
export function installLoupeController(canvas) {
  if (!canvas) {
    log("ERROR", "[loupe-controller] installLoupeController: canvas is null/undefined");
    return () => {};
  }

  // Initial apply
  const initialEnabled = !!getState().settings?.loupeEnabled;
  if (initialEnabled) {
    const meta = ensureLoupeInstalled(canvas, {
      enabled: true,
      sizePx: Number(getState().settings?.loupeSizePx) || 160,
      magnification: Number(getState().settings?.loupeMagnification) || 2,
      showCrosshair: getState().settings?.loupeCrosshair !== false
    });
    if (meta) {
      // Anchor if a Point is selected
      const point = findFirstSelectedPoint();
      if (point) {
        const center = getShapeCenter(point);
        if (center && typeof meta.setAnchorCanvasPoint === 'function') {
          meta.setAnchorCanvasPoint(center.x, center.y);
          meta.setEnabled(true);
        } else {
          // Fallback: enable overlay; pointer mode will be used
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

  // Subscription
  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;

    try {
      const settings = state.settings || {};
      const meta = getLoupeMeta(canvas);

      // Settings changes that affect loupe presence or visuals
      if (details.type === 'setSettings' || details.type === 'setSetting') {
        // Toggle install/remove on loupeEnabled
        if (
          details.type === 'setSetting' &&
          details.key === 'loupeEnabled'
        ) {
          const enabled = !!details.value;
          if (enabled) {
            const m = ensureLoupeInstalled(canvas, {
              enabled: true,
              sizePx: Number(settings.loupeSizePx) || 160,
              magnification: Number(settings.loupeMagnification) || 2,
              showCrosshair: settings.loupeCrosshair !== false
            });
            if (m) {
              // Re-anchor immediately if a Point is selected; else hidden until a Point is selected
              const point = findFirstSelectedPoint();
              if (point) {
                const center = getShapeCenter(point);
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

        // Visual tweaks: size/magnification/crosshair
        if (meta) {
          const relevant =
            (details.type === 'setSetting' &&
              (details.key === 'loupeSizePx' ||
               details.key === 'loupeMagnification' ||
               details.key === 'loupeCrosshair')) ||
            details.type === 'setSettings';
          if (relevant) {
            applySettingsToLoupe(meta, settings);
          }
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
          showCrosshair: settings.loupeCrosshair !== false
        });
        if (!m) return;

        const point = findFirstSelectedPoint();
        if (point) {
          const center = getShapeCenter(point);
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

  log("INFO", "[loupe-controller] Installed (listening to settings + selection)");
  return function detach() {
    try { unsub && unsub(); } catch {}
    try {
      const meta = getLoupeMeta(canvas);
      if (meta && typeof meta.detach === 'function') meta.detach();
    } catch {}
    log("INFO", "[loupe-controller] Detached");
  };
}
