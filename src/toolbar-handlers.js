/**
 * toolbar-handlers.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Event Handlers (ESM ONLY)
 * Purpose:
 * - Attach all toolbar UI handlers (click/change) to DOM refs returned by renderToolbar().
 * - Dispatch intents to actions.js and selection.js (no business logic here).
 * - Handle image upload/server image selection via state.setImage().
 * - NEW (STY-01): Wire stroke/fill color controls with fill alpha.
 *   - If selection exists → apply to unlocked selected shapes.
 *   - If no selection → update defaults in settings (persisted).
 *
 * Public Exports:
 * - attachToolbarHandlers(refs) -> detachFn
 *   - refs: {
 *       container, imageUploadInput, imageUploadLabel, serverImageSelect,
 *       shapeTypeSelect, addShapeBtn, deleteBtn, duplicateBtn, resetRotationBtn,
 *       selectAllBtn, lockBtn, unlockBtn,
 *       strokeColorInput?, fillColorInput?, fillAlphaSlider?
 *     }
 *
 * Dependencies:
 * - log.js (log)
 * - state.js (setImage, getState)
 * - actions.js (add/delete/duplicate/lock/unlock/resetRotation)
 * - selection.js (selectAllShapes)
 * - settings-core.js (setSettingAndSave)
 * - shapes.js (setStrokeColorForSelectedShapes, setFillColorForSelectedShapes)
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { setImage, getState } from './state.js';
import {
  addShapeOfType,
  deleteSelectedShapes,
  duplicateSelectedShapes,
  lockSelectedShapes,
  unlockSelectedShapes,
  resetRotationForSelectedShapes
} from './actions.js';
import { selectAllShapes } from './selection.js';
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
  // #RGB fallback expand
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

/**
 * Attach all toolbar handlers. Returns a detach() function for cleanup.
 * @param {object} refs - DOM references from renderToolbar()
 * @returns {function} detach
 */
export function attachToolbarHandlers(refs) {
  if (!refs || typeof refs !== "object") {
    throw new Error("attachToolbarHandlers: refs object is required");
  }

  const {
    container,
    imageUploadInput,
    imageUploadLabel,
    serverImageSelect,
    shapeTypeSelect,
    addShapeBtn,
    deleteBtn,
    duplicateBtn,
    resetRotationBtn,
    selectAllBtn,
    lockBtn,
    unlockBtn,
    // NEW color controls (may be absent on older toolbars)
    strokeColorInput,
    fillColorInput,
    fillAlphaSlider
  } = refs;

  // Keep references to handlers for clean removal on detach()
  const handlers = [];

  // Utility to bind and track
  function on(el, evt, fn, opts) {
    if (!el || typeof el.addEventListener !== "function") return;
    el.addEventListener(evt, fn, opts || false);
    handlers.push(() => el.removeEventListener(evt, fn, opts || false));
  }

  // --- IMAGE UPLOAD ---
  const onUploadLabelClick = (e) => {
    try {
      if (!imageUploadInput) return;
      imageUploadInput.value = ""; // reset so selecting the same file re-triggers change
      imageUploadInput.click();
      log("DEBUG", "[toolbar-handlers] Upload label clicked → file input opened");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Upload label click failed", err);
    }
  };
  on(imageUploadLabel, 'click', onUploadLabelClick);

  const onUploadInputChange = (e) => {
    try {
      const file = e?.target?.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        const imgObj = new Image();
        imgObj.onload = function () {
          setImage(ev.target.result, imgObj);
          log("INFO", "[toolbar-handlers] Image set from upload", { size: file.size, name: file.name });
        };
        imgObj.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      // Clear server select to avoid ambiguity
      if (serverImageSelect) serverImageSelect.value = "";
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Upload input change failed", err);
    }
  };
  on(imageUploadInput, 'change', onUploadInputChange);

  // --- SERVER IMAGE SELECT ---
  const onServerImageChange = (e) => {
    try {
      const filename = e?.target?.value || "";
      if (!filename) {
        setImage(null, null);
        log("INFO", "[toolbar-handlers] Server image cleared");
        return;
      }
      const imgObj = new Image();
      imgObj.onload = function () {
        const url = `./images/${filename}`;
        setImage(url, imgObj);
        log("INFO", "[toolbar-handlers] Server image set", { url });
      };
      imgObj.src = `./images/${filename}`;
      // Clear any chosen file upload
      if (imageUploadInput) imageUploadInput.value = "";
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Server image select failed", err);
    }
  };
  on(serverImageSelect, 'change', onServerImageChange);

  // --- ADD SHAPE ---
  const onAddShapeClick = () => {
    try {
      const type = shapeTypeSelect?.value || 'point';
      addShapeOfType(type);
      log("INFO", "[toolbar-handlers] Add shape intent", { type });
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Add shape failed", err);
    }
  };
  on(addShapeBtn, 'click', onAddShapeClick);

  // --- DELETE ---
  const onDeleteClick = (ev) => {
    try {
      if (!deleteBtn || deleteBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Delete clicked while disabled");
        return;
      }
      deleteSelectedShapes();
      log("INFO", "[toolbar-handlers] Delete intent dispatched");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Delete failed", err);
    }
  };
  on(deleteBtn, 'click', onDeleteClick);

  // --- DUPLICATE ---
  const onDuplicateClick = (ev) => {
    try {
      if (!duplicateBtn || duplicateBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Duplicate clicked while disabled");
        return;
      }
      duplicateSelectedShapes();
      log("INFO", "[toolbar-handlers] Duplicate intent dispatched");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Duplicate failed", err);
    }
  };
  on(duplicateBtn, 'click', onDuplicateClick);

  // --- RESET ROTATION ---
  const onResetRotationClick = (ev) => {
    try {
      if (!resetRotationBtn || resetRotationBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Reset Rotation clicked while disabled");
        return;
      }
      resetRotationForSelectedShapes();
      log("INFO", "[toolbar-handlers] Reset Rotation intent dispatched");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Reset Rotation failed", err);
    }
  };
  on(resetRotationBtn, 'click', onResetRotationClick);

  // --- SELECT ALL ---
  const onSelectAllClick = (ev) => {
    try {
      if (!selectAllBtn || selectAllBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Select All clicked while disabled");
        return;
      }
      selectAllShapes();
      log("INFO", "[toolbar-handlers] Select All intent dispatched");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Select All failed", err);
    }
  };
  on(selectAllBtn, 'click', onSelectAllClick);

  // --- LOCK / UNLOCK ---
  const onLockClick = (ev) => {
    try {
      if (!lockBtn || lockBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Lock clicked while disabled");
        return;
      }
      lockSelectedShapes();
      log("INFO", "[toolbar-handlers] Lock intent dispatched");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Lock failed", err);
    }
  };
  on(lockBtn, 'click', onLockClick);

  const onUnlockClick = (ev) => {
    try {
      if (!unlockBtn || unlockBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Unlock clicked while disabled");
        return;
      }
      unlockSelectedShapes(); // selected locked or all locked if none selected
      log("INFO", "[toolbar-handlers] Unlock intent dispatched");
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Unlock failed", err);
    }
  };
  on(unlockBtn, 'click', onUnlockClick);

  // --- NEW: STY-01 Color Controls ---

  // Initialize UI with current defaults (tolerant of missing controls)
  try {
    const settings = getState().settings || {};
    if (strokeColorInput) {
      const strokeHex6 = toHex6(settings.defaultStrokeColor || "#000000ff");
      strokeColorInput.value = strokeHex6;
    }
    if (fillColorInput) {
      const fillHex6 = toHex6(settings.defaultFillColor || "#00000000");
      fillColorInput.value = fillHex6;
    }
    if (fillAlphaSlider) {
      const alphaPct = alphaPctFromHex(settings.defaultFillColor || "#00000000", 0);
      fillAlphaSlider.value = String(alphaPct);
      // Note: the visual readout span is updated in toolbar-dom.js on 'input'
    }
  } catch (e) {
    log("WARN", "[toolbar-handlers] Failed to init color inputs from settings", e);
  }

  // Utility: whether any shapes are currently selected
  function hasSelection() {
    const sel = getState().selectedShapes || [];
    return Array.isArray(sel) && sel.length > 0;
  }

  // Stroke color change
  const onStrokeColorChange = (e) => {
    try {
      const hex6 = toHex6(e?.target?.value || "#000000");
      if (hasSelection()) {
        setStrokeColorForSelectedShapes(hex6);
        log("INFO", "[toolbar-handlers] Applied stroke color to selection", { hex6 });
      } else {
        // Persist default with opaque alpha (FF)
        const hex8 = makeHex8(hex6, 100);
        setSettingAndSave("defaultStrokeColor", hex8);
        log("INFO", "[toolbar-handlers] Updated defaultStrokeColor", { hex8 });
      }
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Stroke color change failed", err);
    }
  };
  on(strokeColorInput, 'change', onStrokeColorChange);
  // Optional live feedback while dragging the picker
  on(strokeColorInput, 'input', onStrokeColorChange);

  // Fill color change
  const onFillColorChange = (e) => {
    try {
      const hex6 = toHex6(e?.target?.value || "#000000");
      const alphaPct = fillAlphaSlider ? Number(fillAlphaSlider.value) : 100;
      if (hasSelection()) {
        setFillColorForSelectedShapes(hex6, alphaPct);
        log("INFO", "[toolbar-handlers] Applied fill color (+alpha) to selection", { hex6, alphaPct });
      } else {
        const hex8 = makeHex8(hex6, alphaPct);
        setSettingAndSave("defaultFillColor", hex8);
        log("INFO", "[toolbar-handlers] Updated defaultFillColor", { hex8 });
      }
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Fill color change failed", err);
    }
  };
  on(fillColorInput, 'change', onFillColorChange);
  on(fillColorInput, 'input', onFillColorChange);

  // Fill alpha change (slider)
  const onFillAlphaInput = (e) => {
    try {
      const alphaPct = Number(e?.target?.value ?? 100);
      const hex6 = fillColorInput ? toHex6(fillColorInput.value || "#000000") : "#000000";
      if (hasSelection()) {
        setFillColorForSelectedShapes(hex6, alphaPct);
        log("INFO", "[toolbar-handlers] Applied fill alpha to selection", { hex6, alphaPct });
      } else {
        const hex8 = makeHex8(hex6, alphaPct);
        setSettingAndSave("defaultFillColor", hex8);
        log("INFO", "[toolbar-handlers] Updated defaultFillColor alpha", { hex8 });
      }
      // Note: visual "% value" label is handled in toolbar-dom.js listener
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Fill alpha change failed", err);
    }
  };
  on(fillAlphaSlider, 'input', onFillAlphaInput);
  on(fillAlphaSlider, 'change', onFillAlphaInput);

  log("INFO", "[toolbar-handlers] Toolbar handlers attached");

  // Detach function for cleanup (hot reload, panel destroy)
  return function detach() {
    try {
      handlers.forEach(off => {
        try { off(); } catch {}
      });
      log("INFO", "[toolbar-handlers] Toolbar handlers detached");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Detach handlers error", e);
    }
  };
}

