import { log } from '../log.js';
import { executeCommand } from './commands.js';

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
  const sameKey = top.__coalesceKey === key;
  const sameType = top.__cmdType === type;
  const within = typeof top.__coalesceAt === 'number'
    ? (Date.now() - top.__coalesceAt) <= windowMs
    : false;
  return sameKey && sameType && within;
}

export function dispatch(cmd, options = {}) {
  if (!cmd || typeof cmd.type !== 'string') {
    log("WARN", "[command-bus] dispatch: invalid command", { cmd });
    return null;
  }

  const key = typeof options.coalesceKey === 'string' && options.coalesceKey ? options.coalesceKey : null;
  const windowMs = Number(options.coalesceWindowMs) > 0 ? Number(options.coalesceWindowMs) : 800;

  try {
    const inverse = executeCommand(cmd);

    if (inverse && typeof inverse.type === 'string') {
      if (key && canCoalesce(undoStack[undoStack.length - 1], key, cmd.type, windowMs)) {
        const top = undoStack[undoStack.length - 1];
        top.__coalesceAt = Date.now();
        redoStack.length = 0;
      } else if (key) {
        inverse.__coalesceKey = key;
        inverse.__cmdType = cmd.type;
        inverse.__coalesceAt = Date.now();
        undoStack.push(inverse);
        redoStack.length = 0;
      } else {
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
