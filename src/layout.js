import { MiniLayout } from './minilayout.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel, loadSettings } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { buildCanvasToolbarPanel } from './toolbar.js';
import { buildHistoryPanel } from './history-panel.js';
import { getSetting, subscribe } from './state.js';
import { setSettingAndSave } from './settings.js';
import { log } from './log.js';
import { installUndoRedoKeybindings } from './keybindings.js';

let layout = null;
let mlRoot = null;
let detachKeybindings = null;

// Auto‑force & enforcement guards
let sidebarAutoForced = false;
let enforcingSidebar = false;
const PREVENT_HIDING = true; // user cannot fully hide settings sidebar now

export function isErrorLogPanelOpen() {
  if (!layout || !layout._panelRefs) return false;
  return layout._panelRefs.some(ref => ref.node?.componentName === "ErrorLogPanel");
}

export function isScenarioPanelOpen() { return false; }
export function showScenarioPanel() { log("INFO", "[layout] Scenario Runner is disabled"); }
export function hideScenarioPanel() { log("INFO", "[layout] Scenario Runner is disabled"); }
export function setScenarioRunnerPanelVisible(_visible) {}

export function showErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] showErrorLogPanel: layout not initialized"); return; }
  if (isErrorLogPanelOpen()) return;
  rebuildLayout();
}
export function hideErrorLogPanel() {
  if (!layout) { log("ERROR", "[layout] hideErrorLogPanel: layout not initialized"); return; }
  if (!isErrorLogPanelOpen()) return;
  rebuildLayout();
}
export function setErrorLogPanelVisible(_visible) { rebuildLayout(); }

function ensureSidebarVisibleInitial(reason) {
  if (sidebarAutoForced) return;
  const right = getSetting("showRightSidebarPanel");
  const settings = getSetting("showSettingsPanel");
  if (right === false || settings === false || right === undefined || settings === undefined) {
    sidebarAutoForced = true;
    try {
      if (right !== true) setSettingAndSave("showRightSidebarPanel", true);
      if (settings !== true) setSettingAndSave("showSettingsPanel", true);
      log("INFO", "[layout] Auto-forced Settings sidebar visibility", { reason });
    } catch (e) {
      log("ERROR", "[layout] Auto-force failed", e);
    }
  }
}

function enforceSidebarVisibilityOnSettingChange(key, value) {
  if (!PREVENT_HIDING) return;
  if (key !== "showRightSidebarPanel" && key !== "showSettingsPanel") return;
  if (value === true) return;
  if (enforcingSidebar) return;
  enforcingSidebar = true;
  try {
    log("WARN", "[layout] Preventing sidebar/settings panel from being hidden", { key, attemptedValue: value });
    setSettingAndSave(key, true);
  } catch (e) {
    log("ERROR", "[layout] Failed to re-enable sidebar setting", { key, error: e });
  } finally {
    enforcingSidebar = false;
  }
}

subscribe((state, details) => {
  if (!details || details.type !== "setSetting") return;
  if (
    details.key === "showErrorLogPanel" ||
    details.key === "showScenarioRunner" ||
    details.key === "showRightSidebarPanel" ||
    details.key === "showSettingsPanel" ||
    details.key === "showHistoryPanel"
  ) {
    enforceSidebarVisibilityOnSettingChange(details.key, details.value);
    rebuildLayout();
  }
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
      minWidth: 220,
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

  enforceSidebarDomStyles();

  if (typeof window !== "undefined") {
    try { window.layout = layout; } catch {}
  }

  log("INFO", "[layout] Layout initialized");
}

/**
 * Updated: Allow Settings panel to grow (flexible height) especially for iOS Safari.
 * Previous implementation forced flex: 0 0 auto which collapsed the body to header height.
 * History panel can stay auto-sized unless we later need it flexible.
 */
function enforceSidebarDomStyles() {
  try {
    if (!layout || !mlRoot) return;
    const panels = mlRoot.querySelectorAll('.minilayout-panel');
    panels.forEach(p => {
      const header = p.querySelector('.minilayout-panel-header');
      if (!header) return;
      const txt = (header.textContent || '').trim();

      if (/^Settings$/i.test(txt)) {
        // Growable flex column
        p.style.minWidth = '220px';
        p.style.display = 'flex';
        p.style.flexDirection = 'column';
        p.style.flex = '1 1 0%';
        p.style.minHeight = '0';
        // Panel itself hides overflow; inner scrolling handled by settings-ui container.
        p.style.overflow = 'hidden';

        const body = p.querySelector('.minilayout-panel-body');
        if (body) {
          body.style.flex = '1 1 auto';
          body.style.minHeight = '0';
          body.style.overflow = 'hidden'; // inner div (#tweakpane-fields-div) scrolls
        }
      } else if (/^History$/i.test(txt)) {
        // Keep a minimum width; allow it to size per layout proportions.
        p.style.minWidth = '220px';
        // We purposely do NOT force 0 0 auto anymore; let MiniLayout assigned height stand.
        if (!p.style.flex || p.style.flex === '0 0 auto') {
          p.style.flex = '1 1 0%';
        }
        p.style.overflow = 'hidden';
        const body = p.querySelector('.minilayout-panel-body');
        if (body) {
          body.style.minHeight = '0';
          body.style.overflow = 'auto';
          body.style.WebkitOverflowScrolling = 'touch';
        }
      }
    });
  } catch (e) {
    log("WARN", "[layout] enforceSidebarDomStyles failed", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  mlRoot = document.getElementById("ml-root");
  if (!mlRoot) { log("ERROR", "[layout] #ml-root not found"); return; }

  try {
    await loadSettings();
  } catch (e) {
    log("ERROR", "[layout] Settings load failed; using defaults", e);
  }

  ensureSidebarVisibleInitial("initial-load");
  rebuildLayout();

  if (!detachKeybindings) {
    try {
      detachKeybindings = installUndoRedoKeybindings(window);
    } catch (e) {
      log("ERROR", "[layout] Failed to install keybindings", e);
    }
  }

  window.addEventListener('beforeunload', () => {
    try { detachKeybindings && detachKeybindings(); } catch {}
  }, { once: true });

  log("INFO", "[layout] App ready");
});
