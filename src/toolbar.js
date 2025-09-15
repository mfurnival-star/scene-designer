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

import { log } from './log.js';

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
 * Factory: Create a color picker input (type=color)
 * @param {Object} opts - { id, value, style, disabled }
 * @returns {HTMLInputElement}
 */
export function createToolbarColorInput({ id, value = '#000000', style = '', disabled = false }) {
  const input = document.createElement('input');
  input.type = 'color';
  input.id = id;
  input.value = value;
  input.style = style;
  input.disabled = disabled;
  return input;
}

/**
 * Main builder: Complete toolbar panel for Golden Layout
 * - Assembles all UI elements using factories above.
 * - Includes image upload, server image select, shape type, add/delete/duplicate/lock/unlock, color pickers.
 * - Does NOT hardcode for shapes only; allows any toolbar element.
 */
export function buildCanvasToolbarPanel(rootElement, container) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });

  // --- Example: Compose toolbar row with various elements ---
  rootElement.innerHTML = '';
  const toolbarDiv = document.createElement('div');
  toolbarDiv.id = "canvas-toolbar-panel-container";
  toolbarDiv.style = "width:100%;height:100%;background:#f7f7fa;display:flex;flex-direction:row;align-items:center;overflow-x:auto;padding:4px 8px;";

  // Example image upload
  const imageUpload = createToolbarFileInput({
    id: 'toolbar-image-upload',
    accept: 'image/*',
    style: 'margin-right:8px;',
    disabled: false
  });

  // Example server image select dropdown
  const serverImageDropdown = createToolbarDropdown({
    id: 'toolbar-server-image-select',
    options: [
      { value: '', label: '[Server image]' },
      { value: 'sample1.png', label: 'sample1.png' },
      { value: 'sample2.png', label: 'sample2.png' }
    ],
    style: 'margin-right:8px;',
    disabled: false
  });

  // Example color pickers
  const strokeColorInput = createToolbarColorInput({
    id: 'toolbar-stroke-color',
    value: '#2176ff',
    style: 'margin-right:8px;',
    disabled: false
  });
  const fillColorInput = createToolbarColorInput({
    id: 'toolbar-fill-color',
    value: '#00000000',
    style: 'margin-right:8px;',
    disabled: false
  });

  // Example shape type dropdown
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

  // Example action buttons
  const addBtn = createToolbarButton({ id: 'toolbar-add-shape', label: 'Add' });
  const delBtn = createToolbarButton({ id: 'toolbar-delete-shape', label: 'Delete', style: 'margin-left:8px;' });
  const dupBtn = createToolbarButton({ id: 'toolbar-duplicate-shape', label: 'Duplicate', style: 'margin-left:8px;' });
  const lockBtn = createToolbarButton({ id: 'toolbar-lock-shape', label: 'Lock', style: 'margin-left:8px;' });
  const unlockBtn = createToolbarButton({ id: 'toolbar-unlock-shape', label: 'Unlock', style: 'margin-left:4px;' });

  // Compose the toolbar
  toolbarDiv.appendChild(imageUpload);
  toolbarDiv.appendChild(serverImageDropdown);
  toolbarDiv.appendChild(strokeColorInput);
  toolbarDiv.appendChild(fillColorInput);
  toolbarDiv.appendChild(shapeTypeDropdown);
  toolbarDiv.appendChild(addBtn);
  toolbarDiv.appendChild(delBtn);
  toolbarDiv.appendChild(dupBtn);
  toolbarDiv.appendChild(lockBtn);
  toolbarDiv.appendChild(unlockBtn);

  const infoSpan = document.createElement('span');
  infoSpan.style = "margin-left:18px;font-size:0.98em;color:#888;";
  infoSpan.textContent = "Toolbar (Scene Designer) – agnostic UI factory";
  toolbarDiv.appendChild(infoSpan);

  rootElement.appendChild(toolbarDiv);

  log("INFO", "[toolbar] CanvasToolbarPanel fully initialized (agnostic UI factory)");
  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
}
