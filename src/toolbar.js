/**
 * toolbar.js
 * -------------------------------------------------------------------
 * Scene Designer – Modular Toolbar Panel (ESM ONLY)
 * - Builds and manages the main toolbar UI for annotation and canvas actions.
 * - Toolbar UI scale is controlled by the `toolbarUIScale` setting (from settings.js).
 * - Listens for live setting changes and updates the scale accordingly.
 * - Toolbar contains only: image upload, shape dropdown, add shape button.
 * - No legacy/extra controls, all elements enabled.
 * - No global/window code; all state flows via AppState.
 * - Logging: Uses log.js; logs at INFO for major events, DEBUG for UI changes, TRACE for entry/exit.
 * - Exports: buildCanvasToolbarPanel
 * - Dependencies: log.js, state.js, settings.js
 * -------------------------------------------------------------------
 */

import { getSetting, subscribe } from './state.js';
import { log } from './log.js';

/**
 * Build the Canvas Toolbar Panel for Golden Layout.
 * Applies UI scale from settings and listens for changes.
 * @param {HTMLElement} rootElement
 * @param {Object} container - Golden Layout container (optional)
 */
export function buildCanvasToolbarPanel(rootElement, container) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });

  try {
    log("INFO", "[toolbar] buildCanvasToolbarPanel called", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      containerComponentName: container?.componentName
    });

    // --- Minimal Toolbar HTML: image upload, shape dropdown, add button ---
    rootElement.innerHTML = `
      <div id="canvas-toolbar-main" class="sd-toolbar-main" style="display:flex;align-items:center;gap:12px;padding:6px 8px 4px 8px;background:#f7f7fa;border-bottom:1px solid #bbb;">
        <input type="file" id="canvas-image-upload" accept="image/*" style="display:inline-block;">
        <span style="margin-left:0;">Shape:</span>
        <select id="shape-type-select" style="margin-left:0;">
          <option value="point">Point</option>
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <button id="add-shape-btn" style="margin-left:0;">Add</button>
      </div>
    `;

    // --- Apply UI scale from settings ---
    const bar = rootElement.querySelector('#canvas-toolbar-main');
    if (bar) {
      const scale = Number(getSetting("toolbarUIScale")) || 1;
      bar.style.transform = `scale(${scale})`;
      bar.style.transformOrigin = 'top left';
      log("DEBUG", "[toolbar] Applied initial toolbarUIScale", scale);

      // --- Listen for toolbarUIScale setting changes for live updates ---
      const unsub = subscribe((state, details) => {
        if (details && details.type === "setting" && details.key === "toolbarUIScale") {
          const newScale = Number(details.value) || 1;
          bar.style.transform = `scale(${newScale})`;
          bar.style.transformOrigin = 'top left';
          log("DEBUG", "[toolbar] Updated toolbarUIScale (live)", newScale);
        }
      });

      // Cleanup: Unsubscribe on panel destroy
      if (container && typeof container.on === "function") {
        container.on('destroy', () => {
          unsub && unsub();
          log("DEBUG", "[toolbar] Unsubscribed from toolbarUIScale changes on destroy");
        });
      }
    } else {
      log("ERROR", "[toolbar] #canvas-toolbar-main not found in DOM");
    }

    // --- (Optional: wire up events here in future) ---

    log("INFO", "[toolbar] CanvasToolbarPanel initialized (UI scale applied, minimal controls only)");
  } catch (e) {
    log("ERROR", "[toolbar] buildCanvasToolbarPanel ERROR", e);
    alert("CanvasToolbarPanel ERROR: " + e.message);
    log("TRACE", "[toolbar] buildCanvasToolbarPanel exit (error)");
    throw e;
  }

  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
}
