/**
 * tweakpane-demo.js
 * -------------------------------------------
 * Minimal Tweakpane ESM usage for Scene Designer
 * - No CSS import required (styles are injected automatically)
 * - Demonstrates addInput usage
 * -------------------------------------------
 */

import { Pane } from 'tweakpane';

const obj = {
  foo: true,
  bar: 42,
  baz: 'a'
};

const root = document.createElement('div');
root.style.margin = "2em";
document.body.appendChild(root);

const pane = new Pane({
  container: root,
  title: 'Tweakpane Demo',
  expanded: true
});

pane.addInput(obj, 'foo', { label: 'A Boolean' });
pane.addInput(obj, 'bar', { label: 'A Number', min: 0, max: 100 });
pane.addInput(obj, 'baz', { label: 'A Select', options: { a: 'Option A', b: 'Option B' } });

// For debugging in browser:
window._tweakpaneDemoObj = obj;
