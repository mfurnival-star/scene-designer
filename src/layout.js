import { MiniLayout } from './minilayout.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
import { getSetting, subscribe } from './state.js';
import { log } from './log.js';
import { installUndoRedoKeybindings } from './keybindings.js';

let layout = null;
let mlRoot = null;
let detachKeybindings = null;

export function isErrorLogPanelOpen() {
  if (!layout || !layout._panelRefs) return false;
  return layout._panelRefs.some(ref => ref.node?.componentName === "ErrorLogPanel");
}

export function isScenarioPanelOpen() { return false; }
export function showScenarioPanel() { log("INFO", "[layout] Scenario Runner is disabled (no-op)"); }
export function hideScenarioPanel() { log("INFO", "[layout] Scenario Runner is disabled (no-op)"); }
export function setScenarioRunnerPanelVisible(_visible) { /* no-op (disabled) */ }

export function showErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] showErrorLogPanel: layout not initialized"); return; }
  if (isErrorLogPanelOpen()) { log("INFO", "[layout] Error Log already open"); return; }
  rebuildLayout(true, false);
  log("INFO", "[layout] Error Log panel added");
}
export function hideErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] hideErrorLogPanel: layout not initialized"); return; }
  if (!isErrorLogPanelOpen()) { log("INFO", "[layout] Error Log already hidden"); return; }
  rebuildLayout(false, false);
  log("INFO", "[layout] Error Log panel removed");
}
export function setErrorLogPanelVisible(visible) {
  if (visible) showErrorLogPanel();
  else hideErrorLogPanel();
}

subscribe((state, details) => {
  if (!details || details.type !== "setSetting") return;
  if (details.key === "showErrorLogPanel") {
    setErrorLogPanelVisible(details.value);
  }
  if (details.key === "showScenarioRunner") {
    setScenarioRunnerPanelVisible(details.value);
  }
});

function rebuildLayout(includeErrorLogPanel, _includeScenarioPanel) {
  if (!mlRoot) {
    mlRoot = document.getElementById("ml-root");
    if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }
  }

  if (layout && typeof layout.destroy === "function") {
    try { layout.destroy(); } catch {}
  }

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

  layout = new MiniLayout(panelLayout, mlRoot);

  layout.registerComponent('CanvasToolbarPanel', buildCanvasToolbarPanel);
  layout.registerComponent('CanvasPanel', buildCanvasPanel);
  layout.registerComponent('SettingsPanel', buildSettingsPanel);
  layout.registerComponent('ErrorLogPanel', buildErrorLogPanel);

  registerErrorLogSink();

  layout.init();

  log("INFO", "[layout] Layout initialized", {
    withErrorLog: !!includeErrorLogPanel
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  mlRoot = document.getElementById("ml-root");
  if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }

  let showErrorLog = true;
  try {
    await loadSettings();
    showErrorLog = getSetting("showErrorLogPanel") !== false;
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, using defaults", e);
    showErrorLog = true;
  }

  rebuildLayout(showErrorLog, false);

  if (!detachKeybindings) {
    try {
      detachKeybindings = installUndoRedoKeybindings(window);
    } catch (e) {
      log("ERROR", "[layout] Failed to install undo/redo keybindings", e);
    }
  }

  window.addEventListener('beforeunload', () => {
    try { detachKeybindings && detachKeybindings(); } catch {}
  }, { once: true });

  log("INFO", "[layout] App ready");
});
