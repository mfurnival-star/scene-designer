/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (Enhanced Styling Edition)
 * - Factory for toolbar controls: image upload, server image select, shape type, add/delete.
 * - All controls are visually grouped, evenly sized, and aligned.
 * - Improved color, spacing, rounded corners, subtle shadow, and hover effects.
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
 * - Enhanced styling: grouped controls, uniform height, subtle shadow, hover, alignment.
 * - MiniLayout compliance: accepts { element, title, componentName }.
 */
export function buildCanvasToolbarPanel({ element, title, componentName }) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    elementType: element?.tagName,
    title,
    componentName
  });

  // Inject improved toolbar styles (once per document)
  if (typeof document !== "undefined" && !document.getElementById("scene-designer-toolbar-style")) {
    const style = document.createElement("style");
    style.id = "scene-designer-toolbar-style";
    style.textContent = `
      #canvas-toolbar-container {
        width: 100%;
        min-height: 62px;
        background: linear-gradient(90deg, #f4f8ff 0%, #e6eaf9 100%);
        border-bottom: 1.5px solid #b8c6e6;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 18px 24px 14px 24px;
        box-shadow: 0 1.5px 6px -2px #b8c6e6;
        border-radius: 0 0 13px 13px;
      }
      #canvas-toolbar-container > * {
        margin: 0 3px;
      }
      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 9px;
        border-radius: 8px;
        background: #f8fbff;
        padding: 7px 12px;
        box-shadow: 0 1px 5px -4px #2176ff;
        margin-right: 12px;
      }
      .toolbar-label {
        font-size: 1.10em;
        color: #345;
        font-weight: 600;
        margin-right: 10px;
        margin-left: 10px;
      }
      .toolbar-btn,
      #canvas-toolbar-container select,
      label[for="toolbar-image-upload"] {
        font-size: 1.16em;
        font-family: inherit;
        border: 1.5px solid #8ca6c6;
        background: #fff;
        color: #234;
        border-radius: 7px;
        padding: 11px 24px;
        min-width: 94px;
        min-height: 45px;
        height: 45px;
        outline: none;
        box-shadow: 0 1.5px 3px -1px #e3f0fa;
        transition: background 0.15s, box-shadow 0.14s, border-color 0.12s;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .toolbar-btn:hover,
      label[for="toolbar-image-upload"]:hover,
      #canvas-toolbar-container select:hover {
        background: #eaf2fc;
        border-color: #2176ff;
        box-shadow: 0 2px 7px -2px #b8c6e6;
      }
      input[type="file"] {
        display: none;
      }
      /* Hide unused buttons for now */
      .toolbar-btn.hidden,
      .toolbar-btn[aria-hidden="true"] {
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

    // Enhanced toolbar HTML with visual grouping
    element.innerHTML = `
      <div id="canvas-toolbar-container">
        <div class="toolbar-group">
          <label for="toolbar-image-upload" class="toolbar-btn" title="Upload image">Upload Image</label>
          <input type="file" id="toolbar-image-upload" accept="image/*">
          <select id="toolbar-server-image-select" class="toolbar-btn" title="Choose server image">
            <option value="">[Server image]</option>
            <option value="sample1.png">sample1.png</option>
            <option value="sample2.png">sample2.png</option>
          </select>
        </div>
        <div class="toolbar-group">
          <span class="toolbar-label">Shape:</span>
          <select id="toolbar-shape-type-select" class="toolbar-btn">
            <option value="point">Point</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <button id="toolbar-add-shape-btn" class="toolbar-btn" title="Add shape">&#x2795; Add</button>
          <button id="toolbar-delete-shape-btn" class="toolbar-btn" title="Delete shape">&#x1F5D1; Delete</button>
          <!-- Hidden buttons, will be unhidden when implemented -->
          <button id="toolbar-duplicate-shape-btn" class="toolbar-btn hidden" aria-hidden="true">Duplicate</button>
          <button id="toolbar-select-all-btn" class="toolbar-btn hidden" aria-hidden="true">Select All</button>
          <button id="toolbar-lock-btn" class="toolbar-btn hidden" aria-hidden="true">Lock</button>
          <button id="toolbar-unlock-btn" class="toolbar-btn hidden" aria-hidden="true">Unlock</button>
        </div>
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

    log("INFO", "[toolbar] Toolbar panel fully initialized (enhanced, grouped, ESM only)");

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
