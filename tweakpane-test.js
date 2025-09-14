import { Pane } from 'tweakpane';

const obj = { testBoolean: true, testNumber: 42, testSelect: 'a' };
const pane = new Pane({ title: 'Tweakpane Test', expanded: true });
pane.addInput(obj, 'testBoolean', { label: 'A Boolean' });
pane.addInput(obj, 'testNumber', { label: 'A Number', min: 0, max: 100 });
pane.addInput(obj, 'testSelect', { label: 'A Select', options: { a: 'Option A', b: 'Option B' } });

window._tweakpaneTestObj = obj;
