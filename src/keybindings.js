import { log } from './log.js';
import { undo, redo, canUndo, canRedo, dispatch } from './commands/command-bus.js';
import { getState } from './state.js';
import {
  deleteSelectedShapes,
  duplicateSelectedShapes,
  lockSelectedShapes,
  unlockSelectedShapes,
  resetRotationForSelectedShapes
} from './actions.js';

function isEditableTarget(t) {
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

function handleUndoRedo(e, keyLower) {
  const hasCtrl = !!e.ctrlKey;
  const hasMeta = !!e.metaKey;
  const hasShift = !!e.shiftKey;
  const modifier = hasMeta || hasCtrl;

  if (!modifier) return false;

  if (keyLower === 'z') {
    e.preventDefault();
    e.stopPropagation();
    if (hasShift) {
      if (canRedo()) {
        redo();
        log("INFO", "[keybindings] Redo via Ctrl/Cmd+Shift+Z");
      } else {
        log("INFO", "[keybindings] Redo unavailable");
      }
    } else {
      if (canUndo()) {
        undo();
        log("INFO", "[keybindings] Undo via Ctrl/Cmd+Z");
      } else {
        log("INFO", "[keybindings] Undo unavailable");
      }
    }
    return true;
  }

  if (keyLower === 'y' && hasCtrl && !hasMeta) {
    e.preventDefault();
    e.stopPropagation();
    if (canRedo()) {
      redo();
      log("INFO", "[keybindings] Redo via Ctrl+Y");
    } else {
      log("INFO", "[keybindings] Redo unavailable");
    }
    return true;
  }

  return false;
}

function handleArrowNudge(e, keyLower) {
  const isArrow =
    keyLower === 'arrowleft' ||
    keyLower === 'arrowright' ||
    keyLower === 'arrowup' ||
    keyLower === 'arrowdown';
  if (!isArrow) return false;

  if (isEditableTarget(e.target)) return false;

  const base = e.shiftKey ? 10 : 1;
  let dx = 0, dy = 0;
  if (keyLower === 'arrowleft') dx = -base;
  if (keyLower === 'arrowright') dx = base;
  if (keyLower === 'arrowup') dy = -base;
  if (keyLower === 'arrowdown') dy = base;

  try {
    const inverse = dispatch({
      type: 'MOVE_SHAPES_DELTA',
      payload: { dx, dy, clamp: true }
    });

    if (inverse) {
      e.preventDefault();
      e.stopPropagation();
      log("INFO", "[keybindings] Nudge move", { dx, dy, shift: !!e.shiftKey });
      return true;
    }
  } catch (err) {
    log("ERROR", "[keybindings] Arrow nudge dispatch error", err);
  }
  return false;
}

function handleCommonShortcuts(e, keyLower) {
  const hasCtrl = !!e.ctrlKey;
  const hasMeta = !!e.metaKey;
  const hasShift = !!e.shiftKey;
  const modifier = hasMeta || hasCtrl;

  const state = getState();
  const selected = Array.isArray(state.selectedShapes) ? state.selectedShapes.filter(Boolean) : [];
  const shapes = Array.isArray(state.shapes) ? state.shapes.filter(Boolean) : [];

  const unlockedSelected = selected.filter(s => s && !s.locked);
  const lockedSelected = selected.filter(s => s && s.locked);
  const anyLockedInStore = shapes.some(s => s && s.locked);
  const anyRotatableSelected = selected.some(s =>
    s && !s.locked && (s._type === 'rect' || s._type === 'circle' || s._type === 'ellipse')
  );

  if ((keyLower === 'delete' || keyLower === 'backspace') && !isEditableTarget(e.target)) {
    if (unlockedSelected.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      deleteSelectedShapes();
      log("INFO", "[keybindings] Delete selected via Delete/Backspace");
      return true;
    }
    return false;
  }

  if (modifier && keyLower === 'd') {
    if (unlockedSelected.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      duplicateSelectedShapes();
      log("INFO", "[keybindings] Duplicate via Ctrl/Cmd+D");
      return true;
    }
    return false;
  }

  if (modifier && keyLower === 'l' && !hasShift) {
    if (unlockedSelected.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      lockSelectedShapes();
      log("INFO", "[keybindings] Lock via Ctrl/Cmd+L");
      return true;
    }
    return false;
  }

  if (modifier && keyLower === 'l' && hasShift) {
    if (lockedSelected.length > 0 || (selected.length === 0 && anyLockedInStore)) {
      e.preventDefault();
      e.stopPropagation();
      unlockSelectedShapes();
      log("INFO", "[keybindings] Unlock via Ctrl/Cmd+Shift+L");
      return true;
    }
    return false;
  }

  if (!modifier && keyLower === 'r' && !isEditableTarget(e.target)) {
    if (anyRotatableSelected) {
      e.preventDefault();
      e.stopPropagation();
      resetRotationForSelectedShapes();
      log("INFO", "[keybindings] Reset rotation via R", { shift: hasShift });
      return true;
    }
    return false;
  }

  return false;
}

function handleKeydown(e) {
  try {
    const keyLower = (e.key || '').toLowerCase();

    if (handleUndoRedo(e, keyLower)) return;
    if (handleArrowNudge(e, keyLower)) return;
    if (handleCommonShortcuts(e, keyLower)) return;
  } catch (err) {
    log("ERROR", "[keybindings] keydown handler error", err);
  }
}

export function installUndoRedoKeybindings(target = window) {
  if (!target || typeof target.addEventListener !== 'function') {
    log("ERROR", "[keybindings] installUndoRedoKeybindings: invalid target");
    return () => {};
  }
  const listener = (e) => handleKeydown(e);
  target.addEventListener('keydown', listener, { capture: true });
  log("INFO", "[keybindings] Global keybindings installed (undo/redo + arrow nudges + common actions)");
  return () => {
    try { target.removeEventListener('keydown', listener, { capture: true }); } catch {}
    log("INFO", "[keybindings] Global keybindings removed");
  };
}
