import { getState, sceneDesignerStore } from './state.js';
import { log } from './log.js';
import { subscribeHistory, getHistorySnapshot } from './commands/command-bus.js';

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

function isDrawableChild(obj) {
  return !!obj && !obj._isDiagnosticLabel && (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse' || obj.type === 'line');
}
function readStrokeWidthFromShape(shape) {
  try {
    if (!shape || !Array.isArray(shape._objects)) return null;
    const child = shape._objects.find(isDrawableChild);
    if (!child) return null;
    const w = Number(child.strokeWidth);
    return Number.isFinite(w) && w > 0 ? w : null;
  } catch {
    return null;
  }
}
function getCommonStrokeWidth(selected) {
  if (!Array.isArray(selected) || selected.length === 0) return null;
  const widths = [];
  selected.forEach(s => {
    const w = readStrokeWidthFromShape(s);
    if (Number.isFinite(w) && w > 0) widths.push(w);
  });
  if (!widths.length) return null;
  const first = widths[0];
  for (let i = 1; i < widths.length; i++) {
    if (Math.abs(widths[i] - first) > 0.0001) return null;
  }
  return Math.round(first);
}

export function installButtonsStateSync(refs) {
  const {
    deleteBtn,
    duplicateBtn,
    resetRotationBtn,
    selectAllBtn,
    lockBtn,
    unlockBtn,
    alignLeftBtn,
    alignCenterXBtn,
    alignRightBtn,
    alignTopBtn,
    alignMiddleYBtn,
    alignBottomBtn,
    undoBtn,
    redoBtn,
    strokeWidthInput
  } = refs || {};

  function syncStrokeWidthInput() {
    if (!strokeWidthInput) return;
    if (document.activeElement === strokeWidthInput) return;
    const selected = getState().selectedShapes || [];
    const common = getCommonStrokeWidth(selected);
    if (common !== null) {
      if (strokeWidthInput.value !== String(common)) strokeWidthInput.value = String(common);
      strokeWidthInput.placeholder = '';
      return;
    }
    if (!Array.isArray(selected) || selected.length === 0) {
      const defW = Number(getState().settings?.defaultStrokeWidth) || 1;
      if (strokeWidthInput.value !== String(defW)) strokeWidthInput.value = String(defW);
      strokeWidthInput.placeholder = '';
      return;
    }
    strokeWidthInput.value = '';
    strokeWidthInput.placeholder = '—';
  }

  function updateButtonsState() {
    const selected = getState().selectedShapes || [];
    const shapes = getState().shapes || [];

    const selectedCount = selected.length;
    const shapesCount = shapes.length;

    const anyUnlockedSelected = selected.some(s => s && !s.locked);
    const anyLockedSelected = selected.some(s => s && s.locked);
    const anyLockedInStore = shapes.some(s => s && s.locked);

    const anyRotatableSelected = selected.some(s =>
      s && !s.locked && (s._type === 'rect' || s._type === 'circle' || s._type === 'ellipse')
    );

    const canAlign = selectedCount >= 2;

    setEnabled(
      deleteBtn,
      selectedCount > 0,
      "Select a shape to delete",
      "Delete selected shape(s)"
    );

    setEnabled(
      duplicateBtn,
      selectedCount > 0,
      "Select shape(s) to duplicate",
      "Duplicate selected shape(s)"
    );

    setEnabled(
      resetRotationBtn,
      anyRotatableSelected,
      "Select an unlocked rectangle, circle or ellipse",
      "Reset rotation to 0°"
    );

    setEnabled(
      selectAllBtn,
      shapesCount > 0,
      "No shapes to select",
      "Select all shapes"
    );

    setEnabled(
      lockBtn,
      selectedCount > 0 && anyUnlockedSelected,
      "Select unlocked shape(s) to lock",
      "Lock selected shape(s)"
    );

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

    syncStrokeWidthInput();
  }

  function updateUndoRedoFromSnapshot() {
    try {
      const snap = getHistorySnapshot();
      setEnabled(undoBtn, !!snap.canUndo, "Nothing to undo", "Undo");
      setEnabled(redoBtn, !!snap.canRedo, "Nothing to redo", "Redo");
    } catch (e) {
      log("WARN", "[toolbar-state] Failed to read history snapshot", e);
    }
  }

  updateButtonsState();
  updateUndoRedoFromSnapshot();

  const unsubStore = sceneDesignerStore.subscribe(() => updateButtonsState());
  const unsubHistory = subscribeHistory(({ canUndo, canRedo }) => {
    setEnabled(undoBtn, !!canUndo, "Nothing to undo", "Undo");
    setEnabled(redoBtn, !!canRedo, "Nothing to redo", "Redo");
  });

  log("INFO", "[toolbar-state] Button state + stroke width sync installed");
  return function detach() {
    try { unsubStore && unsubStore(); } catch {}
    try { unsubHistory && unsubHistory(); } catch {}
    log("INFO", "[toolbar-state] Button state sync detached");
  };
}

export function installToolbarScaleSync(containerEl) {
  if (!containerEl || typeof containerEl.style?.setProperty !== 'function') {
    log("WARN", "[toolbar-state] installToolbarScaleSync: invalid container element");
    return () => {};
  }

  const applyScale = () => {
    const scale = getState().settings?.toolbarUIScale ?? 1;
    containerEl.style.setProperty('--toolbar-ui-scale', String(scale));
  };

  applyScale();

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
