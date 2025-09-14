import { Pane } from 'tweakpane';

const obj = { foo: true, bar: 42 };
const container = document.createElement('div');
document.body.appendChild(container);

const pane = new Pane({ container });
pane.addInput(obj, 'foo', { label: 'Foo' });
pane.addInput(obj, 'bar', { label: 'Bar' });
