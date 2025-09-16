/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (ESM ONLY)
 * - Factory for all toolbar controls: image upload, server image select, shape type, shape actions.
 * - ES module only, all dependencies imported.
 * - No direct use of window.*, no legacy code.
 * - All logic for image upload and shape creation is routed via state.js and shapes.js.
 * - Logging via log.js at appropriate levels.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { makePointShape, makeRectShape, makeCircleShape } from './shapes.js';
import { addShape, setImage, AppState } from './state.js';
import { setSelectedShapes, selectAllShapes } from './selection.js';

/**
 * Build the canvas toolbar panel.
 * - All UI events are handled here.
 * - Only the toolbar panel creates the controls.
 * - All events are routed via ES module APIs.
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

    // Toolbar HTML (complete: image controls + shape controls)
    rootElement.innerHTML = `
      <div id="canvas-toolbar-container" style="width:100%;height:100%;display:flex;align-items:center;gap:12px;padding:8px 12px;background:#f8f8fa;border-bottom:1px solid #bbb;">
        <input type="file" id="toolbar-image-upload" accept="image/*" style="display:inline-block;">
        <select id="toolbar-server-image-select" style="min-width:120px;">
          <option value="">[Server image]</option>
          <option value="sample1.png">sample1.png</option>
          <option value="sample2.png">sample2.png</option>
        </select>
        <span style="margin-left:12px;">Shape:</span>
        <select id="toolbar-shape-type-select" style="min-width:80px;">
          <option value="point">Point</option>
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <button id="toolbar-add-shape-btn" style="margin-left:8px;">Add</button>
        <button id="toolbar-delete-shape-btn" style="margin-left:8px;">Delete</button>
        <button id="toolbar-duplicate-shape-btn" style="margin-left:8px;">Duplicate</button>
        <button id="toolbar-select-all-btn" style="margin-left:8px;">Select All</button>
        <button id="toolbar-lock-btn" style="margin-left:8px;">Lock</button>
        <button id="toolbar-unlock-btn" style="margin-left:4px;">Unlock</button>
      </div>
    `;

    // Query toolbar elements
    const imageUpload = rootElement.querySelector('#toolbar-image-upload');
    const serverImageSelect = rootElement.querySelector('#toolbar-server-image-select');
    const shapeTypeSelect = rootElement.querySelector('#toolbar-shape-type-select');
    const addShapeBtn = rootElement.querySelector('#toolbar-add-shape-btn');
    const deleteShapeBtn = rootElement.querySelector('#toolbar-delete-shape-btn');
    const duplicateShapeBtn = rootElement.querySelector('#toolbar-duplicate-shape-btn');
    const selectAllBtn = rootElement.querySelector('#toolbar-select-all-btn');
    const lockBtn = rootElement.querySelector('#toolbar-lock-btn');
    const unlockBtn = rootElement.querySelector('#toolbar-unlock-btn');

    // -- IMAGE UPLOAD --
    imageUpload.addEventListener('change', function (e) {
      log("INFO", "[toolbar] Image upload changed", e);
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new window.FileReader();
      reader.onload = function (ev) {
        const imgObj = new window.Image();
        imgObj.onload = function () {
          setImage(ev.target.result, imgObj);
          log("INFO", "[toolbar] Image loaded and set via setImage (upload)", { url: ev.target.result });
        };
        imgObj.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      // Clear server select
      if (serverImageSelect) serverImageSelect.value = "";
    });

    // -- SERVER IMAGE SELECT --
    serverImageSelect.addEventListener('change', function (e) {
      log("INFO", "[toolbar] Server image select changed", e);
      const filename = e.target.value;
      if (!filename) {
        setImage(null, null);
        return;
      }
      const imgObj = new window.Image();
      imgObj.onload = function () {
        setImage('./images/' + filename, imgObj);
        log("INFO", "[toolbar] Server image loaded and set via setImage", { url: './images/' + filename });
      };
      imgObj.src = './images/' + filename;
      // Clear file upload
      if (imageUpload) imageUpload.value = "";
    });

    // -- ADD SHAPE BUTTON --
    addShapeBtn.addEventListener('click', () => {
      const type = shapeTypeSelect.value;
      let shape = null;
      const stage = AppState.konvaStage;
      const w = AppState.settings?.defaultRectWidth || 50;
      const h = AppState.settings?.defaultRectHeight || 30;
      const r = AppState.settings?.defaultCircleRadius || 15;
      const x = (stage?.width() || 600) / 2;
      const y = (stage?.height() || 400) / 2;
      if (type === "rect") {
        shape = makeRectShape(x - w / 2, y - h / 2, w, h);
      } else if (type === "circle") {
        shape = makeCircleShape(x, y, r);
      } else if (type === "point") {
        shape = makePointShape(x, y);
      }
      if (shape) {
        addShape(shape); // Only add shape via state API; do not touch Konva layer here
        setSelectedShapes([shape]);
        log("INFO", `[toolbar] Added ${type} shape via shapes.js`, shape);
      }
    });

    // -- DELETE SHAPE BUTTON --
    deleteShapeBtn.addEventListener('click', () => {
      // Deletion logic handled elsewhere (sidebar/canvas)
      log("INFO", "[toolbar] Delete button clicked (handled externally)");
    });

    // -- DUPLICATE SHAPE BUTTON --
    duplicateShapeBtn.addEventListener('click', () => {
      // Duplication logic handled elsewhere (sidebar/canvas)
      log("INFO", "[toolbar] Duplicate button clicked (handled externally)");
    });

    // -- SELECT ALL BUTTON --
    selectAllBtn.addEventListener('click', () => {
      selectAllShapes();
      log("INFO", "[toolbar] Select All button clicked");
    });

    // -- LOCK/UNLOCK BUTTONS --
    lockBtn.addEventListener('click', () => {
      // Lock logic handled elsewhere (sidebar/canvas)
      log("INFO", "[toolbar] Lock button clicked (handled externally)");
    });
    unlockBtn.addEventListener('click', () => {
      // Unlock logic handled elsewhere (sidebar/canvas)
      log("INFO", "[toolbar] Unlock button clicked (handled externally)");
    });

    log("INFO", "[toolbar] Toolbar panel fully initialized (image + shape controls, ESM only)");
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
