/**
 * toolbar-dom.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar DOM Renderer (ESM ONLY)
 * Purpose:
 * - Render the toolbar HTML markup into the provided element.
 * - Query and return strongly-typed references to all interactive DOM nodes.
 * - No business logic, no event wiring here (handlers live in toolbar-handlers.js).
 * - Styles are injected by toolbar-styles.js.
 *
 * Public Exports:
 * - renderToolbar(element) -> refs
 *
 * Returned refs:
 * - container
 * - imageUploadInput
 * - imageUploadLabel
 * - serverImageSelect
 * - shapeTypeSelect
 * - addShapeBtn
 * - deleteBtn
 * - duplicateBtn
 * - resetRotationBtn
 * - selectAllBtn
 * - lockBtn
 * - unlockBtn
 * - strokeColorInput
 * - fillColorInput
 * - fillAlphaSlider
 *
 * Dependencies:
 * - log.js (logging)
 * -----------------------------------------------------------
 */

import { log } from './log.js';

/**
 * Render the toolbar into the given root element and return DOM refs.
 * @param {HTMLElement} element - Panel body element provided by MiniLayout
 * @returns {object} refs - See header comment for fields
 */
export function renderToolbar(element) {
  log("TRACE", "[toolbar-dom] renderToolbar ENTRY", {
    elementType: element?.tagName
  });

  if (!element || !(element instanceof HTMLElement)) {
    const msg = "[toolbar-dom] renderToolbar: invalid element";
    log("ERROR", msg, { element });
    throw new Error(msg);
  }

  // Render markup (single row, grouped)
  element.innerHTML = `
    <div id="canvas-toolbar-container">
      <div class="toolbar-group">
        <label for="toolbar-image-upload" class="toolbar-btn" title="Upload image">Upload Image</label>
        <input type="file" id="toolbar-image-upload" accept="image/*">
        <select id="toolbar-server-image-select" title="Choose server image">
          <option value="">[Server image]</option>
          <option value="sample1.png">sample1.png</option>
          <option value="sample2.png">sample2.png</option>
        </select>
      </div>

      <div class="toolbar-group">
        <span class="toolbar-label">Shape:</span>
        <select id="toolbar-shape-type-select" title="Select a shape type">
          <option value="point">Point</option>
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
        <button id="toolbar-add-shape-btn" class="toolbar-btn" title="Add shape">
          <span style="font-size:1em;margin-right:3px;">&#x2795;</span> Add
        </button>
        <button id="toolbar-delete-shape-btn" class="toolbar-btn" title="Delete selected shape(s)">
          <span style="font-size:1em;margin-right:3px;">&#x1F5D1;</span> Delete
        </button>
        <button id="toolbar-duplicate-shape-btn" class="toolbar-btn" title="Duplicate selected shape(s)">Duplicate</button>
        <button id="toolbar-reset-rotation-btn" class="toolbar-btn" title="Reset rotation to 0°">Reset Rotation</button>
        <button id="toolbar-select-all-btn" class="toolbar-btn" title="Select all shapes">Select All</button>
        <button id="toolbar-lock-btn" class="toolbar-btn" title="Lock selected shape(s)">Lock</button>
        <button id="toolbar-unlock-btn" class="toolbar-btn" title="Unlock selected shape(s)">Unlock</button>
      </div>

      <div class="toolbar-group" id="toolbar-color-group">
        <span class="toolbar-label">Color:</span>
        <label class="toolbar-label" for="toolbar-stroke-color-input" title="Stroke color">Stroke</label>
        <input type="color" id="toolbar-stroke-color-input" title="Stroke color (#RRGGBB)">

        <label class="toolbar-label" for="toolbar-fill-color-input" title="Fill color">Fill</label>
        <input type="color" id="toolbar-fill-color-input" title="Fill color (#RRGGBB)">
        <input
          type="range"
          id="toolbar-fill-alpha-input"
          min="0"
          max="100"
          step="1"
          value="0"
          title="Fill Alpha (0–100%)"
          style="width:120px;"
        >
        <span id="toolbar-fill-alpha-value" aria-hidden="true" style="min-width:2.5em;text-align:right;">0%</span>
      </div>
    </div>
  ";

  // Query refs scoped to the provided element
  const container = element.querySelector('#canvas-toolbar-container');

  const imageUploadInput = element.querySelector('#toolbar-image-upload');
  const imageUploadLabel = element.querySelector('label[for="toolbar-image-upload"]');

  const serverImageSelect = element.querySelector('#toolbar-server-image-select');
  const shapeTypeSelect = element.querySelector('#toolbar-shape-type-select');

  const addShapeBtn = element.querySelector('#toolbar-add-shape-btn');
  const deleteBtn = element.querySelector('#toolbar-delete-shape-btn');
  const duplicateBtn = element.querySelector('#toolbar-duplicate-shape-btn');
  const resetRotationBtn = element.querySelector('#toolbar-reset-rotation-btn');
  const selectAllBtn = element.querySelector('#toolbar-select-all-btn');
  const lockBtn = element.querySelector('#toolbar-lock-btn');
  const unlockBtn = element.querySelector('#toolbar-unlock-btn');

  // New color controls
  const strokeColorInput = element.querySelector('#toolbar-stroke-color-input');
  const fillColorInput = element.querySelector('#toolbar-fill-color-input');
  const fillAlphaSlider = element.querySelector('#toolbar-fill-alpha-input');
  const fillAlphaValue = element.querySelector('#toolbar-fill-alpha-value');

  // Initialize simple alpha value readout (no state coupling here)
  if (fillAlphaSlider && fillAlphaValue) {
    fillAlphaValue.textContent = `${fillAlphaSlider.value}%`;
    // Lightweight UI update; event wiring to business logic happens in toolbar-handlers.js
    fillAlphaSlider.addEventListener('input', () => {
      fillAlphaValue.textContent = `${fillAlphaSlider.value}%`;
    });
  }

  const refs = {
    container,
    imageUploadInput,
    imageUploadLabel,
    serverImageSelect,
    shapeTypeSelect,
    addShapeBtn,
    deleteBtn,
    duplicateBtn,
    resetRotationBtn,
    selectAllBtn,
    lockBtn,
    unlockBtn,
    strokeColorInput,
    fillColorInput,
    fillAlphaSlider
  };

  // Basic sanity check
  const missing = Object.entries(refs)
    .filter(([, el]) => !el)
    .map(([k]) => k);
  if (missing.length) {
    log("WARN", "[toolbar-dom] Some toolbar refs are missing", { missing });
  }

  log("INFO", "[toolbar-dom] Toolbar DOM rendered");
  log("TRACE", "[toolbar-dom] renderToolbar EXIT");

  return refs;
}

