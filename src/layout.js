/**
 * layout.js
 * -----------------------------------------------------------
 * MiniLayout App Bootstrapper for Scene Designer
 * Exports:
 *  - Error Log panel helpers:
 *      isErrorLogPanelOpen, showErrorLogPanel, hideErrorLogPanel, setErrorLogPanelVisible
 *  - Scenario Runner panel helpers (DISABLED/NO-OP):
 *      isScenarioPanelOpen, showScenarioPanel, hideScenarioPanel, setScenarioRunnerPanelVisible
 * Dependencies: minilayout.js, log.js, state.js, settings.js, errorlog.js, canvas.js, toolbar.js
 *
 * MiniLayout Compliance:
 * - All panel/component factories registered expect a single object argument:
 *   { element, title, componentName }
 * - Scenario Runner is intentionally disabled: no imports, no registration, no layout usage.
 */

import { MiniLayout } from './minilayout.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
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
 * Scenario Runner – DISABLED:
 * Always returns false and never opens a panel.
 */
export function isScenarioPanelOpen() {
  return false;
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
  // Scenario panel is disabled; ignore that flag
  rebuildLayout(true, false);
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
  // Scenario panel is disabled; ignore that flag
  rebuildLayout(false, false);
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
 * Scenario Runner – DISABLED (no-op).
 */
export function showScenarioPanel() {
  log("INFO", "[layout] showScenarioPanel requested, but Scenario Runner is disabled (no-op)");
}

/**
 * Scenario Runner – DISABLED (no-op).
 */
export function hideScenarioPanel() {
  log("INFO", "[layout] hideScenarioPanel requested, but Scenario Runner is disabled (no-op)");
}

/**
 * Expose for settings.js to use (no-op).
 */
export function setScenarioRunnerPanelVisible(visible) {
  log("INFO", "[layout] Scenario Runner visibility set to", { visible, note: "disabled/no-op" });
}

// Listen for changes to panel visibility settings
subscribe((state, details) => {
  if (!details || details.type !== "setSetting") return;

  if (details.key === "showErrorLogPanel") {
    setErrorLogPanelVisible(details.value);
  }
  if (details.key === "showScenarioRunner") {
    // Intentionally do nothing (disabled)
    setScenarioRunnerPanelVisible(details.value);
  }
});

/**
 * Rebuild the layout with conditional Error Log panel.
 * Scenario Runner panel is intentionally ignored (disabled).
 * @param {boolean} includeErrorLogPanel
 * @param {boolean} _includeScenarioPanel (ignored)
 */
function rebuildLayout(includeErrorLogPanel, _includeScenarioPanel) {
  log("DEBUG", "[layout] rebuildLayout entry", { includeErrorLogPanel, scenarioPanelDisabled: true });
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

  // Base column: Toolbar (fixed ~14%) + Canvas (flex fill)
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
  // ScenarioPanel intentionally NOT registered (disabled)

  registerErrorLogSink();

  log("INFO", "[layout] All panel factories registered (Scenario Runner disabled), log sink registered");

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
  // Scenario Runner disabled; ignore setting but still load settings to honor others
  try {
    await loadSettings();
    showErrorLog = getSetting("showErrorLogPanel") !== false;
    log("DEBUG", "[layout] Loaded settings", { showErrorLog, scenarioPanelDisabled: true });
    log("INFO", "[layout] DOMContentLoaded fired");
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, using defaults", e);
    showErrorLog = true;
  }

  // Initial layout build honoring error log setting only
  rebuildLayout(showErrorLog, false);
});
