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

export function dispatch(cmd, options = {}) {
  if (!cmd || typeof cmd.type !== 'string') {
    log("WARN", "[command-bus] dispatch: invalid command", { cmd });
    return null;
  }
  try {
    const inverse = executeCommand(cmd);
    if (inverse && typeof inverse.type === 'string') {
      undoStack.push(inverse);
      redoStack.length = 0;
    } else {
      log("DEBUG", "[command-bus] dispatch: no inverse returned", { type: cmd.type });
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
    } else {
      log("DEBUG", "[command-bus] undo: no redo-forward returned", { type: inverseCmd?.type });
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
    } else {
      log("DEBUG", "[command-bus] redo: no undo-inverse returned", { type: redoCmd?.type });
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
