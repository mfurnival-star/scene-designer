/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (Simplified Edition, Actions Decoupled)
 * - Factory for toolbar controls: image upload, server image select, shape type, add/delete.
 * - Only working buttons are visible; others hidden for now.
 * - Double toolbar height for dev/test ergonomics.
 * - ES module only, all dependencies imported.
 * - All shape/scene actions are emitted as intents to actions.js.
 * - NO business logic, selection, or state mutation.
 * - Logging via log.js at appropriate levels.
 * - MiniLayout compliance: panel factory expects { element, title, componentName } argument.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState, setImage } from './state.js';
import {
  addShapeOfType,
  deleteSelectedShapes
} from './actions.js';

/**
 * Build the canvas toolbar panel.
 * - All UI events are handled here.
 * - Only the toolbar panel creates the controls.
 * - Only working buttons shown; others hidden for now.
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
        min-height: 88px; /* DOUBLE height for dev/test */
        background: #f8f8fa;
        border-bottom: 1px solid #bbb;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px;
        padding: 16px 18px;
      }
      #canvas-toolbar-container .toolbar-btn,
      #canvas-toolbar-container select {
        font-size: 1.14em;
        font-family: inherit;
        border: 1px solid #888;
        background: #fff;
        color: #222;
        border-radius: 4px;
        padding: 9px 16px;
        margin: 4px 3px 3px 0;
        outline: none;
        box-shadow: none;
        transition: background 0.15s;
        cursor: pointer;
        min-width: 54px;
        min-height: 44px;
      }
      #canvas-toolbar-container .toolbar-btn:hover {
        background: #e8eff8;
      }
      #canvas-toolbar-container input[type="file"] {
        display: none;
      }
      #canvas-toolbar-container label[for="toolbar-image-upload"] {
        display: inline-block;
        font-size: 1.13em;
        border: 1px solid #888;
        background: #fff;
        color: #222;
        border-radius: 4px;
        padding: 10px 18px;
        margin: 4px 2px 2px 0;
        cursor: pointer;
        min-width: 54px;
        min-height: 44px;
        outline: none;
        box-shadow: none;
        transition: background 0.15s;
      }
      #canvas-toolbar-container label[for="toolbar-image-upload"]:hover {
        background: #e8eff8;
      }
      /* Hide unused buttons for now */
      #canvas-toolbar-container .toolbar-btn.hidden,
      #canvas-toolbar-container .toolbar-btn[aria-hidden="true"] {
        display: none !important;
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

    // Toolbar HTML (only show working controls)
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
        <!-- Hidden buttons, will be unhidden when implemented -->
        <button id="toolbar-duplicate-shape-btn" class="toolbar-btn hidden" aria-hidden="true">Duplicate</button>
        <button id="toolbar-select-all-btn" class="toolbar-btn hidden" aria-hidden="true">Select All</button>
        <button id="toolbar-lock-btn" class="toolbar-btn hidden" aria-hidden="true">Lock</button>
        <button id="toolbar-unlock-btn" class="toolbar-btn hidden" aria-hidden="true">Unlock</button>
      </div>
    `;

    // Query toolbar elements
    const imageUploadInput = element.querySelector('#toolbar-image-upload');
    const imageUploadLabel = element.querySelector('label[for="toolbar-image-upload"]');
    const serverImageSelect = element.querySelector('#toolbar-server-image-select');
    const shapeTypeSelect = element.querySelector('#toolbar-shape-type-select');
    const addShapeBtn = element.querySelector('#toolbar-add-shape-btn');
    const deleteShapeBtn = element.querySelector('#toolbar-delete-shape-btn');
    // Other buttons are present but hidden; will be registered later

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
      addShapeOfType(type);
      log("INFO", `[toolbar] Add shape intent emitted`, { type });
    });

    // --- DELETE SHAPE BUTTON ---
    deleteShapeBtn.addEventListener('click', () => {
      log("INFO", "[toolbar] Delete button clicked");
      deleteSelectedShapes();
    });

    log("INFO", "[toolbar] Toolbar panel fully initialized (simplified, only working controls, ESM only)");

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
