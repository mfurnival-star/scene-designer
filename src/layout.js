/**
 * layout.js
 * -----------------------------------------------------------
 * MiniLayout App Bootstrapper for Scene Designer
 * Exports:
 *  - Error Log panel helpers:
 *      isErrorLogPanelOpen, showErrorLogPanel, hideErrorLogPanel, setErrorLogPanelVisible
 *  - Scenario Runner panel helpers:
 *      isScenarioPanelOpen, showScenarioPanel, hideScenarioPanel, setScenarioRunnerPanelVisible
 * Dependencies: minilayout.js, log.js, state.js, settings.js, errorlog.js, canvas.js, toolbar.js, scenario-panel.js
 *
 * MiniLayout Compliance:
 * - All panel/component factories registered expect a single object argument:
 *   { element, title, componentName }
 * - No legacy Golden Layout patterns or multi-argument panel factories.
 */

import { MiniLayout } from './minilayout.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
import { buildScenarioPanel } from './scenario-panel.js';
import { getSetting, subscribe } from './state.js';
import { log } from './log.js';

let layout = null;
let mlRoot = null;

/**
 * Returns true if Error Log panel is present in layout.
 */
export function isErrorLogPanelOpen() {
  if (!layout || !layout._panelRefs) return false;
  return layout._panelRefs.some(ref => ref.node?.componentName === "ErrorLogPanel");
}

/**
 * Returns true if Scenario Runner panel is present in layout.
 */
export function isScenarioPanelOpen() {
  if (!layout || !layout._panelRefs) return false;
  return layout._panelRefs.some(ref => ref.node?.componentName === "ScenarioPanel");
}

/**
 * Show Error Log Panel (add to layout if not present).
 */
export function showErrorLogPanel() {
  log("DEBUG", "[layout] showErrorLogPanel entry");
  if (!layout) {
    log("ERROR", "[layout] showErrorLogPanel: layout not initialized");
    return;
  }
  if (isErrorLogPanelOpen()) {
    log("INFO", "[layout] showErrorLogPanel: already open, skipping");
    return;
  }
  const includeScenario = getSetting("showScenarioRunner") === true;
  rebuildLayout(true, includeScenario);
  log("INFO", "[layout] ErrorLogPanel added to layout (showErrorLogPanel)");
}

/**
 * Hide Error Log Panel (removes the panel).
 */
export function hideErrorLogPanel() {
  log("DEBUG", "[layout] hideErrorLogPanel entry");
  if (!layout) {
    log("ERROR", "[layout] hideErrorLogPanel: layout not initialized");
    return;
  }
  if (!isErrorLogPanelOpen()) {
    log("INFO", "[layout] hideErrorLogPanel: already hidden, skipping");
    return;
  }
  const includeScenario = getSetting("showScenarioRunner") === true;
  rebuildLayout(false, includeScenario);
  log("INFO", "[layout] ErrorLogPanel removed from layout (hideErrorLogPanel)");
}

/**
 * Expose for settings.js to use
 */
export function setErrorLogPanelVisible(visible) {
  if (visible) showErrorLogPanel();
  else hideErrorLogPanel();
}

/**
 * Show Scenario Runner Panel.
 */
export function showScenarioPanel() {
  log("DEBUG", "[layout] showScenarioPanel entry");
  if (!layout) {
    log("ERROR", "[layout] showScenarioPanel: layout not initialized");
    return;
  }
  if (isScenarioPanelOpen()) {
    log("INFO", "[layout] showScenarioPanel: already open, skipping");
    return;
  }
  const includeError = getSetting("showErrorLogPanel") !== false;
  rebuildLayout(includeError, true);
  log("INFO", "[layout] ScenarioPanel added to layout (showScenarioPanel)");
}

/**
 * Hide Scenario Runner Panel.
 */
export function hideScenarioPanel() {
  log("DEBUG", "[layout] hideScenarioPanel entry");
  if (!layout) {
    log("ERROR", "[layout] hideScenarioPanel: layout not initialized");
    return;
  }
  if (!isScenarioPanelOpen()) {
    log("INFO", "[layout] hideScenarioPanel: already hidden, skipping");
    return;
  }
  const includeError = getSetting("showErrorLogPanel") !== false;
  rebuildLayout(includeError, false);
  log("INFO", "[layout] ScenarioPanel removed from layout (hideScenarioPanel)");
}

/**
 * Expose for settings.js to use
 */
export function setScenarioRunnerPanelVisible(visible) {
  if (visible) showScenarioPanel();
  else hideScenarioPanel();
}

// Listen for changes to panel visibility settings
subscribe((state, details) => {
  if (!details || details.type !== "setSetting") return;

  if (details.key === "showErrorLogPanel") {
    setErrorLogPanelVisible(details.value);
  }
  if (details.key === "showScenarioRunner") {
    setScenarioRunnerPanelVisible(details.value);
  }
});

/**
 * Rebuild the layout with conditional Scenario Runner and/or Error Log panels.
 * @param {boolean} includeErrorLogPanel
 * @param {boolean} includeScenarioPanel
 */
function rebuildLayout(includeErrorLogPanel, includeScenarioPanel) {
  log("DEBUG", "[layout] rebuildLayout entry", { includeErrorLogPanel, includeScenarioPanel });
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

  // Base column: Toolbar (fixed 14%) + Canvas (flex fill)
  const mainColumn = {
    type: 'column',
    width: 70,
    content: [
      {
        type: 'component',
        componentName: 'CanvasToolbarPanel',
        title: 'Toolbar',
        height: 14,
        closable: false
      },
      {
        type: 'component',
        componentName: 'CanvasPanel',
        title: 'Canvas',
        // IMPORTANT: no height here → Canvas flexes to fill all remaining space
        scrollbars: 'both',
        scrollbarStyle: {
          width: '28px',
          color: '#2176ff',
          track: '#e0e4ec',
          radius: '14px',
          hover: '#0057d8'
        },
        closable: false
      }
    ]
  };

  if (includeScenarioPanel) {
    // Scenario takes a fixed 30%; Canvas above will automatically shrink to fit
    mainColumn.content.push({
      type: 'component',
      componentName: 'ScenarioPanel',
      title: 'Scenario Runner',
      height: 30,
      scrollbars: 'auto',
      // Keep non-closable for now to avoid desync with settings checkbox
      closable: false
    });
  }

  // Full root with Settings on the right
  let panelLayout = {
    root: {
      type: 'row',
      content: [
        mainColumn,
        {
          type: 'component',
          componentName: 'SettingsPanel',
          title: 'Settings',
          width: 30,
          closable: false
        }
      ]
    }
  };

  if (includeErrorLogPanel) {
    // Add ErrorLog panel as a bottom row
    panelLayout.root = {
      type: 'column',
      content: [
        panelLayout.root,
        {
          type: 'component',
          componentName: 'ErrorLogPanel',
          title: 'Error Log',
          height: 18,
          closable: false // keep in sync with setting
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
  log("DEBUG", "[layout] rebuildLayout exit");
}

// --- DOMContentLoaded Bootstrap ---
document.addEventListener("DOMContentLoaded", async () => {
  mlRoot = document.getElementById("ml-root");
  if (!mlRoot) {
    log("ERROR", "[layout] #ml-root not found!");
    return;
  }

  let showErrorLog = true;
  let showScenario = false;
  try {
    await loadSettings();
    showErrorLog = getSetting("showErrorLogPanel") !== false;
    showScenario = getSetting("showScenarioRunner") === true;
    log("DEBUG", "[layout] Loaded settings", { showErrorLog, showScenario });
    log("INFO", "[layout] DOMContentLoaded fired");
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, using defaults", e);
    showErrorLog = true;
    showScenario = false;
  }

  // Initial layout build honoring both settings
  rebuildLayout(showErrorLog, showScenario);
});

