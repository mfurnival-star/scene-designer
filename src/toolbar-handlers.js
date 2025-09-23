/**
 * toolbar-handlers.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Event Handlers (ESM ONLY)
 * Purpose:
 * - Attach all toolbar UI handlers (click/change) to DOM refs returned by renderToolbar().
 * - Dispatch intents to actions.js and selection.js (no business logic here).
 * - Handle image upload/server image selection via state.setImage().
 * - Color controls use Pickr via toolbar-color.js (no native <input type="color"> here).
 * - Alignment controls dispatch actions.alignSelected(mode, ref).
 *
 * Public Exports:
 * - attachToolbarHandlers(refs) -> detachFn
 *   - refs: {
 *       container, imageUploadInput, imageUploadLabel, serverImageSelect,
 *       shapeTypeSelect, addShapeBtn, deleteBtn, duplicateBtn, resetRotationBtn,
 *       selectAllBtn, lockBtn, unlockBtn,
 *       strokePickrEl?, fillPickrEl?,
 *       alignRefSelect?, alignLeftBtn?, alignCenterXBtn?, alignRightBtn?,
 *       alignTopBtn?, alignMiddleYBtn?, alignBottomBtn?
 *     }
 *
 * Dependencies:
 * - log.js (log)
 * - state.js (setImage, getState)
 * - actions.js (add/delete/duplicate/lock/unlock/resetRotation/alignSelected)
 * - selection.js (selectAllShapes)
 * - toolbar-color.js (installColorPickers)
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
    // Alignment controls (optional if older DOM)
    alignRefSelect,
    alignLeftBtn,
    alignCenterXBtn,
    alignRightBtn,
    alignTopBtn,
    alignMiddleYBtn,
    alignBottomBtn,
    // Pickr hosts
    strokePickrEl,
    fillPickrEl
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

  // --- ALIGNMENT ---
  // Helper to resolve current reference mode from dropdown (defaults to 'selection')
  const getAlignRef = () => {
    const v = alignRefSelect?.value;
    return v === 'canvas' ? 'canvas' : 'selection';
  };
  // Guard: Require 2+ selected (business logic also guards, but we avoid spam)
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
      const refMode = getAlignRef();
      alignSelected(mode, refMode);
      log("INFO", "[toolbar-handlers] Align intent dispatched", { mode, refMode });
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

  // Alignment ref select just logs for now; action reads its value at click time
  if (alignRefSelect) {
    const onAlignRefChange = () => {
      const v = getAlignRef();
      log("DEBUG", "[toolbar-handlers] Alignment reference changed", { ref: v });
    };
    on(alignRefSelect, 'change', onAlignRefChange);
  }

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

