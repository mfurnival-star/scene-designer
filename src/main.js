// main.js – Entry point for Scene Designer ES module app
// -----------------------------------------------------
// Wires up ES module foundation: log.js, state.js, canvas.js, selection.js.
// Initializes the UI and canvas, and connects sidebar/toolbar event handlers as needed.
// No global state leakage; everything through imports and AppState.
// -----------------------------------------------------

import { log } from './log.js';
import { AppState, subscribe, setShapes, setSelectedShapes } from './state.js';
import { initCanvas, makePointShape, makeRectShape, makeCircleShape, addShape, removeShape } from './canvas.js';
import { setSelectedShape, selectAllShapes, deselectAll } from './selection.js';

// --- Minimal DOM references ---
const container = document.getElementById('container');
const sidebar = document.getElementById('sidebar');
const errorBox = document.getElementById('errorBox');
const serverImageSelect = document.getElementById('serverImageSelect');
const imageUpload = document.getElementById('imageUpload');

// --- Initialize App on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', async () => {
  log('INFO', '[main] DOM loaded, initializing app');

  // 1. Initialize the canvas
  await initCanvas(container);

  // 2. Wire up image loader UI
  if (serverImageSelect) {
    serverImageSelect.addEventListener('change', async (e) => {
      const imgName = serverImageSelect.value;
      if (!imgName) return;
      const url = 'images/' + imgName;
      AppState.imageURL = url;
      await initCanvas(container);
    });
  }
  if (imageUpload) {
    imageUpload.addEventListener('change', async (e) => {
      const file = imageUpload.files && imageUpload.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      AppState.imageURL = url;
      await initCanvas(container);
    });
  }

  // 3. Toolbar event wiring (minimal)
  document.getElementById('newBtn')?.addEventListener('click', () => {
    const shapeType = document.getElementById('shapeType')?.value || 'point';
    let shape = null;
    if (shapeType === 'point') shape = makePointShape(80, 80);
    else if (shapeType === 'rect') shape = makeRectShape(60, 60, 80, 48);
    else if (shapeType === 'circle') shape = makeCircleShape(100, 100, 32);
    if (shape) {
      addShape(shape);
      setSelectedShapes([shape]);
    }
  });
  document.getElementById('deleteBtn')?.addEventListener('click', () => {
    const sel = AppState.selectedShapes.slice();
    sel.forEach(removeShape);
    setSelectedShapes([]);
  });
  document.getElementById('selectAllBtn')?.addEventListener('click', selectAllShapes);

  // 4. Minimal sidebar table rendering
  function renderSidebar() {
    if (!sidebar) return;
    sidebar.innerHTML = '<h3>Shapes</h3>';
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '0';
    ul.style.listStyle = 'none';
    for (const shape of AppState.shapes) {
      const li = document.createElement('li');
      li.textContent = `[${shape._type}] ${shape._label || ''} (${Math.round(shape.x())},${Math.round(shape.y())})`;
      li.style.cursor = 'pointer';
      if (AppState.selectedShapes.includes(shape)) {
        li.style.background = '#e9f1ff';
        li.style.fontWeight = 'bold';
      }
      li.onclick = () => setSelectedShape(shape);
      ul.appendChild(li);
    }
    sidebar.appendChild(ul);
  }

  // 5. Subscribe to state changes for live UI updates
  subscribe(() => {
    renderSidebar();
    // Update errorBox if needed (e.g., validation)
  });

  // 6. Initial sidebar render
  renderSidebar();

  log('INFO', '[main] App initialized');
});
