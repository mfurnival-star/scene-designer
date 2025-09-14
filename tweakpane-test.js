import { Pane } from 'tweakpane';

window.addEventListener('DOMContentLoaded', () => {
  const pane = new Pane();

  const params = {
    speed: 5,
    enabled: true,
    color: '#ff0000'
  };

  pane.addInput(params, 'speed', { min: 0, max: 10 });
  pane.addInput(params, 'enabled');
  pane.addInput(params, 'color');
});

