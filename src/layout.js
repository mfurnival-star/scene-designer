/**
 * layout.js
 * -----------------------------------------------------------
 * Golden Layout App Bootstrapper for Scene Designer
 * - Sets up all Golden Layout panels and registers panel factories.
 * - Panels: Sidebar, CanvasToolbar, Canvas, Settings, ErrorLog (dynamically shown/hidden).
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
import { setSettingAndSave } from './settings.js';
// Import the new CanvasToolbarPanel builder (to be implemented)
import { buildCanvasToolbarPanel } from './toolbar.js';

// Track layout instance and ErrorLog stack item
let layout = null;

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
  return traverse(layout.rootItem?.contentItems?.[0]);
}

/**
 * Find the top-level column below root (the only child).
 */
function getTopLevelColumn() {
  if (!layout || !layout.rootItem) return null;
  const firstChild = layout.rootItem.contentItems?.[0];
  if (firstChild?.type === "column") return firstChild;
  if (firstChild?.type === "row") {
    // Should never happen after initial config, but for safety, wrap in column if needed
    return null;
  }
  return null;
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
  const col = getTopLevelColumn();
  if (!col) {
    log("ERROR", "[layout] showErrorLogPanel: top-level column not found or not a column");
    return;
  }
  col.addChild({
    type: 'component',
    componentName: 'ErrorLogPanel',
    title: 'Error Log',
    height: 18
  });
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

document.addEventListener("DOMContentLoaded", async () => {
  // --------- DEFER ALL LOGGING UNTIL SETTINGS ARE LOADED ----------
  const glRoot = document.getElementById("gl-root");

  if (!glRoot) {
    log("ERROR", "[layout] #gl-root not found!");
    return;
  }

  // Load settings asynchronously before building layout, so we get the correct showErrorLogPanel value
  let showErrorLogPanelSetting = true;
  try {
    await loadSettings();
    showErrorLogPanelSetting = getSetting("showErrorLogPanel") !== false;
    // Now safe to log at INFO/DEBUG/TRACE after log level is set
    log("DEBUG", "[layout] Loaded settings, showErrorLogPanel:", showErrorLogPanelSetting);
    log("INFO", "[layout] DOMContentLoaded fired");
    log("INFO", "[layout] glRoot found?", !!glRoot, glRoot);
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, defaulting showErrorLogPanel to true", e);
    showErrorLogPanelSetting = true;
  }

  // Layout config: new layout with CanvasToolbar above Canvas in a column
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
          type: 'column',
          width: 60,
          content: [
            {
              type: 'component',
              componentName: 'CanvasToolbarPanel',
              title: 'Toolbar',
              height: 8
            },
            {
              type: 'component',
              componentName: 'CanvasPanel',
              title: 'Canvas',
              height: 92
            }
          ]
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
      glRoot
    );
    log("INFO", "[layout] GoldenLayout instance created.");
  } catch (e) {
    log("ERROR", "[layout] ERROR while creating GoldenLayout instance:", e?.message || e);
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

    layout.registerComponent('CanvasToolbarPanel', (container) => {
      log("TRACE", "[layout] CanvasToolbarPanel factory entry", {
        title: container?.title,
        componentName: container?.componentName
      });
      log("INFO", "[layout] CanvasToolbarPanel factory called", {
        title: container?.title,
        componentName: container?.componentName
      });
      buildCanvasToolbarPanel(container.element, container);
      log("TRACE", "[layout] CanvasToolbarPanel factory exit");
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

    layout.registerComponent('SettingsPanel', (container) => {
      log("TRACE", "[layout] SettingsPanel factory entry", {
        title: container?.title,
        componentName: container?.componentName
      });
      log("INFO", "[layout] SettingsPanel factory called", {
        title: container?.title,
        componentName: container?.componentName
      });
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

      if (typeof container.on === "function") {
        container.on('destroy', () => {
          log("INFO", "[layout] ErrorLogPanel destroy event – updating setting to false");
          if (getSetting("showErrorLogPanel")) {
            setSettingAndSave("showErrorLogPanel", false);
          }
        });
      }
      log("TRACE", "[layout] ErrorLogPanel factory exit");
    });

    registerErrorLogSink();

    log("DEBUG", "[layout] All panel factories registered, log sink registered");
  } catch (e) {
    log("ERROR", "[layout] ERROR in registerComponent:", e?.message || e);
    throw e;
  }

  try {
    log("INFO", "[layout] Calling layout.init...");
    layout.init();
    log("INFO", "[layout] layout.init called, done.");
  } catch (e) {
    log("ERROR", "[layout] ERROR during layout.init:", e?.message || e);
    throw e;
  }
});

// Export control functions for settings.js
export { isErrorLogPanelOpen };

