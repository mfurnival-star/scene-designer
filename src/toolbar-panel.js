import { log } from './log.js';
import { ensureToolbarStylesInjected } from './toolbar-styles.js';
import { renderToolbar } from './toolbar-dom.js';
import {
  installButtonsStateSync,
  installToolbarScaleSync
} from './toolbar-state.js';
import { attachToolbarHandlers } from './toolbar-handlers.js';

export function buildCanvasToolbarPanel({ element, title, componentName }) {
  try {
    ensureToolbarStylesInjected();
    const refs = renderToolbar(element);
    const detachHandlers = attachToolbarHandlers(refs);
    const detachButtons = installButtonsStateSync(refs);
    const detachScale = installToolbarScaleSync(refs.container);

    const cleanup = () => {
      try { detachHandlers && detachHandlers(); } catch {}
      try { detachButtons && detachButtons(); } catch {}
      try { detachScale && detachScale(); } catch {}
      log("INFO", "[toolbar-panel] Toolbar panel cleaned up");
    };

    window.addEventListener('beforeunload', cleanup, { once: true });
    if (typeof element.on === "function") {
      try { element.on("destroy", cleanup); } catch {}
    }

    log("INFO", "[toolbar-panel] Toolbar panel initialized");
  } catch (e) {
    log("ERROR", "[toolbar-panel] buildCanvasToolbarPanel ERROR", e);
    alert("ToolbarPanel ERROR: " + e.message);
    throw e;
  }
}
