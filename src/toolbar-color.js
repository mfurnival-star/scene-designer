/**
 * toolbar-color.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Color Pickers (Pickr integration, ESM ONLY)
 * Purpose:
 * - Replace native <input type="color"> and alpha slider with Pickr-based color pickers.
 * - Two pickers:
 *    - Stroke: hex only (no opacity slider)
 *    - Fill: hex + opacity
 * - Behavior:
 *    - If shapes are selected: apply to unlocked selected shapes live as the user changes.
 *    - If none selected: update defaults in settings (persisted).
 *
 * Public Exports:
 * - installColorPickers(refs) -> detachFn
 *   - refs must include: { strokePickrEl, fillPickrEl }
 *
 * Dependencies:
 * - @simonwep/pickr (ESM)
 * - log.js (logging)
 * - state.js (getState)
 * - settings-core.js (setSettingAndSave)
 * - shapes.js (setStrokeColorForSelectedShapes, setFillColorForSelectedShapes)
 * -----------------------------------------------------------
 */

import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/classic.min.css';

import { log } from './log.js';
import { getState } from './state.js';
import { setSettingAndSave } from './settings-core.js';
import {
  setStrokeColorForSelectedShapes,
  setFillColorForSelectedShapes
} from './shapes.js';

/** --- Helpers for color parsing/formatting --- */

// Ensure string starts with '#'
function ensureHash(hex) {
  if (typeof hex !== "string") return "#000000";
  return hex.startsWith("#") ? hex : ("#" + hex);
}

// Get #RRGGBB from #RRGGBB or #RRGGBBAA (fallback #000000)
function toHex6(hex) {
  const h = ensureHash(hex).toLowerCase();
  if (h.length === 7) return h;
  if (h.length === 9) return h.slice(0, 7);
  if (h.length === 4) {
    return "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return "#000000";
}

// Convert alpha percent (0–100) to AA hex (00–FF)
function alphaPctToAA(percent) {
  let p = Number(percent);
  if (!Number.isFinite(p)) p = 100;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  const v = Math.round((p / 100) * 255);
  return v.toString(16).padStart(2, "0");
}

// Extract alpha percent (0–100) from #RRGGBBAA or default (100 if missing)
function alphaPctFromHex(hex, defaultPct = 100) {
  const h = ensureHash(hex);
  if (h.length === 9) {
    const aa = h.slice(7, 9);
    const v = parseInt(aa, 16);
    if (Number.isFinite(v)) {
      return Math.round((v / 255) * 100);
    }
  }
  return defaultPct;
}

// Compose #RRGGBBAA from #RRGGBB and alpha percent
function makeHex8(hex6, alphaPercent) {
  return toHex6(hex6) + alphaPctToAA(alphaPercent);
}

function hasSelection() {
  const sel = getState().selectedShapes || [];
  return Array.isArray(sel) && sel.length > 0;
}

/**
 * Create and install Pickr-based color pickers.
 * Returns a detach function that destroys the pickers.
 */
export function installColorPickers(refs) {
  const { strokePickrEl, fillPickrEl } = refs || {};
  if (!strokePickrEl || !fillPickrEl) {
    log("ERROR", "[toolbar-color] installColorPickers: missing refs { strokePickrEl, fillPickrEl }");
    return () => {};
  }

  // Initialize defaults from settings
  const settings = getState().settings || {};
  const defaultStrokeHex6 = toHex6(settings.defaultStrokeColor || "#000000ff");
  const defaultFillHex8 = ensureHash(settings.defaultFillColor || "#00000000");
  const defaultFillHex6 = toHex6(defaultFillHex8);
  const defaultFillAlphaPct = alphaPctFromHex(defaultFillHex8, 0);

  // Common options
  const common = {
    theme: 'classic',
    useAsButton: true,
    position: 'bottom-start',
    appClass: 'scene-designer-pickr',
    components: {
      // Main components
      preview: true,
      opacity: true, // may override per-instance
      hue: true,
      // Input / interaction
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
    strings: {
      save: 'Apply',
      clear: 'Clear',
      cancel: 'Close'
    }
  };

  // Stroke: hex only, no opacity slider
  const strokePickr = Pickr.create({
    ...common,
    el: strokePickrEl,
    default: defaultStrokeHex6,
    components: {
      ...common.components,
      opacity: false // disable for stroke
    }
  });

  // Fill: hex + opacity
  const fillPickr = Pickr.create({
    ...common,
    el: fillPickrEl,
    default: makeHex8(defaultFillHex6, defaultFillAlphaPct)
  });

  // Apply stroke on change (live)
  const onStrokeChange = (color /*, instance */) => {
    try {
      if (!color) return;
      const hex6 = '#' + color.toHEXA().slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('');
      if (hasSelection()) {
        setStrokeColorForSelectedShapes(hex6);
        log("INFO", "[toolbar-color] Applied stroke to selection", { hex6 });
      } else {
        // Persist with opaque alpha
        const hex8 = makeHex8(hex6, 100);
        setSettingAndSave("defaultStrokeColor", hex8);
        log("INFO", "[toolbar-color] Updated defaultStrokeColor", { hex8 });
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] Stroke change error", e);
    }
  };

  // Apply fill on change (live)
  const onFillChange = (color /*, instance */) => {
    try {
      if (!color) return;
      // hex + separate alpha percent
      const hexaArr = color.toHEXA();
      const hex6 = '#' + hexaArr.slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('');
      const rgba = color.toRGBA();
      const alphaPct = Math.round((rgba[3] ?? 1) * 100);

      if (hasSelection()) {
        setFillColorForSelectedShapes(hex6, alphaPct);
        log("INFO", "[toolbar-color] Applied fill to selection", { hex6, alphaPct });
      } else {
        const hex8 = makeHex8(hex6, alphaPct);
        setSettingAndSave("defaultFillColor", hex8);
        log("INFO", "[toolbar-color] Updated defaultFillColor", { hex8 });
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] Fill change error", e);
    }
  };

  // Wire events (live update)
  strokePickr.on('change', onStrokeChange);
  strokePickr.on('swatchselect', onStrokeChange);

  fillPickr.on('change', onFillChange);
  fillPickr.on('swatchselect', onFillChange);

  log("INFO", "[toolbar-color] Pickr color pickers installed");

  // Detach / destroy
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

