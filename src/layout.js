/**
 * layout.js
 * -----------------------------------------------------------
 * MiniLayout App Bootstrapper for Scene Designer
 * Exports: showErrorLogPanel, hideErrorLogPanel, setErrorLogPanelVisible, isErrorLogPanelOpen
 * Dependencies: minilayout.js, log.js, state.js, settings.js, errorlog.js, canvas.js, toolbar.js, scenario-panel.js
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
import { buildScenarioPanel } from './scenario-panel.js';
import { getSetting, subscribe } from './state.js';
import { log } from './log.js';
// FIX: Remove import of setErrorLogPanelVisible
// import { setErrorLogPanelVisible } from './settings.js';

let layout = null;
let mlRoot = null;

/**
 * Returns true if Error Log panel is present in layout.
 */
export function isErrorLogPanelOpen() {
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
 * Rebuild the layout with Scenario Runner panel and/or Error Log panel.
 * Scenario Runner panel location:
 * - If panel is taller than wide (default): add as new row beneath CanvasToolbarPanel/CanvasPanel column.
 * - If panel is wider than tall: add as new column next to CanvasPanel in main column.
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

  // --- Scenario Runner panel config ---
  // Proportion logic: if default or unknown, add as a new row under toolbar/canvas column.
  // For now, always add as a new row below toolbar/canvas (taller than wide).
  let panelLayout = {
    root: {
      type: 'row',
      content: [
        {
          type: 'column',
          width: 70,
          content: [
            {
              type: 'component',
              componentName: 'CanvasToolbarPanel',
              title: 'Toolbar',
              height: 14
            },
            {
              type: 'component',
              componentName: 'CanvasPanel',
              title: 'Canvas',
              height: 56,
              scrollbars: 'both',
              scrollbarStyle: {
                width: '28px',
                color: '#2176ff',
                track: '#e0e4ec',
                radius: '14px',
                hover: '#0057d8'
              }
            },
            {
              type: 'component',
              componentName: 'ScenarioPanel',
              title: 'Scenario Runner',
              height: 30,
              scrollbars: 'auto',
	      closable: true
            }
          ]
        },
        {
          type: 'component',
          componentName: 'SettingsPanel',
          title: 'Settings',
          width: 30
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
          height: 18,
	  closable: true
        }
      ]
    };
    log("DEBUG", "[layout] ErrorLogPanel added to layout");
  }

  layout = new MiniLayout(panelLayout, mlRoot);

  // Panel/component registration (MiniLayout expects single object arg: { element, title, componentName })
  layout.registerComponent('CanvasToolbarPanel', buildCanvasToolbarPanel);
  layout.registerComponent('CanvasPanel', buildCanvasPanel);
  layout.registerComponent('SettingsPanel', buildSettingsPanel);
  layout.registerComponent('ErrorLogPanel', buildErrorLogPanel);
  layout.registerComponent('ScenarioPanel', buildScenarioPanel);

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

