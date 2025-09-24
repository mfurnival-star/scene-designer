/**
 * layout.js
 * -----------------------------------------------------------
 * Scene Designer – MiniLayout Bootstrapper (ESM ONLY)
 *
 * Purpose:
 * - Build the MiniLayout-based UI: Toolbar + Canvas + Settings (+ optional Error Log).
 * - Expose helpers to toggle the Error Log panel.
 * - Scenario Runner is intentionally disabled (no registration).
 *
 * Exports:
 *  - isErrorLogPanelOpen()
 *  - showErrorLogPanel()
 *  - hideErrorLogPanel()
 *  - setErrorLogPanelVisible(visible)
 *  - isScenarioPanelOpen()           // always false (disabled)
 *  - showScenarioPanel()             // no-op
 *  - hideScenarioPanel()             // no-op
 *  - setScenarioRunnerPanelVisible() // no-op
 *
 * Dependencies:
 * - minilayout.js (MiniLayout)
 * - canvas.js (buildCanvasPanel)
 * - settings.js (buildSettingsPanel, loadSettings)
 * - errorlog.js (buildErrorLogPanel, registerErrorLogSink)
 * - toolbar.js (buildCanvasToolbarPanel)
 * - state.js (getSetting, subscribe)
 * - log.js (log)
 * -----------------------------------------------------------
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

/** True if Error Log panel is present in layout. */
export function isErrorLogPanelOpen() {
  if (!layout || !layout._panelRefs) return false;
  return layout._panelRefs.some(ref => ref.node?.componentName === "ErrorLogPanel");
}

/** Scenario Runner – DISABLED: return false and do nothing. */
export function isScenarioPanelOpen() { return false; }
export function showScenarioPanel() { log("INFO", "[layout] Scenario Runner is disabled (no-op)"); }
export function hideScenarioPanel() { log("INFO", "[layout] Scenario Runner is disabled (no-op)"); }
export function setScenarioRunnerPanelVisible(_visible) { /* no-op (disabled) */ }

/** Show/Hide Error Log panel (adds/removes panel and rebuilds layout). */
export function showErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] showErrorLogPanel: layout not initialized"); return; }
  if (isErrorLogPanelOpen()) { log("INFO", "[layout] Error Log already open"); return; }
  rebuildLayout(true /* includeErrorLogPanel */, false /* scenario disabled */);
  log("INFO", "[layout] Error Log panel added");
}
export function hideErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] hideErrorLogPanel: layout not initialized"); return; }
  if (!isErrorLogPanelOpen()) { log("INFO", "[layout] Error Log already hidden"); return; }
  rebuildLayout(false /* includeErrorLogPanel */, false /* scenario disabled */);
  log("INFO", "[layout] Error Log panel removed");
}
/** External helper (used by settings). */
export function setErrorLogPanelVisible(visible) {
  if (visible) showErrorLogPanel();
  else hideErrorLogPanel();
}

/** React to settings changes that affect panel visibility. */
subscribe((state, details) => {
  if (!details || details.type !== "setSetting") return;
  if (details.key === "showErrorLogPanel") {
    setErrorLogPanelVisible(details.value);
  }
  if (details.key === "showScenarioRunner") {
    // Intentionally disabled – keep no-op
    setScenarioRunnerPanelVisible(details.value);
  }
});

/**
 * Rebuild the layout with optional Error Log panel.
 * Scenario Runner is ignored (disabled).
 */
function rebuildLayout(includeErrorLogPanel, _includeScenarioPanel) {
  if (!mlRoot) {
    mlRoot = document.getElementById("ml-root");
    if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }
  }

  // Destroy previous layout if present
  if (layout && typeof layout.destroy === "function") {
    try { layout.destroy(); } catch {}
  }

  // Base: left column with Toolbar (top) + Canvas (fill), right Settings
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
    panelLayout.root = {
      type: 'column',
      content: [
        panelLayout.root,
        {
          type: 'component',
          componentName: 'ErrorLogPanel',
          title: 'Error Log',
          height: 18,
          closable: false
        }
      ]
    };
  }

  // Build new layout
  layout = new MiniLayout(panelLayout, mlRoot);

  // Register panels (MiniLayout expects { element, title, componentName })
  layout.registerComponent('CanvasToolbarPanel', buildCanvasToolbarPanel);
  layout.registerComponent('CanvasPanel', buildCanvasPanel);
  layout.registerComponent('SettingsPanel', buildSettingsPanel);
  layout.registerComponent('ErrorLogPanel', buildErrorLogPanel);
  // ScenarioPanel: intentionally NOT registered

  // Hook error log sink
  registerErrorLogSink();

  layout.init();

  log("INFO", "[layout] Layout initialized", {
    withErrorLog: !!includeErrorLogPanel
  });
}

// --- DOMContentLoaded Bootstrap ---
document.addEventListener("DOMContentLoaded", async () => {
  mlRoot = document.getElementById("ml-root");
  if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }

  // Load settings (once); honor showErrorLogPanel only (scenario disabled)
  let showErrorLog = true;
  try {
    await loadSettings();
    showErrorLog = getSetting("showErrorLogPanel") !== false;
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, using defaults", e);
    showErrorLog = true;
  }

  rebuildLayout(showErrorLog, false);
  log("INFO", "[layout] App ready");
});
