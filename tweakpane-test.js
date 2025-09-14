/**
 * tweakpane-test.js
 * -----------------------------------------------------------
 * Minimal Tweakpane ESM test for Scene Designer project.
 * - Verifies Tweakpane imports and works in your ES module build.
 * - No dependencies on any app state or other modules.
 * - No CSS import required (Tweakpane v4+ injects styles automatically).
 * - Run this as your entry to confirm Tweakpane is functional.
 * -----------------------------------------------------------
 */

import { Pane } from 'tweakpane';

// Create a root div for the panel
const root = document.createElement('div');
root.id = 'tweakpane-test-root';
root.style.margin = '2em';
root.style.maxWidth = '320px';
root.style.background = '#f6fcf7';
root.style.border = '1px solid #b7e8c3';
root.style.borderRadius = '8px';
root.style.padding = '1em';
document.body.appendChild(root);

// Instantiate the Tweakpane panel
const pane = new Pane({
  container: root,
  title: 'Tweakpane Test',
  expanded: true
});

// Sample parameters object
const params = {
  slider: 0.42,
  toggle: true,
  text: 'Hello world!'
};

// Add controls using addBinding (Tweakpane v4+ universal API)
pane.addBinding(params, 'slider', {
  min: 0,
  max: 1,
  label: 'Slider'
});
pane.addBinding(params, 'toggle', {
  label: 'Toggle'
});
pane.addBinding(params, 'text', {
  label: 'Text'
});

// For diagnostics, attach to window for manual inspection
window._tweakpaneTestParams = params;

/* 
Instructions:
- Add this file to your src/ directory as src/tweakpane-test.js.
- Temporarily set your HTML entry to use this file or set it as your webpack entry.
- Open the page in the browser; you should see a styled Tweakpane panel with three controls.
- If you do NOT see a panel, or get errors, your Tweakpane ESM setup is broken.
*/
