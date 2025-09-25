import { MiniLayout } from './minilayout.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
import { getSetting, subscribe } from './state.js';
import { log } from './log.js';
import { installUndoRedoKeybindings } from './keybindings.js';
import { buildHistoryPanel } from './history-panel.js';

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
export function setScenarioRunnerPanelVisible(_visible) {}

export function showErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] showErrorLogPanel: layout not initialized"); return; }
  if (isErrorLogPanelOpen()) { log("INFO", "[layout] Error Log already open"); return; }
  rebuildLayout();
  log("INFO", "[layout] Error Log panel added");
}
export function hideErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] hideErrorLogPanel: layout not initialized"); return; }
  if (!isErrorLogPanelOpen()) { log("INFO", "[layout] Error Log already hidden"); return; }
  rebuildLayout();
  log("INFO", "[layout] Error Log panel removed");
}
export function setErrorLogPanelVisible(_visible) {
  rebuildLayout();
}

subscribe((state, details) => {
  if (!details || details.type !== "setSetting") return;
  if (details.key === "showErrorLogPanel") rebuildLayout();
  if (details.key === "showScenarioRunner") rebuildLayout();
  if (details.key === "showRightSidebarPanel") rebuildLayout();
  if (details.key === "showSettingsPanel") rebuildLayout();
  if (details.key === "showHistoryPanel") rebuildLayout();
});

function rebuildLayout() {
  if (!mlRoot) {
    mlRoot = document.getElementById("ml-root");
    if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }
  }

  if (layout && typeof layout.destroy === "function") {
    try { layout.destroy(); } catch {}
  }

  const showErrorLog = getSetting("showErrorLogPanel") !== false;
  const sidebarEnabled = getSetting("showRightSidebarPanel") !== false;
  const settingsEnabled = getSetting("showSettingsPanel") !== false;
  const historyEnabled = !!getSetting("showHistoryPanel");

  const rightSidebarContent = [];
  if (sidebarEnabled) {
    if (settingsEnabled) {
      rightSidebarContent.push({
        type: 'component',
        componentName: 'SettingsPanel',
        title: 'Settings',
        height: historyEnabled ? 60 : 100,
        closable: false
      });
    }
    if (historyEnabled) {
      rightSidebarContent.push({
        type: 'component',
        componentName: 'HistoryPanel',
        title: 'History',
        height: settingsEnabled ? 40 : 100,
        closable: false
      });
    }
  }

  const mainColumn = {
    type: 'column',
    width: rightSidebarContent.length ? 70 : 100,
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

  const rowContent = [mainColumn];
  if (rightSidebarContent.length) {
    rowContent.push({
      type: 'column',
      width: 30,
      content: rightSidebarContent,
      closable: false
    });
  }

  let rootLayout = {
    type: 'row',
    content: rowContent
  };

  if (showErrorLog) {
    rootLayout = {
      type: 'column',
      content: [
        rootLayout,
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

  const panelLayout = { root: rootLayout };

  layout = new MiniLayout(panelLayout, mlRoot);

  layout.registerComponent('CanvasToolbarPanel', buildCanvasToolbarPanel);
  layout.registerComponent('CanvasPanel', buildCanvasPanel);
  layout.registerComponent('SettingsPanel', buildSettingsPanel);
  layout.registerComponent('ErrorLogPanel', buildErrorLogPanel);
  layout.registerComponent('HistoryPanel', buildHistoryPanel);

  registerErrorLogSink();

  layout.init();

  if (typeof window !== "undefined") {
    try { window.layout = layout; } catch {}
  }

  log("INFO", "[layout] Layout initialized", {
    withErrorLog: !!showErrorLog,
    sidebarEnabled: !!rightSidebarContent.length,
    settingsPanel: !!settingsEnabled,
    historyPanel: !!historyEnabled
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  mlRoot = document.getElementById("ml-root");
  if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }

  try {
    await loadSettings();
  } catch (e) {
    log("ERROR", "[layout] Error loading settings, using defaults", e);
  }

  rebuildLayout();

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
