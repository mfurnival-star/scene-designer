/**
 * layout.js (DEBUG VERSION)
 * -----------------------------------------------------------
 * Golden Layout 2.5.0 Bootstrapping & Panel Registration
 * - DEBUG: Alerts, log div, and console logs at every step
 * - Uses a correct, minimal, Golden Layout 2.x config that matches your desired UI
 * -----------------------------------------------------------
 */

// -- DEBUG: Floating log div for in-page output --
(function setupFloatingLogDiv() {
  if (document.getElementById('debugLogDiv')) return;
  const div = document.createElement('div');
  div.id = 'debugLogDiv';
  div.style.position = 'fixed';
  div.style.bottom = '10px';
  div.style.right = '10px';
  div.style.zIndex = 99999;
  div.style.maxWidth = '90vw';
  div.style.maxHeight = '40vh';
  div.style.overflow = 'auto';
  div.style.background = 'rgba(0,0,0,0.87)';
  div.style.color = '#fff';
  div.style.padding = '8px';
  div.style.borderRadius = '8px';
  div.style.fontSize = '13px';
  div.style.fontFamily = 'monospace';
  div.style.boxShadow = '0 2px 16px #0009';
  div.innerHTML = '<b>Debug Log</b><hr style="border-color:#333">';
  document.body.appendChild(div);
  window.debugLog = function(...args) {
    const time = new Date().toLocaleTimeString();
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    div.innerHTML += `<div style="margin-bottom:2px;"><span style="color:#9af;">[${time}]</span> ${msg}</div>`;
    div.scrollTop = div.scrollHeight;
    // Also log to console
    console.log('[DEBUG]', ...args);
  };
  window.debugAlert = function(...args) {
    debugLog(...args);
    alert(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  };
})();

import { GoldenLayout } from "https://cdn.jsdelivr.net/npm/golden-layout@2.5.0/+esm";
import { buildCanvasPanel } from './canvas.js';
import { buildSidebarPanel } from './sidebar.js';
import { buildSettingsPanel } from './settings.js';

/**
 * Correct Golden Layout 2.x config for your desired UI:
 * - A row with:
 *   - Left: CanvasPanel (large area)
 *   - Right: column with SidebarPanel (top) and SettingsPanel (bottom)
 * 
 * Use 'weight' for sizing (Golden Layout 2.x).
 */
const layoutConfig = {
  content: [{
    type: "row",
    content: [
      {
        type: "component",
        componentName: "CanvasPanel",
        title: "Canvas",
        weight: 4 // 4/5 of the width
      },
      {
        type: "column",
        weight: 1, // 1/5 of the width
        content: [
          {
            type: "component",
            componentName: "SidebarPanel",
            title: "Shapes",
            weight: 1 // top half of the column
          },
          {
            type: "component",
            componentName: "SettingsPanel",
            title: "Settings",
            weight: 1 // bottom half of the column
          }
        ]
      }
    ]
  }]
};

function logLayoutEvent(level, ...args) {
  debugLog(`[${level}]`, ...args);
  if (level === "ERROR") {
    alert("ERROR: " + args.join(' '));
    console.error("[layout]", ...args);
  }
}

function mountPanel(factory, container) {
  try {
    debugLog("mountPanel called for", factory.name, container);
    alert(`mountPanel: ${factory.name}`);
    const rootElement = document.createElement("div");
    rootElement.style.height = "100%";
    rootElement.style.width = "100%";
    rootElement.style.border = "2px dashed #ff0";
    container.element.appendChild(rootElement);
    debugLog(`Calling factory for ${factory.name}...`);
    factory(rootElement, container);
    debugLog(`Factory ${factory.name} completed.`);
  } catch (e) {
    debugLog("mountPanel ERROR", e);
    alert("mountPanel ERROR: " + e.message);
    throw e;
  }
}

function registerPanels(layout) {
  debugLog("registerPanels called");
  layout.registerComponent("CanvasPanel", (container, state) => {
    debugLog("registerComponent: CanvasPanel");
    mountPanel(buildCanvasPanel, container);
  });
  layout.registerComponent("SidebarPanel", (container, state) => {
    debugLog("registerComponent: SidebarPanel");
    mountPanel(buildSidebarPanel, container);
  });
  layout.registerComponent("SettingsPanel", (container, state) => {
    debugLog("registerComponent: SettingsPanel");
    mountPanel(buildSettingsPanel, container);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    debugLog("DOMContentLoaded - bootstrapping Golden Layout");
    const glRoot = document.getElementById("gl-root");
    if (!glRoot) {
      logLayoutEvent("ERROR", "Golden Layout root #gl-root not found!");
      return;
    }
    while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);
    const layout = new GoldenLayout(glRoot, layoutConfig);
    registerPanels(layout);
    window.myLayout = layout;
    layout.init();
    logLayoutEvent("INFO", "Golden Layout initialized and panels registered.");
  } catch (e) {
    debugLog("ERROR in DOMContentLoaded", e);
    alert("ERROR in DOMContentLoaded: " + e.message);
    throw e;
  }
});
