import { Canvas, Rect } from 'fabric';

const div = document.createElement('div');
div.id = 'fabric-test-canvas';
div.style.width = '400px';
div.style.height = '300px';
document.body.appendChild(div);

const canvas = new Canvas(div, { width: 400, height: 300, backgroundColor: '#f7f9fc' });

const rect = new Rect({
  left: 50,
  top: 70,
  width: 120,
  height: 80,
  fill: 'red',
  stroke: 'black',
  strokeWidth: 2,
  selectable: true,
  evented: true
});
canvas.add(rect);
canvas.renderAll();
