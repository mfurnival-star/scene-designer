import { getState } from './state.js';
import { log } from './log.js';
import { dispatch } from './commands/command-bus.js';

const VALID_MODES = new Set(["left", "centerX", "right", "top", "middleY", "bottom"]);

export function alignSelected(mode, ref = 'selection') {
  const alignMode = typeof mode === 'string' ? mode : '';
  const refMode = ref === 'canvas' ? 'canvas' : 'selection';

  if (!VALID_MODES.has(alignMode)) {
    log("WARN", "[actions-align] Invalid align mode", { mode: alignMode });
    return;
  }

  const selected = Array.isArray(getState().selectedShapes) ? getState().selectedShapes.filter(Boolean) : [];
  if (selected.length < 2) {
    log("INFO", "[actions-align] Requires 2+ selected shapes", { selectedCount: selected.length });
    return;
  }

  dispatch({
    type: 'ALIGN_SELECTED',
    payload: { mode: alignMode, ref: refMode }
  });
}
