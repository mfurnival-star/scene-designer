/**
 * toolbar-handlers.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Event Handlers (ESM ONLY)
 * Purpose:
 * - Attach all toolbar UI handlers (click/change) to DOM refs returned by renderToolbar().
 * - Dispatch intents to actions.js and selection.js (no business logic here).
 * - Handle image upload/server image selection via state.setImage().
 * - Color controls use Pickr via toolbar-color.js (no native <input type="color"> here).
 * - Alignment controls dispatch actions.alignSelected(mode) relative to the selection hull.
 * - Debug button (optional) triggers a diagnostic snapshot via debug.js and copies it to clipboard.
 *
 * Phase-1 Hardening:
 * - Server image selection now performs a fetch() preflight to surface 404/NETWORK errors
 *   and guarantee a visible network request (Eruda Network panel).
 * - On success, the image element is loaded from a Blob URL (no 2nd network hit),
 *   while state.imageURL stores the canonical absolute URL for reference.
 *
 * Public Exports:
 * - attachToolbarHandlers(refs) -> detachFn
 *   - refs: {
 *       container, imageUploadInput, imageUploadLabel, serverImageSelect,
 *       shapeTypeSelect, addShapeBtn, deleteBtn, duplicateBtn, resetRotationBtn,
 *       selectAllBtn, lockBtn, unlockBtn,
 *       strokePickrEl?, fillPickrEl?,
 *       alignLeftBtn?, alignCenterXBtn?, alignRightBtn?,
 *       alignTopBtn?, alignMiddleYBtn?, alignBottomBtn?,
 *       debugBtn? // NEW: optional Debug snapshot button
 *     }
 *
 * Dependencies:
 * - log.js (log)
 * - state.js (setImage, getState)
 * - actions.js (add/delete/duplicate/lock/unlock/resetRotation/alignSelected)
 * - selection.js (selectAllShapes)
 * - toolbar-color.js (installColorPickers)
 * - debug.js (runDebugCapture)  // NEW
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
 * Ensures paths remain correct when hosted under /scene-designer/.
 */
function resolveServerImageUrl(filename) {
  const base = (typeof window !== 'undefined' ? window.location.href : '');
  const url = new URL(`./images/${filename}`, base).href;
  return url;
}

/**
 * Load an HTMLImageElement from a Blob (fetch response) and invoke cb(imageEl).
 * Pass canonicalUrl through for logging/state.
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
    // Alignment controls (relative to selection hull only)
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

  // Keep references to handlers and detach fns for clean removal on detach()
  const handlers = [];
  let detachPickrs = null;

  // Utility to bind and track
  function on(el, evt, fn, opts) {
    if (!el || typeof el.addEventListener !== "function") return;
    el.addEventListener(evt, fn, opts || false);
    handlers.push(() => el.removeEventListener(evt, fn, opts || false));
  }

  // --- IMAGE UPLOAD (local file → data URL) ---
  const onUploadLabelClick = () => {
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
      reader.onloadstart = () => {
        log("DEBUG", "[toolbar-handlers] FileReader onloadstart (upload)");
      };
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

  // --- SERVER IMAGE SELECT (fetch preflight → Blob → Image element) ---
  const onServerImageChange = async (e) => {
    try {
      const filename = e?.target?.value || "";
      if (!filename) {
        setImage(null, null);
        log("INFO", "[toolbar-handlers] Server image cleared");
        return;
      }

      const absoluteUrl = resolveServerImageUrl(filename);
      log("INFO", "[toolbar-handlers] Server image selection", {
        filename,
        absoluteUrl,
        location: { href: window.location.href, pathname: window.location.pathname }
      });

      // Preflight fetch so that Network tab shows the request and we can surface errors
      log("DEBUG", "[toolbar-handlers] Fetching server image (preflight)", { absoluteUrl });
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
        log("INFO", "[toolbar-handlers] Server image loaded and set", {
          canonicalUrl,
          naturalWidth: imgEl.naturalWidth,
          naturalHeight: imgEl.naturalHeight
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
        log("INFO", "[toolbar-handlers] Align no-op (need 2+ selected)");
        return;
      }
      // Always align relative to selection hull
      alignSelected(mode);
      log("INFO", "[toolbar-handlers] Align intent dispatched", { mode });
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
      log("INFO", "[toolbar-handlers] Pickr color pickers installed via toolbar-color.js");
    } else {
      log("WARN", "[toolbar-handlers] Pickr hosts missing; color pickers not installed", {
        hasStrokeHost: !!strokePickrEl,
        hasFillHost: !!fillPickrEl
      });
    }
  } catch (e) {
    log("ERROR", "[toolbar-handlers] Failed to install Pickr color pickers", e);
  }

  // --- Debug button (optional) ---
  const onDebugClick = async (ev) => {
    try {
      if (!debugBtn) return;
      debugBtn.disabled = true;
      const origText = debugBtn.textContent;
      debugBtn.textContent = "Collecting…";

      const { text, snapshot } = await runDebugCapture({ format: 'json', copy: true, log: true });

      // Simple visual feedback
      debugBtn.textContent = "Copied ✓";
      setTimeout(() => {
        debugBtn.textContent = origText || "Debug";
        debugBtn.disabled = false;
      }, 1200);

      log("INFO", "[toolbar-handlers] Debug snapshot captured", {
        copiedToClipboard: true,
        shapeCount: snapshot?.scene?.shapeCount,
        selectedCount: snapshot?.scene?.selectedCount,
        fabricActiveType: snapshot?.fabricSelection?.activeType,
        fabricMemberCount: snapshot?.fabricSelection?.memberCount
      });
      // Full text already logged at DEBUG inside runDebugCapture
    } catch (e) {
      if (debugBtn) {
        debugBtn.textContent = "Failed";
        setTimeout(() => {
          debugBtn.textContent = "Debug";
          debugBtn.disabled = false;
        }, 1200);
      }
      log("ERROR", "[toolbar-handlers] Debug snapshot failed", e);
    }
  };
  if (debugBtn) {
    on(debugBtn, 'click', onDebugClick);
    log("INFO", "[toolbar-handlers] Debug button handler attached");
  } else {
    log("DEBUG", "[toolbar-handlers] Debug button not present (skipping handler)");
  }

  log("INFO", "[toolbar-handlers] Toolbar handlers attached");

  // Detach function for cleanup (hot reload, panel destroy)
  return function detach() {
    try {
      handlers.forEach(off => {
        try { off(); } catch {}
      });
      try { detachPickrs && detachPickrs(); } catch {}
      log("INFO", "[toolbar-handlers] Toolbar handlers detached");
    } catch (e) {
      log("ERROR", "[toolbar-handlers] Detach handlers error", e);
    }
  };
}
