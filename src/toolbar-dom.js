import { log } from './log.js';

export function renderToolbar(element) {
  log("DEBUG", "[toolbar-dom] renderToolbar ENTRY", { elementType: element?.tagName });

  if (!element || !(element instanceof HTMLElement)) {
    const msg = "[toolbar-dom] renderToolbar: invalid element";
    log("ERROR", msg, { element });
    throw new Error(msg);
  }

  element.innerHTML = `
    <div id="canvas-toolbar-container">
      <div class="toolbar-row" id="toolbar-row-1">
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
            <option value="ellipse">Ellipse</option>
          </select>
          <button id="toolbar-add-shape-btn" class="toolbar-btn" title="Add shape">
            <span style="font-size:1em;margin-right:3px;">&#x2795;</span> Add
          </button>
        </div>

        <div class="toolbar-group">
          <button id="toolbar-delete-shape-btn" class="toolbar-btn" title="Delete selected shape(s)">
            <span style="font-size:1em;margin-right:3px;">&#x1F5D1;</span> Delete
          </button>
          <button id="toolbar-select-all-btn" class="toolbar-btn" title="Select all shapes">Select All</button>
        </div>

        <div class="toolbar-group">
          <button id="toolbar-undo-btn" class="toolbar-btn" title="Undo (Ctrl/Cmd+Z)">Undo</button>
          <button id="toolbar-redo-btn" class="toolbar-btn" title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)">Redo</button>
        </div>
      </div>

      <div class="toolbar-row" id="toolbar-row-2">
        <div class="toolbar-group">
          <button id="toolbar-duplicate-shape-btn" class="toolbar-btn" title="Duplicate selected shape(s)">Duplicate</button>
          <button id="toolbar-reset-rotation-btn" class="toolbar-btn" title="Reset rotation to 0°">Reset Rotation</button>
          <button id="toolbar-lock-btn" class="toolbar-btn" title="Lock selected shape(s)">Lock</button>
          <button id="toolbar-unlock-btn" class="toolbar-btn" title="Unlock selected shape(s)">Unlock</button>
        </div>

        <div class="toolbar-group" id="toolbar-align-group">
          <span class="toolbar-label">Align:</span>
          <button id="toolbar-align-left-btn" class="toolbar-btn" title="Align left (requires 2+ selected)">⟸ L</button>
          <button id="toolbar-align-centerX-btn" class="toolbar-btn" title="Align horizontal center (requires 2+ selected)">↔ C</button>
          <button id="toolbar-align-right-btn" class="toolbar-btn" title="Align right (requires 2+ selected)">R ⟹</button>
          <button id="toolbar-align-top-btn" class="toolbar-btn" title="Align top (requires 2+ selected)">⇑ T</button>
          <button id="toolbar-align-middleY-btn" class="toolbar-btn" title="Align vertical middle (requires 2+ selected)">↕ M</button>
          <button id="toolbar-align-bottom-btn" class="toolbar-btn" title="Align bottom (requires 2+ selected)">B ⇓</button>
        </div>

        <div class="toolbar-group" id="toolbar-color-group">
          <span class="toolbar-label">Color:</span>
          <label class="toolbar-label" for="toolbar-stroke-pickr" title="Stroke color">Stroke</label>
          <button id="toolbar-stroke-pickr" class="toolbar-btn pickr-btn" type="button" title="Stroke color">Pick</button>
          <label class="toolbar-label" for="toolbar-fill-pickr" title="Fill color + Alpha">Fill</label>
          <button id="toolbar-fill-pickr" class="toolbar-btn pickr-btn" type="button" title="Fill color + Alpha">Pick</button>

          <span class="toolbar-label" style="margin-left:8px;">Stroke:</span>
          <label class="toolbar-label" for="toolbar-stroke-width-input" title="Stroke width (px)">Width</label>
          <input id="toolbar-stroke-width-input" class="toolbar-input-number" type="number" min="1" max="20" step="1" value="1" title="Stroke width (px)" />
        </div>

        <div class="toolbar-group" id="toolbar-debug-group">
          <button id="toolbar-debug-btn" class="toolbar-btn" title="Collect debug snapshot and copy to clipboard">Debug</button>
        </div>
      </div>
    </div>
  `;

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

  const undoBtn = element.querySelector('#toolbar-undo-btn');
  const redoBtn = element.querySelector('#toolbar-redo-btn');

  const alignLeftBtn = element.querySelector('#toolbar-align-left-btn');
  const alignCenterXBtn = element.querySelector('#toolbar-align-centerX-btn');
  const alignRightBtn = element.querySelector('#toolbar-align-right-btn');
  const alignTopBtn = element.querySelector('#toolbar-align-top-btn');
  const alignMiddleYBtn = element.querySelector('#toolbar-align-middleY-btn');
  const alignBottomBtn = element.querySelector('#toolbar-align-bottom-btn');

  const strokePickrEl = element.querySelector('#toolbar-stroke-pickr');
  const fillPickrEl = element.querySelector('#toolbar-fill-pickr');
  const strokeWidthInput = element.querySelector('#toolbar-stroke-width-input');

  const debugBtn = element.querySelector('#toolbar-debug-btn');

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
    undoBtn,
    redoBtn,
    strokePickrEl,
    fillPickrEl,
    strokeWidthInput,
    alignLeftBtn,
    alignCenterXBtn,
    alignRightBtn,
    alignTopBtn,
    alignMiddleYBtn,
    alignBottomBtn,
    debugBtn
  };

  const missing = Object.entries(refs).filter(([, el]) => !el).map(([k]) => k);
  if (missing.length) {
    log("WARN", "[toolbar-dom] Some toolbar refs are missing", { missing });
  }

  log("INFO", "[toolbar-dom] Toolbar DOM rendered (undo/redo, color pickers, stroke width input)");
  log("DEBUG", "[toolbar-dom] renderToolbar EXIT");

  return refs;
}
