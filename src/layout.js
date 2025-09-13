// layout.js – Golden Layout loader for 3-panel setup with local ESM panels
// -----------------------------------------------------
// Uses local ESM modules for canvas, sidebar, settings.
// -----------------------------------------------------

import { GoldenLayout } from 'golden-layout';
import { buildCanvasPanel } from './canvas.js';
import { buildSidebarPanel } from './sidebar.js';
import { buildSettingsPanel } from './settings.js';

console.log("LAYOUT.JS: imported GoldenLayout:", GoldenLayout);

const layoutConfig = {
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

document.addEventListener("DOMContentLoaded", () => {
  console.log("LAYOUT.JS: DOMContentLoaded");
  const glRoot = document.getElementById("gl-root");
  while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

  console.log("LAYOUT.JS: About to create GoldenLayout instance...");
  const layout = new GoldenLayout(glRoot, layoutConfig);

  layout.registerComponent("SidebarPanel", (container) => {
    console.log("LAYOUT.JS: SidebarPanel factory called", container);
    buildSidebarPanel(container.element, container);
  });

  layout.registerComponent("CanvasPanel", (container) => {
    console.log("LAYOUT.JS: CanvasPanel factory called", container);
    buildCanvasPanel(container.element, container);
  });

  layout.registerComponent("SettingsPanel", (container) => {
    console.log("LAYOUT.JS: SettingsPanel factory called", container);
    buildSettingsPanel(container.element, container);
  });

  console.log("LAYOUT.JS: Calling layout.init...");
  layout.init();

  console.log("LAYOUT.JS: layout.init called, done.");
});
