import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/classic.min.css';

import { log } from './log.js';
import { getState, sceneDesignerStore } from './state.js';
import { setSettingAndSave } from './settings-core.js';
import { setStrokeColorForSelected, setFillColorForSelected } from './actions.js';

/*
  Hotfix (Post Batch 6):
  - Restored full file (previous delivery was incomplete with placeholder comments).
  - Fixed regression introduced in Batch 6 where applyStroke/applyFill passed items[] into
    actions.* instead of a plain color string. Actions now build items[] internally.
  - All utility helpers inlined (no omissions) to comply with manifesto (complete files only).
*/

/* ---------------- Utility: General ---------------- */

function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function debounce(fn, wait = 140) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function hasSelection() {
  const sel = getState().selectedShapes || [];
  return Array.isArray(sel) && sel.filter(Boolean).length > 0;
}

/* ---------------- Utility: Hex / RGBA Conversion ---------------- */

function ensureHash(hex) {
  if (typeof hex !== 'string') return '#000000';
  const h = hex.trim();
  return h.startsWith('#') ? h : ('#' + h);
}

function stripHash(hex) {
  if (typeof hex !== 'string') return '';
  return hex.trim().replace(/^#/, '');
}

function toHex6(hexOr8) {
  if (typeof hexOr8 !== 'string') return '000000';
  let h = stripHash(hexOr8);
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  if (h.length === 6) return h.toLowerCase();
  if (h.length === 8) return h.slice(0, 6).toLowerCase();
  if (h.length < 6) return (h + '000000').slice(0, 6).toLowerCase();
  return h.slice(0, 6).toLowerCase();
}

function alphaPctFromHex(hexOr8, fallbackPct = 100) {
  if (typeof hexOr8 !== 'string') return fallbackPct;
  let h = stripHash(hexOr8);
  if (h.length === 3) {
    // Expand #RGB to #RRGGBB (opaque)
    return fallbackPct;
  }
  if (h.length === 6) return fallbackPct;
  if (h.length === 8) {
    const a = parseInt(h.slice(6, 8), 16);
    if (!Number.isFinite(a)) return fallbackPct;
    return clamp(Math.round((a / 255) * 100), 0, 100);
  }
  return fallbackPct;
}

function makeHex8(hex6, alphaPct = 100) {
  const a = clamp(alphaPct, 0, 100);
  const alphaByte = Math.round((a / 100) * 255);
  const ah = alphaByte.toString(16).padStart(2, '0');
  return `#${toHex6(hex6)}${ah}`;
}

function pickrColorToHex6(color) {
  try {
    const rgba = color.toRGBA(); // [r,g,b,a]
    if (!Array.isArray(rgba) || rgba.length < 3) return '000000';
    const r = clamp(Math.round(rgba[0]), 0, 255).toString(16).padStart(2, '0');
    const g = clamp(Math.round(rgba[1]), 0, 255).toString(16).padStart(2, '0');
    const b = clamp(Math.round(rgba[2]), 0, 255).toString(16).padStart(2, '0');
    return `${r}${g}${b}`;
  } catch {
    return '000000';
  }
}

function pickrColorToAlphaPct(color) {
  try {
    const rgba = color.toRGBA();
    if (!Array.isArray(rgba) || rgba.length < 4) return 100;
    return clamp(Math.round(rgba[3] * 100), 0, 100);
  } catch {
    return 100;
  }
}

function rgbaStringFromHex6(hex6, alphaPct) {
  const h = toHex6(hex6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = clamp(alphaPct, 0, 100) / 100;
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------------- Utility: Shape Style Readers ---------------- */

function isDrawableChild(obj) {
  return !!obj && !obj._isDiagnosticLabel && (
    obj.type === 'rect' ||
    obj.type === 'circle' ||
    obj.type === 'ellipse' ||
    obj.type === 'line'
  );
}

function readStrokeFromShape(shape) {
  if (!shape || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(isDrawableChild);
  if (!child) return null;
  const stroke = child.stroke;
  if (typeof stroke !== 'string' || !stroke) return null;
  return toHex6(stroke);
}

function readFillFromShape(shape) {
  if (!shape || shape._type === 'point' || !Array.isArray(shape._objects)) return null;
  const child = shape._objects.find(o =>
    isDrawableChild(o) && (o.type === 'rect' || o.type === 'circle' || o.type === 'ellipse')
  );
  if (!child) return null;
  const fill = child.fill;
  if (typeof fill !== 'string' || !fill) return null;

  // Accept rgba(r,g,b,a) OR hex forms
  if (/^rgba\(/i.test(fill)) {
    try {
      const m = fill.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)/i);
      if (!m) return null;
      const r = clamp(parseInt(m[1], 10), 0, 255);
      const g = clamp(parseInt(m[2], 10), 0, 255);
      const b = clamp(parseInt(m[3], 10), 0, 255);
      const a = clamp(parseFloat(m[4]), 0, 1);
      const hex6 = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      const alphaPct = Math.round(a * 100);
      return { hex6, alphaPct };
    } catch {
      return null;
    }
  }

  // If it's hex (3,6,8), parse alpha
  let base = stripHash(fill);
  if (base.length === 3) {
    base = base.split('').map(c => c + c).join('');
    return { hex6: base, alphaPct: 100 };
  }
  if (base.length === 6) {
    return { hex6: base, alphaPct: 100 };
  }
  if (base.length === 8) {
    return { hex6: base.slice(0, 6), alphaPct: alphaPctFromHex('#' + base, 100) };
  }
  return null;
}

/* ---------------- Install Pickers ---------------- */

export function installColorPickers(refs) {
  const { strokePickrEl, fillPickrEl } = refs || {};
  if (!strokePickrEl || !fillPickrEl) {
    log("ERROR", "[toolbar-color] installColorPickers: missing refs { strokePickrEl, fillPickrEl }");
    return () => {};
  }

  const settings = getState().settings || {};
  const defaultStrokeHex6 = toHex6(settings.defaultStrokeColor || "#2176ff");
  const defaultFillHex8 = ensureHash(settings.defaultFillColor || "#00000000");
  const defaultFillHex6 = toHex6(defaultFillHex8);
  const defaultFillAlphaPct = alphaPctFromHex(defaultFillHex8, 0);

  const common = {
    theme: 'classic',
    useAsButton: true,
    position: 'bottom-start',
    appClass: 'scene-designer-pickr',
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        input: true,
        hex: true,
        rgba: true,
        hsla: false,
        hsva: false,
        cmyk: false,
        clear: false,
        save: false
      }
    }
  };

  let strokePickr;
  let fillPickr;
  try {
    strokePickr = Pickr.create({
      ...common,
      el: strokePickrEl,
      default: defaultStrokeHex6,
      components: { ...common.components, opacity: false }
    });
  } catch (e) {
    log("ERROR", "[toolbar-color] Failed to create stroke Pickr", e);
    return () => {};
  }

  try {
    fillPickr = Pickr.create({
      ...common,
      el: fillPickrEl,
      default: makeHex8(defaultFillHex6, defaultFillAlphaPct)
    });
  } catch (e) {
    log("ERROR", "[toolbar-color] Failed to create fill Pickr", e);
    try { strokePickr.destroyAndRemove(); } catch {}
    return () => {};
  }

  let strokeSession = 0;
  let fillSession = 0;
  let muteStrokeChange = false;
  let muteFillChange = false;

  function applyStroke(hex6, opts = {}) {
    try {
      const sel = getState().selectedShapes || [];
      if (Array.isArray(sel) && sel.length > 0) {
        // Pass plain color (actions will construct items[] payload)
        setStrokeColorForSelected('#' + toHex6(hex6), opts);
        log("DEBUG", "[toolbar-color] Stroke applied", { coalesceKey: opts.coalesceKey });
      } else {
        // Update default stroke color (stored with alpha = 100%)
        const hex8 = makeHex8(hex6, 100);
        setSettingAndSave("defaultStrokeColor", hex8);
        log("INFO", "[toolbar-color] Default stroke updated");
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] applyStroke error", e);
    }
  }

  function applyFill(hex6, alphaPct, opts = {}) {
    try {
      const sel = getState().selectedShapes || [];
      const pct = clamp(alphaPct, 0, 100);
      if (Array.isArray(sel) && sel.length > 0) {
        const rgba = rgbaStringFromHex6(hex6, pct);
        setFillColorForSelected(rgba, opts);
        log("DEBUG", "[toolbar-color] Fill applied", { coalesceKey: opts.coalesceKey });
      } else {
        const hex8 = makeHex8(hex6, pct);
        setSettingAndSave("defaultFillColor", hex8);
        log("INFO", "[toolbar-color] Default fill updated");
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] applyFill error", e);
    }
  }

  const debouncedStroke = debounce((hex6, key) => {
    applyStroke(hex6, { coalesceKey: key, coalesceWindowMs: 1000 });
  }, 140);

  const debouncedFill = debounce((hex6, alphaPct, key) => {
    applyFill(hex6, alphaPct, { coalesceKey: key, coalesceWindowMs: 1000 });
  }, 140);

  function onStrokeChange(color) {
    if (!color || muteStrokeChange) return;
    const hex6 = pickrColorToHex6(color);
    const key = `stroke-color-${strokeSession}`;
    debouncedStroke(hex6, key);
  }

  function onStrokeSwatch(color) {
    if (!color) return;
    const hex6 = pickrColorToHex6(color);
    strokeSession += 1;
    const key = `stroke-color-${strokeSession}-swatch`;
    applyStroke(hex6, { coalesceKey: key, coalesceWindowMs: 1000 });
  }

  function onFillChange(color) {
    if (!color || muteFillChange) return;
    const hex6 = pickrColorToHex6(color);
    const alphaPct = pickrColorToAlphaPct(color);
    const key = `fill-color-${fillSession}`;
    debouncedFill(hex6, alphaPct, key);
  }

  function onFillSwatch(color) {
    if (!color) return;
    const hex6 = pickrColorToHex6(color);
    const alphaPct = pickrColorToAlphaPct(color);
    fillSession += 1;
    const key = `fill-color-${fillSession}-swatch`;
    applyFill(hex6, alphaPct, { coalesceKey: key, coalesceWindowMs: 1000 });
  }

  strokePickr.on('show', () => { strokeSession += 1; });
  strokePickr.on('change', onStrokeChange);
  strokePickr.on('swatchselect', onStrokeSwatch);

  fillPickr.on('show', () => { fillSession += 1; });
  fillPickr.on('change', onFillChange);
  fillPickr.on('swatchselect', onFillSwatch);

  function setStrokePickrSilently(hex6) {
    try {
      muteStrokeChange = true;
      strokePickr.setColor(hex6);
    } catch {} finally {
      setTimeout(() => { muteStrokeChange = false; }, 0);
    }
  }

  function setFillPickrSilently(hex6, alphaPct) {
    try {
      muteFillChange = true;
      const hex8 = makeHex8(hex6, alphaPct);
      fillPickr.setColor(hex8);
    } catch {} finally {
      setTimeout(() => { muteFillChange = false; }, 0);
    }
  }

  function syncPickersFromSelectionOrDefaults() {
    const s = getState();
    const selected = Array.isArray(s.selectedShapes) ? s.selectedShapes.filter(Boolean) : [];
    const settingsNow = s.settings || {};

    // stroke
    let strokeTitleExtra = '';
    if (selected.length === 0) {
      const defStroke6 = toHex6(settingsNow.defaultStrokeColor || '#2176ff');
      setStrokePickrSilently(defStroke6);
      strokeTitleExtra = ' (default)';
    } else {
      const strokes = selected.map(readStrokeFromShape).filter(Boolean);
      if (!strokes.length) {
        const defStroke6 = toHex6(settingsNow.defaultStrokeColor || '#2176ff');
        setStrokePickrSilently(defStroke6);
        strokeTitleExtra = ' (mixed)';
      } else {
        const allSame = strokes.every(c => c === strokes[0]);
        if (allSame) {
          setStrokePickrSilently(strokes[0]);
        } else {
          strokeTitleExtra = ' (mixed)';
        }
      }
    }
    try { strokePickrEl.title = 'Stroke color' + strokeTitleExtra; } catch {}

    // fill
    let fillTitleExtra = '';
    const nonPoint = selected.filter(sh => sh && sh._type !== 'point');
    if (selected.length === 0 || nonPoint.length === 0) {
      const defFill = ensureHash(settingsNow.defaultFillColor || '#00000000');
      const defFill6 = toHex6(defFill);
      const defAlpha = alphaPctFromHex(defFill, 0);
      setFillPickrSilently(defFill6, defAlpha);
      fillTitleExtra = selected.length === 0 ? ' (default)' : '';
    } else {
      const fills = nonPoint.map(readFillFromShape).filter(Boolean);
      if (!fills.length) {
        const defFill = ensureHash(settingsNow.defaultFillColor || '#00000000');
        const defFill6 = toHex6(defFill);
        const defAlpha = alphaPctFromHex(defFill, 0);
        setFillPickrSilently(defFill6, defAlpha);
        fillTitleExtra = ' (mixed)';
      } else {
        const first = fills[0];
        const allSame = fills.every(f =>
          f.hex6 === first.hex6 && Math.abs(f.alphaPct - first.alphaPct) < 0.5
        );
        if (allSame) {
          setFillPickrSilently(first.hex6, first.alphaPct);
        } else {
          fillTitleExtra = ' (mixed)';
        }
      }
    }
    try { fillPickrEl.title = 'Fill color + Alpha' + fillTitleExtra; } catch {}
  }

  const unsub = sceneDesignerStore.subscribe((_state, details) => {
    if (!details) return;
    try {
      if (details.type === 'setSelectedShapes') {
        syncPickersFromSelectionOrDefaults();
      } else if (details.type === 'setSettings') {
        if (!hasSelection()) syncPickersFromSelectionOrDefaults();
      } else if (details.type === 'setSetting') {
        if ((details.key === 'defaultStrokeColor' || details.key === 'defaultFillColor') && !hasSelection()) {
          syncPickersFromSelectionOrDefaults();
        }
      }
    } catch (e) {
      log("WARN", "[toolbar-color] store subscription error", e);
    }
  });

  setTimeout(() => {
    try { syncPickersFromSelectionOrDefaults(); } catch {}
  }, 0);

  log("INFO", "[toolbar-color] Color pickers installed");
  return function detach() {
    try { unsub && unsub(); } catch {}
    try { strokePickr && strokePickr.destroyAndRemove(); } catch (e) {
      log("WARN", "[toolbar-color] destroy strokePickr failed", e);
    }
    try { fillPickr && fillPickr.destroyAndRemove(); } catch (e) {
      log("WARN", "[toolbar-color] destroy fillPickr failed", e);
    }
    log("INFO", "[toolbar-color] Color pickers detached");
  };
}
