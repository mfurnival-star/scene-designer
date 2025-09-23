/**
 * debug.js
 * -----------------------------------------------------------
 * Scene Designer – Debug Snapshot Collector (ESM ONLY)
 * Purpose:
 * - Collect a comprehensive, safe-to-share diagnostic snapshot of the app state.
 * - Provide helpers to format the snapshot and copy it to clipboard.
 * - Intended to be invoked from UI (e.g., a "Debug" toolbar button) or programmatically.
 *
 * Public Exports:
 * - collectDebugSnapshot() -> object
 * - formatDebugSnapshot(snapshot, format = 'json') -> string
 * - runDebugCapture(options = { format: 'json', copy: true, log: true }) -> Promise<{ text, snapshot }>
 *
 * Dependencies:
 * - log.js (log)
 * - state.js (getState)
 *
 * Notes:
 * - No external side effects beyond optional clipboard copy and logging.
 * - Does not mutate store or canvas; read-only diagnostics.
 * - Clipboard copy uses navigator.clipboard when available, with a safe fallback.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState } from './state.js';

/**
 * Minimal, non-throwing serialization of arbitrary values.
 */
function safe(val) {
  try {
    if (val === undefined) return null;
    if (val === null) return null;
    if (typeof val === 'function') return `[fn ${val.name || 'anonymous'}]`;
    if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack || '' };
    if (typeof Element !== 'undefined' && val instanceof Element) {
      return `<${val.tagName.toLowerCase()} id="${val.id}" class="${val.className}">`;
    }
    if (typeof val === 'object') {
      // Avoid huge/recursive graphs
      const out = {};
      const keys = Object.keys(val).slice(0, 50);
      for (const k of keys) {
        const v = val[k];
        if (v == null) out[k] = null;
        else if (typeof v === 'object' || typeof v === 'function') {
          // Only shallow-type tag
          out[k] = `[${v.constructor?.name || typeof v}]`;
        } else {
          out[k] = v;
        }
      }
      return out;
    }
    return val;
  } catch {
    return '[unserializable]';
  }
}

function summarizeShape(shape) {
  if (!shape) return null;
  try {
    // Fabric group used as our logical shape
    const kind = shape._type || shape.type || 'unknown';
    const dims = {
      left: round(shape.left),
      top: round(shape.top),
      width: round(shape.width ?? (shape.getScaledWidth ? shape.getScaledWidth() : undefined)),
      height: round(shape.height ?? (shape.getScaledHeight ? shape.getScaledHeight() : undefined)),
      radius: round(shape.radius)
    };
    return {
      id: shape._id || null,
      type: kind,
      label: shape._label || null,
      locked: !!shape.locked,
      selectable: !!shape.selectable,
      angle: round(shape.angle),
      ...dims
    };
  } catch {
    return {
      id: shape?._id || null,
      type: shape?._type || shape?.type || 'unknown'
    };
  }
}

function round(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.round(n * 100) / 100;
}

function summarizeFabricSelection(canvas) {
  try {
    if (!canvas || typeof canvas.getActiveObject !== 'function') {
      return { activeType: null, memberCount: 0, memberIds: [] };
    }
    const active = canvas.getActiveObject();
    if (!active) return { activeType: null, memberCount: 0, memberIds: [] };
    if (active.type === 'activeSelection' && Array.isArray(active._objects)) {
      const ids = active._objects.map(o => o && (o._id || o.id || o.name || o.type)).filter(Boolean);
      return {
        activeType: 'activeSelection',
        memberCount: active._objects.length,
        memberIds: ids
      };
    }
    // Single active object
    return {
      activeType: active.type || 'object',
      memberCount: 1,
      memberIds: [active._id || active.id || active.name || active.type].filter(Boolean)
    };
  } catch (e) {
    return { activeType: 'error', error: safe(e), memberCount: 0, memberIds: [] };
  }
}

function summarizeCanvas(canvas) {
  try {
    if (!canvas) return { present: false };
    const w = typeof canvas.getWidth === 'function' ? canvas.getWidth() : undefined;
    const h = typeof canvas.getHeight === 'function' ? canvas.getHeight() : undefined;
    return {
      present: true,
      width: w,
      height: h,
      devicePixelRatio: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1
    };
  } catch (e) {
    return { present: !!canvas, error: safe(e) };
  }
}

function summarizeBackgroundImage(img) {
  if (!img) return { present: false };
  try {
    return {
      present: true,
      width: round(img.width || img.naturalWidth),
      height: round(img.height || img.naturalHeight),
      scaleX: round(img.scaleX),
      scaleY: round(img.scaleY)
    };
  } catch (e) {
    return { present: true, error: safe(e) };
  }
}

function summarizeSettings(settings) {
  const out = {};
  try {
    if (!settings) return out;
    // Include a focused set first
    const keys = [
      'canvasMaxWidth', 'canvasMaxHeight',
      'defaultStrokeWidth', 'defaultStrokeColor', 'defaultFillColor',
      'reticleStyle', 'reticleSize',
      'toolbarUIScale', 'multiDragBox',
      'DEBUG_LOG_LEVEL', 'LOG_OUTPUT_DEST', 'INTERCEPT_CONSOLE',
      'showDiagnosticLabels'
    ];
    for (const k of keys) {
      if (k in settings) out[k] = settings[k];
    }
    // Also include any FORCE settings flag if present on window (non-fatal usage)
    if (typeof window !== 'undefined') {
      out.__FORCE__ = !!window.SCENE_DESIGNER_FORCE;
      if (window.SCENE_DESIGNER_FORCE_SETTINGS) {
        out.__FORCE_SETTINGS__ = { ...window.SCENE_DESIGNER_FORCE_SETTINGS };
      }
    }
  } catch (e) {
    out.__error = safe(e);
  }
  return out;
}

/**
 * Collect a comprehensive snapshot of current app diagnostics.
 */
export function collectDebugSnapshot() {
  const s = getState();
  const canvas = s.fabricCanvas || null;
  const bgImg = s.bgFabricImage || null;

  const shapesSumm = (Array.isArray(s.shapes) ? s.shapes : []).map(summarizeShape);
  const selectedSumm = (Array.isArray(s.selectedShapes) ? s.selectedShapes : []).map(summarizeShape);

  const fabricSel = summarizeFabricSelection(canvas);
  const canvasSumm = summarizeCanvas(canvas);
  const bgSumm = summarizeBackgroundImage(bgImg);

  const env = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'n/a',
    language: typeof navigator !== 'undefined' ? navigator.language : 'n/a',
    location: typeof window !== 'undefined' ? String(window.location) : 'n/a',
    timeISO: new Date().toISOString()
  };

  const snapshot = {
    meta: {
      tool: 'Scene Designer',
      version: 'debug-snapshot-1',
      timeISO: env.timeISO
    },
    scene: {
      name: s.sceneName || '',
      logic: s.sceneLogic || '',
      shapeCount: shapesSumm.length,
      selectedCount: selectedSumm.length
    },
    settings: summarizeSettings(s.settings || {}),
    canvas: canvasSumm,
    backgroundImage: bgSumm,
    fabricSelection: fabricSel,
    shapes: shapesSumm,
    selectedShapes: selectedSumm,
    ids: {
      shapes: shapesSumm.map(x => x && x.id).filter(Boolean),
      selected: selectedSumm.map(x => x && x.id).filter(Boolean)
    },
    consistencyChecks: buildConsistencyChecks({ shapesSumm, selectedSumm, fabricSel }),
    environment: env
  };

  return snapshot;
}

function buildConsistencyChecks({ shapesSumm, selectedSumm, fabricSel }) {
  try {
    const selIds = new Set((selectedSumm || []).map(s => s && s.id).filter(Boolean));
    const allIds = new Set((shapesSumm || []).map(s => s && s.id).filter(Boolean));
    const missingSel = Array.from(selIds).filter(id => !allIds.has(id));

    const fabricVsStoreMismatch = (() => {
      try {
        const fabricMemberIds = new Set((fabricSel.memberIds || []).map(String));
        const storeSelIds = new Set(Array.from(selIds).map(String));
        if (fabricSel.activeType === 'activeSelection' && fabricSel.memberCount >= 2) {
          const symDiff = new Set([...fabricMemberIds, ...storeSelIds]);
          for (const id of fabricMemberIds) {
            if (storeSelIds.has(id)) symDiff.delete(id);
          }
          for (const id of storeSelIds) {
            if (fabricMemberIds.has(id)) symDiff.delete(id);
          }
          return { mismatch: symDiff.size > 0, differingIds: Array.from(symDiff) };
        }
        return { mismatch: false, differingIds: [] };
      } catch {
        return { mismatch: false, differingIds: [] };
      }
    })();

    return {
      selectedIdsMissingFromStore: missingSel,
      fabricSelectionVsStore: fabricVsStoreMismatch
    };
  } catch {
    return {};
  }
}

/**
 * Format a snapshot for sharing.
 * - 'json' returns prettified JSON.
 * - 'markdown' returns a compact Markdown section with JSON fenced block.
 */
export function formatDebugSnapshot(snapshot, format = 'json') {
  try {
    if (format === 'markdown') {
      const json = JSON.stringify(snapshot, null, 2);
      return [
        '## Scene Designer Debug Snapshot',
        `- Captured: ${snapshot?.meta?.timeISO || new Date().toISOString()}`,
        `- Shapes: ${snapshot?.scene?.shapeCount ?? '?'}, Selected: ${snapshot?.scene?.selectedCount ?? '?'}`,
        '',
        '```json',
        json,
        '```'
      ].join('\n');
    }
    // default json
    return JSON.stringify(snapshot, null, 2);
  } catch (e) {
    log("ERROR", "[debug] formatDebugSnapshot failed", e);
    return String(snapshot);
  }
}

/**
 * Copy text to clipboard with a resilient fallback.
 */
async function copyToClipboard(text) {
  try {
    if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // continue to fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

/**
 * High-level API:
 * - Collects snapshot
 * - Formats it (json|markdown)
 * - Optionally copies to clipboard
 * - Optionally logs a summary + the snapshot
 */
export async function runDebugCapture(options = {}) {
  const {
    format = 'json',
    copy = true,
    log: doLog = true
  } = options;

  const snapshot = collectDebugSnapshot();
  const text = formatDebugSnapshot(snapshot, format);

  let copied = false;
  if (copy) {
    copied = await copyToClipboard(text);
  }

  if (doLog) {
    log("INFO", "[debug] Snapshot collected", {
      copiedToClipboard: copied,
      shapeCount: snapshot?.scene?.shapeCount,
      selectedCount: snapshot?.scene?.selectedCount,
      fabricActiveType: snapshot?.fabricSelection?.activeType,
      fabricMemberCount: snapshot?.fabricSelection?.memberCount
    });
    // Emit the full text as a DEBUG-level log so remote log panes can be used for copy
    log("DEBUG", "[debug] Snapshot text", text);
  }

  return { text, snapshot };
}
