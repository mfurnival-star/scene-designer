/**
 * debug.js
 * -----------------------------------------------------------
 * Scene Designer – Debug Snapshot Collector (ESM ONLY)
 * Purpose:
 * - Collect a diagnostic snapshot of app state, Fabric selection, and DOM layout.
 * - Added (2025-09-23): selectionDiagnostics block to compare MARQUEE vs SELECT ALL behavior.
 *
 * Public Exports:
 * - collectDebugSnapshot()
 * - formatDebugSnapshot(snapshot, format='json')
 * - runDebugCapture({ format='json', copy=true, log=true })
 *
 * Version History:
 * - debug-snapshot-2: DOM layout / bleedIndicators
 * - debug-snapshot-3: selectionDiagnostics (order, membership, locks, flags)
 *
 * Usage for your current investigation:
 * 1) Make a marquee multi-select (include at least 3 shapes, one locked if possible) → Debug → paste.
 * 2) Then click Select All → Debug → paste.
 * Compare selectionDiagnostics between the two snapshots.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState } from './state.js';

/* ---------- Generic Safe Helpers ---------- */
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

/* ---------- Shape Summaries ---------- */
function summarizeShape(shape) {
  if (!shape) return null;
  try {
    const kind = shape._type || shape.type || 'unknown';
    return {
      id: shape._id || null,
      type: kind,
      label: shape._label || null,
      locked: !!shape.locked,
      selectable: !!shape.selectable,
      angle: round(shape.angle),
      left: round(shape.left),
      top: round(shape.top),
      width: round(shape.width ?? (shape.getScaledWidth ? shape.getScaledWidth() : undefined)),
      height: round(shape.height ?? (shape.getScaledHeight ? shape.getScaledHeight() : undefined)),
      radius: round(shape.radius)
    };
  } catch {
    return { id: shape?._id || null, type: shape?._type || shape?.type || 'unknown' };
  }
}

/* ---------- Fabric Selection Basic Summary ---------- */
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

/* ---------- Canvas / Background Summaries ---------- */
function summarizeCanvas(canvas) {
  try {
    if (!canvas) return { present: false };
    return {
      present: true,
      width: typeof canvas.getWidth === 'function' ? canvas.getWidth() : undefined,
      height: typeof canvas.getHeight === 'function' ? canvas.getHeight() : undefined,
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

/* ---------- DOM Layout (Bleed) Helpers ---------- */
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
    return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right),
             bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
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
  } catch { return { present: !!el }; }
}
const rectsIntersect = (a,b) => !!(a && b) && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
const rectContains = (outer, inner) => !!(outer && inner) &&
  inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom;

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

/* ---------- Selection Diagnostics (NEW) ---------- */
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

  // Order & membership comparisons
  const storeSet = new Set(storeIds);
  const fabricSet = new Set(fabricMemberIds);
  const missingInFabric = [...storeSet].filter(id => !fabricSet.has(id));
  const missingInStore = [...fabricSet].filter(id => !storeSet.has(id));
  const orderMismatch =
    storeIds.length === fabricMemberIds.length &&
    storeIds.some((id, i) => fabricMemberIds[i] !== id);

  // Locked shape analysis
  const lockedInStoreSelected = storeSelected.filter(s => s.locked).map(s => s._id);
  const anyLockedSelected = lockedInStoreSelected.length > 0;

  // Attempt bounding rect of active selection (Fabric)
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

  // Responsive scale (if canvasResponsive scaled)
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
      lockedSelectedIds: lockedInStoreSelected
    },
    activeFlags,
    activeSelectionRect
  };
}

/* ---------- Consistency Checks (Existing) ---------- */
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

  const env = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'n/a',
    language: typeof navigator !== 'undefined' ? navigator.language : 'n/a',
    location: typeof window !== 'undefined' ? String(window.location) : 'n/a',
    timeISO: new Date().toISOString()
  };

  return {
    meta: {
      tool: 'Scene Designer',
      version: 'debug-snapshot-3',
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
    selectionDiagnostics,          // NEW block
    domLayout,
    shapes: shapesSumm,
    selectedShapes: selectedSumm,
    ids: {
      shapes: shapesSumm.map(x => x && x.id).filter(Boolean),
      selected: selectedSumm.map(x => x && x.id).filter(Boolean)
    },
    consistencyChecks: buildConsistencyChecks({ shapesSumm, selectedSumm, fabricSel }),
    environment: env
  };
}

/* ---------- Formatting / Clipboard / Run ---------- */
export function formatDebugSnapshot(snapshot, format = 'json') {
  try {
    if (format === 'markdown') {
      const bleed = snapshot?.domLayout?.bleedIndicators || {};
      const sel = snapshot?.selectionDiagnostics?.summary || {};
      const json = JSON.stringify(snapshot, null, 2);
      return [
        '## Scene Designer Debug Snapshot',
        `- Captured: ${snapshot?.meta?.timeISO}`,
        `- Shapes: ${snapshot?.scene?.shapeCount}, Selected: ${snapshot?.scene?.selectedCount}`,
        `- Selection: activeType=${sel.activeType}, store=${sel.storeSelectedCount}, fabric=${sel.fabricMemberCount}, orderMismatch=${snapshot?.selectionDiagnostics?.ids?.orderMismatch}`,
        `- LockedInSelection=${sel.anyLockedSelected}`,
        `- ResponsiveScale=${sel.responsiveScale}`,
        `- BleedFlags: upper→Toolbar=${!!bleed.upperOverlapsToolbar}, upper→Settings=${!!bleed.upperOverlapsSettings}, upperOutsideCanvas=${!!bleed.upperOutsideCanvasPanel}`,
        '',
        '```json',
        json,
        '```'
      ].join('\n');
    }
    return JSON.stringify(snapshot, null, 2);
  } catch (e) {
    log("ERROR", "[debug] formatDebugSnapshot failed", e);
    return String(snapshot);
  }
}

async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
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

export async function runDebugCapture(options = {}) {
  const { format = 'json', copy = true, log: doLog = true } = options;
  const snapshot = collectDebugSnapshot();
  const text = formatDebugSnapshot(snapshot, format);
  let copied = false;
  if (copy) copied = await copyToClipboard(text);

  if (doLog) {
    const bleed = snapshot?.domLayout?.bleedIndicators || {};
    const sel = snapshot?.selectionDiagnostics?.summary || {};
    log("INFO", "[debug] Snapshot collected", {
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
      bleed_upperOverlapsSettings: !!bleed.upperOverlapsSettings
    });
    log("DEBUG", "[debug] Snapshot text", text);
  }
  return { text, snapshot };
}
