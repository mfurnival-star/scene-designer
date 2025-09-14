/**
 * sidebar.js
 * -----------------------------------------------------------
 * Shape Table/List Panel for Scene Designer (Golden Layout)
 * - [Tabulator-free stub version]
 * - This revision removes all Tabulator code and dependencies.
 * - Displays a simple placeholder sidebar showing the number of shapes.
 * - All state via AppState.
 * - Logging via log.js.
 * - Logging policy: Use INFO for user actions, DEBUG for updates, ERROR for UI problems.
 * - ES module only: no globals, no window.*.
 * - TRACE-level logging for all function entry/exit (diagnostic).
 * -----------------------------------------------------------
 */

import { AppState } from './state.js';
import { log } from './log.js';

/**
 * Build the sidebar panel (stub version, no Tabulator).
 * Shows a simple list of shape count and a static message.
 */
export function buildSidebarPanel(rootElement, container) {
  log("TRACE", "[sidebar] buildSidebarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
  try {
    log("INFO", "[sidebar] buildSidebarPanel called (Tabulator-free stub)", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      containerComponentName: container?.componentName
    });

    // Render a simple stub sidebar
    rootElement.innerHTML = `
      <div id="sidebar-panel-container" style="width:100%;height:100%;background:#f4f8ff;display:flex;flex-direction:column;overflow:auto;">
        <div style="padding:10px 8px 4px 8px;font-weight:bold;font-size:1.2em;color:#0057d8;">
          Shape List (Tabulator-Free)
        </div>
        <div id="sidebar-shape-summary" style="padding:12px 8px;">
          <div style="font-size:1.1em;">
            Total shapes: <span id="sidebar-shape-count">${AppState.shapes?.length || 0}</span>
          </div>
          <div style="margin-top:1em;">
            <em>This is a placeholder sidebar.<br>
            The shape table will return when Tabulator is re-enabled.</em>
          </div>
        </div>
      </div>
    `;

    // Subscribe to AppState for shape count updates
    if (!rootElement._appStateUnsub) {
      log("TRACE", "[sidebar] registering AppState update subscriber (Tabulator-free)");
      const update = () => {
        log("TRACE", "[sidebar] AppState update triggered (Tabulator-free)");
        const countSpan = rootElement.querySelector("#sidebar-shape-count");
        if (countSpan) countSpan.textContent = AppState.shapes?.length || 0;
      };
      AppState._subscribers = AppState._subscribers || [];
      AppState._subscribers.push(update);
      rootElement._appStateUnsub = update;
      // Clean up when panel is destroyed
      if (container && typeof container.on === "function") {
        container.on("destroy", () => {
          log("TRACE", "[sidebar] panel destroy event (Tabulator-free)");
          const idx = AppState._subscribers.indexOf(update);
          if (idx !== -1) AppState._subscribers.splice(idx, 1);
        });
      }
    }

    log("INFO", "[sidebar] Sidebar panel fully initialized (Tabulator-free stub)");
  } catch (e) {
    log("ERROR", "[sidebar] buildSidebarPanel ERROR (Tabulator-free)", e);
    alert("SidebarPanel ERROR: " + e.message);
    log("TRACE", "[sidebar] buildSidebarPanel exit (error, Tabulator-free)");
    throw e;
  }
  log("TRACE", "[sidebar] buildSidebarPanel exit (Tabulator-free)", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
}

