/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (ESM ONLY)
 * - Factory for toolbar buttons, selects, swatches, text inputs.
 * - ES module only, all dependencies imported.
 * - No direct use of window.*, no legacy code.
 * - No shape creation logic here: shape creation is handled by shapes.js, and shape addition to state by state.js.
 * - No direct Konva layer manipulation here—only call state APIs.
 * - Logging via log.js at appropriate levels.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { makePointShape, makeRectShape, makeCircleShape } from './shapes.js';
import { addShape } from './state.js';
import { AppState } from './state.js';

/**
 * Build the canvas toolbar panel.
 * - All UI events are handled here.
 * - No direct layer manipulation (all shapes added via addShape()).
 */
export function buildCanvasToolbarPanel(rootElement, container) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });

  try {
    log("INFO", "[toolbar] buildCanvasToolbarPanel called", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      componentName: container?.componentName
    });

    // Toolbar HTML (ESM only, no window/global, no legacy IDs)
    rootElement.innerHTML = `
      <div id="canvas-toolbar-container" style="width:100%;height:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8f8fa;">
        <select id="shape-type-select" style="min-width:80px;">
          <option value="point">Point</option>
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <button id="add-shape-btn">Add</button>
        <button id="delete-shape-btn">Delete</button>
        <button id="duplicate-shape-btn">Duplicate</button>
        <button id="select-all-btn">Select All</button>
        <button id="lock-btn">Lock</button>
        <button id="unlock-btn">Unlock</button>
      </div>
    `;

    // Query toolbar elements
    const shapeTypeSelect = rootElement.querySelector('#shape-type-select');
    const addShapeBtn = rootElement.querySelector('#add-shape-btn');
    const deleteShapeBtn = rootElement.querySelector('#delete-shape-btn');
    const duplicateShapeBtn = rootElement.querySelector('#duplicate-shape-btn');
    const selectAllBtn = rootElement.querySelector('#select-all-btn');
    const lockBtn = rootElement.querySelector('#lock-btn');
    const unlockBtn = rootElement.querySelector('#unlock-btn');

    // -- ADD SHAPE BUTTON --
    addShapeBtn.addEventListener('click', () => {
      const type = shapeTypeSelect.value;
      let shape = null;
      if (type === "rect") {
        // Use default settings for size
        const x = AppState.konvaStage?.width() / 2 || 300;
        const y = AppState.konvaStage?.height() / 2 || 200;
        const w = AppState.settings?.defaultRectWidth || 50;
        const h = AppState.settings?.defaultRectHeight || 30;
        shape = makeRectShape(x - w / 2, y - h / 2, w, h);
      } else if (type === "circle") {
        const x = AppState.konvaStage?.width() / 2 || 300;
        const y = AppState.konvaStage?.height() / 2 || 200;
        const r = AppState.settings?.defaultCircleRadius || 15;
        shape = makeCircleShape(x, y, r);
      } else if (type === "point") {
        const x = AppState.konvaStage?.width() / 2 || 300;
        const y = AppState.konvaStage?.height() / 2 || 200;
        shape = makePointShape(x, y);
      }
      if (shape) {
        addShape(shape); // Only add shape via state API; do not touch Konva layer here
        log("INFO", `[toolbar] Added ${type} shape via shapes.js`, shape);
      }
    });

    // -- DELETE SHAPE BUTTON --
    deleteShapeBtn.addEventListener('click', () => {
      // Deletion logic handled elsewhere (not in toolbar)
      log("INFO", "[toolbar] Delete button clicked (handled in sidebar/canvas)");
    });

    // -- DUPLICATE SHAPE BUTTON --
    duplicateShapeBtn.addEventListener('click', () => {
      // Duplication logic handled elsewhere (not in toolbar)
      log("INFO", "[toolbar] Duplicate button clicked (handled in sidebar/canvas)");
    });

    // -- SELECT ALL BUTTON --
    selectAllBtn.addEventListener('click', () => {
      // Selection logic handled elsewhere
      log("INFO", "[toolbar] Select All button clicked (handled in selection.js)");
    });

    // -- LOCK/UNLOCK BUTTONS --
    lockBtn.addEventListener('click', () => {
      // Lock logic handled elsewhere
      log("INFO", "[toolbar] Lock button clicked (handled in selection/canvas)");
    });
    unlockBtn.addEventListener('click', () => {
      // Unlock logic handled elsewhere
      log("INFO", "[toolbar] Unlock button clicked (handled in selection/canvas)");
    });

    log("INFO", "[toolbar] Toolbar panel fully initialized (ESM only)");
  } catch (e) {
    log("ERROR", "[toolbar] buildCanvasToolbarPanel ERROR", e);
    alert("ToolbarPanel ERROR: " + e.message);
    log("TRACE", "[toolbar] buildCanvasToolbarPanel exit (error)");
    throw e;
  }

  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
}

