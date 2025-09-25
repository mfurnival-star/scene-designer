import { log } from './log.js';
import { setImage, getState } from './state.js';
import {
  addShapeOfType,
  deleteSelectedShapes,
  duplicateSelectedShapes,
  lockSelectedShapes,
  unlockSelectedShapes,
  resetRotationForSelectedShapes,
  alignSelected,
  setStrokeWidthForSelected
} from './actions.js';
import { selectAllShapes } from './selection.js';
import { installColorPickers } from './toolbar-color.js';
import { runDebugCapture } from './debug.js';
import { undo, redo } from './commands/command-bus.js';
import { setSettingAndSave } from './settings-core.js';

function resolveServerImageUrl(filename) {
  const base = (typeof window !== 'undefined' ? window.location.href : '');
  return new URL(`./images/${filename}`, base).href;
}

function loadImageFromBlob(blob, cb, canonicalUrl) {
  try {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      cb(img, canonicalUrl);
    };
    img.onerror = (e) => {
      try { URL.revokeObjectURL(objectUrl); } catch {}
      log("ERROR", "[toolbar-handlers] Image element failed to load from Blob URL", { canonicalUrl, error: e });
    };
    img.src = objectUrl;
  } catch (e) {
    log("ERROR", "[toolbar-handlers] Failed to create Blob URL for image", { canonicalUrl, error: e });
  }
}

function debounce(fn, wait = 140) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function attachToolbarHandlers(refs) {
  if (!refs || typeof refs !== "object") {
    throw new Error("attachToolbarHandlers: refs object is required");
  }

  const {
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
    undoBtn,
    redoBtn,
    alignLeftBtn,
    alignCenterXBtn,
    alignRightBtn,
    alignTopBtn,
    alignMiddleYBtn,
    alignBottomBtn,
    strokePickrEl,
    fillPickrEl,
    strokeWidthInput,
    debugBtn,
    settingsToggleBtn
  } = refs;

  const handlers = [];
  let detachPickrs = null;

  function on(el, evt, fn, opts) {
    if (!el || typeof el.addEventListener !== "function") return;
    el.addEventListener(evt, fn, opts || false);
    handlers.push(() => el.removeEventListener(evt, fn, opts || false));
  }

  const onUploadLabelClick = () => {
    try {
      if (!imageUploadInput) return;
      imageUploadInput.value = "";
      imageUploadInput.click();
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
      reader.onerror = (ev) => {
        log("ERROR", "[toolbar-handlers] FileReader error (upload)", ev?.target?.error || ev);
      };
      reader.onload = function (ev) {
        try {
          const dataUrl = ev?.target?.result;
          if (!dataUrl) {
            log("ERROR", "[toolbar-handlers] FileReader produced empty result");
            return;
          }
          const imgObj = new Image();
          imgObj.onload = function () {
            setImage(dataUrl, imgObj);
            log("INFO", "[toolbar-handlers] Image set from upload", { size: file.size, name: file.name });
          };
          imgObj.onerror = (err) => {
            log("ERROR", "[toolbar-handlers] HTMLImageElement error (upload data URL)", err);
          };
          imgObj.src = dataUrl;
        } catch (e2) {
          log("ERROR", "[toolbar-handlers] Upload onload handler failed", e2);
        }
      };
      reader.readAsDataURL(file);
      if (serverImageSelect) serverImageSelect.value = "";
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Upload input change failed", err);
    }
  };
  on(imageUploadInput, 'change', onUploadInputChange);

  const onServerImageChange = async (e) => {
    try {
      const filename = e?.target?.value || "";
      if (!filename) {
        setImage(null, null);
        log("INFO", "[toolbar-handlers] Server image cleared");
        return;
      }

      const absoluteUrl = resolveServerImageUrl(filename);

      let resp;
      try {
        resp = await fetch(absoluteUrl, { method: 'GET', cache: 'no-cache' });
      } catch (fetchErr) {
        log("ERROR", "[toolbar-handlers] Network error fetching server image", { absoluteUrl, error: fetchErr });
        return;
      }
      if (!resp.ok) {
        log("ERROR", "[toolbar-handlers] Server image fetch failed", { absoluteUrl, status: resp.status, statusText: resp.statusText });
        return;
      }

      const blob = await resp.blob();
      loadImageFromBlob(blob, (imgEl, canonicalUrl) => {
        setImage(canonicalUrl, imgEl);
        log("INFO", "[toolbar-handlers] Server image loaded", {
          canonicalUrl,
          w: imgEl.naturalWidth,
          h: imgEl.naturalHeight
        });
      }, absoluteUrl);

      if (imageUploadInput) imageUploadInput.value = "";
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Server image select failed", err);
    }
  };
  on(serverImageSelect, 'change', onServerImageChange);

  const onAddShapeClick = () => {
    try {
      const type = shapeTypeSelect?.value || 'point';
      addShapeOfType(type);
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Add shape failed", err);
    }
  };
  on(addShapeBtn, 'click', onAddShapeClick);

  const onDeleteClick = (ev) => {
    try {
      if (!deleteBtn || deleteBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Delete clicked while disabled");
        return;
      }
      deleteSelectedShapes();
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Delete failed", err);
    }
  };
  on(deleteBtn, 'click', onDeleteClick);

  const onDuplicateClick = (ev) => {
    try {
      if (!duplicateBtn || duplicateBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Duplicate clicked while disabled");
        return;
      }
      duplicateSelectedShapes();
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Duplicate failed", err);
    }
  };
  on(duplicateBtn, 'click', onDuplicateClick);

  const onResetRotationClick = (ev) => {
    try {
      if (!resetRotationBtn || resetRotationBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Reset Rotation clicked while disabled");
        return;
      }
      resetRotationForSelectedShapes();
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Reset Rotation failed", err);
    }
  };
  on(resetRotationBtn, 'click', onResetRotationClick);

  const onSelectAllClick = (ev) => {
    try {
      if (!selectAllBtn || selectAllBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Select All clicked while disabled");
        return;
      }
      selectAllShapes();
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Select All failed", err);
    }
  };
  on(selectAllBtn, 'click', onSelectAllClick);

  const onLockClick = (ev) => {
    try {
      if (!lockBtn || lockBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Lock clicked while disabled");
        return;
      }
      lockSelectedShapes();
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
      unlockSelectedShapes();
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Unlock failed", err);
    }
  };
  on(unlockBtn, 'click', onUnlockClick);

  const hasTwoOrMoreSelected = () => {
    const sel = getState().selectedShapes || [];
    return Array.isArray(sel) && sel.length >= 2;
  };
  const handleAlignClick = (mode) => (ev) => {
    try {
      const btn = ev?.currentTarget;
      if (btn && btn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", `[toolbar-handlers] Align '${mode}' clicked while disabled`);
        return;
      }
      if (!hasTwoOrMoreSelected()) {
        log("WARN", "[toolbar-handlers] Align: need 2+ selected");
        return;
      }
      alignSelected(mode);
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Align failed", { mode, err });
    }
  };

  on(alignLeftBtn, 'click', handleAlignClick('left'));
  on(alignCenterXBtn, 'click', handleAlignClick('centerX'));
  on(alignRightBtn, 'click', handleAlignClick('right'));
  on(alignTopBtn, 'click', handleAlignClick('top'));
  on(alignMiddleYBtn, 'click', handleAlignClick('middleY'));
  on(alignBottomBtn, 'click', handleAlignClick('bottom'));

  const onUndoClick = (ev) => {
    try {
      if (!undoBtn || undoBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Undo clicked while disabled");
        return;
      }
      undo();
      log("INFO", "[toolbar-handlers] Undo triggered via toolbar button");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Undo failed", e);
    }
  };
  on(undoBtn, 'click', onUndoClick);

  const onRedoClick = (ev) => {
    try {
      if (!redoBtn || redoBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        log("WARN", "[toolbar-handlers] Redo clicked while disabled");
        return;
      }
      redo();
      log("INFO", "[toolbar-handlers] Redo triggered via toolbar button");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Redo failed", e);
    }
  };
  on(redoBtn, 'click', onRedoClick);

  try {
    if (strokePickrEl && fillPickrEl) {
      detachPickrs = installColorPickers({ strokePickrEl, fillPickrEl });
      log("INFO", "[toolbar-handlers] Pickr color pickers installed");
    } else {
      log("WARN", "[toolbar-handlers] Pickr hosts missing; color pickers not installed", {
        hasStrokeHost: !!strokePickrEl,
        hasFillHost: !!fillPickrEl
      });
    }
  } catch (e) {
    log("ERROR", "[toolbar-handlers] Failed to install Pickr color pickers", e);
  }

  function coerceStrokeWidth(raw) {
    let w = Number(raw);
    if (!Number.isFinite(w)) return null;
    if (w < 1) w = 1;
    if (w > 20) w = 20;
    w = Math.round(w);
    return w;
  }

  const applyStrokeWidth = (source = 'input') => {
    try {
      if (!strokeWidthInput) return;
      const w = coerceStrokeWidth(strokeWidthInput.value);
      if (!Number.isFinite(w) || w <= 0) {
        log("WARN", "[toolbar-handlers] Stroke width ignored (invalid)", { value: strokeWidthInput.value });
        return;
      }
      try { strokeWidthInput.value = String(w); } catch {}

      const selected = Array.isArray(getState().selectedShapes) ? getState().selectedShapes.filter(Boolean) : [];
      const anyUnlocked = selected.some(s => s && !s.locked);
      if (selected.length > 0 && anyUnlocked) {
        setStrokeWidthForSelected(w);
        log("INFO", "[toolbar-handlers] Stroke width applied to selection", { width: w, source });
      } else {
        setSettingAndSave("defaultStrokeWidth", w);
        log("INFO", "[toolbar-handlers] Default stroke width updated", { width: w, source });
      }
    } catch (e) {
      log("ERROR", "[toolbar-handlers] applyStrokeWidth error", e);
    }
  };

  const debouncedApplyStrokeWidth = debounce(() => applyStrokeWidth('debounced'));

  if (strokeWidthInput) {
    on(strokeWidthInput, 'input', () => debouncedApplyStrokeWidth());
    on(strokeWidthInput, 'change', () => applyStrokeWidth('change'));
    on(strokeWidthInput, 'blur', () => applyStrokeWidth('blur'));
  } else {
    log("WARN", "[toolbar-handlers] strokeWidthInput ref missing; stroke width control not wired");
  }

  const onDebugClick = async () => {
    try {
      if (!debugBtn) return;
      debugBtn.disabled = true;
      const origText = debugBtn.textContent;
      debugBtn.textContent = "Collecting…";

      const { text, snapshot } = await runDebugCapture({ format: 'json', copy: true, log: false });

      debugBtn.textContent = "Copied ✓";
      setTimeout(() => {
        debugBtn.textContent = origText || "Debug";
        debugBtn.disabled = false;
      }, 1000);

      log("INFO", "[toolbar-handlers] Debug snapshot captured", {
        copiedToClipboard: !!text,
        sections: snapshot?.meta?.sections || []
      });
    } catch (e) {
      if (debugBtn) {
        debugBtn.textContent = "Failed";
        setTimeout(() => {
          debugBtn.textContent = "Debug";
          debugBtn.disabled = false;
        }, 1000);
      }
      log("ERROR", "[toolbar-handlers] Debug snapshot failed", e);
    }
  };
  if (debugBtn) on(debugBtn, 'click', onDebugClick);

  const onSettingsToggleClick = () => {
    try {
      const s = getState().settings || {};
      const isVisible = !!s.showSettingsPanel;
      if (!isVisible) {
        if (s.showRightSidebarPanel === false) setSettingAndSave("showRightSidebarPanel", true);
        setSettingAndSave("showSettingsPanel", true);
        log("INFO", "[toolbar-handlers] Settings panel shown via toolbar toggle");
      } else {
        setSettingAndSave("showSettingsPanel", false);
        log("INFO", "[toolbar-handlers] Settings panel hidden via toolbar toggle");
      }
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Settings toggle failed", e);
    }
  };
  if (settingsToggleBtn) on(settingsToggleBtn, 'click', onSettingsToggleClick);

  log("INFO", "[toolbar-handlers] Toolbar handlers attached");
  return function detach() {
    try {
      handlers.forEach(off => { try { off(); } catch {} });
      try { detachPickrs && detachPickrs(); } catch {}
      log("INFO", "[toolbar-handlers] Toolbar handlers detached");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Detach handlers error", e);
    }
  };
}
