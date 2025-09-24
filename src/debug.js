/**
 * debug.js
 * -----------------------------------------------------------
 * Scene Designer – Debug Snapshot Collector (ESM ONLY)
 *
 * Purpose:
 * - Collect a diagnostic snapshot of app state, Fabric selection state, DOM layout geometry,
 *   responsive scaling, and selection synchronization traces.
 *
 * 2025-09-24 (debug-snapshot-5):
 * - VERSION bump: debug-snapshot-5
 * - Added direct selection trace ingestion via getSelectionEventTrace() (canvas-events.js ring buffer).
 * - Keeps legacy (patched) log interception fallback; merges and de‑duplicates events (time+event+ids).
 * - Added scaledCanvas metrics (logical vs scaled dimensions).
 * - Added bleed tolerance evaluation (upperOutsideCanvasPanelTolerant) – ignores small differences caused
 *   by responsive zoom rounding and panel sizing (configurable thresholds).
 * - Added tolerantBleed block summarizing raw vs tolerant flags.
 * - Hardened clipboard copy fallback.
 * - Narrowed hook patching (no longer forcibly overrides global log each snapshot; interception
 *   is still supported but now secondary to direct trace).
 *
 * Phase 1 Completion Patch (2025-09-24):
 * - Unified single-shape geometry: width/height now sourced from geometry/shape-rect.js instead of
 *   ad-hoc shape.width / shape.getScaledWidth / radius logic.
 * - Added aspectRatio, outerRadius, geometrySource to shape summaries.
 * - Ensures future transform model changes (Phase 2+) only need updates in geometry helpers.
 *
 * Earlier history:
 * - debug-snapshot-4b: force log hook (selectionSyncLog)
 * - debug-snapshot-4: selectionDiagnostics section (order / membership / locks / flags)
 * - debug-snapshot-3: DOM bleed indicators
 * - debug-snapshot-2: initial structured snapshot improvements
 *
 * Public Exports:
 * - collectDebugSnapshot()
 * - formatDebugSnapshot(snapshot, format='json'|'markdown')
 * - runDebugCapture({ format='json', copy=true, log=true })
 *
 * Dependencies:
 * - log.js (origLog)
 * - state.js (getState)
 * - canvas-events.js (getSelectionEventTrace)
 * - geometry/shape-rect.js (getShapeBoundingBox, getShapeAspectRatio, getShapeOuterRadius)  ← Phase 1 unified geometry
 *
 * NOTE:
 * - Legacy interception support retained for backward compatibility.
 */

import { log as origLog } from './log.js';
import { getState } from './state.js';
import { getSelectionEventTrace } from './canvas-events.js';
import {
  getShapeBoundingBox,
  getShapeAspectRatio,
  getShapeOuterRadius
} from './geometry/shape-rect.js';

/* ---------- Legacy Intercepted Selection Sync Log (fallback) ---------- */
let legacyInterceptLog = [];
let legacyHookInstalled = false;

/**
 * Install a lightweight interception hook ONLY ONCE if not already installed.
 * This is now fallback only; primary trace source is getSelectionEventTrace().
 */
function ensureLegacyLogHook() {
  if (legacyHookInstalled) return;
  legacyHookInstalled = true;

  function patched(level, msg, obj) {
    try {
      if (typeof msg === 'string' && msg.startsWith('[canvas-events] selection:')) {
        const st = getState();
        legacyInterceptLog.push({
          timeISO: new Date().toISOString(),
          event: msg.includes('created') ? 'selection:created'
            : msg.includes('updated') ? 'selection:updated'
              : msg.includes('cleared') ? 'selection:cleared'
                : 'selection:other',
          raw: msg,
          idsStore: (st.selectedShapes || []).map(s => s?._id),
          idsAll: (st.shapes || []).map(s => s?._id),
          level
        });
        if (legacyInterceptLog.length > 25) legacyInterceptLog.shift();
      }
    } catch {/* ignore */}
    return origLog(level, msg, obj);
  }

  if (typeof window !== 'undefined' && window.log === origLog) {
    window.log = patched;
  }
}

/* ---------- Safe helpers ---------- */
function safe(val) {
  try {
    if (val == null) return null;
    if (typeof val === 'function') return `[fn ${val.name || 'anonymous'}]`;
    if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack || '' };
    if (typeof Element !== 'undefined' && val instanceof Element) {
      return `<${val.tagName.toLowerCase()} id="${val.id}" class="${val.className}">`;
    }
    if (typeof val === 'object') {
      const out = {};
      Object.keys(val).slice(0, 40).forEach(k => {
        const v = val[k];
        if (v == null) out[k] = null;
        else if (typeof v === 'object' || typeof v === 'function') out[k] = `[${v.constructor?.name || typeof v}]`;
        else out[k] = v;
      });
      return out;
    }
    return val;
  } catch {
    return '[unserializable]';
  }
}
const round = n => (typeof n === 'number' && Number.isFinite(n)) ? Math.round(n * 100) / 100 : undefined;

/* ---------- Shape summary (Unified Geometry) ---------- */
function summarizeShape(shape) {
  if (!shape) return null;
  try {
    const bbox = getShapeBoundingBox(shape);
    const aspectRatio = getShapeAspectRatio(shape);
    const outerRadius = getShapeOuterRadius(shape);
    return {
      id: shape._id || null,
      type: shape._type || shape.type || 'unknown',
      label: shape._label || null,
      locked: !!shape.locked,
      selectable: !!shape.selectable,
      angle: round(shape.angle),
      left: round(shape.left),
      top: round(shape.top),
      width: bbox ? round(bbox.width) : undefined,
      height: bbox ? round(bbox.height) : undefined,
      geometrySource: bbox ? bbox.source : 'none',
      aspectRatio: aspectRatio !== null ? round(aspectRatio) : null,
      outerRadius: outerRadius !== null ? round(outerRadius) : null
    };
  } catch {
    return { id: shape?._id || null, type: shape?._type || shape?.type || 'unknown' };
  }
}

/* ---------- Fabric selection summary ---------- */
function summarizeFabricSelection(canvas) {
  try {
    if (!canvas || typeof canvas.getActiveObject !== 'function') {
      return { activeType: null, memberCount: 0, memberIds: [] };
    }
    const active = canvas.getActiveObject();
    if (!active) return { activeType: null, memberCount: 0, memberIds: [] };
    if (active.type === 'activeSelection' && Array.isArray(active._objects)) {
      return {
        activeType: 'activeSelection',
        memberCount: active._objects.length,
        memberIds: active._objects.map(o => o && (o._id || o.id || o.name || o.type)).filter(Boolean)
      };
    }
    return {
      activeType: active.type || 'object',
      memberCount: 1,
      memberIds: [active._id || active.id || active.name || active.type].filter(Boolean)
    };
  } catch (e) {
    return { activeType: 'error', error: safe(e), memberCount: 0, memberIds: [] };
  }
}

/* ---------- Canvas / Background summaries ---------- */
function summarizeCanvas(canvas) {
  try {
    if (!canvas) return { present: false };
    const logicalW = typeof canvas.getWidth === 'function' ? canvas.getWidth() : undefined;
    const logicalH = typeof canvas.getHeight === 'function' ? canvas.getHeight() : undefined;
    const scale = canvas.__responsiveScale || 1;
    return {
      present: true,
      width: logicalW,
      height: logicalH,
      scaledWidth: logicalW != null ? round(logicalW * scale) : undefined,
      scaledHeight: logicalH != null ? round(logicalH * scale) : undefined,
      responsiveScale: scale,
      devicePixelRatio: (typeof canvas.getRetinaScaling === 'function')
        ? canvas.getRetinaScaling()
        : (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
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
    [
      'canvasMaxWidth','canvasMaxHeight',
      'defaultStrokeWidth','defaultStrokeColor','defaultFillColor',
      'reticleStyle','reticleSize',
      'toolbarUIScale','multiDragBox','canvasResponsive',
      'DEBUG_LOG_LEVEL','LOG_OUTPUT_DEST','INTERCEPT_CONSOLE',
      'showDiagnosticLabels'
    ].forEach(k => { if (k in settings) out[k] = settings[k]; });
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

/* ---------- DOM Layout + Bleed ---------- */
function getEl(selOrEl) {
  if (!selOrEl) return null;
  if (typeof Element !== 'undefined' && selOrEl instanceof Element) return selOrEl;
  if (typeof document === 'undefined') return null;
  try { return document.querySelector(String(selOrEl)); } catch { return null; }
}
function rectOf(el) {
  try {
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left), top: Math.round(r.top),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
      width: Math.round(r.width), height: Math.round(r.height)
    };
  } catch { return null; }
}
function styleSummary(el) {
  try {
    if (!el || typeof window === 'undefined' || !window.getComputedStyle) return null;
    const cs = window.getComputedStyle(el);
    return {
      position: cs.position,
      overflow: cs.overflow,
      overflowX: cs.overflowX,
      overflowY: cs.overflowY,
      zIndex: cs.zIndex,
      contain: cs.contain,
      isolation: cs.isolation,
      clipPath: cs.clipPath,
      background: cs.backgroundColor || cs.background
    };
  } catch { return null; }
}
function canvasLayerMetrics(el) {
  try {
    if (!el) return null;
    const cs = (typeof window !== 'undefined' && window.getComputedStyle) ? window.getComputedStyle(el) : null;
    return {
      present: true,
      attrW: Number(el.width) || null,
      attrH: Number(el.height) || null,
      cssW: cs ? Number(parseFloat(cs.width)) : null,
      cssH: cs ? Number(parseFloat(cs.height)) : null,
      position: cs ? cs.position : null,
      zIndex: cs ? cs.zIndex : null,
      background: cs ? (cs.backgroundColor || cs.background) : null
    };
  } catch {
    return { present: !!el };
  }
}
const rectsIntersect = (a,b) => !!(a && b) && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
const rectContains = (outer, inner) => !!(outer && inner) &&
  inner.left >= outer.left && inner.top >= outer.top &&
  inner.right <= outer.right && inner.bottom <= outer.bottom;

function collectDomLayout(canvas) {
  try {
    const dpr = (typeof window !== 'undefined') ? (window.devicePixelRatio || 1) : 1;
    const upper = canvas?.upperCanvasEl || null;
    const lower = canvas?.lowerCanvasEl || null;
    const wrapper = lower?.parentElement || null;
    const clipHost = wrapper?.parentElement?.classList?.contains('canvas-clip-host') ? wrapper.parentElement : null;
    const canvasBody = getEl('.minilayout-panel-body--canvaspanel');
    const toolbarBody = getEl('.minilayout-panel-body--canvastoolbarpanel');
    const settingsBody = getEl('.minilayout-panel-body--settingspanel');
    const rects = {
      upperCanvas: rectOf(upper),
      lowerCanvas: rectOf(lower),
      wrapper: rectOf(wrapper),
      clipHost: rectOf(clipHost),
      canvasBody: rectOf(canvasBody),
      toolbarBody: rectOf(toolbarBody),
      settingsBody: rectOf(settingsBody)
    };
    const bleedIndicators = {
      upperOverlapsToolbar: rectsIntersect(rects.upperCanvas, rects.toolbarBody),
      upperOverlapsSettings: rectsIntersect(rects.upperCanvas, rects.settingsBody),
      wrapperOverlapsToolbar: rectsIntersect(rects.wrapper, rects.toolbarBody),
      wrapperOverlapsSettings: rectsIntersect(rects.wrapper, rects.settingsBody),
      upperOutsideCanvasPanel: !!(rects.upperCanvas && rects.canvasBody && !rectContains(rects.canvasBody, rects.upperCanvas)),
      wrapperOutsideCanvasPanel: !!(rects.wrapper && rects.canvasBody && !rectContains(rects.canvasBody, rects.wrapper))
    };
    return {
      dpr,
      elementsPresent: {
        upperCanvas: !!upper, lowerCanvas: !!lower, wrapper: !!wrapper, clipHost: !!clipHost,
        canvasBody: !!canvasBody, toolbarBody: !!toolbarBody, settingsBody: !!settingsBody
      },
      rects,
      styles: {
        upperCanvas: styleSummary(upper),
        lowerCanvas: styleSummary(lower),
        wrapper: styleSummary(wrapper),
        clipHost: styleSummary(clipHost),
        canvasBody: styleSummary(canvasBody),
        toolbarBody: styleSummary(toolbarBody),
        settingsBody: styleSummary(settingsBody)
      },
      layers: {
        upperCanvas: canvasLayerMetrics(upper),
        lowerCanvas: canvasLayerMetrics(lower)
      },
      bleedIndicators
    };
  } catch (e) {
    return { error: safe(e) };
  }
}

/* ---------- Selection Diagnostics ---------- */
function collectSelectionDiagnostics(canvas) {
  const st = getState();
  const storeSelected = Array.isArray(st.selectedShapes) ? st.selectedShapes.filter(Boolean) : [];
  const storeIds = storeSelected.map(s => s._id).filter(Boolean);

  let fabricActive = null;
  let activeType = null;
  let fabricMemberIds = [];
  let activeFlags = {};
  try {
    if (canvas && typeof canvas.getActiveObject === 'function') {
      fabricActive = canvas.getActiveObject();
      if (fabricActive) {
        activeType = fabricActive.type || 'object';
        if (activeType === 'activeSelection' && Array.isArray(fabricActive._objects)) {
          fabricMemberIds = fabricActive._objects.map(o => o && o._id).filter(Boolean);
        } else if (fabricActive._id) {
          fabricMemberIds = [fabricActive._id];
        }
        activeFlags = {
          hasControls: !!fabricActive.hasControls,
          hasBorders: !!fabricActive.hasBorders,
          lockMovementX: !!fabricActive.lockMovementX,
          lockMovementY: !!fabricActive.lockMovementY,
          lockScalingX: !!fabricActive.lockScalingX,
          lockScalingY: !!fabricActive.lockScalingY,
          lockRotation: !!fabricActive.lockRotation,
          hoverCursor: fabricActive.hoverCursor || null
        };
      }
    }
  } catch (e) {
    activeType = 'error';
    activeFlags.error = safe(e);
  }

  const storeSet = new Set(storeIds);
  const fabricSet = new Set(fabricMemberIds);
  const missingInFabric = [...storeSet].filter(id => !fabricSet.has(id));
  const missingInStore = [...fabricSet].filter(id => !storeSet.has(id));
  const orderMismatch =
    storeIds.length === fabricMemberIds.length &&
    storeIds.some((id, i) => fabricMemberIds[i] !== id);

  const lockedSelectedIds = storeSelected.filter(s => s.locked).map(s => s._id);
  const anyLockedSelected = lockedSelectedIds.length > 0;

  let activeSelectionRect = null;
  if (fabricActive && activeType === 'activeSelection' && typeof fabricActive.getBoundingRect === 'function') {
    try {
      const r = fabricActive.getBoundingRect(true, true);
      activeSelectionRect = {
        left: round(r.left), top: round(r.top),
        width: round(r.width), height: round(r.height)
      };
    } catch {}
  }

  const responsiveScale = canvas ? (canvas.__responsiveScale || 1) : 1;

  return {
    summary: {
      storeSelectedCount: storeIds.length,
      fabricMemberCount: fabricMemberIds.length,
      activeType,
      anyLockedSelected,
      responsiveScale
    },
    ids: {
      storeSelected: storeIds,
      fabricMembers: fabricMemberIds,
      missingInFabric,
      missingInStore,
      orderMismatch
    },
    locked: {
      lockedSelectedIds
    },
    activeFlags,
    activeSelectionRect
  };
}

/* ---------- Consistency Checks ---------- */
function buildConsistencyChecks({ shapesSumm, selectedSumm, fabricSel }) {
  try {
    const selIds = new Set((selectedSumm || []).map(s => s && s.id).filter(Boolean));
    const allIds = new Set((shapesSumm || []).map(s => s && s.id).filter(Boolean));
    const missingSel = [...selIds].filter(id => !allIds.has(id));

    const fabricVsStoreMismatch = (() => {
      try {
        const fabricMemberIds = new Set((fabricSel.memberIds || []).map(String));
        const storeSelIds = new Set([...selIds].map(String));
        if (fabricSel.activeType === 'activeSelection' && fabricSel.memberCount >= 2) {
          const symDiff = new Set([...fabricMemberIds, ...storeSelIds]);
          for (const id of fabricMemberIds) if (storeSelIds.has(id)) symDiff.delete(id);
          for (const id of storeSelIds) if (fabricMemberIds.has(id)) symDiff.delete(id);
          return { mismatch: symDiff.size > 0, differingIds: [...symDiff] };
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

/* ---------- Bleed Tolerance ---------- */
function evaluateBleedTolerance(domLayout, responsiveScale) {
  const raw = domLayout?.bleedIndicators || {};
  const upper = domLayout?.rects?.upperCanvas;
  const body = domLayout?.rects?.canvasBody;
  if (!upper || !body) {
    return {
      upperOutsideCanvasPanelTolerant: raw.upperOutsideCanvasPanel,
      details: { reason: "missing-rects" }
    };
  }
  const widthDiff = Math.abs(upper.width - body.width);
  const heightDiff = Math.abs(upper.height - body.height);
  const widthTol = 4;
  const heightTol = Math.max(6, Math.round(40 * Math.max(0, 1 - responsiveScale) + 6));

  const tolerated = raw.upperOutsideCanvasPanel &&
    widthDiff <= widthTol &&
    heightDiff <= heightTol;

  return {
    upperOutsideCanvasPanelTolerant: raw.upperOutsideCanvasPanel ? !tolerated : false,
    toleranceApplied: raw.upperOutsideCanvasPanel && tolerated,
    metrics: { widthDiff, heightDiff, widthTol, heightTol }
  };
}

/* ---------- Selection Trace Merge ---------- */
function buildMergedSelectionTrace() {
  const directTrace = getSelectionEventTrace() || [];
  ensureLegacyLogHook(); // install fallback once (non-invasive)
  const legacy = legacyInterceptLog.slice();

  const normDirect = directTrace.map(e => ({
    source: 'direct',
    timeISO: e.timeISO,
    event: e.event,
    token: e.token,
    suppressed: !!e.suppressed,
    prevIds: e.prevIds || [],
    nextIds: e.nextIds || [],
    error: !!e.error,
    noop: !!e.noop
  }));

  const normLegacy = legacy.map(e => ({
    source: 'legacy',
    timeISO: e.timeISO,
    event: e.event,
    token: undefined,
    suppressed: false,
    prevIds: [],
    nextIds: e.idsStore || [],
    error: false,
    noop: false
  }));

  const combined = [...normDirect, ...normLegacy];

  const seen = new Set();
  const out = [];
  for (const ev of combined.sort((a,b) => a.timeISO.localeCompare(b.timeISO))) {
    const key = `${ev.timeISO}|${ev.event}|${ev.nextIds.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }

  return out.slice(-25);
}

/* ---------- Snapshot Builder ---------- */
export function collectDebugSnapshot() {
  const s = getState();
  const canvas = s.fabricCanvas || null;
  const bgImg = s.bgFabricImage || null;

  const shapesSumm = (Array.isArray(s.shapes) ? s.shapes : []).map(summarizeShape);
  const selectedSumm = (Array.isArray(s.selectedShapes) ? s.selectedShapes : []).map(summarizeShape);
  const fabricSel = summarizeFabricSelection(canvas);
  const domLayout = collectDomLayout(canvas);
  const selectionDiagnostics = collectSelectionDiagnostics(canvas);
  const bleedTol = evaluateBleedTolerance(domLayout, selectionDiagnostics.summary.responsiveScale || 1);

  const env = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'n/a',
    language: typeof navigator !== 'undefined' ? navigator.language : 'n/a',
    location: typeof window !== 'undefined' ? String(window.location) : 'n/a',
    timeISO: new Date().toISOString()
  };

  const selectionTrace = buildMergedSelectionTrace();

  return {
    meta: {
      tool: 'Scene Designer',
      version: 'debug-snapshot-5',
      timeISO: env.timeISO
    },
    scene: {
      name: s.sceneName || '',
      logic: s.sceneLogic || '',
      shapeCount: shapesSumm.length,
      selectedCount: selectedSumm.length
    },
    settings: summarizeSettings(s.settings || {}),
    canvas: summarizeCanvas(canvas),
    backgroundImage: summarizeBackgroundImage(bgImg),
    fabricSelection: fabricSel,
    selectionDiagnostics,
    domLayout,
    tolerantBleed: bleedTol,
    shapes: shapesSumm,
    selectedShapes: selectedSumm,
    ids: {
      shapes: shapesSumm.map(x => x && x.id).filter(Boolean),
      selected: selectedSumm.map(x => x && x.id).filter(Boolean)
    },
    consistencyChecks: buildConsistencyChecks({ shapesSumm, selectedSumm, fabricSel }),
    selectionTrace,
    environment: env
  };
}

/* ---------- Formatting ---------- */
export function formatDebugSnapshot(snapshot, format = 'json') {
  try {
    if (format === 'markdown') {
      const sel = snapshot?.selectionDiagnostics?.summary || {};
      const bleed = snapshot?.domLayout?.bleedIndicators || {};
      const tol = snapshot?.tolerantBleed || {};
      const trace = snapshot?.selectionTrace || [];
      const json = JSON.stringify(snapshot, null, 2);
      return [
        '## Scene Designer Debug Snapshot',
        `- Captured: ${snapshot?.meta?.timeISO}`,
        `- Shapes: ${snapshot?.scene?.shapeCount}, Selected: ${snapshot?.scene?.selectedCount}`,
        `- Selection: activeType=${sel.activeType}, store=${sel.storeSelectedCount}, fabric=${sel.fabricMemberCount}, orderMismatch=${snapshot?.selectionDiagnostics?.ids?.orderMismatch}`,
        `- LockedSelected=${sel.anyLockedSelected}`,
        `- ResponsiveScale=${sel.responsiveScale}`,
        `- RawBleed: upperOutsideCanvasPanel=${bleed.upperOutsideCanvasPanel}`,
        `- TolerantBleed: upperOutsideCanvasPanelTolerant=${tol.upperOutsideCanvasPanelTolerant} (applied=${tol.toleranceApplied})`,
        '',
        '### Selection Trace (last events, direct+legacy merged):',
        ...trace.map(ev =>
          `- [${ev.timeISO}] ${ev.event} src=${ev.source} suppressed=${ev.suppressed} nextIds=[${ev.nextIds.join(',')}]`
        ),
        '',
        '```json',
        json,
        '```'
      ].join('\n');
    }
    return JSON.stringify(snapshot, null, 2);
  } catch (e) {
    origLog("ERROR", "[debug] formatDebugSnapshot failed", e);
    return String(snapshot);
  }
}

/* ---------- Clipboard ---------- */
async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {/* fallback below */}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Capture Orchestrator ---------- */
export async function runDebugCapture(options = {}) {
  const { format = 'json', copy = true, log: doLog = true } = options;
  const snapshot = collectDebugSnapshot();
  const text = formatDebugSnapshot(snapshot, format);
  let copied = false;
  if (copy) copied = await copyToClipboard(text);

  if (doLog) {
    const sel = snapshot?.selectionDiagnostics?.summary || {};
    const bleed = snapshot?.domLayout?.bleedIndicators || {};
    const tol = snapshot?.tolerantBleed || {};
    origLog("INFO", "[debug] Snapshot collected", {
      version: snapshot?.meta?.version,
      copiedToClipboard: copied,
      shapes: snapshot?.scene?.shapeCount,
      selected: snapshot?.scene?.selectedCount,
      activeType: sel.activeType,
      storeSelected: sel.storeSelectedCount,
      fabricMembers: sel.fabricMemberCount,
      orderMismatch: snapshot?.selectionDiagnostics?.ids?.orderMismatch,
      anyLockedSelected: sel.anyLockedSelected,
      responsiveScale: sel.responsiveScale,
      bleed_upperOutsideCanvasPanel_raw: bleed.upperOutsideCanvasPanel,
      bleed_upperOutsideCanvasPanel_tolerant: tol.upperOutsideCanvasPanelTolerant
    });
    origLog("DEBUG", "[debug] Snapshot text", text);
  }
  return { text, snapshot };
}

