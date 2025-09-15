/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Element Factory (ESM only)
 * - Purpose: Agnostic factory for toolbar UI elements (buttons, dropdowns, file inputs, color pickers, etc).
 * - Not limited to shape annotation; includes image upload, server image selection, color pickers, and all annotation controls.
 * - All event logic is handled in consumer/panel code (not in this factory).
 * - Exports: buildCanvasToolbarPanel, plus UI element factory functions.
 * - Uses ES module imports/exports ONLY; no window/global code.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { AppState, addShape, removeShape, setSelectedShapes } from './state.js';
import { log } from './log.js';
import { makeRectShape, makeCircleShape, makePointShape } from './shapes.js';
import { setSelectedShape, setSelectedShapes as setSelection } from './selection.js';

/**
 * Factory: Create a toolbar button
 * @param {Object} opts - { id, label, style, disabled }
 * @returns {HTMLButtonElement}
 */
export function createToolbarButton({ id, label, style = '', disabled = false }) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.innerText = label;
  btn.style = style;
  btn.disabled = disabled;
  return btn;
}

/**
 * Factory: Create a toolbar dropdown
 * @param {Object} opts - { id, options, style, disabled }
 * @returns {HTMLSelectElement}
 */
export function createToolbarDropdown({ id, options, style = '', disabled = false }) {
  const select = document.createElement('select');
  select.id = id;
  select.style = style;
  select.disabled = disabled;
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    select.appendChild(o);
  });
  return select;
}

/**
 * Factory: Create a file input for image upload
 * @param {Object} opts - { id, accept, style, disabled }
 * @returns {HTMLInputElement}
 */
export function createToolbarFileInput({ id, accept = 'image/*', style = '', disabled = false }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.id = id;
  input.accept = accept;
  input.style = style;
  input.disabled = disabled;
  return input;
}

/**
 * Factory: Create an image select dropdown for server images
 * @param {Object} opts - { id, options, style, disabled }
 * @returns {HTMLSelectElement}
 */
export function createToolbarImageDropdown({ id, options, style = '', disabled = false }) {
  return createToolbarDropdown({ id, options, style, disabled });
}

/**
 * Main builder: Complete toolbar panel for Golden Layout
 * - Assembles all UI elements using factories above.
 * - Includes image upload, server image select, shape type, add/delete/duplicate/lock/unlock, color pickers.
 * - Event logic for shape creation/transformer is preserved/fixed.
 */
export function buildCanvasToolbarPanel(rootElement, container) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });

  // --- UI element factories (agnostic, not hardcoded for shape only) ---
  const imageUpload = createToolbarFileInput({
    id: 'toolbar-image-upload',
    accept: 'image/*',
    style: 'margin-right:8px;',
    disabled: false
  });

  const serverImageDropdown = createToolbarImageDropdown({
    id: 'toolbar-server-image-select',
    options: [
      { value: '', label: '[Server image]' },
      { value: 'sample1.png', label: 'sample1.png' },
      { value: 'sample2.png', label: 'sample2.png' }
    ],
    style: 'margin-right:8px;',
    disabled: false
  });

  const shapeTypeDropdown = createToolbarDropdown({
    id: 'toolbar-shape-type',
    options: [
      { value: 'point', label: 'Point' },
      { value: 'rect', label: 'Rectangle' },
      { value: 'circle', label: 'Circle' }
    ],
    style: 'margin-right:8px;',
    disabled: false
  });

  const addBtn = createToolbarButton({ id: 'toolbar-add-shape', label: 'Add' });
  const delBtn = createToolbarButton({ id: 'toolbar-delete-shape', label: 'Delete', style: 'margin-left:8px;' });
  const dupBtn = createToolbarButton({ id: 'toolbar-duplicate-shape', label: 'Duplicate', style: 'margin-left:8px;' });
  const lockBtn = createToolbarButton({ id: 'toolbar-lock-shape', label: 'Lock', style: 'margin-left:8px;' });
  const unlockBtn = createToolbarButton({ id: 'toolbar-unlock-shape', label: 'Unlock', style: 'margin-left:4px;' });

  // --- Assemble toolbar row ---
  rootElement.innerHTML = '';
  const toolbarDiv = document.createElement('div');
  toolbarDiv.id = "canvas-toolbar-panel-container";
  toolbarDiv.style = "width:100%;height:100%;background:#f7f7fa;display:flex;flex-direction:row;align-items:center;overflow-x:auto;padding:4px 8px;";

  toolbarDiv.appendChild(imageUpload);
  toolbarDiv.appendChild(serverImageDropdown);
  toolbarDiv.appendChild(shapeTypeDropdown);
  toolbarDiv.appendChild(addBtn);
  toolbarDiv.appendChild(delBtn);
  toolbarDiv.appendChild(dupBtn);
  toolbarDiv.appendChild(lockBtn);
  toolbarDiv.appendChild(unlockBtn);

  const infoSpan = document.createElement('span');
  infoSpan.style = "margin-left:18px;font-size:0.98em;color:#888;";
  infoSpan.textContent = "Toolbar (Scene Designer)";
  toolbarDiv.appendChild(infoSpan);

  rootElement.appendChild(toolbarDiv);

  // --- Event Handlers (image upload, shape creation, etc) ---

  imageUpload.addEventListener('change', function (e) {
    log("INFO", "[toolbar] imageUpload changed");
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      // Set image in AppState and canvas
      AppState.imageURL = ev.target.result;
      AppState.imageObj = new window.Image();
      AppState.imageObj.src = ev.target.result;
      AppState.imageObj.onload = () => {
        // Notify canvas to update background
        if (typeof AppState.setImage === "function") {
          AppState.setImage(AppState.imageURL, AppState.imageObj);
        }
      };
    };
    reader.readAsDataURL(file);
    serverImageDropdown.value = "";
  });

  serverImageDropdown.addEventListener('change', function (e) {
    log("INFO", "[toolbar] serverImageDropdown changed");
    const filename = e.target.value;
    if (!filename) {
      AppState.imageURL = null;
      AppState.imageObj = null;
      if (typeof AppState.setImage === "function") {
        AppState.setImage(null, null);
      }
      return;
    }
    const imgPath = './images/' + filename;
    AppState.imageURL = imgPath;
    AppState.imageObj = new window.Image();
    AppState.imageObj.src = imgPath;
    AppState.imageObj.onload = () => {
      if (typeof AppState.setImage === "function") {
        AppState.setImage(AppState.imageURL, AppState.imageObj);
      }
    };
    imageUpload.value = "";
  });

  // --- Shape controls (with transformer fix) ---
  addBtn.addEventListener('click', () => {
    const type = shapeTypeDropdown.value;
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
    addShape(shape);
    setSelectedShapes([shape]);
    log("INFO", "[toolbar] Added shape via shapes.js", shape);
  });

  delBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    const unlocked = AppState.selectedShapes.filter(s => !s.locked);
    unlocked.forEach(s => {
      removeShape(s);
      log("INFO", "[toolbar] Deleted shape", s);
    });
    setSelectedShapes([]);
  });

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

  lockBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    AppState.selectedShapes.forEach(s => { s.locked = true; s.draggable(false); });
    setSelectedShapes(AppState.selectedShapes);
    log("INFO", "[toolbar] Locked selected shapes", AppState.selectedShapes);
  });

  unlockBtn.addEventListener('click', () => {
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
    AppState.selectedShapes.forEach(s => { s.locked = false; s.draggable(true); });
    setSelectedShapes(AppState.selectedShapes);
    log("INFO", "[toolbar] Unlocked selected shapes", AppState.selectedShapes);
  });

  log("INFO", "[toolbar] CanvasToolbarPanel fully initialized (agnostic UI factory, transformer fix applied)");
  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
}
