/**
 * toolbar-handlers.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Event Handlers (ESM ONLY)
 * Purpose:
 * - Attach toolbar UI handlers (click/change) to DOM refs returned by renderToolbar().
 * - Dispatch intents to actions.js and selection.js (no business logic here).
 * - Handle image upload/server image selection via state.setImage().
 * - Color controls use Pickr via toolbar-color.js.
 * - Alignment controls dispatch actions.alignSelected(mode) relative to the selection hull.
 * - Debug button triggers a diagnostic snapshot via debug.js (on-demand).
 *
 * Logging (reduced noise):
 * - Keep WARN/ERROR for failures or disabled-clicks.
 * - Minimize INFO for routine successful clicks (UI already shows the effect).
 * - Image operations keep concise INFO since they affect canvas size.
 *
 * Public Export:
 * - attachToolbarHandlers(refs) -> detachFn
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
  resetRotationForSelectedShapes,
  alignSelected
} from './actions.js';
import { selectAllShapes } from './selection.js';
import { installColorPickers } from './toolbar-color.js';
import { runDebugCapture } from './debug.js';

/**
 * Resolve an absolute URL for a server image under ./images/
 */
function resolveServerImageUrl(filename) {
  const base = (typeof window !== 'undefined' ? window.location.href : '');
  return new URL(`./images/${filename}`, base).href;
}

/**
 * Load an HTMLImageElement from a Blob (fetch response) and invoke cb(imageEl).
 */
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
    // Alignment controls
    alignLeftBtn,
    alignCenterXBtn,
    alignRightBtn,
    alignTopBtn,
    alignMiddleYBtn,
    alignBottomBtn,
    // Pickr hosts
    strokePickrEl,
    fillPickrEl,
    // Debug button (optional)
    debugBtn
  } = refs;

  const handlers = [];
  let detachPickrs = null;

  function on(el, evt, fn, opts) {
    if (!el || typeof el.addEventListener !== "function") return;
    el.addEventListener(evt, fn, opts || false);
    handlers.push(() => el.removeEventListener(evt, fn, opts || false));
  }

  // --- IMAGE: Upload (local file → data URL) ---
  const onUploadLabelClick = () => {
    try {
      if (!imageUploadInput) return;
      imageUploadInput.value = ""; // allow same-file reselect
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
      // Clear server select to avoid ambiguity
      if (serverImageSelect) serverImageSelect.value = "";
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Upload input change failed", err);
    }
  };
  on(imageUploadInput, 'change', onUploadInputChange);

  // --- IMAGE: Server select (fetch preflight → Blob → Image) ---
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
      // No INFO log; success is visible on canvas
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
    } catch (err) {
      log("ERROR", "[toolbar-handlers] Unlock failed", err);
    }
  };
  on(unlockBtn, 'click', onUnlockClick);

  // --- ALIGNMENT (relative to selection hull) ---
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

  // --- Color pickers (Pickr) ---
  try {
    if (strokePickrEl && fillPickrEl) {
      detachPickrs = installColorPickers({ strokePickrEl, fillPickrEl });
      // Keep one INFO (installed); heavy logs inside pickr handlers are already minimal
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

  // --- Debug button (optional, on-demand) ---
  const onDebugClick = async () => {
    try {
      if (!debugBtn) return;
      debugBtn.disabled = true;
      const origText = debugBtn.textContent;
      debugBtn.textContent = "Collecting…";

      const { text, snapshot } = await runDebugCapture({ format: 'json', copy: true, log: false });

      // Visual feedback only; logging is on-demand
      debugBtn.textContent = "Copied ✓";
      setTimeout(() => {
        debugBtn.textContent = origText || "Debug";
        debugBtn.disabled = false;
      }, 1000);

      // Keep a single INFO line (low frequency action)
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

  log("INFO", "[toolbar-handlers] Toolbar handlers attached");

  // Detach function for cleanup (hot reload, panel destroy)
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
