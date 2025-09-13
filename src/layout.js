import { GoldenLayout } from 'golden-layout';

// Helper for logging to both console and error-log-box
function debugLog(...args) {
  if (typeof window.logToBox === 'function') window.logToBox(...args.map(a => {
    if (typeof a === 'object') return '[object Object]';
    return String(a);
  }));
  // eslint-disable-next-line no-console
  console.log(...args);
}

debugLog("LAYOUT.JS: Script loaded and running!");

try {
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
      layout = new GoldenLayout(glRoot, {
        root: {
          type: 'row',
          content: [
            {
              type: 'component',
              componentName: 'testPanel',
              title: 'Test Panel'
            }
          ]
        }
      });
      debugLog("LAYOUT.JS: GoldenLayout instance created:", "[object Object]");
    } catch (e) {
      debugLog("LAYOUT.JS: ERROR while creating GoldenLayout instance:", e?.message || e);
      throw e;
    }

    try {
      layout.registerComponent('testPanel', (container) => {
        debugLog("LAYOUT.JS: testPanel factory called", container);
        container.element.innerHTML = "<div style='background:#fda;padding:2em;font-size:2em;'>Golden Layout IS WORKING<br><small>Check console and error-log-box for details.</small></div>";
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
} catch (err) {
  debugLog("LAYOUT.JS: TOP-LEVEL ERROR", err?.message || err);
}
