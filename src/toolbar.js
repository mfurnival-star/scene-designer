/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Element Factory (ESM only)
 * - Exports helpers for creating toolbar UI elements (button, dropdown).
 * - Exports buildCanvasToolbarPanel for use as Golden Layout panel (CanvasToolbarPanel).
 * - Handles device image upload and server image select, wiring both to setImage().
 * - Device-uploaded image filename is NOT displayed in the UI.
 * - All ES module imports/exports, no window/global use.
 * - Dependencies: log.js, state.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { setImage } from './state.js';

// --- UI ELEMENT HELPERS ---

export function createToolbarButton({ id, label, icon = "", tooltip = "", onClick }) {
  log("TRACE", "[toolbar] createToolbarButton entry", { id, label });
  const btn = document.createElement('button');
  if (id) btn.id = id;
  btn.type = 'button';
  btn.className = 'sd-toolbar-btn';
  btn.innerHTML = icon ? `${icon} ${label}` : label;
  if (tooltip) btn.title = tooltip;
  if (typeof onClick === "function") {
    btn.addEventListener('click', onClick);
  }
  log("TRACE", "[toolbar] createToolbarButton exit", { id, label });
  return btn;
}

export function createToolbarDropdown({ id, options = [], value = "", tooltip = "", onChange }) {
  log("TRACE", "[toolbar] createToolbarDropdown entry", { id, options });
  const select = document.createElement('select');
  if (id) select.id = id;
  select.className = 'sd-toolbar-dropdown';
  if (tooltip) select.title = tooltip;
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });
  if (value) select.value = value;
  if (typeof onChange === "function") {
    select.addEventListener('change', e => onChange(e.target.value, e));
  }
  log("TRACE", "[toolbar] createToolbarDropdown exit", { id, options });
  return select;
}

// --- PANEL FACTORY ---

/**
 * Golden Layout panel factory for CanvasToolbarPanel.
 * - Wires up image upload (device), server select, shape dropdown, and add button.
 * - Does NOT show filename of device-uploaded image in the UI.
 * @param {HTMLElement} rootElement
 * @param {Object} container - Golden Layout container
 */
export function buildCanvasToolbarPanel(rootElement, container) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });

  try {
    rootElement.innerHTML = ""; // Clear panel
    // Main toolbar container
    const bar = document.createElement('div');
    bar.className = 'sd-toolbar-main';
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.alignItems = 'center';
    bar.style.padding = '6px 8px 4px 8px';
    bar.style.background = '#f7f7fa';
    bar.style.borderBottom = '1px solid #bbb';
    rootElement.appendChild(bar);

    // --- Device image upload (no filename display) ---
    const uploadLabel = document.createElement('label');
    uploadLabel.textContent = "Image: ";
    uploadLabel.setAttribute('for', 'toolbar-image-upload');
    uploadLabel.style.marginRight = "4px";
    bar.appendChild(uploadLabel);

    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/*';
    uploadInput.id = 'toolbar-image-upload';
    uploadInput.className = 'sd-toolbar-file';
    uploadInput.style.display = 'inline-block';
    uploadInput.style.marginRight = "8px";
    uploadInput.title = "Upload image from your device";
    // -- No filename display anywhere --
    uploadInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        log("DEBUG", "[toolbar] Image upload: no file selected");
        return;
      }
      const reader = new FileReader();
      reader.onload = function(ev) {
        const url = ev.target.result;
        const imgObj = new window.Image();
        imgObj.onload = function() {
          log("INFO", "[toolbar] Image upload: Image loaded", { width: imgObj.naturalWidth, height: imgObj.naturalHeight });
          setImage(url, imgObj);
          serverSelect.value = "";
        };
        imgObj.onerror = function(e) {
          log("ERROR", "[toolbar] Image upload: Image failed to load", e);
          setImage(null, null);
        };
        imgObj.src = url;
      };
      reader.readAsDataURL(file);
    });
    bar.appendChild(uploadInput);

    // --- Server image select ---
    const serverImages = [
      { label: "[Server image]", value: "" },
      { label: "sample1.png", value: "sample1.png" },
      { label: "sample2.png", value: "sample2.png" }
      // Add more as needed
    ];
    const serverSelect = createToolbarDropdown({
      id: "toolbar-server-image-select",
      options: serverImages,
      value: "",
      tooltip: "Select server image",
      onChange: v => {
        if (!v) {
          setImage(null, null);
          return;
        }
        const url = './images/' + v;
        const imgObj = new window.Image();
        imgObj.onload = function() {
          log("INFO", "[toolbar] Server image: Image loaded", { width: imgObj.naturalWidth, height: imgObj.naturalHeight });
          setImage(url, imgObj);
          uploadInput.value = "";
        };
        imgObj.onerror = function(e) {
          log("ERROR", "[toolbar] Server image: Image failed to load", e);
          setImage(null, null);
        };
        imgObj.src = url;
      }
    });
    serverSelect.style.marginRight = "12px";
    bar.appendChild(serverSelect);

    // --- Shape type dropdown ---
    const shapeDropdown = createToolbarDropdown({
      id: "toolbar-shape-type",
      options: [
        { label: "Point", value: "point" },
        { label: "Rectangle", value: "rect" },
        { label: "Circle", value: "circle" }
      ],
      value: "point",
      tooltip: "Select shape type",
      onChange: v => log("INFO", "[toolbar] Shape type selected", v)
    });
    shapeDropdown.style.marginRight = "6px";
    bar.appendChild(shapeDropdown);

    // --- Add shape button ---
    const addBtn = createToolbarButton({
      id: "toolbar-add-btn",
      label: "Add",
      tooltip: "Add shape",
      onClick: () => log("INFO", "[toolbar] Add button clicked (not yet wired to addShape)")
    });
    bar.appendChild(addBtn);

    log("INFO", "[toolbar] CanvasToolbarPanel UI rendered (image upload, server select, shape dropdown, add)");

    // Clean up on destroy
    if (container && typeof container.on === "function") {
      container.on("destroy", () => {
        log("TRACE", "[toolbar] CanvasToolbarPanel destroy event");
      });
    }
  } catch (e) {
    log("ERROR", "[toolbar] buildCanvasToolbarPanel ERROR", e);
    rootElement.innerHTML = `<div style="color:red;padding:2em;">ToolbarPanel ERROR: ${e.message}</div>`;
    throw e;
  }
  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
}

// --- Toolbar CSS inject ---
if (typeof document !== "undefined" && !document.getElementById('sd-toolbar-style')) {
  const style = document.createElement('style');
  style.id = 'sd-toolbar-style';
  style.textContent = `
    .sd-toolbar-btn {
      margin: 0 4px;
      padding: 4px 10px;
      border: 1px solid #bbb;
      background: #f3f6fb;
      color: #133070;
      font-size: 1em;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .sd-toolbar-btn:hover, .sd-toolbar-btn:focus {
      background: #e3e8f2;
      border-color: #2176ff;
      color: #2176ff;
      outline: none;
    }
    .sd-toolbar-dropdown {
      margin: 0 4px;
      padding: 3px 7px;
      font-size: 1em;
      border-radius: 3px;
      border: 1px solid #bbb;
      background: #fcfcff;
    }
    .sd-toolbar-file {
      margin: 0 4px;
      padding: 1px 0px;
      font-size: 1em;
      border-radius: 3px;
      border: 1px solid #bbb;
      background: #fcfcff;
    }
    .sd-toolbar-main {
      width: 100%;
      min-height: 32px;
      box-sizing: border-box;
    }
  `;
  document.head.appendChild(style);
}
