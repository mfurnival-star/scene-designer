/**
 * toolbar-panel.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Panel Builder (ESM ONLY, split from monolith)
 * Purpose:
 * - Assemble the toolbar panel: inject styles, render DOM, wire handlers, and
 *   install state-driven enable/disable logic.
 * - Keeps business logic in actions.js; this module only wires UI events.
 * - Uses Pickr-based color pickers via toolbar-handlers → toolbar-color.
 *
 * Public Exports:
 * - buildCanvasToolbarPanel({ element, title, componentName })
 *
 * Dependencies:
 * - toolbar-styles.js (ensureToolbarStylesInjected)
 * - toolbar-dom.js (renderToolbar → returns element refs)
 * - toolbar-handlers.js (attachToolbarHandlers → click/change handlers)
 * - toolbar-state.js (installButtonsStateSync, installToolbarScaleSync)
 * - log.js (logging)
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { ensureToolbarStylesInjected } from './toolbar-styles.js';
import { renderToolbar } from './toolbar-dom.js';
import {
  installButtonsStateSync,
  installToolbarScaleSync
} from './toolbar-state.js';
import { attachToolbarHandlers } from './toolbar-handlers.js';

/**
 * MiniLayout component factory: Build the Canvas Toolbar panel.
 * Accepts: { element, title, componentName }
 */
export function buildCanvasToolbarPanel({ element, title, componentName }) {
  log("TRACE", "[toolbar-panel] buildCanvasToolbarPanel ENTRY", {
    elementType: element?.tagName,
    title,
    componentName
  });

  try {
    // 1) Styles (inject once)
    ensureToolbarStylesInjected();

    // 2) Render DOM and get strongly-typed refs to elements
    const refs = renderToolbar(element);

    // 3) Wire event handlers (clicks, file input, color pickers, etc.)
    const detachHandlers = attachToolbarHandlers(refs);

    // 4) Install state-driven UI behavior
    //    - Buttons enable/disable based on selection/lock/etc.
    //    - Live scale updates from settings.toolbarUIScale
    const detachButtons = installButtonsStateSync(refs);
    const detachScale = installToolbarScaleSync(refs.container);

    // 5) Optional cleanup on unload (for hot reload/dev)
    const cleanup = () => {
      try { detachHandlers && detachHandlers(); } catch {}
      try { detachButtons && detachButtons(); } catch {}
      try { detachScale && detachScale(); } catch {}
      log("INFO", "[toolbar-panel] Toolbar panel cleaned up");
    };

    window.addEventListener('beforeunload', cleanup, { once: true });

    // If MiniLayout exposes a destroy hook on panel element, attach cleanup
    if (typeof element.on === "function") {
      try {
        element.on("destroy", cleanup);
      } catch {
        // ignore if not supported
      }
    }

    log("INFO", "[toolbar-panel] Toolbar panel initialized (styles + DOM + handlers + state sync)");
  } catch (e) {
    log("ERROR", "[toolbar-panel] buildCanvasToolbarPanel ERROR", e);
    alert("ToolbarPanel ERROR: " + e.message);
    throw e;
  }

  log("TRACE", "[toolbar-panel] buildCanvasToolbarPanel EXIT", {
    elementType: element?.tagName,
    title,
    componentName
  });
}

