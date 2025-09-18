/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (ESM ONLY, Manifesto-compliant, Actions Decoupled)
 * - Factory for all toolbar controls: image upload, server image select, shape type, shape actions.
 * - ES module only, all dependencies imported.
 * - No direct use of window.*, no legacy code.
 * - All shape/scene actions are emitted as intents to actions.js.
 * - NO business logic, selection, or state mutation.
 * - Logging via log.js at appropriate levels.
 * - MiniLayout compliance: panel factory expects { element, title, componentName } argument.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState, setImage } from './state.js';
import { selectAllShapes } from './selection.js';
import {
  addShapeOfType,
  deleteSelectedShapes,
  duplicateSelectedShapes,
  lockSelectedShapes,
  unlockSelectedShapes
} from './actions.js';

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
      // Emit intent to actions.js: centralized add/select/strokeWidth logic
      addShapeOfType(type);
      log("INFO", `[toolbar] Add shape intent emitted`, { type });
    });

    // --- DELETE SHAPE BUTTON ---
    deleteShapeBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Delete button clicked");
      // Emit intent to actions.js
      deleteSelectedShapes();
    });

    // --- DUPLICATE SHAPE BUTTON ---
    duplicateShapeBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Duplicate button clicked");
      // Emit intent to actions.js
      duplicateSelectedShapes();
    });

    // --- SELECT ALL BUTTON ---
    selectAllBtn.addEventListener('click', () => {
      selectAllShapes();
      log("INFO", "[toolbar] Select All button clicked");
    });

    // --- LOCK/UNLOCK BUTTONS ---
    lockBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Lock button clicked");
      // Emit intent to actions.js
      lockSelectedShapes();
    });
    unlockBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Unlock button clicked");
      // Emit intent to actions.js
      unlockSelectedShapes();
    });

    log("INFO", "[toolbar] Toolbar panel fully initialized (image + shape controls, ESM only, actions decoupled)");

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

