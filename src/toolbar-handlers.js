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
import { exportSceneJSON, importSceneJSON } from './serialization/scene-io.js';

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
    exportJsonBtn,
    importJsonBtn,
    importJsonFile,
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
        return;
      }
      if (!hasTwoOrMoreSelected()) return;
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
        return;
      }
      undo();
      log("DEBUG", "[toolbar-handlers] Undo via toolbar");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Undo failed", e);
    }
  };
  on(undoBtn, 'click', onUndoClick);

  const onRedoClick = (ev) => {
    try {
      if (!redoBtn || redoBtn.disabled) {
        ev && ev.preventDefault && ev.preventDefault();
        return;
      }
      redo();
      log("DEBUG", "[toolbar-handlers] Redo via toolbar");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Redo failed", e);
    }
  };
  on(redoBtn, 'click', onRedoClick);

  try {
    if (strokePickrEl && fillPickrEl) {
      detachPickrs = installColorPickers({ strokePickrEl, fillPickrEl });
      log("INFO", "[toolbar-handlers] Color pickers installed");
    } else {
      log("WARN", "[toolbar-handlers] Pickr hosts missing", {
        hasStrokeHost: !!strokePickrEl,
        hasFillHost: !!fillPickrEl
      });
    }
  } catch (e) {
    log("ERROR", "[toolbar-handlers] Failed to install color pickers", e);
  }

  function coerceStrokeWidth(raw) {
    let w = Number(raw);
    if (!Number.isFinite(w)) return null;
    if (w < 1) w = 1;
    if (w > 20) w = 20;
    w = Math.round(w);
    return w;
  }

  let strokeWidthSession = 0;
  let strokeWidthKey = null;
  const beginStrokeWidthSession = () => {
    strokeWidthSession += 1;
    strokeWidthKey = `stroke-width-${strokeWidthSession}`;
  };
  const endStrokeWidthSession = () => {
    strokeWidthKey = null;
  };

  const applyStrokeWidth = (source = 'input', key = null) => {
    try {
      if (!strokeWidthInput) return;
      const w = coerceStrokeWidth(strokeWidthInput.value);
      if (!Number.isFinite(w) || w <= 0) return;

      try { strokeWidthInput.value = String(w); } catch {}

      const selected = Array.isArray(getState().selectedShapes) ? getState().selectedShapes.filter(Boolean) : [];
      const anyUnlocked = selected.some(s => s && !s.locked);
      if (selected.length > 0 && anyUnlocked) {
        const opts = key ? { coalesceKey: key, coalesceWindowMs: 1000 } : undefined;
        setStrokeWidthForSelected(w, opts);
        log("DEBUG", "[toolbar-handlers] Stroke width applied to selection", { width: w, source, coalesceKey: key || null });
      } else {
        setSettingAndSave("defaultStrokeWidth", w);
        log("DEBUG", "[toolbar-handlers] Default stroke width updated", { width: w, source });
      }
    } catch (e) {
      log("ERROR", "[toolbar-handlers] applyStrokeWidth error", e);
    }
  };

  const debouncedApplyStrokeWidth = debounce((key) => applyStrokeWidth('debounced', key));

  if (strokeWidthInput) {
    on(strokeWidthInput, 'focus', () => {
      if (!strokeWidthKey) beginStrokeWidthSession();
    });
    on(strokeWidthInput, 'input', () => {
      if (!strokeWidthKey) beginStrokeWidthSession();
      debouncedApplyStrokeWidth(strokeWidthKey);
    });
    on(strokeWidthInput, 'change', () => {
      if (!strokeWidthKey) beginStrokeWidthSession();
      applyStrokeWidth('change', strokeWidthKey);
      endStrokeWidthSession();
    });
    on(strokeWidthInput, 'blur', () => {
      if (!strokeWidthKey) beginStrokeWidthSession();
      applyStrokeWidth('blur', strokeWidthKey);
      endStrokeWidthSession();
    });
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
        log("DEBUG", "[toolbar-handlers] Settings panel shown via toggle");
      } else {
        setSettingAndSave("showSettingsPanel", false);
        log("DEBUG", "[toolbar-handlers] Settings panel hidden via toggle");
      }
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Settings toggle failed", e);
    }
  };
  if (settingsToggleBtn) on(settingsToggleBtn, 'click', onSettingsToggleClick);

  function downloadText(filename, text) {
    try {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch {}
        try { URL.revokeObjectURL(url); } catch {}
      }, 0);
    } catch (e) {
      log("ERROR", "[toolbar-handlers] downloadText failed", e);
    }
  }

  const onExportJsonClick = () => {
    try {
      const json = exportSceneJSON(true);
      const ts = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fname = `scene-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
      downloadText(fname, json);
      log("INFO", "[toolbar-handlers] Scene exported", { bytes: json.length, filename: fname });
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Export scene failed", e);
    }
  };

  const onImportJsonClick = () => {
    try {
      if (!importJsonFile) return;
      importJsonFile.value = "";
      importJsonFile.click();
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Import click failed", e);
    }
  };

  const onImportJsonFileChange = async (e) => {
    try {
      const file = e?.target?.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const result = await importSceneJSON(text);
      log("INFO", "[toolbar-handlers] Scene imported", {
        filename: file.name,
        shapesLoaded: result?.shapesLoaded ?? 0,
        imageSet: !!result?.imageSet
      });
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Import scene failed", err);
    } finally {
      try { if (importJsonFile) importJsonFile.value = ""; } catch {}
    }
  };

  on(exportJsonBtn, 'click', onExportJsonClick);
  on(importJsonBtn, 'click', onImportJsonClick);
  on(importJsonFile, 'change', onImportJsonFileChange);

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
