/**
 * layout.js
 * -----------------------------------------------------------
 * MiniLayout App Bootstrapper for Scene Designer
 * - Sets up all panels using MiniLayout (row/column/stack config, splitters, tabs).
 * - Panels: Sidebar, CanvasToolbar, Canvas, Settings, ErrorLog (dynamically shown/hidden).
 * - Error Log panel is included on startup if AppState.settings.showErrorLogPanel is true.
 * - Supports live show/hide of Error Log panel in response to settings.
 * - No use of window.* or global log boxes: all logs routed to ErrorLogPanel via ES module.
 * - Logging via log.js.
 * - Logging policy: Use INFO for panel registration, user-visible events, and layout lifecycle; DEBUG for internal state; ERROR for problems.
 * - TRACE-level entry/exit logging for all functions.
 * -----------------------------------------------------------
 * Exports: showErrorLogPanel, hideErrorLogPanel, setErrorLogPanelVisible, isErrorLogPanelOpen
 * Dependencies: minilayout.js, log.js, state.js, settings.js, errorlog.js, sidebar.js, canvas.js, toolbar.js
 */

import { MiniLayout } from './minilayout.js';
import { buildSidebarPanel } from './sidebar.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
import { AppState, getSetting, subscribe } from './state.js';
import { log } from './log.js';
import { setSettingAndSave } from './settings.js';

let layout = null;
let mlRoot = null;

/**
 * Returns true if Error Log panel is present in layout.
 */
export function isErrorLogPanelOpen() {
  // Find the ErrorLogPanel among panel refs
  if (!layout || !layout._panelRefs) return false;
  return layout._panelRefs.some(ref =>
    ref.node?.componentName === "ErrorLogPanel"
  );
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
  // Rebuild layout config with ErrorLogPanel included
  rebuildLayout(true);
  log("INFO", "[layout] ErrorLogPanel added to layout (showErrorLogPanel)");
}

/**
 * Hide Error Log Panel (removes the panel).
 */
export function hideErrorLogPanel() {
  log("TRACE", "[layout] hideErrorLogPanel entry");
  if (!layout) {
    log("ERROR", "[layout] hideErrorLogPanel: layout not initialized");
    return;
  }
  if (!isErrorLogPanelOpen()) {
    log("INFO", "[layout] hideErrorLogPanel: already hidden, skipping");
    return;
  }
  // Rebuild layout config without ErrorLogPanel
  rebuildLayout(false);
  log("INFO", "[layout] ErrorLogPanel removed from layout (hideErrorLogPanel)");
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

/**
 * Rebuild the layout with or without the ErrorLogPanel.
 * @param {boolean} includeErrorLogPanel
 */
function rebuildLayout(includeErrorLogPanel) {
  log("TRACE", "[layout] rebuildLayout entry", { includeErrorLogPanel });
  if (!mlRoot) {
    mlRoot = document.getElementById("ml-root");
    if (!mlRoot) {
      log("ERROR", "[layout] #ml-root not found!");
      return;
    }
  }
  // Destroy previous layout if present
  if (layout && typeof layout.destroy === "function") {
    layout.destroy();
  }

  // Build layout config
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

  if (includeErrorLogPanel) {
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

  layout = new MiniLayout(panelLayout, mlRoot);

  // Panel/component registration
  layout.registerComponent('SidebarPanel', buildSidebarPanel);
  layout.registerComponent('CanvasToolbarPanel', buildCanvasToolbarPanel);
  layout.registerComponent('CanvasPanel', buildCanvasPanel);
  layout.registerComponent('SettingsPanel', buildSettingsPanel);
  layout.registerComponent('ErrorLogPanel', buildErrorLogPanel);

  registerErrorLogSink();

  log("INFO", "[layout] All panel factories registered, log sink registered");

  layout.init();

  log("INFO", "[layout] Layout initialized");
  log("TRACE", "[layout] rebuildLayout exit");
}

// --- DOMContentLoaded Bootstrap ---
document.addEventListener("DOMContentLoaded", async () => {
  mlRoot = document.getElementById("ml-root");
  if (!mlRoot) {
    log("ERROR", "[layout] #ml-root not found!");
    return;
  }

  let showErrorLogPanelSetting = true;
  try {
    await loadSettings();
    showErrorLogPanelSetting = getSetting("showErrorLogPanel") !== false;
    log("DEBUG", "[layout] Loaded settings, showErrorLogPanel:", showErrorLogPanelSetting);
    log("INFO", "[layout] DOMContentLoaded fired");
    log("INFO", "[layout] mlRoot found?", !!mlRoot, mlRoot);
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, defaulting showErrorLogPanel to true", e);
    showErrorLogPanelSetting = true;
  }

  // Initial layout build
  rebuildLayout(showErrorLogPanelSetting);
});

// Only export each symbol once:
export {
  showErrorLogPanel,
  hideErrorLogPanel,
  setErrorLogPanelVisible,
  isErrorLogPanelOpen
};
