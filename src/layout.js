/**
 * layout.js
 * -----------------------------------------------------------
 * Golden Layout App Bootstrapper for Scene Designer
 * - Sets up all Golden Layout panels and registers panel factories.
 * - Panels: Sidebar, Canvas, Settings, ErrorLog (dynamically shown/hidden).
 * - Error Log panel is included on startup if AppState.settings.showErrorLogPanel is true.
 * - Now supports live show/hide of Error Log panel in response to settings.
 * - No use of window.* or global log boxes: all logs routed to ErrorLogPanel via ES module.
 * - Logging via log.js.
 * - Logging policy: Use INFO for panel registration, user-visible events, and layout lifecycle; DEBUG for internal state; ERROR for problems.
 * - TRACE-level entry/exit logging for all functions.
 * -----------------------------------------------------------
 */

import 'tabulator-tables/dist/css/tabulator.min.css';

import { GoldenLayout } from 'golden-layout';
import { buildSidebarPanel } from './sidebar.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { AppState, getSetting, setSetting, subscribe } from './state.js';
import { log } from './log.js';

log("INFO", "[layout] layout.js module loaded and ready!");

// Track layout instance and ErrorLog stack item
let layout = null;
let errorLogStackItem = null;

/**
 * Returns true if Error Log panel is present in layout.
 */
function isErrorLogPanelOpen() {
  if (!layout) return false;
  try {
    return !!findErrorLogStackItem();
  } catch (e) {
    log("ERROR", "[layout] isErrorLogPanelOpen exception", e);
    return false;
  }
}

/**
 * Find the Error Log panel stack item in GL.
 */
function findErrorLogStackItem() {
  if (!layout) return null;
  // Golden Layout v2: walk contentItems tree to find "ErrorLogPanel"
  const traverse = (item) => {
    if (!item) return null;
    if (item.config && item.config.componentName === "ErrorLogPanel") return item;
    if (item.contentItems && item.contentItems.length) {
      for (const child of item.contentItems) {
        const found = traverse(child);
        if (found) return found;
      }
    }
    return null;
  };
  return traverse(layout.rootItem);
}

/**
 * Show Error Log Panel (add to layout if not present).
 */
export function showErrorLogPanel() {
  log("TRACE", "[layout] showErrorLogPanel entry");
  if (!layout) {
    log("ERROR", "[layout] showErrorLogPanel: layout not initialized");
    return;
  }
  if (isErrorLogPanelOpen()) {
    log("INFO", "[layout] showErrorLogPanel: already open, skipping");
    return;
  }
  // Add as last child in column (full width at bottom)
  const root = layout.rootItem;
  // If root is a row, wrap in column
  let column = root;
  if (root.type === "row") {
    // Convert to column with existing row and new error log
    layout.root.replaceChild(root, layout.createContentItem({
      type: 'column',
      content: [
        root.config,
        {
          type: 'component',
          componentName: 'ErrorLogPanel',
          title: 'Error Log',
          height: 18
        }
      ]
    }));
  } else if (root.type === "column") {
    // Add to bottom of column
    layout.root.addChild({
      type: 'component',
      componentName: 'ErrorLogPanel',
      title: 'Error Log',
      height: 18
    });
  }
  log("INFO", "[layout] ErrorLogPanel added to layout (showErrorLogPanel)");
}

/**
 * Hide Error Log Panel (closes the panel as if user pressed its close button).
 */
export function hideErrorLogPanel() {
  log("TRACE", "[layout] hideErrorLogPanel entry");
  if (!layout) {
    log("ERROR", "[layout] hideErrorLogPanel: layout not initialized");
    return;
  }
  const errorLogItem = findErrorLogStackItem();
  if (errorLogItem) {
    errorLogItem.remove();
    log("INFO", "[layout] ErrorLogPanel removed from layout (hideErrorLogPanel)");
  } else {
    log("DEBUG", "[layout] hideErrorLogPanel: panel not present, nothing to remove");
  }
}

// Expose for settings.js to use
export function setErrorLogPanelVisible(visible) {
  if (visible) {
    showErrorLogPanel();
  } else {
    hideErrorLogPanel();
  }
}

// Listen for changes to showErrorLogPanel setting
subscribe((state, details) => {
  if (details && details.type === "setting" && details.key === "showErrorLogPanel") {
    setErrorLogPanelVisible(details.value);
  }
});

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
  let showErrorLogPanelSetting = true;
  try {
    // Import and call loadSettings from settings.js for proper persistence
    loadSettings();
    showErrorLogPanelSetting = getSetting("showErrorLogPanel") !== false;
    log("DEBUG", "[layout] Loaded settings, showErrorLogPanel:", showErrorLogPanelSetting);
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, defaulting showErrorLogPanel to true", e);
    showErrorLogPanelSetting = true;
  }

  // Layout config: conditionally add ErrorLog panel
  let panelLayout = {
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

  if (showErrorLogPanelSetting) {
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

// Export control functions for settings.js
export { isErrorLogPanelOpen };

