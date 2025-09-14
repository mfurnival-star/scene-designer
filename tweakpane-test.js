import { Pane } from 'tweakpane';

const params = {
  speed: 5,
  enabled: true,
  color: '#ff0000',
};

const pane = new Pane();
pane.addInput(params, 'speed', { min: 0, max: 10 });
pane.addInput(params, 'enabled');
pane.addInput(params, 'color');

