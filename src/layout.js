/**
 * layout.js
 * -----------------------------------------------------------
 * Golden Layout 2.5.0 Bootstrapping & Panel Registration
 * - Sets up Golden Layout using the canonical config (canvas, sidebar, settings)
 * - Panels are registered as ES module factories (no globals)
 * - Adheres to SCENE_DESIGNER_MANIFESTO.md and COPILOT_MANIFESTO.md
 * -----------------------------------------------------------
 */

import GoldenLayout from "https://cdn.jsdelivr.net/npm/golden-layout@2.5.0/+esm";

// Import panel modules (as ES modules; stubbed if not yet implemented)
import { buildCanvasPanel } from './canvas.js';
import { buildSidebarPanel } from './sidebar.js';
import { buildSettingsPanel } from './settings.js';

// Optional: Import logging if desired for layout events
// import { log } from './log.js';

// Canonical layout config (matches your provided structure)
const layoutConfig = {
  settings: {
    showPopoutIcon: false,
    showCloseIcon: false,
    showMaximiseIcon: false,
    hasHeaders: true
  },
  content: [{
    type: "row",
    content: [
      {
        type: "component",
        componentName: "CanvasPanel",
        title: "Canvas",
        width: 80
      },
      {
        type: "column",
        width: 20,
        content: [
          {
            type: "component",
            componentName: "SidebarPanel",
            title: "Shapes",
            height: 20
          },
          {
            type: "component",
            componentName: "SettingsPanel",
            title: "Settings",
            height: 80,
            isClosable: true
          }
        ]
      }
    ]
  }]
};

function logLayoutEvent(level, ...args) {
  // If using a logger module, call it here. Otherwise, fallback to console.
  if (typeof window.log === "function") window.log(level, "[layout]", ...args);
  else if (level === "ERROR") console.error("[layout]", ...args);
  else console.log("[layout]", ...args);
}

function mountPanel(factory, container) {
  // Factory: (rootElement, container) => void
  // Clear the panel and call the module factory
  const rootElement = document.createElement("div");
  rootElement.style.height = "100%";
  rootElement.style.width = "100%";
  container.element.appendChild(rootElement);
  factory(rootElement, container);
}

function registerPanels(layout) {
  layout.registerComponent("CanvasPanel", (container, state) => {
    mountPanel(buildCanvasPanel, container);
  });
  layout.registerComponent("SidebarPanel", (container, state) => {
    mountPanel(buildSidebarPanel, container);
  });
  layout.registerComponent("SettingsPanel", (container, state) => {
    mountPanel(buildSettingsPanel, container);
  });
}

// Bootstrap Golden Layout
document.addEventListener("DOMContentLoaded", () => {
  const glRoot = document.getElementById("gl-root");
  if (!glRoot) {
    logLayoutEvent("ERROR", "Golden Layout root #gl-root not found!");
    return;
  }
  // Remove any children in root
  while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

  const layout = new GoldenLayout(glRoot, layoutConfig);
  registerPanels(layout);

  // Optionally expose layout globally for debugging
  window.myLayout = layout;

  layout.init();

  // Optionally: Implement show/hide/toggle for settings panel here (per your UX needs)
  // e.g., expose window.showSettingsPanel / window.hideSettingsPanel if desired

  logLayoutEvent("INFO", "Golden Layout initialized and panels registered.");
});

