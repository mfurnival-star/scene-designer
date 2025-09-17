/**
 * minilayout.demo.js
 * -----------------------------------------------------------
 * Demo Entrypoint for Scene Designer Native Layout Manager (MiniLayout)
 * - Demonstrates MiniLayout features: panel stacking, drag-resize splitters, compact GL-like headers, close/destroy.
 * - Registers panel factories for Sidebar, Toolbar, Canvas, Settings, ErrorLog.
 * - All panel config uses { closable }, headerHeight, etc.
 * - Logging via log.js.
 * - Layout: Sidebar | [Toolbar above Canvas] | Settings, Error Log as bottom row.
 * - Ensures root container is fullscreen with no overflow/scroll.
 * -----------------------------------------------------------
 */

import { MiniLayout } from './minilayout.js';
import { log } from './log.js';

// --- Panel Factories (stub implementations) ---
function buildSidebarPanel({ element, title }) {
  element.innerHTML = `
    <div style="width:100%;height:100%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:1.2em;color:#444;font-weight:bold;">Sidebar<br>(Panel Stub)</span>
    </div>
  `;
  log("INFO", "[MiniLayout Demo] SidebarPanel rendered", { title });
}
function buildToolbarPanel({ element, title }) {
  element.innerHTML = `
    <div style="width:100%;height:100%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:1.15em;color:#555;font-weight:bold;">Toolbar<br>(Panel Stub)</span>
    </div>
  `;
  log("INFO", "[MiniLayout Demo] ToolbarPanel rendered", { title });
}
function buildCanvasPanel({ element, title }) {
  element.innerHTML = `
    <div style="width:100%;height:100%;background:#fafbfc;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:1.15em;color:#333;font-weight:bold;">Canvas<br>(Panel Stub)</span>
    </div>
  `;
  log("INFO", "[MiniLayout Demo] CanvasPanel rendered", { title });
}
function buildSettingsPanel({ element, title }) {
  element.innerHTML = `
    <div style="width:100%;height:100%;background:#fff8e6;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:1.08em;color:#a36a00;font-weight:bold;">Settings<br>(Panel Stub)</span>
    </div>
  `;
  log("INFO", "[MiniLayout Demo] SettingsPanel rendered", { title });
}
function buildErrorLogPanel({ element, title }) {
  element.innerHTML = `
    <div style="width:100%;height:100%;background:#222;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:1.05em;color:#fff;font-weight:bold;">Error Log<br>(Panel Stub)</span>
    </div>
  `;
  log("INFO", "[MiniLayout Demo] ErrorLogPanel rendered", { title });
}

// --- Demo Layout Config (Sidebar | [Toolbar above Canvas] | Settings, ErrorLog bottom row) ---
const panelLayoutConfig = {
  root: {
    type: 'column',
    content: [
      {
        type: 'row',
        content: [
          {
            type: 'component',
            componentName: 'SidebarPanel',
            title: 'Sidebar',
            width: 20,
            closable: true,
            headerHeight: 28
          },
          {
            type: 'column',     // Toolbar above Canvas, not a stack!
            width: 60,
            content: [
              {
                type: 'component',
                componentName: 'ToolbarPanel',
                title: 'Toolbar',
                height: 10,
                closable: false,
                headerHeight: 24
              },
              {
                type: 'component',
                componentName: 'CanvasPanel',
                title: 'Canvas',
                height: 90,
                closable: false,
                headerHeight: 28
              }
            ]
          },
          {
            type: 'component',
            componentName: 'SettingsPanel',
            title: 'Settings',
            width: 20,
            closable: true,
            headerHeight: 28
          }
        ]
      },
      {
        type: 'component',
        componentName: 'ErrorLogPanel',
        title: 'Error Log',
        height: 18,
        closable: true,
        headerHeight: 24
      }
    ]
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Ensure the root is fullscreen and overflow-hidden
  let mlRoot = document.getElementById("ml-root");
  if (!mlRoot) {
    mlRoot = document.createElement("div");
    mlRoot.id = "ml-root";
    mlRoot.style.position = "fixed";
    mlRoot.style.top = "0";
    mlRoot.style.left = "0";
    mlRoot.style.width = "100vw";
    mlRoot.style.height = "100vh";
    mlRoot.style.overflow = "hidden";
    mlRoot.style.margin = "0";
    mlRoot.style.padding = "0";
    mlRoot.style.boxSizing = "border-box";
    document.body.appendChild(mlRoot);
  } else {
    mlRoot.style.position = "fixed";
    mlRoot.style.top = "0";
    mlRoot.style.left = "0";
    mlRoot.style.width = "100vw";
    mlRoot.style.height = "100vh";
    mlRoot.style.overflow = "hidden";
    mlRoot.style.margin = "0";
    mlRoot.style.padding = "0";
    mlRoot.style.boxSizing = "border-box";
  }

  // Instantiate MiniLayout with config and container
  const layout = new MiniLayout(panelLayoutConfig, mlRoot);

  // Register panel/component factories
  layout.registerComponent('SidebarPanel', buildSidebarPanel);
  layout.registerComponent('ToolbarPanel', buildToolbarPanel);
  layout.registerComponent('CanvasPanel', buildCanvasPanel);
  layout.registerComponent('SettingsPanel', buildSettingsPanel);
  layout.registerComponent('ErrorLogPanel', buildErrorLogPanel);

  // Render the layout
  layout.init();

  log("INFO", "[MiniLayout Demo] Layout initialized");

  // NOTE: No demo controls for add/remove ErrorLogPanel (buttons removed for clean layout)
});
