import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/classic.min.css';

import { log } from './log.js';
import { getState, sceneDesignerStore } from './state.js';
import { setSettingAndSave } from './settings-core.js';
import { setStrokeColorForSelected, setFillColorForSelected } from './actions.js';

// ... Utility functions (unchanged) ...

// [Utility function definitions omitted for brevity; unchanged from prior version.]

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
  let muteStrokeChange = false;
  let muteFillChange = false;

  // ---- BATCH 6: When selection, build items array, not single color ----
  const applyStroke = (hex6, opts = {}) => {
    try {
      const sel = getState().selectedShapes || [];
      if (Array.isArray(sel) && sel.length > 0) {
        const items = sel
          .map(s => s && s._id)
          .filter(Boolean)
          .map(id => ({ id, color: hex6 }));
        setStrokeColorForSelected(items, opts);
        log("DEBUG", "[toolbar-color] Stroke applied", { coalesceKey: opts.coalesceKey });
      } else {
        const hex8 = makeHex8(hex6, 100);
        setSettingAndSave("defaultStrokeColor", hex8);
        log("INFO", "[toolbar-color] Default stroke updated");
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] applyStroke error", e);
    }
  };

  const applyFill = (hex6, alphaPct, opts = {}) => {
    try {
      const sel = getState().selectedShapes || [];
      if (Array.isArray(sel) && sel.length > 0) {
        const rgba = rgbaStringFromHex6(hex6, alphaPct);
        const items = sel
          .map(s => s && s._id)
          .filter(Boolean)
          .map(id => ({ id, fill: rgba }));
        setFillColorForSelected(items, opts);
        log("DEBUG", "[toolbar-color] Fill applied", { coalesceKey: opts.coalesceKey });
      } else {
        const hex8 = makeHex8(hex6, alphaPct);
        setSettingAndSave("defaultFillColor", hex8);
        log("INFO", "[toolbar-color] Default fill updated");
      }
    } catch (e) {
      log("ERROR", "[toolbar-color] applyFill error", e);
    }
  };

  // ... Rest of pickr event bindings and sync logic unchanged ...

  const debouncedStroke = debounce((hex6, key) => {
    applyStroke(hex6, { coalesceKey: key, coalesceWindowMs: 1000 });
  }, 140);
  const debouncedFill = debounce((hex6, alphaPct, key) => {
    applyFill(hex6, alphaPct, { coalesceKey: key, coalesceWindowMs: 1000 });
  }, 140);

  const onStrokeChange = (color) => {
    if (!color || muteStrokeChange) return;
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
    if (!color || muteFillChange) return;
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
          strokeTitleExtra = '';
        } else {
          strokeTitleExtra = ' (mixed)';
        }
      }
    }
    try { strokePickrEl.title = 'Stroke color' + strokeTitleExtra; } catch {}

    let fillTitleExtra = '';
    const nonPoint = selected.length ? selected.filter(sh => sh && sh._type !== 'point') : [];
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
        const allSame = fills.every(f => f.hex6 === first.hex6 && Math.abs(f.alphaPct - first.alphaPct) < 0.5);
        if (allSame) {
          setFillPickrSilently(first.hex6, first.alphaPct);
          fillTitleExtra = '';
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

// [End of file]
