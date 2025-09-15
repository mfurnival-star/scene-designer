/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Logic/Panel (ESM only)
 * - Modular toolbar factory for all shape creation, duplication, deletion, lock, and quick actions.
 * - All shape creation passes Konva shape objects, NOT .attrs, to state.js (addShape).
 * - Ensures all shapes have _type, _label, locked, and event handlers attached.
 * - No window/global code; all imports/exports are ES module only.
 * - Logging via log.js.
 * - Adheres to Engineering Manifesto and file delivery policy.
 * -----------------------------------------------------------
 */

import { AppState, addShape, removeShape, setSelectedShapes } from './state.js';
import { log } from './log.js';
import { makeRectShape, makeCircleShape, makePointShape } from './shapes.js';
import { setSelectedShape, setSelectedShapes as setSelection } from './selection.js';

/**
 * Build the Canvas Toolbar Panel (ESM only, no global DOM mutation)
 * @param {HTMLElement} rootElement
 * @param {Object} container
 */
export function buildCanvasToolbarPanel(rootElement, container) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });

  // Render toolbar panel UI
  rootElement.innerHTML = `
    <div id="canvas-toolbar-panel-container" style="width:100%;height:100%;background:#f7f7fa;display:flex;flex-direction:row;align-items:center;overflow-x:auto;padding:4px 8px;">
      <select id="toolbar-shape-type" style="margin-right:8px;">
        <option value="point">Point</option>
        <option value="rect">Rectangle</option>
        <option value="circle">Circle</option>
      </select>
      <button id="toolbar-add-shape">Add</button>
      <button id="toolbar-delete-shape" style="margin-left:8px;">Delete</button>
      <button id="toolbar-duplicate-shape" style="margin-left:8px;">Duplicate</button>
      <button id="toolbar-lock-shape" style="margin-left:8px;">Lock</button>
      <button id="toolbar-unlock-shape" style="margin-left:4px;">Unlock</button>
      <span style="margin-left:18px;font-size:0.98em;color:#888;">Toolbar (Scene Designer)</span>
    </div>
  `;

  const shapeTypeSelect = rootElement.querySelector('#toolbar-shape-type');
  const addBtn = rootElement.querySelector('#toolbar-add-shape');
  const delBtn = rootElement.querySelector('#toolbar-delete-shape');
  const dupBtn = rootElement.querySelector('#toolbar-duplicate-shape');
  const lockBtn = rootElement.querySelector('#toolbar-lock-shape');
  const unlockBtn = rootElement.querySelector('#toolbar-unlock-shape');

  // --- Add Shape ---
  addBtn.addEventListener('click', () => {
    const type = shapeTypeSelect.value;
    let shape;
    // Use default start position from settings if available, else center
    let x = (AppState.konvaStage ? AppState.konvaStage.width() : 600) / 2;
    let y = (AppState.konvaStage ? AppState.konvaStage.height() : 400) / 2;
    if (AppState.settings && typeof AppState.settings.shapeStartXPercent === 'number') {
      x = (AppState.konvaStage ? AppState.konvaStage.width() : 600) * AppState.settings.shapeStartXPercent / 100;
    }
    if (AppState.settings && typeof AppState.settings.shapeStartYPercent === 'number') {
      y = (AppState.konvaStage ? AppState.konvaStage.height() : 400) * AppState.settings.shapeStartYPercent / 100;
    }
    if (type === "rect") {
      const w = AppState.settings?.defaultRectWidth || 50;
      const h = AppState.settings?.defaultRectHeight || 30;
      shape = makeRectShape(x, y, w, h);
    } else if (type === "circle") {
      const r = AppState.settings?.defaultCircleRadius || 15;
      shape = makeCircleShape(x, y, r);
    } else if (type === "point") {
      shape = makePointShape(x, y);
    }
    if (!shape) {
      log("ERROR", "[toolbar] Failed to create shape", { type, x, y });
      return;
    }
    // Add to AppState and layer (canvas.js will handle adding to Konva layer)
    addShape(shape);
    setSelectedShapes([shape]);
    log("INFO", "[toolbar] Added shape via shapes.js", shape);
  });

  // --- Delete Selected Shape(s) ---
  delBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    const unlocked = AppState.selectedShapes.filter(s => !s.locked);
    unlocked.forEach(s => {
      removeShape(s);
      log("INFO", "[toolbar] Deleted shape", s);
    });
    setSelectedShapes([]);
  });

  // --- Duplicate Selected Shape(s) ---
  dupBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    const offset = 18;
    let newShapes = [];
    AppState.selectedShapes.forEach(orig => {
      let clone;
      const type = orig._type;
      if (type === "rect") {
        clone = makeRectShape(orig.x() + offset, orig.y() + offset, orig.width(), orig.height());
      } else if (type === "circle") {
        clone = makeCircleShape(orig.x() + offset, orig.y() + offset, orig.radius());
      } else if (type === "point") {
        clone = makePointShape(orig.x() + offset, orig.y() + offset);
      }
      if (!clone) return;
      clone._label = orig._label + "-copy";
      clone.locked = orig.locked;
      addShape(clone);
      newShapes.push(clone);
      log("INFO", "[toolbar] Duplicated shape", { original: orig, clone });
    });
    setSelectedShapes(newShapes);
  });

  // --- Lock Selected Shapes ---
  lockBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    AppState.selectedShapes.forEach(s => { s.locked = true; s.draggable(false); });
    setSelectedShapes(AppState.selectedShapes);
    log("INFO", "[toolbar] Locked selected shapes", AppState.selectedShapes);
  });

  // --- Unlock Selected Shapes ---
  unlockBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    AppState.selectedShapes.forEach(s => { s.locked = false; s.draggable(true); });
    setSelectedShapes(AppState.selectedShapes);
    log("INFO", "[toolbar] Unlocked selected shapes", AppState.selectedShapes);
  });

  log("INFO", "[toolbar] CanvasToolbarPanel fully initialized (ES module toolbar)");
  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
}
