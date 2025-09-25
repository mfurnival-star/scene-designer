import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/classic.min.css';

import { log } from './log.js';
import { getState } from './state.js';
import { setSettingAndSave } from './settings-core.js';
import { setStrokeColorForSelected, setFillColorForSelected } from './actions.js';

function ensureHash(hex) {
  if (typeof hex !== "string") return "#000000";
  const s = hex.trim();
  return s.startsWith("#") ? s : ("#" + s);
}
function toHex6(hex) {
  const h = ensureHash(hex).toLowerCase();
  if (h.length === 7) return h;
  if (h.length === 9) return h.slice(0, 7);
  if (h.length === 4) {
    return "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return "#000000";
}
function alphaPctToAA(percent) {
  let p = Number(percent);
  if (!Number.isFinite(p)) p = 100;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  const v = Math.round((p / 100) * 255);
  return v.toString(16).padStart(2, "0");
}
function alphaPctFromHex(hex, defaultPct = 100) {
  const h = ensureHash(hex);
  if (h.length === 9) {
    const aa = h.slice(7, 9);
    const v = parseInt(aa, 16);
    if (Number.isFinite(v)) return Math.round((v / 255) * 100);
  }
  return defaultPct;
}
function makeHex8(hex6, alphaPercent) {
  return toHex6(hex6) + alphaPctToAA(alphaPercent);
}
function hasSelection() {
  const sel = getState().selectedShapes || [];
  return Array.isArray(sel) && sel.length > 0;
}
function pickrColorToHex6(color) {
  const arr = color.toHEXA();
  const hex6 = '#' + arr.slice(0, 3).map(h => (typeof h === 'string' ? h.padStart(2, '0') : String(h).padStart(2, '0'))).join('').toLowerCase();
  return hex6;
}
function pickrColorToAlphaPct(color) {
  const rgba = color.toRGBA();
  const a = Array.isArray(rgba) ? (rgba[3] ?? 1) : 1;
  let pct = Math.round(Number(a) * 100);
  if (!Number.isFinite(pct)) pct = 100;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}
function rgbaStringFromHex6(hex6, alphaPercent) {
  const h = toHex6(hex6).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, Number(alphaPercent) / 100));
  return `rgba(${r},${g},${b},${a})`;
}
function debounce(fn, wait = 120) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function installColorPickers(refs) {
  const { strokePickrEl, fillPickrEl } = refs || {};
  if (!strokePickrEl || !fillPickrEl) {
    log("ERROR", "[toolbar-color] installColorPickers: missing refs { strokePickrEl, fillPickrEl }");
    return () => {};
  }

  const settings = getState().settings || {};
  const defaultStrokeHex6 = toHex6(settings.defaultStrokeColor || "#000000ff");
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
    },
  };

  const strokePickr = Pickr.create({
    ...common,
    el: strokePickrEl,
    default: defaultStrokeHex6,
    components: { ...common.components, opacity: false }
  });

  const fillPickr = Pickr.create({
    ...common,
    el: fillPickrEl,
    default: makeHex8(defaultFillHex6, defaultFillAlphaPct)
  });

  let strokeSession = 0;
  let fillSession = 0;

  const applyStroke = (hex6, opts = {}) => {
    try {
      if (hasSelection()) {
        setStrokeColorForSelected(hex6, opts);
        log("INFO", "[toolbar-color] Applied stroke to selection", { hex6, coalesceKey: opts.coalesceKey });
      } else {
        const hex8 = makeHex8(hex6, 100);
        setSettingAndSave("defaultStrokeColor", hex8);
        log("INFO", "[toolbar-color] Updated defaultStrokeColor", { hex8 });
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] applyStroke error", e);
    }
  };
  const applyFill = (hex6, alphaPct, opts = {}) => {
    try {
      if (hasSelection()) {
        const rgba = rgbaStringFromHex6(hex6, alphaPct);
        setFillColorForSelected(rgba, opts);
        log("INFO", "[toolbar-color] Applied fill to selection", { rgba, coalesceKey: opts.coalesceKey });
      } else {
        const hex8 = makeHex8(hex6, alphaPct);
        setSettingAndSave("defaultFillColor", hex8);
        log("INFO", "[toolbar-color] Updated defaultFillColor", { hex8 });
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] applyFill error", e);
    }
  };

  const debouncedStroke = debounce((hex6, key) => {
    applyStroke(hex6, { coalesceKey: key, coalesceWindowMs: 1000 });
  }, 140);
  const debouncedFill = debounce((hex6, alphaPct, key) => {
    applyFill(hex6, alphaPct, { coalesceKey: key, coalesceWindowMs: 1000 });
  }, 140);

  const onStrokeChange = (color) => {
    if (!color) return;
    const hex6 = pickrColorToHex6(color);
    const key = `stroke-color-${strokeSession}`;
    debouncedStroke(hex6, key);
  };
  const onStrokeSwatch = (color) => {
    if (!color) return;
    const hex6 = pickrColorToHex6(color);
    strokeSession += 1;
    const key = `stroke-color-${strokeSession}-swatch`;
    applyStroke(hex6, { coalesceKey: key, coalesceWindowMs: 1000 });
  };

  const onFillChange = (color) => {
    if (!color) return;
    const hex6 = pickrColorToHex6(color);
    const alphaPct = pickrColorToAlphaPct(color);
    const key = `fill-color-${fillSession}`;
    debouncedFill(hex6, alphaPct, key);
  };
  const onFillSwatch = (color) => {
    if (!color) return;
    const hex6 = pickrColorToHex6(color);
    const alphaPct = pickrColorToAlphaPct(color);
    fillSession += 1;
    const key = `fill-color-${fillSession}-swatch`;
    applyFill(hex6, alphaPct, { coalesceKey: key, coalesceWindowMs: 1000 });
  };

  strokePickr.on('show', () => { strokeSession += 1; });
  strokePickr.on('change', onStrokeChange);
  strokePickr.on('swatchselect', onStrokeSwatch);

  fillPickr.on('show', () => { fillSession += 1; });
  fillPickr.on('change', onFillChange);
  fillPickr.on('swatchselect', onFillSwatch);

  log("INFO", "[toolbar-color] Pickr color pickers installed (with history coalescing)");
  return function detach() {
    try {
      strokePickr && strokePickr.destroyAndRemove();
    } catch (e) {
      log("WARN", "[toolbar-color] Failed to destroy strokePickr", e);
    }
    try {
      fillPickr && fillPickr.destroyAndRemove();
    } catch (e) {
      log("WARN", "[toolbar-color] Failed to destroy fillPickr", e);
    }
    log("INFO", "[toolbar-color] Pickr color pickers detached");
  };
}
