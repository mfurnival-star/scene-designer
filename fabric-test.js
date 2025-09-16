// Import only what you need from the ESM build
import { Canvas, Rect } from 'https://cdn.jsdelivr.net/npm/fabric@6.4.3/dist/fabric.esm.js';

const canvas = new Canvas('c');

const rect = new Rect({
  left: 50,
  top: 50,
  width: 150,
  height: 100,
  fill: 'orange',
});

canvas.add(rect);
canvas.renderAll();
