/**
 * layout.js
 * -----------------------------------------------------------
 * MiniLayout App Bootstrapper for Scene Designer
 * Exports: showErrorLogPanel, hideErrorLogPanel, setErrorLogPanelVisible, isErrorLogPanelOpen
 * Dependencies: minilayout.js, log.js, state.js, settings.js, errorlog.js, canvas.js, toolbar.js
 *
 * MiniLayout Compliance:
 * - All panel/component factories registered expect a single object argument:
 *   { element, title, componentName }
 * - No legacy Golden Layout patterns or multi-argument panel factories.
 */

import { MiniLayout } from './minilayout.js';
// REMOVED: import { buildSidebarPanel } from './sidebar.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
// FIXED: Remove invalid import of AppState, only import actual exports
import { getSetting, subscribe } from './state.js';
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

/**
 * Expose for settings.js to use
 */
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
        // REMOVED SIDEBAR PANEL
        // {
        //   type: 'component',
        //   componentName: 'SidebarPanel',
        //   title: 'Sidebar',
        //   width: 20,
        // },
        {
          type: 'column',
          width: 70, // Increase width for canvas/toolbar after removing sidebar
          content: [
            {
              type: 'component',
              componentName: 'CanvasToolbarPanel',
              title: 'Toolbar',
              height: 18
            },
            {
              type: 'component',
              componentName: 'CanvasPanel',
              title: 'Canvas',
              height: 82
            }
          ]
        },
        {
          type: 'component',
          componentName: 'SettingsPanel',
          title: 'Settings',
          width: 30,
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

  // Panel/component registration (MiniLayout expects single object arg: { element, title, componentName })
  // REMOVED: layout.registerComponent('SidebarPanel', buildSidebarPanel);
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

