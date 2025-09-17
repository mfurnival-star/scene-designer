/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (ESM ONLY)
 * - Factory for all toolbar controls: image upload, server image select, shape type, shape actions.
 * - ES module only, all dependencies imported.
 * - No direct use of window.*, no legacy code.
 * - All logic for image upload and shape creation is routed via state.js and shapes.js.
 * - Logging via log.js at appropriate levels.
 * - MiniLayout compliance: panel factory expects { element, title, componentName } argument.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { makePointShape, makeRectShape, makeCircleShape, setStrokeWidthForSelectedShapes } from './shapes.js';
import { addShape, setImage, AppState, removeShape } from './state.js';
import { setSelectedShapes, selectAllShapes } from './selection.js';

/**
 * Build the canvas toolbar panel.
 * - All UI events are handled here.
 * - Only the toolbar panel creates the controls.
 * - All events are routed via ES module APIs.
 * - MiniLayout compliance: accepts { element, title, componentName }.
 */
export function buildCanvasToolbarPanel({ element, title, componentName }) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    elementType: element?.tagName,
    title,
    componentName
  });

  // Inject toolbar styles (once per document)
  if (typeof document !== "undefined" && !document.getElementById("scene-designer-toolbar-style")) {
    const style = document.createElement("style");
    style.id = "scene-designer-toolbar-style";
    style.textContent = `
      #canvas-toolbar-container {
        width: 100%;
        min-height: 44px;
        background: #f8f8fa;
        border-bottom: 1px solid #bbb;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
      }
      #canvas-toolbar-container .toolbar-btn,
      #canvas-toolbar-container select {
        font-size: 1em;
        font-family: inherit;
        border: 1px solid #888;
        background: #fff;
        color: #222;
        border-radius: 3px;
        padding: 5px 12px;
        margin: 0 2px 2px 0;
        outline: none;
        box-shadow: none;
        transition: background 0.15s;
        cursor: pointer;
        min-width: 48px;
        min-height: 32px;
      }
      #canvas-toolbar-container .toolbar-btn:hover {
        background: #e8eff8;
      }
      #canvas-toolbar-container input[type="file"] {
        display: none;
      }
      #canvas-toolbar-container label[for="toolbar-image-upload"] {
        display: inline-block;
        font-size: 1em;
        border: 1px solid #888;
        background: #fff;
        color: #222;
        border-radius: 3px;
        padding: 6px 16px;
        margin: 0 2px 2px 0;
        cursor: pointer;
        min-width: 48px;
        min-height: 32px;
        outline: none;
        box-shadow: none;
        transition: background 0.15s;
      }
      #canvas-toolbar-container label[for="toolbar-image-upload"]:hover {
        background: #e8eff8;
      }
    `;
    document.head.appendChild(style);
  }

  try {
    log("INFO", "[toolbar] buildCanvasToolbarPanel called", {
      elementType: element?.tagName,
      title,
      componentName
    });

    // Toolbar HTML (image controls + shape controls, standard/classic buttons, responsive)
    element.innerHTML = `
      <div id="canvas-toolbar-container">
        <label for="toolbar-image-upload" title="Upload image">Upload Image</label>
        <input type="file" id="toolbar-image-upload" accept="image/*">
        <select id="toolbar-server-image-select" title="Choose server image">
          <option value="">[Server image]</option>
          <option value="sample1.png">sample1.png</option>
          <option value="sample2.png">sample2.png</option>
        </select>
        <span style="margin-left:8px;">Shape:</span>
        <select id="toolbar-shape-type-select">
          <option value="point">Point</option>
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <button id="toolbar-add-shape-btn" class="toolbar-btn">Add</button>
        <button id="toolbar-delete-shape-btn" class="toolbar-btn">Delete</button>
        <button id="toolbar-duplicate-shape-btn" class="toolbar-btn">Duplicate</button>
        <button id="toolbar-select-all-btn" class="toolbar-btn">Select All</button>
        <button id="toolbar-lock-btn" class="toolbar-btn">Lock</button>
        <button id="toolbar-unlock-btn" class="toolbar-btn">Unlock</button>
      </div>
    `;

    // Query toolbar elements
    const imageUploadInput = element.querySelector('#toolbar-image-upload');
    const imageUploadLabel = element.querySelector('label[for="toolbar-image-upload"]');
    const serverImageSelect = element.querySelector('#toolbar-server-image-select');
    const shapeTypeSelect = element.querySelector('#toolbar-shape-type-select');
    const addShapeBtn = element.querySelector('#toolbar-add-shape-btn');
    const deleteShapeBtn = element.querySelector('#toolbar-delete-shape-btn');
    const duplicateShapeBtn = element.querySelector('#toolbar-duplicate-shape-btn');
    const selectAllBtn = element.querySelector('#toolbar-select-all-btn');
    const lockBtn = element.querySelector('#toolbar-lock-btn');
    const unlockBtn = element.querySelector('#toolbar-unlock-btn');

    // --- IMAGE UPLOAD ---
    imageUploadLabel.addEventListener('click', (e) => {
      imageUploadInput.value = ""; // Clear previous file, so no filename shows
      imageUploadInput.click();
    });
    imageUploadInput.addEventListener('change', function (e) {
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
      // Remove filename from label (cannot show filename in label)
    });

    // --- SERVER IMAGE SELECT ---
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
      if (imageUploadInput) imageUploadInput.value = "";
    });

    // --- ADD SHAPE BUTTON ---
    addShapeBtn.addEventListener('click', () => {
      const type = shapeTypeSelect.value;
      let shape = null;
      const w = AppState.settings?.defaultRectWidth || 50;
      const h = AppState.settings?.defaultRectHeight || 30;
      const r = AppState.settings?.defaultCircleRadius || 15;
      const x = (AppState.settings?.canvasMaxWidth || 600) * ((AppState.settings?.shapeStartXPercent ?? 50) / 100);
      const y = (AppState.settings?.canvasMaxHeight || 400) * ((AppState.settings?.shapeStartYPercent ?? 50) / 100);
      if (type === "rect") {
        shape = makeRectShape(x - w / 2, y - h / 2, w, h);
      } else if (type === "circle") {
        shape = makeCircleShape(x, y, r);
      } else if (type === "point") {
        shape = makePointShape(x, y);
      }
      if (shape) {
        addShape(shape);
        setSelectedShapes([shape]);
        setStrokeWidthForSelectedShapes(1);
        log("INFO", `[toolbar] Added ${type} shape via shapes.js`, shape);
      }
    });

    // --- DELETE SHAPE BUTTON ---
    deleteShapeBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Delete button clicked");
      // Defensive: resolve selected shapes from AppState.shapes (in case references changed)
      const allShapes = AppState.shapes || [];
      const selected = (AppState.selectedShapes || []).map(s => allShapes.find(sh => sh === s)).filter(s => s && !s.locked);
      if (!selected.length) {
        log("INFO", "[toolbar] Delete button: No unlocked shapes selected");
        return;
      }
      selected.forEach(shape => {
        removeShape(shape);
        if (AppState.fabricCanvas) {
          AppState.fabricCanvas.remove(shape);
        }
      });
      setSelectedShapes([]);
      log("INFO", "[toolbar] Deleted selected unlocked shapes", { count: selected.length });
    });

    // --- DUPLICATE SHAPE BUTTON ---
    duplicateShapeBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Duplicate button clicked (handled externally)");
      // Duplication logic handled elsewhere (sidebar/canvas)
    });

    // --- SELECT ALL BUTTON ---
    selectAllBtn.addEventListener('click', () => {
      selectAllShapes();
      log("INFO", "[toolbar] Select All button clicked");
    });

    // --- LOCK/UNLOCK BUTTONS ---
    lockBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Lock button clicked (handled externally)");
      // Lock logic handled elsewhere (sidebar/canvas)
    });
    unlockBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Unlock button clicked (handled externally)");
      // Unlock logic handled elsewhere (sidebar/canvas)
    });

    log("INFO", "[toolbar] Toolbar panel fully initialized (image + shape controls, ESM only)");

  } catch (e) {
    log("ERROR", "[toolbar] buildCanvasToolbarPanel ERROR", e);
    alert("ToolbarPanel ERROR: " + e.message);
    throw e;
  }

  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    elementType: element?.tagName,
    title,
    componentName
  });
}
