// Import the Pane class from tweakpane package
import { Pane } from 'tweakpane';

window.addEventListener('DOMContentLoaded', () => {
  // Create a new Tweakpane instance
  const pane = new Pane();

  // Example data object to control
  const params = {
    speed: 5,
    enabled: true,
    color: '#ff0000'
  };

  // Add inputs to the pane for each parameter
  pane.addInput(params, 'speed', { min: 0, max: 10 });
  pane.addInput(params, 'enabled');
  pane.addInput(params, 'color');
});

