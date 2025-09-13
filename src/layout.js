import { GoldenLayout } from 'golden-layout';
import { buildSidebarPanel } from './sidebar.js';
import { buildCanvasPanel } from './canvas.js';
import { buildSettingsPanel } from './settings.js';

// Robust debug logger
function debugLog(...args) {
  if (typeof window.logToBox === 'function') window.logToBox(...args.map(a => {
    if (typeof a === 'object') return '[object Object]';
    return String(a);
  }));
  // eslint-disable-next-line no-console
  console.log(...args);
}
window.debugLog = debugLog; // For panel modules

debugLog("LAYOUT.JS: Script loaded and running!");

document.addEventListener("DOMContentLoaded", () => {
  debugLog("LAYOUT.JS: DOMContentLoaded fired");

  const glRoot = document.getElementById("gl-root");
  debugLog("LAYOUT.JS: glRoot found?", !!glRoot, glRoot);

  if (!glRoot) {
    debugLog("LAYOUT.JS: ERROR – #gl-root not found!");
    return;
  }

  let layout;
  try {
    debugLog("LAYOUT.JS: About to create GoldenLayout instance...");
    layout = new GoldenLayout(
      {
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
      },
      glRoot // <--- container is second argument!
    );
    debugLog("LAYOUT.JS: GoldenLayout instance created:", "[object Object]");
  } catch (e) {
    debugLog("LAYOUT.JS: ERROR while creating GoldenLayout instance:", e?.message || e);
    throw e;
  }

  try {
    layout.registerComponent('SidebarPanel', (container) => {
      debugLog("LAYOUT.JS: SidebarPanel factory called", container);
      buildSidebarPanel(container.element, container);
    });

    layout.registerComponent('CanvasPanel', (container) => {
      debugLog("LAYOUT.JS: CanvasPanel factory called", container);
      buildCanvasPanel(container.element, container);
    });

    layout.registerComponent('SettingsPanel', (container) => {
      debugLog("LAYOUT.JS: SettingsPanel factory called", container);
      buildSettingsPanel(container.element, container);
    });
  } catch (e) {
    debugLog("LAYOUT.JS: ERROR in registerComponent:", e?.message || e);
    throw e;
  }

  try {
    debugLog("LAYOUT.JS: Calling layout.init...");
    layout.init();
    debugLog("LAYOUT.JS: layout.init called, done.");
  } catch (e) {
    debugLog("LAYOUT.JS: ERROR during layout.init:", e?.message || e);
    throw e;
  }
});
