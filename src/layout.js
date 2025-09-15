/**
 * layout.js
 * -----------------------------------------------------------
 * Golden Layout App Bootstrapper for Scene Designer
 * - Sets up all Golden Layout panels and registers panel factories.
 * - Panels: Sidebar, Canvas, Settings, (NEW) ErrorLog.
 * - Error log panel is included on startup if AppState.settings.showErrorLogPanel is true.
 * - No use of window.* or global log boxes: all logs routed to ErrorLogPanel via ES module.
 * - Logging via log.js.
 * - Logging policy: Use INFO for panel registration, user-visible events, and layout lifecycle; DEBUG for internal state; ERROR for problems.
 * - TRACE-level entry/exit logging for all functions.
 * -----------------------------------------------------------
 */

// --- ESM Tabulator Theme CSS Import ---
// This ensures Tabulator tables are styled even in pure ESM/Webpack builds (no CDN needed)
import 'tabulator-tables/dist/css/tabulator.min.css';

import { GoldenLayout } from 'golden-layout';
import { buildSidebarPanel } from './sidebar.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { AppState, getSetting, setSetting } from './state.js';
import { log } from './log.js';

log("INFO", "[layout] layout.js module loaded and ready!");

function logEntryExit(fn, name) {
  return function(...args) {
    log("TRACE", `[layout] ${name} entry`, ...args);
    const result = fn.apply(this, args);
    log("TRACE", `[layout] ${name} exit`, result);
    return result;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  log("TRACE", "[layout] DOMContentLoaded handler entry");
  log("INFO", "[layout] DOMContentLoaded fired");

  const glRoot = document.getElementById("gl-root");
  log("INFO", "[layout] glRoot found?", !!glRoot, glRoot);

  if (!glRoot) {
    log("ERROR", "[layout] #gl-root not found!");
    log("TRACE", "[layout] DOMContentLoaded handler exit (no glRoot)");
    return;
  }

  // Load settings once before layout, to ensure correct panel config
  let showErrorLogPanel = true;
  try {
    // Import and call loadSettings from settings.js for proper persistence
    loadSettings();
    showErrorLogPanel = getSetting("showErrorLogPanel") !== false;
    log("DEBUG", "[layout] Loaded settings, showErrorLogPanel:", showErrorLogPanel);
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, defaulting showErrorLogPanel to true", e);
    showErrorLogPanel = true;
  }

  // Layout config: conditionally add ErrorLog panel
  const panelLayout = {
    root: {
      type: 'row',
      content: [
        {
          type: 'component',
          componentName: 'SidebarPanel',
          title: 'Sidebar',
          width: 20,
        },
        {
          type: 'component',
          componentName: 'CanvasPanel',
          title: 'Canvas',
          width: 60,
        },
        {
          type: 'component',
          componentName: 'SettingsPanel',
          title: 'Settings',
          width: 20,
        }
      ]
    }
  };

  if (showErrorLogPanel) {
    // Add ErrorLog panel as a stack at the bottom, spanning the full width
    panelLayout.root = {
      type: 'column',
      content: [
        panelLayout.root,
        {
          type: 'component',
          componentName: 'ErrorLogPanel',
          title: 'Error Log',
          height: 18
        }
      ]
    };
    log("DEBUG", "[layout] ErrorLogPanel added to layout");
  }

  let layout;
  try {
    log("INFO", "[layout] About to create GoldenLayout instance...");
    layout = new GoldenLayout(
      panelLayout,
      glRoot // <--- container is second argument!
    );
    log("INFO", "[layout] GoldenLayout instance created.");
  } catch (e) {
    log("ERROR", "[layout] ERROR while creating GoldenLayout instance:", e?.message || e);
    log("TRACE", "[layout] DOMContentLoaded handler exit (GoldenLayout error)");
    throw e;
  }

  try {
    layout.registerComponent('SidebarPanel', (container) => {
      log("TRACE", "[layout] SidebarPanel factory entry", {
        title: container?.title,
        componentName: container?.componentName
      });
      log("INFO", "[layout] SidebarPanel factory called", {
        title: container?.title,
        componentName: container?.componentName
      });
      buildSidebarPanel(container.element, container);
      log("TRACE", "[layout] SidebarPanel factory exit");
    });

    layout.registerComponent('CanvasPanel', (container) => {
      log("TRACE", "[layout] CanvasPanel factory entry", {
        title: container?.title,
        componentName: container?.componentName
      });
      log("INFO", "[layout] CanvasPanel factory called", {
        title: container?.title,
        componentName: container?.componentName
      });
      buildCanvasPanel(container.element, container);
      log("TRACE", "[layout] CanvasPanel factory exit");
    });

    // === FIX: Delay SettingsPanel construction until visible ===
    layout.registerComponent('SettingsPanel', (container) => {
      log("TRACE", "[layout] SettingsPanel factory entry", {
        title: container?.title,
        componentName: container?.componentName
      });
      log("INFO", "[layout] SettingsPanel factory called", {
        title: container?.title,
        componentName: container?.componentName
      });
      // Golden Layout: only build panel after it's visible/attached
      container.on('open', () => {
        log("TRACE", "[layout] SettingsPanel container 'open' event");
        buildSettingsPanel(container.element, container);
      });
      log("TRACE", "[layout] SettingsPanel factory exit");
    });

    layout.registerComponent('ErrorLogPanel', (container) => {
      log("TRACE", "[layout] ErrorLogPanel factory entry", {
        title: container?.title,
        componentName: container?.componentName
      });
      log("INFO", "[layout] ErrorLogPanel factory called", {
        title: container?.title,
        componentName: container?.componentName
      });
      buildErrorLogPanel(container.element, container);
      log("TRACE", "[layout] ErrorLogPanel factory exit");
    });

    // Register log sink so all log messages go to ErrorLogPanel if open
    registerErrorLogSink();

    log("DEBUG", "[layout] All panel factories registered, log sink registered");
  } catch (e) {
    log("ERROR", "[layout] ERROR in registerComponent:", e?.message || e);
    log("TRACE", "[layout] DOMContentLoaded handler exit (registerComponent error)");
    throw e;
  }

  try {
    log("INFO", "[layout] Calling layout.init...");
    layout.init();
    log("INFO", "[layout] layout.init called, done.");
  } catch (e) {
    log("ERROR", "[layout] ERROR during layout.init:", e?.message || e);
    log("TRACE", "[layout] DOMContentLoaded handler exit (layout.init error)");
    throw e;
  }

  log("TRACE", "[layout] DOMContentLoaded handler exit");
});


