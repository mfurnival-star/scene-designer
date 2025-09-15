/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Element Factory (ESM only)
 * - Exports helpers for creating toolbar UI elements (button, dropdown).
 * - Exports buildCanvasToolbarPanel for use as Golden Layout panel (CanvasToolbarPanel).
 * - Handles device image upload and server image select, wiring both to setImage().
 * - Device-uploaded image filename is NOT displayed in the UI; just a button triggers the file dialog.
 * - Adds shape (point, rectangle, circle) at position controlled by shapeStartXPercent/shapeStartYPercent (as % of image/canvas).
 * - All ES module imports/exports, no window/global use.
 * - Toolbar scaling is controlled by the `toolbarUIScale` setting and updates live.
 * - Dependencies: log.js, state.js, shapes.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { setImage, getSetting, subscribe, addShape, AppState } from './state.js';
import { makePointShape, makeRectShape, makeCircleShape } from './shapes.js';

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

// --- Helper: Get shape start X/Y in px as percent of image/canvas size ---
function getShapeStartXY() {
  const xPct = Number(getSetting('shapeStartXPercent')) || 50;
  const yPct = Number(getSetting('shapeStartYPercent')) || 50;
  let w = 0, h = 0;
  if (AppState.konvaStage) {
    w = AppState.konvaStage.width();
    h = AppState.konvaStage.height();
  } else if (AppState.imageObj) {
    w = AppState.imageObj.naturalWidth || AppState.imageObj.width || 600;
    h = AppState.imageObj.naturalHeight || AppState.imageObj.height || 400;
  } else {
    w = 600;
    h = 400;
  }
  const x = Math.round((xPct / 100) * w);
  const y = Math.round((yPct / 100) * h);
  log("DEBUG", "[toolbar] Calculated shape start XY", { x, y, xPct, yPct, w, h });
  return { x, y };
}

// --- PANEL FACTORY ---

/**
 * Golden Layout panel factory for CanvasToolbarPanel.
 * - Applies toolbar scaling from settings and listens for changes.
 * - Adds "Add Point", "Add Rectangle", "Add Circle" functionality (calls shapes.js factories).
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
    // REMOVE border and background for minimal look
    bar.style.borderBottom = 'none';
    bar.style.background = 'none';
    rootElement.appendChild(bar);

    // --- Apply toolbar scaling from settings ---
    const applyScale = (scaleVal) => {
      const scale = Number(scaleVal) || 1;
      bar.style.transform = `scale(${scale})`;
      bar.style.transformOrigin = 'top left';
      log("DEBUG", "[toolbar] Applied toolbarUIScale", scale);
    };
    // Initial scale
    applyScale(getSetting("toolbarUIScale"));
    // Listen for live updates
    const unsub = subscribe((state, details) => {
      if (details && details.type === "setting" && details.key === "toolbarUIScale") {
        applyScale(details.value);
      }
    });
    // Cleanup on destroy
    if (container && typeof container.on === "function") {
      container.on("destroy", () => {
        unsub && unsub();
        log("TRACE", "[toolbar] CanvasToolbarPanel destroy event (unsubscribed)");
      });
    }

    // --- Device image upload as button ---
    const uploadBtn = createToolbarButton({
      id: 'toolbar-upload-btn',
      label: "Upload Image",
      tooltip: "Upload image from your device",
      onClick: () => {
        hiddenFileInput.value = ''; // reset file input so same file can be re-uploaded
        hiddenFileInput.click();
      }
    });
    bar.appendChild(uploadBtn);

    // Hidden file input (real input, not visible)
    const hiddenFileInput = document.createElement('input');
    hiddenFileInput.type = 'file';
    hiddenFileInput.accept = 'image/*';
    hiddenFileInput.style.display = 'none';
    hiddenFileInput.addEventListener('change', (e) => {
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
    bar.appendChild(hiddenFileInput);

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
          hiddenFileInput.value = "";
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

    // --- Shape type dropdown (now supports circle) ---
    const shapeDropdown = createToolbarDropdown({
      id: "toolbar-shape-type",
      options: [
        { label: "Point", value: "point" },
        { label: "Rectangle", value: "rect" },
        { label: "Circle", value: "circle" }
      ],
      value: "point",
      tooltip: "Select shape type"
    });
    shapeDropdown.style.marginRight = "6px";
    bar.appendChild(shapeDropdown);

    // --- Add shape button ---
    const addBtn = createToolbarButton({
      id: "toolbar-add-btn",
      label: "Add",
      tooltip: "Add shape",
      onClick: () => {
        const shapeType = shapeDropdown.value;
        const { x, y } = getShapeStartXY();
        if (shapeType === "point") {
          // Use shapes.js factory for visible, interactive point
          const group = makePointShape(x, y);
          if (AppState.konvaLayer) {
            AppState.konvaLayer.add(group);
            AppState.konvaLayer.draw();
          }
          addShape(group);
          log("INFO", "[toolbar] Added point shape via shapes.js", group);
        } else if (shapeType === "rect") {
          // Use shapes.js factory for rectangle
          const rect = makeRectShape(x, y);
          if (AppState.konvaLayer) {
            AppState.konvaLayer.add(rect);
            AppState.konvaLayer.draw();
          }
          addShape(rect);
          log("INFO", "[toolbar] Added rectangle shape via shapes.js", rect);
        } else if (shapeType === "circle") {
          // Use shapes.js factory for circle
          const circle = makeCircleShape(x, y);
          if (AppState.konvaLayer) {
            AppState.konvaLayer.add(circle);
            AppState.konvaLayer.draw();
          }
          addShape(circle);
          log("INFO", "[toolbar] Added circle shape via shapes.js", circle);
        } else {
          log("WARN", "[toolbar] Only Point/Rectangle/Circle shape add is implemented.");
        }
      }
    });
    bar.appendChild(addBtn);

    log("INFO", "[toolbar] CanvasToolbarPanel UI rendered (Upload button, server select, shape dropdown, add w/point/rect/circle support)");

  } catch (e) {
    log("ERROR", "[toolbar] buildCanvasToolbarPanel ERROR", e);
    rootElement.innerHTML = `<div style="color:red;padding:2em;">ToolbarPanel ERROR: ${e.message}</div>`;
    throw e;
  }
  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit");
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
    /* .sd-toolbar-main: no border or background */
    .sd-toolbar-main {
      width: 100%;
      min-height: 32px;
      box-sizing: border-box;
      border-bottom: none !important;
      background: none !important;
    }
  `;
  document.head.appendChild(style);
}
