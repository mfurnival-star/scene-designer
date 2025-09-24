/**
 * debug.js (STUB / LIGHTWEIGHT)
 * -----------------------------------------------------------
 * Purpose:
 * - Minimal on-demand debug snapshot facility.
 * - Does NOTHING expensive by default.
 * - You selectively request data slices via runDebugCapture({ sections:[...] }).
 *
 * Exported API:
 * - async runDebugCapture(options?) -> { snapshot, text }
 * - registerDebugProvider(name, fn)  // add custom section providers at runtime
 * - listDebugProviders()             // list registered provider names
 *
 * Options (all optional):
 * {
 *   sections: string[]   // e.g. ['scene','selection','fabric','geometry','settings','trace']
 *                        // if omitted → defaults to ['scene','selection']
 *   format: 'json' | 'object'  // default 'object'; if 'json' returns pretty text
 *   copy: boolean        // if true attempts to copy JSON text to clipboard
 *   log: boolean         // if true logs the snapshot at INFO
 * }
 *
 * Extension Model:
 * - Keep this file small. Add ad‑hoc providers via registerDebugProvider
 *   from a dev console or temporary modules without bloating baseline size.
 *
 * Philosophy:
 * - Always safe to leave in production; returns tiny objects unless asked for more.
 * - No hidden heavy geometry or selection tracing unless the relevant section is requested.
 *
 * Manifest Compliance:
 * - ESM only, no global side effects.
 * - Uses log() for all logging.
 *
 * Size Guard: Keep this stub lean (<150 lines). Add large logic in separate impl files if needed.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState } from './state.js';

// ---- Internal Registry ----
const _providers = new Map();

/**
 * Register a debug provider.
 * fn may be sync or async and should return serializable data.
 */
export function registerDebugProvider(name, fn) {
  if (!name || typeof fn !== 'function') {
    log("WARN", "[debug] registerDebugProvider invalid args", { name, fnType: typeof fn });
    return;
  }
  _providers.set(name, fn);
  log("INFO", "[debug] provider registered", { name });
}

/**
 * List provider names (for quick introspection).
 */
export function listDebugProviders() {
  return Array.from(_providers.keys()).sort();
}

// ---- Built‑in Lightweight Providers ----
// Keep each tiny; no heavy looping beyond current state arrays.

registerDebugProvider('scene', () => {
  const s = getState();
  return {
    shapeCount: s.shapes?.length || 0,
    selectedCount: s.selectedShapes?.length || 0,
    hasImage: !!s.imageObj,
    canvasSize: s.fabricCanvas ? {
      w: s.fabricCanvas.getWidth(),
      h: s.fabricCanvas.getHeight()
    } : null
  };
});

registerDebugProvider('selection', () => {
  const s = getState();
  return {
    ids: (s.selectedShapes || []).map(x => x?._id),
    types: (s.selectedShapes || []).map(x => x?._type),
    single: s.selectedShape ? s.selectedShape._id : null
  };
});

registerDebugProvider('settings', () => {
  const s = getState();
  // Return only a shallow subset (avoid dumping everything if it grows)
  const keys = [
    'defaultStrokeWidth', 'defaultStrokeColor', 'defaultFillColor',
    'canvasMaxWidth', 'canvasMaxHeight', 'toolbarUIScale',
    'shapeStartXPercent', 'shapeStartYPercent', 'showDiagnosticLabels',
    'multiDragBox', 'reticleStyle', 'reticleSize', 'DEBUG_LOG_LEVEL'
  ];
  const out = {};
  keys.forEach(k => {
    if (k in (s.settings || {})) out[k] = s.settings[k];
  });
  return out;
});

registerDebugProvider('fabric', () => {
  const c = getState().fabricCanvas;
  if (!c) return { active: null, objects: 0 };
  let activeType = null;
  let activeCount = 0;
  try {
    const active = c.getActiveObject && c.getActiveObject();
    if (active) {
      activeType = active.type;
      if (active.type === 'activeSelection' && Array.isArray(active._objects)) {
        activeCount = active._objects.length;
      } else {
        activeCount = 1;
      }
    }
  } catch {}
  return {
    objects: (c.getObjects && c.getObjects().length) || 0,
    activeType,
    activeCount
  };
});

// geometry + trace providers attempt lazy dynamic imports (optional)
registerDebugProvider('geometry', async () => {
  try {
    const mod = await import('./geometry/shape-rect.js');
    const selMod = await import('./geometry/selection-rects.js');
    const s = getState();
    const first = s.shapes?.[0];
    const bbox = first ? mod.getShapeBoundingBox(first) : null;
    const hull = selMod.getSelectionHullRect ? selMod.getSelectionHullRect(s.selectedShapes, s.fabricCanvas) : null;
    return {
      firstShapeId: first?._id || null,
      firstShapeBbox: bbox,
      selectionHull: hull
    };
  } catch (e) {
    log("WARN", "[debug] geometry provider failed", e);
    return { error: "geometry-load-failed" };
  }
});

registerDebugProvider('trace', async () => {
  // Only if canvas-events exported the trace getter
  try {
    const mod = await import('./canvas-events.js');
    if (typeof mod.getSelectionEventTrace === 'function') {
      const trace = mod.getSelectionEventTrace();
      return {
        recent: trace.slice(-5),
        total: trace.length
      };
    }
    return { error: "no-trace-export" };
  } catch (e) {
    log("WARN", "[debug] trace provider failed", e);
    return { error: "trace-load-failed" };
  }
});

// ---- Core Capture Function ----

/**
 * Collect a debug snapshot.
 * @param {Object} opts
 */
export async function runDebugCapture(opts = {}) {
  const {
    sections = ['scene', 'selection'],
    format = 'object',
    copy = false,
    log: logIt = false
  } = opts;

  const unique = Array.from(new Set(sections)).filter(Boolean);

  const snapshot = {
    meta: {
      time: new Date().toISOString(),
      sections: unique
    },
    data: {}
  };

  for (const name of unique) {
    const provider = _providers.get(name);
    if (!provider) {
      snapshot.data[name] = { error: "unknown-provider" };
      continue;
    }
    try {
      const value = provider.length > 0
        ? await provider() // supports async when function expects no args but returns promise
        : await provider();
      snapshot.data[name] = value;
    } catch (e) {
      snapshot.data[name] = { error: e?.message || 'provider-error' };
      log("WARN", "[debug] provider error", { name, e });
    }
  }

  let text = null;
  if (format === 'json') {
    try {
      text = JSON.stringify(snapshot, null, 2);
    } catch (e) {
      log("ERROR", "[debug] JSON stringify failed", e);
    }
  }

  if (logIt) {
    log("INFO", "[debug] snapshot", snapshot);
  }

  if (copy && text) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        log("INFO", "[debug] snapshot copied to clipboard");
      } else {
        log("WARN", "[debug] clipboard API unavailable");
      }
    } catch (e) {
      log("WARN", "[debug] clipboard copy failed", e);
    }
  }

  return { snapshot, text };
}

// (Optional) Expose helpers for quick console usage without polluting global scope heavily.
// Uncomment only if needed:
// if (typeof window !== 'undefined') {
//   window.__debug = { runDebugCapture, registerDebugProvider, listDebugProviders };
// }

