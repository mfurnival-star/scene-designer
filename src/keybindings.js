import { log } from './log.js';
import { undo, redo, canUndo, canRedo, dispatch } from './commands/command-bus.js';

function isEditableTarget(t) {
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

function handleUndoRedo(e, keyLower) {
  const hasCtrl = !!e.ctrlKey;
  const hasMeta = !!e.metaKey; // Cmd on macOS
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

function handleKeydown(e) {
  try {
    const keyLower = (e.key || '').toLowerCase();

    if (handleUndoRedo(e, keyLower)) return;
    if (handleArrowNudge(e, keyLower)) return;
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
  log("INFO", "[keybindings] Global keybindings installed (undo/redo + arrow nudges)");
  return () => {
    try { target.removeEventListener('keydown', listener, { capture: true }); } catch {}
    log("INFO", "[keybindings] Global keybindings removed");
  };
}
