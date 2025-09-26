import { log } from '../log.js';
import { executeCommand } from './commands.js';

/*
  Command Bus
  -----------
  Responsibilities:
    - Dispatch commands through layered executors (scene → structure → style).
    - Capture inverse commands onto the undo stack (history).
    - Provide redo stack management.
    - Implement coalescing for high‑frequency adjustments (color drags, fill alpha drags,
      stroke width scrubs, numeric scrubs) via (coalesceKey, coalesceWindowMs).
    - Notify subscribers on any history-affecting event.

  Coalescing Policy (Phase 2 – see docs/PHASED_ARCHITECTURE_PATH.md):
    - A dispatch may include options: { coalesceKey: string, coalesceWindowMs: number }.
    - If a new command of the SAME type AND SAME coalesceKey arrives within the
      specified window (default ~800ms unless overridden), we DO NOT push a new undo frame.
      Instead we extend the coalescing window timestamp (__coalesceAt) on the existing frame.
    - The first command in a coalesced series pushes the inverse; subsequent
      coalesced commands rely on that original inverse to restore pre-series state.
    - Discrete intents (selection wrapper commands, structural add/delete/duplicate,
      alignment, transforms aggregate, scene metadata changes) should NOT use coalescing.
    - Coalescing is opt-in only (absence of coalesceKey disables it).
    - Undoing a coalesced frame reverts all merged adjustments in one step.
    - Redo is symmetrical.
    - A coalesced history frame stores metadata:
         __coalesceKey  – string key
         __cmdType      – forward command type
         __coalesceAt   – last updated timestamp (ms since epoch)
    - Any new dispatch that coalesces clears the redo stack (new forward path).
    - Null inverse (executor returned null) → no history update, no coalescing.

  Standardized No-op Logging:
    - Executors themselves log no-op reason tokens (NO_CHANGE, NO_TARGETS, etc.).
    - Command bus remains agnostic; it only records non-null inverses.

  Edge Cases:
    - If coalesceKey changes or window expires, a new frame is created.
    - If forward command type differs (even with same key) we DO NOT coalesce.

  Public API:
    - dispatch(cmd, options?)
    - undo()
    - redo()
    - canUndo(), canRedo()
    - clearHistory()
    - getHistorySnapshot()
    - subscribeHistory(listener)
*/

const undoStack = [];
const redoStack = [];
const listeners = [];

function notify(event, extra = {}) {
  const snapshot = getHistorySnapshot();
  const payload = { event, ...snapshot, ...extra };
  listeners.slice().forEach(fn => {
    try { fn(payload); } catch (e) { log("ERROR", "[command-bus] listener error", e); }
  });
}

function canCoalesce(top, key, type, windowMs) {
  if (!top || !key) return false;
  if (top.__coalesceKey !== key) return false;
  if (top.__cmdType !== type) return false;
  if (typeof top.__coalesceAt !== 'number') return false;
  const age = Date.now() - top.__coalesceAt;
  return age <= windowMs;
}

export function dispatch(cmd, options = {}) {
  if (!cmd || typeof cmd.type !== 'string') {
    log("WARN", "[command-bus] dispatch: invalid command", { cmd });
    return null;
  }

  const key = (typeof options.coalesceKey === 'string' && options.coalesceKey.trim())
    ? options.coalesceKey.trim()
    : null;
  const windowMs = Number(options.coalesceWindowMs) > 0
    ? Number(options.coalesceWindowMs)
    : 800;

  try {
    const inverse = executeCommand(cmd);

    if (inverse && typeof inverse.type === 'string') {
      if (key && canCoalesce(undoStack[undoStack.length - 1], key, cmd.type, windowMs)) {
        // Extend existing coalesced frame window
        const top = undoStack[undoStack.length - 1];
        top.__coalesceAt = Date.now();
        // On any successful forward command redo path is invalidated
        redoStack.length = 0;
      } else if (key) {
        // Start a new coalesced frame
        inverse.__coalesceKey = key;
        inverse.__cmdType = cmd.type;
        inverse.__coalesceAt = Date.now();
        undoStack.push(inverse);
        redoStack.length = 0;
      } else {
        // Normal (non-coalesced) history frame
        undoStack.push(inverse);
        redoStack.length = 0;
      }
    }

    notify('dispatch', { cmdType: cmd.type, undoDepth: undoStack.length, redoDepth: redoStack.length });
    return inverse || null;
  } catch (e) {
    log("ERROR", "[command-bus] dispatch error", { type: cmd.type, error: e });
    return null;
  }
}

export function undo() {
  if (!canUndo()) return null;
  try {
    const inverseCmd = undoStack.pop();
    const redoForward = executeCommand(inverseCmd);
    if (redoForward && typeof redoForward.type === 'string') {
      redoStack.push(redoForward);
    }
    notify('undo', { cmdType: inverseCmd?.type, undoDepth: undoStack.length, redoDepth: redoStack.length });
    return inverseCmd || null;
  } catch (e) {
    log("ERROR", "[command-bus] undo error", e);
    return null;
  }
}

export function redo() {
  if (!canRedo()) return null;
  try {
    const redoCmd = redoStack.pop();
    const undoInverse = executeCommand(redoCmd);
    if (undoInverse && typeof undoInverse.type === 'string') {
      undoStack.push(undoInverse);
    }
    notify('redo', { cmdType: redoCmd?.type, undoDepth: undoStack.length, redoDepth: redoStack.length });
    return redoCmd || null;
  } catch (e) {
    log("ERROR", "[command-bus] redo error", e);
    return null;
  }
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  notify('clear');
}

export function getHistorySnapshot() {
  return {
    undoDepth: undoStack.length,
    redoDepth: redoStack.length,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  };
}

export function subscribeHistory(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.push(fn);
  try { fn({ event: 'subscribe', ...getHistorySnapshot() }); } catch {}
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}
