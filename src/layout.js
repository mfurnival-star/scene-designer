/**
 * layout.js
 * -----------------------------------------------------------
 * Golden Layout App Bootstrapper for Scene Designer
 * - Sets up all Golden Layout panels and registers panel factories.
 * - Panels: Sidebar, Canvas, Settings, (NEW) ErrorLog.
 * - Error log panel is included on startup if AppState.settings.showErrorLogPanel is true.
 * - No use of window.* or global log boxes: all logs routed to ErrorLogPanel via ES module.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { GoldenLayout } from 'golden-layout';
import { buildSidebarPanel } from './sidebar.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel } from './settings.js';
import { buildErrorLogPanel, registerErrorLogSink } from './errorlog.js';
import { AppState, getSetting, setSetting } from './state.js';
import { log } from './log.js';

log("INFO", "[layout] layout.js module loaded and ready!");

document.addEventListener("DOMContentLoaded", () => {
  log("INFO", "[layout] DOMContentLoaded fired");

  const glRoot = document.getElementById("gl-root");
  log("INFO", "[layout] glRoot found?", !!glRoot, glRoot);

  if (!glRoot) {
    log("ERROR", "[layout] #gl-root not found!");
    return;
  }

  // Load settings once before layout, to ensure correct panel config
  let showErrorLogPanel = true;
  try {
    // If settings have not yet been loaded, this will default to true
    showErrorLogPanel = getSetting("showErrorLogPanel") !== false;
  } catch {
    showErrorLogPanel = true;
  }

  // Layout config: conditionally add ErrorLog panel
  const panelLayout = {
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
          type: 'component',
          componentName: 'CanvasPanel',
          title: 'Canvas',
          width: 60,
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

  if (showErrorLogPanel) {
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
  }

  let layout;
  try {
    log("INFO", "[layout] About to create GoldenLayout instance...");
    layout = new GoldenLayout(
      panelLayout,
      glRoot // <--- container is second argument!
    );
    log("INFO", "[layout] GoldenLayout instance created.");
  } catch (e) {
    log("ERROR", "[layout] ERROR while creating GoldenLayout instance:", e?.message || e);
    throw e;
  }

  try {
    layout.registerComponent('SidebarPanel', (container) => {
      log("INFO", "[layout] SidebarPanel factory called", container);
      buildSidebarPanel(container.element, container);
    });

    layout.registerComponent('CanvasPanel', (container) => {
      log("INFO", "[layout] CanvasPanel factory called", container);
      buildCanvasPanel(container.element, container);
    });

    layout.registerComponent('SettingsPanel', (container) => {
      log("INFO", "[layout] SettingsPanel factory called", container);
      buildSettingsPanel(container.element, container);
    });

    layout.registerComponent('ErrorLogPanel', (container) => {
      log("INFO", "[layout] ErrorLogPanel factory called", container);
      buildErrorLogPanel(container.element, container);
    });

    // Register log sink so all log messages go to ErrorLogPanel if open
    registerErrorLogSink();

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

