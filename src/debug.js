/**
 * debug.js
 * -----------------------------------------------------------
 * Lightweight, extensible debug snapshot + targeted mobile Safari
 * diagnostics / live patch helpers (added ad‑hoc providers).
 *
 * Exported API:
 *   runDebugCapture(opts)
 *   registerDebugProvider(name, fn)
 *   listDebugProviders()
 *
 * Added Providers (for iOS Settings panel issue):
 *   settingsPanelMetrics   – DOM + flex metrics for Settings panel
 *   tweakpaneStatus        – Detect Tweakpane JS + CSS presence
 *   layoutSnapshot         – All MiniLayout panels (header, flex, heights)
 *   ua                     – User agent / platform info
 *   applySettingsPanelFix  – Idempotent live patch (flex + CSS inject)
 *
 * NOTE: Keep file <500 lines, avoid heavy work unless provider requested.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState } from './state.js';

const _providers = new Map();

export function registerDebugProvider(name, fn) {
  if (!name || typeof fn !== 'function') {
    log("WARN", "[debug] registerDebugProvider invalid args", { name, fnType: typeof fn });
    return;
  }
  _providers.set(name, fn);
  log("INFO", "[debug] provider registered", { name });
}

export function listDebugProviders() {
  return Array.from(_providers.keys()).sort();
}

/* -----------------------------------------------------------
 * Core / existing lightweight providers
 * --------------------------------------------------------- */
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
  const keys = [
    'defaultStrokeWidth','defaultStrokeColor','defaultFillColor',
    'canvasMaxWidth','canvasMaxHeight','toolbarUIScale',
    'shapeStartXPercent','shapeStartYPercent','showDiagnosticLabels',
    'multiDragBox','reticleStyle','reticleSize','DEBUG_LOG_LEVEL',
    'showRightSidebarPanel','showSettingsPanel','showHistoryPanel'
  ];
  const out = {};
  keys.forEach(k => { if (k in (s.settings || {})) out[k] = s.settings[k]; });
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
      } else activeCount = 1;
    }
  } catch {}
  return {
    objects: (c.getObjects && c.getObjects().length) || 0,
    activeType,
    activeCount
  };
});

registerDebugProvider('geometry', async () => {
  try {
    const mod = await import('./geometry/shape-rect.js');
    const selMod = await import('./geometry/selection-rects.js');
    const s = getState();
    const first = s.shapes?.[0];
    const bbox = first ? mod.getShapeBoundingBox(first) : null;
    const hull = selMod.getSelectionHullRect
      ? selMod.getSelectionHullRect(s.selectedShapes, s.fabricCanvas)
      : null;
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

/* -----------------------------------------------------------
 * NEW: iOS Safari Settings Panel Diagnostics
 * --------------------------------------------------------- */

/**
 * Helper: find settings panel root & body safely.
 */
function findSettingsPanelElements() {
  const container = document.getElementById('settings-panel-container');
  const fields = document.getElementById('tweakpane-fields-div');
  const paneRoot = container?.querySelector('.tp-dfw') || null;
  const panel = container?.closest('.minilayout-panel') || null;
  const body = panel?.querySelector('.minilayout-panel-body') || null;
  return { container, fields, paneRoot, panel, body };
}

/**
 * Helper: Ensure flex chain styles for growth (idempotent).
 */
function ensureFlexGrowth(el, styles) {
  if (!el) return false;
  const applied = [];
  Object.entries(styles).forEach(([k, v]) => {
    if (el.style[k] !== v) {
      el.style[k] = v;
      applied.push(k);
    }
  });
  return applied.length > 0;
}

function computeElementMetrics(el) {
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(),
    class: el.className || '',
    flex: cs.flex,
    display: cs.display,
    overflow: cs.overflow,
    height: el.offsetHeight,
    scrollHeight: el.scrollHeight,
    minHeight: cs.minHeight,
    position: cs.position
  };
}

/**
 * settingsPanelMetrics
 * - Captures sizing/flex chain + presence flags.
 */
registerDebugProvider('settingsPanelMetrics', () => {
  if (typeof document === 'undefined') {
    return { error: 'no-dom' };
  }
  const { container, fields, paneRoot, panel, body } = findSettingsPanelElements();
  const metrics = {
    present: {
      container: !!container,
      fields: !!fields,
      paneRoot: !!paneRoot,
      panel: !!panel,
      body: !!body
    },
    metrics: {
      panel: computeElementMetrics(panel),
      body: computeElementMetrics(body),
      container: computeElementMetrics(container),
      fields: computeElementMetrics(fields),
      paneRoot: paneRoot ? {
        children: paneRoot.children.length,
        height: paneRoot.offsetHeight,
        scrollHeight: paneRoot.scrollHeight
      } : null
    }
  };

  metrics.flags = {
    bodyCollapsed: (metrics.metrics.body?.height ?? 0) < 120,
    paneRootEmpty: (paneRoot && paneRoot.children.length === 0),
    paneRootZeroHeight: (paneRoot && paneRoot.offsetHeight < 40),
    fieldsScrollable: (metrics.metrics.fields
      ? metrics.metrics.fields.scrollHeight > metrics.metrics.fields.height
      : false)
  };
  return metrics;
});

/**
 * tweakpaneStatus
 * - Detects JS constructor, CSS presence, root count.
 */
registerDebugProvider('tweakpaneStatus', () => {
  if (typeof document === 'undefined') return { error: 'no-dom' };
  let paneType = 'unknown';
  try {
    // intentionally left minimal; Pane is imported only in settings-ui.js
  } catch {}
  const cssLoaded = [...document.styleSheets].some(s => {
    try { return (s.href || '').includes('tweakpane'); } catch { return false; }
  });
  const rootCount = document.querySelectorAll('#settings-panel-container .tp-dfw').length;
  return {
    paneType,
    cssLoaded,
    rootCount
  };
});

/**
 * layoutSnapshot
 * - Walk all .minilayout-panel elements for comparative sizing.
 */
registerDebugProvider('layoutSnapshot', () => {
  if (typeof document === 'undefined') return { error: 'no-dom' };
  const panels = [...document.querySelectorAll('.minilayout-panel')];
  return panels.map(p => {
    const header = p.querySelector('.minilayout-panel-header');
    const body = p.querySelector('.minilayout-panel-body');
    const hTxt = (header?.textContent || '').trim();
    return {
      title: hTxt || null,
      flex: getComputedStyle(p).flex,
      panelH: p.offsetHeight,
      bodyH: body?.offsetHeight ?? null,
      bodyScrollH: body?.scrollHeight ?? null,
      bodyFlex: body ? getComputedStyle(body).flex : null,
      collapsed: (body?.offsetHeight ?? 0) < 60
    };
  });
});

/**
 * ua
 * - Environment / platform info.
 */
registerDebugProvider('ua', () => {
  if (typeof navigator === 'undefined') return { error: 'no-navigator' };
  const nav = navigator;
  const standalone = (nav && typeof nav === 'object' && 'standalone' in nav) ? nav.standalone : false;
  const touchPoints = (nav && typeof nav === 'object' && 'maxTouchPoints' in nav)
    ? nav.maxTouchPoints
    : null;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    vendor: nav.vendor,
    standalone: !!standalone,
    touchPoints
  };
});

/**
 * applySettingsPanelFix
 * - Attempts in-place remediation for collapsed Settings panel (iOS Safari).
 * - Injects Tweakpane CSS via CDN if missing (non-destructive).
 * - Ensures panel/body/container/fields are flex growable with min-height:0.
 * - Returns actions performed (idempotent).
 */
registerDebugProvider('applySettingsPanelFix', async () => {
  if (typeof document === 'undefined') return { error: 'no-dom' };
  const actions = [];
  const { container, fields, paneRoot, panel, body } = findSettingsPanelElements();

  if (!panel) return { error: 'panel-not-found' };

  // 1. Inject CSS if missing
  const hasTPcss = [...document.styleSheets].some(s => {
    try { return (s.href || '').includes('tweakpane'); } catch { return false; }
  });
  if (!hasTPcss) {
    try {
      if (!document.getElementById('__debug_tp_css_injected')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/tweakpane@4.0.3/dist/tweakpane.css';
        link.id = '__debug_tp_css_injected';
        document.head.appendChild(link);
        actions.push('inject-tweakpane-css');
      }
    } catch (e) {
      actions.push('inject-tweakpane-css-failed');
      log("WARN", "[debug/applySettingsPanelFix] CSS inject failed", e);
    }
  } else {
    actions.push('css-already-present');
  }

  // 2. Ensure panel flex growth
  if (ensureFlexGrowth(panel, {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0%',
    minHeight: '0',
    overflow: 'visible'
  })) actions.push('panel-flex-adjusted');

  // 3. Body growth
  if (body && ensureFlexGrowth(body, {
    flex: '1 1 auto',
    minHeight: '0',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    display: 'flex',
    flexDirection: 'column'
  })) actions.push('panel-body-flex-adjusted');

  // 4. Container
  if (container && ensureFlexGrowth(container, {
    flex: '1 1 auto',
    minHeight: '0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  })) actions.push('container-flex-adjusted');

  // 5. Fields
  if (fields && ensureFlexGrowth(fields, {
    flex: '1 1 auto',
    minHeight: '0',
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch'
  })) actions.push('fields-flex-adjusted');

  // 6. Force a reflow read (diagnostic)
  const beforeAfter = {
    panelH: panel.offsetHeight,
    bodyH: body?.offsetHeight ?? null,
    fieldsH: fields?.offsetHeight ?? null,
    paneRootH: paneRoot?.offsetHeight ?? null
  };

  // 7. If paneRoot exists but zero height, add temp min-height
  if (paneRoot && paneRoot.offsetHeight < 40) {
    paneRoot.style.minHeight = '160px';
    actions.push('paneRoot-minHeight-added');
  }

  return {
    actions,
    metrics: beforeAfter
  };
});

/* -----------------------------------------------------------
 * runDebugCapture
 * --------------------------------------------------------- */
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
        ? await provider()
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

  if (logIt) log("INFO", "[debug] snapshot", snapshot);

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
