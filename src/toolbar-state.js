/**
 * toolbar-state.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar State Sync (ESM ONLY)
 * Purpose:
 * - Derive button enabled/disabled state from the centralized store.
 * - Keep toolbar scale in sync with settings (toolbarUIScale).
 * - No business logic and no event wiring; only UI state updates.
 *
 * Public Exports:
 * - installButtonsStateSync(refs) -> detachFn
 * - installToolbarScaleSync(containerEl) -> detachFn
 *
 * Dependencies:
 * - state.js (getState, sceneDesignerStore)
 * - log.js (log)
 * -----------------------------------------------------------
 */

import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';

/**
 * Utility: Enable/disable a button element, update ARIA and title.
 * @param {HTMLButtonElement} el
 * @param {boolean} enabled
 * @param {string} [disabledTitle]
 * @param {string} [enabledTitle]
 */
function setEnabled(el, enabled, disabledTitle, enabledTitle) {
  if (!el) return;
  el.disabled = !enabled;
  el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  if (!enabled) {
    el.classList.add('disabled');
    if (disabledTitle) el.title = disabledTitle;
  } else {
    el.classList.remove('disabled');
    if (enabledTitle) el.title = enabledTitle;
  }
}

/**
 * Install state-driven button enable/disable updates.
 * Accepts DOM refs returned by renderToolbar().
 * Returns a detach function to unsubscribe.
 */
export function installButtonsStateSync(refs) {
  const {
    // Core actions
    deleteBtn,
    duplicateBtn,
    resetRotationBtn,
    selectAllBtn,
    lockBtn,
    unlockBtn,
    // Alignment controls (no reference dropdown)
    alignLeftBtn,
    alignCenterXBtn,
    alignRightBtn,
    alignTopBtn,
    alignMiddleYBtn,
    alignBottomBtn
  } = refs || {};

  function updateButtonsState() {
    const selected = getState().selectedShapes || [];
    const shapes = getState().shapes || [];

    const selectedCount = selected.length;
    const shapesCount = shapes.length;

    // Lock/Unlock state derivation
    const anyUnlockedSelected = selected.some(s => s && !s.locked);
    const anyLockedSelected = selected.some(s => s && s.locked);
    const anyLockedInStore = shapes.some(s => s && s.locked);

    // Rotatable eligibility: unlocked rect or circle
    const anyRotatableSelected = selected.some(s =>
      s && !s.locked && (s._type === 'rect' || s._type === 'circle')
    );

    // Alignment eligibility: must have 2+ selected (locks are handled by the action)
    const canAlign = selectedCount >= 2;

    // Delete
    setEnabled(
      deleteBtn,
      selectedCount > 0,
      "Select a shape to delete",
      "Delete selected shape(s)"
    );

    // Duplicate
    setEnabled(
      duplicateBtn,
      selectedCount > 0,
      "Select shape(s) to duplicate",
      "Duplicate selected shape(s)"
    );

    // Reset Rotation
    setEnabled(
      resetRotationBtn,
      anyRotatableSelected,
      "Select an unlocked rectangle or circle",
      "Reset rotation to 0°"
    );

    // Select All (enabled if there is at least one shape)
    setEnabled(
      selectAllBtn,
      shapesCount > 0,
      "No shapes to select",
      "Select all shapes"
    );

    // Lock
    setEnabled(
      lockBtn,
      selectedCount > 0 && anyUnlockedSelected,
      "Select unlocked shape(s) to lock",
      "Lock selected shape(s)"
    );

    // Unlock (selected locked OR any locked in store)
    const unlockEnabled =
      (selectedCount > 0 && anyLockedSelected) ||
      (selectedCount === 0 && anyLockedInStore);
    const unlockEnabledTitle =
      (selectedCount > 0 && anyLockedSelected)
        ? "Unlock selected shape(s)"
        : "Unlock all locked shapes";
    setEnabled(
      unlockBtn,
      unlockEnabled,
      "No locked shapes",
      unlockEnabledTitle
    );

    // Alignment buttons (always relative to selection hull)
    setEnabled(
      alignLeftBtn,
      canAlign,
      "Select 2 or more shapes to align",
      "Align left (2+ selected)"
    );
    setEnabled(
      alignCenterXBtn,
      canAlign,
      "Select 2 or more shapes to align",
      "Align horizontal center (2+ selected)"
    );
    setEnabled(
      alignRightBtn,
      canAlign,
      "Select 2 or more shapes to align",
      "Align right (2+ selected)"
    );
    setEnabled(
      alignTopBtn,
      canAlign,
      "Select 2 or more shapes to align",
      "Align top (2+ selected)"
    );
    setEnabled(
      alignMiddleYBtn,
      canAlign,
      "Select 2 or more shapes to align",
      "Align vertical middle (2+ selected)"
    );
    setEnabled(
      alignBottomBtn,
      canAlign,
      "Select 2 or more shapes to align",
      "Align bottom (2+ selected)"
    );

    log("DEBUG", "[toolbar-state] updateButtonsState", {
      selectedCount,
      shapesCount,
      anyUnlockedSelected,
      anyLockedSelected,
      anyLockedInStore,
      anyRotatableSelected,
      canAlign
    });
  }

  // Initial run
  updateButtonsState();

  // Subscribe to all store changes (selection, shapes, locks, etc.)
  const unsub = sceneDesignerStore.subscribe(() => updateButtonsState());

  log("INFO", "[toolbar-state] Button state sync installed");
  return function detach() {
    try { unsub && unsub(); } catch {}
    log("INFO", "[toolbar-state] Button state sync detached");
  };
}

/**
 * Keep toolbar scale in sync with settings.toolbarUIScale.
 * @param {HTMLElement} containerEl - The root toolbar container (holds CSS var --toolbar-ui-scale)
 * @returns {function} detach
 */
export function installToolbarScaleSync(containerEl) {
  if (!containerEl || typeof containerEl.style?.setProperty !== 'function') {
    log("WARN", "[toolbar-state] installToolbarScaleSync: invalid container element");
    return () => {};
  }

  const applyScale = () => {
    const scale = getState().settings?.toolbarUIScale ?? 1;
    containerEl.style.setProperty('--toolbar-ui-scale', String(scale));
    log("DEBUG", "[toolbar-state] Applied toolbar scale", { scale });
  };

  // Initial apply
  applyScale();

  // Subscribe for setting changes
  const unsub = sceneDesignerStore.subscribe((state, details) => {
    if (!details) return;
    if (details.type === "setSetting" && details.key === "toolbarUIScale") {
      applyScale();
    } else if (
      details.type === "setSettings" &&
      details.settings &&
      Object.prototype.hasOwnProperty.call(details.settings, "toolbarUIScale")
    ) {
      applyScale();
    }
  });

  log("INFO", "[toolbar-state] Toolbar scale sync installed");
  return function detach() {
    try { unsub && unsub(); } catch {}
    log("INFO", "[toolbar-state] Toolbar scale sync detached");
  };
}

