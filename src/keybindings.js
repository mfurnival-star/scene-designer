import { log } from './log.js';
import { undo, redo, canUndo, canRedo } from './commands/command-bus.js';

function isEditableTarget(t) {
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

function handleKeydown(e) {
  try {
    const key = (e.key || '').toLowerCase();
    const hasCtrl = !!e.ctrlKey;
    const hasMeta = !!e.metaKey; // Cmd on macOS
    const hasShift = !!e.shiftKey;

    const modifier = hasMeta || hasCtrl;
    if (!modifier) return;

    // Skip if typing in an editable field
    if (isEditableTarget(e.target)) return;

    // Ctrl/Cmd+Z → Undo, Ctrl/Cmd+Shift+Z → Redo
    if (key === 'z') {
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
      return;
    }

    // Ctrl+Y → Redo (Windows convention)
    if (key === 'y' && hasCtrl && !hasMeta) {
      e.preventDefault();
      e.stopPropagation();
      if (canRedo()) {
        redo();
        log("INFO", "[keybindings] Redo via Ctrl+Y");
      } else {
        log("INFO", "[keybindings] Redo unavailable");
      }
      return;
    }
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
  log("INFO", "[keybindings] Global undo/redo keybindings installed");
  return () => {
    try { target.removeEventListener('keydown', listener, { capture: true }); } catch {}
    log("INFO", "[keybindings] Global undo/redo keybindings removed");
  };
}
