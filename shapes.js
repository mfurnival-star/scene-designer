/**
 * shapes.part1.settings.js
 * App settings and config management for scene-designer
 * - Loads/saves user settings (localStorage)
 * - Exports setupSettingsPanel for GL settings panel
 * - Handles settings form population and change events
 */

const DEFAULT_SETTINGS = {
  pointHitRadius: 12,
  defaultStrokeColor: "#2176ff",
  defaultFillColor: "#e3eeff",
  toolbarPosition: "top"
};

function getSetting(key) {
  const stored = localStorage.getItem("sceneDesignerSettings");
  let settings = DEFAULT_SETTINGS;
  if (stored) {
    try {
      settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(stored));
    } catch (e) {
      // ignore, use defaults
    }
  }
  return settings[key];
}

function saveSetting(key, value) {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem("sceneDesignerSettings")) || {};
  } catch (e) {}
  settings[key] = value;
  localStorage.setItem("sceneDesignerSettings", JSON.stringify(settings));
}

function setupSettingsPanel(containerId = "settingsPanel") {
  const panel = document.getElementById(containerId);
  if (!panel) return;

  // Settings UI (basic for now)
  panel.innerHTML = `
    <h2>Settings</h2>
    <form id="settingsForm">
      <label>
        Point Hit Radius:
        <input type="number" id="setting-pointHitRadius" value="${getSetting("pointHitRadius")}" min="1" max="40">
      </label>
      <label>
        Stroke Color:
        <input type="color" id="setting-defaultStrokeColor" value="${getSetting("defaultStrokeColor")}">
      </label>
      <label>
        Fill Color:
        <input type="color" id="setting-defaultFillColor" value="${getSetting("defaultFillColor")}">
      </label>
    </form>
  `;

  // Event listeners for settings changes
  panel.querySelector("#setting-pointHitRadius").addEventListener("change", e => {
    saveSetting("pointHitRadius", Number(e.target.value));
    if (window.redrawAllPoints) window.redrawAllPoints();
  });
  panel.querySelector("#setting-defaultStrokeColor").addEventListener("change", e => {
    saveSetting("defaultStrokeColor", e.target.value);
    if (window.redrawAllPoints) window.redrawAllPoints();
  });
  panel.querySelector("#setting-defaultFillColor").addEventListener("change", e => {
    saveSetting("defaultFillColor", e.target.value);
    if (window.redrawAllPoints) window.redrawAllPoints();
  });
}

if (typeof window !== "undefined") {
  window.getSetting = getSetting;
  window.saveSetting = saveSetting;
  window.setupSettingsPanel = setupSettingsPanel;
}

/**
 * shapes.part2a.konva.js
 * Konva stage and layer setup for scene-designer
 * - Exports konvaStageInit and createKonvaStage
 * - Responsible for initializing the main drawing surface
 * - Integrates with shape tools/logic (see part2b)
 */

// Holds the global Konva stage and layer
let stage = null;
let layer = null;

function createKonvaStage(containerId = "container", width = 960, height = 600) {
  // Remove any previous children
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element not found: ${containerId}`);
  }
  container.innerHTML = "";

  stage = new Konva.Stage({
    container: containerId,
    width,
    height
  });

  layer = new Konva.Layer();
  stage.add(layer);

  window.stage = stage;
  window.layer = layer;
  return { stage, layer };
}

/**
 * Initializes the Konva stage and layer, sets up resizing
 * Called from CanvasPanel (GoldenLayout)
 */
function konvaStageInit(containerId = "container") {
  // Default size: fill parent
  const parent = document.getElementById(containerId);
  let width = 960, height = 600;
  if (parent) {
    width = parent.clientWidth || width;
    height = parent.clientHeight || height;
  }
  createKonvaStage(containerId, width, height);

  // Responsive resizing
  window.addEventListener("resize", () => {
    if (!stage) return;
    const parent = document.getElementById(containerId);
    if (parent) {
      stage.width(parent.clientWidth);
      stage.height(parent.clientHeight);
    }
  });
}

if (typeof window !== "undefined") {
  window.konvaStageInit = konvaStageInit;
  window.createKonvaStage = createKonvaStage;
  window.stage = stage;
  window.layer = layer;
}

/**
 * shapes.part2b.konva.js
 * Konva shapes/tools/extensions for scene-designer
 * - Sets up shape tools (point, rect, circle)
 * - Handles drawing, selection, and tool logic
 * - Depends on part2a (stage/layer creation)
 */

let currentTool = "point";
let shapes = [];
let selectedShape = null;

// Tool setup: called after stage/layer is created
function setupShapeTools() {
  // Tool dropdown
  const toolSelect = document.getElementById("shapeType");
  if (toolSelect) {
    toolSelect.value = currentTool;
    toolSelect.onchange = e => {
      currentTool = e.target.value;
      handleToolChange();
    };
  }

  // Add shape button
  const addBtn = document.getElementById("newBtn");
  if (addBtn) addBtn.onclick = addShapeHandler;

  // Delete shape button
  const delBtn = document.getElementById("deleteBtn");
  if (delBtn) delBtn.onclick = deleteShapeHandler;

  // Duplicate shape button
  const dupBtn = document.getElementById("duplicateBtn");
  if (dupBtn) dupBtn.onclick = duplicateShapeHandler;

  // Init layer events for drawing
  if (window.layer) {
    window.layer.on("mousedown touchstart", onCanvasDown);
  }
}

function handleToolChange() {
  clearSelection();
  // Future: update UI for tool-specific options
}

function addShapeHandler() {
  if (!window.layer) return;
  const stage = window.stage;
  const pointer = stage.getPointerPosition() || { x: 100, y: 100 };
  let shape;
  if (currentTool === "point") {
    shape = new Konva.Circle({
      x: pointer.x,
      y: pointer.y,
      radius: window.getSetting ? window.getSetting("pointHitRadius") : 12,
      stroke: window.getSetting ? window.getSetting("defaultStrokeColor") : "#2176ff",
      fill: window.getSetting ? window.getSetting("defaultFillColor") : "#e3eeff",
      strokeWidth: 2,
      draggable: true,
      _type: "point"
    });
  } else if (currentTool === "rect") {
    shape = new Konva.Rect({
      x: pointer.x - 30,
      y: pointer.y - 20,
      width: 60,
      height: 40,
      stroke: "#2176ff",
      fill: "#e3eeff",
      strokeWidth: 2,
      draggable: true,
      _type: "rect"
    });
  } else if (currentTool === "circle") {
    shape = new Konva.Circle({
      x: pointer.x,
      y: pointer.y,
      radius: 32,
      stroke: "#2176ff",
      fill: "#e3eeff",
      strokeWidth: 2,
      draggable: true,
      _type: "circle"
    });
  }
  if (shape) {
    shapes.push(shape);
    window.layer.add(shape);
    window.layer.draw();
    selectShape(shape);
  }
}

function deleteShapeHandler() {
  if (!selectedShape) return;
  shapes = shapes.filter(s => s !== selectedShape);
  selectedShape.destroy();
  selectedShape = null;
  window.layer.draw();
}

function duplicateShapeHandler() {
  if (!selectedShape) return;
  let clone;
  if (selectedShape._type === "point" || selectedShape._type === "circle") {
    clone = selectedShape.clone({ x: selectedShape.x() + 16, y: selectedShape.y() + 16 });
  } else if (selectedShape._type === "rect") {
    clone = selectedShape.clone({ x: selectedShape.x() + 20, y: selectedShape.y() + 20 });
  }
  if (clone) {
    shapes.push(clone);
    window.layer.add(clone);
    window.layer.draw();
    selectShape(clone);
  }
}

function clearSelection() {
  if (selectedShape) {
    selectedShape.strokeEnabled(true);
    selectedShape = null;
    window.layer.draw();
  }
}

function selectShape(shape) {
  clearSelection();
  selectedShape = shape;
  if (shape) {
    shape.strokeEnabled(true);
    window.layer.draw();
  }
}

function onCanvasDown(e) {
  if (e.target === window.layer) {
    clearSelection();
  } else {
    selectShape(e.target);
  }
}

function addShapeHandlers() {
  // For extension: add event handlers to shapes (e.g. drag, transform)
}

if (typeof window !== "undefined") {
  window.setupShapeTools = setupShapeTools;
  window.addShapeHandlers = addShapeHandlers;
  window.shapes = shapes;
}

/**
 * shapes.part3.sidebar.js
 * Sidebar UI: component layout & events for scene-designer
 * - Renders sidebar panel (label editor, labels list)
 * - Handles sidebar-specific events and interactions
 * - Depends on Konva shapes/tools (part2b)
 */

function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  // Elements
  const labelInput = sidebar.querySelector("#labelInput");
  const saveLabelBtn = sidebar.querySelector("#saveLabelBtn");
  const labelsList = sidebar.querySelector("#labels-list");

  // Save label handler
  if (saveLabelBtn && labelInput) {
    saveLabelBtn.onclick = function() {
      if (window.shapes && window.shapes.length && window.shapes.selectedShape) {
        window.shapes.selectedShape._label = labelInput.value.trim();
        updateLabelsList();
      }
    };
  }

  // Populate labels list
  function updateLabelsList() {
    if (!labelsList) return;
    labelsList.innerHTML = "";
    if (window.shapes && window.shapes.length) {
      window.shapes.forEach((shape, idx) => {
        const label = shape._label || "";
        const type = shape._type || "shape";
        const div = document.createElement("div");
        div.className = "shape-label-row";
        div.innerHTML = `
          <span class="shape-type">${type}</span>
          <input type="text" value="${label}" data-idx="${idx}" maxlength="40" class="label-input-row">
          <button type="button" class="label-save-btn" data-idx="${idx}">Save</button>
        `;
        labelsList.appendChild(div);
      });

      // Attach save handlers for each row
      const saveBtns = labelsList.querySelectorAll(".label-save-btn");
      saveBtns.forEach(btn => {
        btn.onclick = function(e) {
          const idx = Number(btn.getAttribute("data-idx"));
          const input = labelsList.querySelector(`.label-input-row[data-idx="${idx}"]`);
          if (window.shapes[idx] && input) {
            window.shapes[idx]._label = input.value.trim();
          }
        };
      });
    }
  }

  // Export for use elsewhere
  window.updateLabelsList = updateLabelsList;
  updateLabelsList();
}

if (typeof window !== "undefined") {
  window.setupSidebar = setupSidebar;
}

/**
 * shapes.part4.toolbar.js
 * Toolbar and tool selection for scene-designer
 * - Renders toolbar
 * - Handles tool selection and tool switching logic
 * - Integrates with Konva tool logic (part2b)
 */

function setupToolbar() {
  // Shape type dropdown
  const shapeType = document.getElementById("shapeType");
  if (shapeType) {
    shapeType.onchange = function (e) {
      if (window.currentTool !== undefined) {
        window.currentTool = e.target.value;
      }
      if (window.handleToolChange) window.handleToolChange();
    };
  }

  // Toolbar buttons
  const addBtn = document.getElementById("newBtn");
  if (addBtn) {
    addBtn.onclick = function () {
      if (window.addShapeHandler) window.addShapeHandler();
    };
  }
  const duplicateBtn = document.getElementById("duplicateBtn");
  if (duplicateBtn) {
    duplicateBtn.onclick = function () {
      if (window.duplicateShapeHandler) window.duplicateShapeHandler();
    };
  }
  const deleteBtn = document.getElementById("deleteBtn");
  if (deleteBtn) {
    deleteBtn.onclick = function () {
      if (window.deleteShapeHandler) window.deleteShapeHandler();
    };
  }

  // Color pickers (stroke/fill)
  const strokePickr = document.getElementById("strokePickr");
  const fillPickr = document.getElementById("fillPickr");
  if (strokePickr) {
    strokePickr.style.background = window.getSetting ? window.getSetting("defaultStrokeColor") : "#2176ff";
    strokePickr.onclick = function () {
      // Placeholder: open color picker dialog, or integrate Pickr lib if needed
      // For now, fallback to prompt
      const color = prompt("Enter stroke color (hex)", strokePickr.style.background);
      if (color) {
        strokePickr.style.background = color;
        if (window.saveSetting) window.saveSetting("defaultStrokeColor", color);
        if (window.redrawAllPoints) window.redrawAllPoints();
      }
    };
  }
  if (fillPickr) {
    fillPickr.style.background = window.getSetting ? window.getSetting("defaultFillColor") : "#e3eeff";
    fillPickr.onclick = function () {
      const color = prompt("Enter fill color (hex)", fillPickr.style.background);
      if (color) {
        fillPickr.style.background = color;
        if (window.saveSetting) window.saveSetting("defaultFillColor", color);
        if (window.redrawAllPoints) window.redrawAllPoints();
      }
    };
  }
}

if (typeof window !== "undefined") {
  window.setupToolbar = setupToolbar;
}
/**
 * shapes.part5.loupe.js
 * Loupe/magnifier feature for scene-designer
 * - Displays a magnifier lens over the canvas
 * - Handles zoom logic and drawing
 */

let loupeEnabled = false;
let loupeZoom = 3;
let loupeCanvas = null;
let loupeCtx = null;

function setupLoupe(containerId = "container") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Remove any old loupe
  const existing = document.getElementById("loupeCanvas");
  if (existing) existing.remove();

  loupeCanvas = document.createElement("canvas");
  loupeCanvas.id = "loupeCanvas";
  loupeCanvas.width = 160;
  loupeCanvas.height = 160;
  loupeCanvas.style.position = "absolute";
  loupeCanvas.style.pointerEvents = "none";
  loupeCanvas.style.border = "2px solid #2176ff";
  loupeCanvas.style.borderRadius = "50%";
  loupeCanvas.style.display = "none";
  loupeCanvas.style.zIndex = 10;

  container.appendChild(loupeCanvas);
  loupeCtx = loupeCanvas.getContext("2d");

  // Mouse events for loupe
  container.addEventListener("mousemove", loupeMouseMove);
  container.addEventListener("mouseleave", loupeMouseLeave);
}

function loupeMouseMove(e) {
  if (!loupeEnabled || !loupeCanvas || !window.stage) return;
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Position loupe near the cursor
  loupeCanvas.style.left = `${mx + 18}px`;
  loupeCanvas.style.top = `${my + 18}px`;
  loupeCanvas.style.display = "block";

  // Draw magnified area from Konva stage
  const stage = window.stage;
  const pixelRatio = window.devicePixelRatio || 1;
  const size = 160;
  const zoom = loupeZoom;
  loupeCtx.clearRect(0, 0, size, size);

  // Render stage to temp canvas, draw portion into loupe
  const dataURL = stage.toDataURL({
    x: mx - size / (2 * zoom),
    y: my - size / (2 * zoom),
    width: size / zoom,
    height: size / zoom,
    pixelRatio: zoom * pixelRatio
  });

  const img = new window.Image();
  img.onload = function () {
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    loupeCtx.closePath();
    loupeCtx.clip();
    loupeCtx.drawImage(img, 0, 0, size, size);
    loupeCtx.restore();
  };
  img.src = dataURL;
}

function loupeMouseLeave() {
  if (loupeCanvas) loupeCanvas.style.display = "none";
}

function loupeZoomHandler(zoomIn) {
  loupeZoom = Math.max(1, Math.min(8, loupeZoom + (zoomIn ? 1 : -1)));
}

if (typeof window !== "undefined") {
  window.setupLoupe = setupLoupe;
  window.loupeZoomHandler = loupeZoomHandler;
  window.loupeEnabled = loupeEnabled;
}
/**
 * shapes.part6.utils.js
 * Utility functions/helpers for scene-designer
 * - Common helpers for exporting/importing shapes, etc.
 * - Export: exportShapes, importShapes, helpers
 */

// Export shapes to JSON
function exportShapes() {
  if (!window.shapes) return "[]";
  return JSON.stringify(window.shapes.map(shape => {
    // Only basic shape properties (extend as needed)
    return {
      type: shape._type,
      x: shape.x(),
      y: shape.y(),
      ...(shape._type === "point" || shape._type === "circle"
        ? { radius: shape.radius() }
        : {}),
      ...(shape._type === "rect"
        ? { width: shape.width(), height: shape.height() }
        : {}),
      stroke: shape.stroke(),
      fill: shape.fill(),
      strokeWidth: shape.strokeWidth(),
      label: shape._label || ""
    };
  }), null, 2);
}

// Import shapes from JSON
function importShapes(json) {
  let arr = [];
  try {
    arr = JSON.parse(json);
  } catch (e) {
    alert("Import failed: Invalid JSON");
    return;
  }
  if (!Array.isArray(arr)) {
    alert("Import failed: Not a shape array");
    return;
  }
  if (!window.layer) return;
  window.layer.removeChildren();
  window.shapes.length = 0;
  arr.forEach(obj => {
    let shape;
    if (obj.type === "point" || obj.type === "circle") {
      shape = new Konva.Circle({
        x: obj.x,
        y: obj.y,
        radius: obj.radius || 12,
        stroke: obj.stroke || "#2176ff",
        fill: obj.fill || "#e3eeff",
        strokeWidth: obj.strokeWidth || 2,
        draggable: true,
        _type: obj.type
      });
    } else if (obj.type === "rect") {
      shape = new Konva.Rect({
        x: obj.x,
        y: obj.y,
        width: obj.width || 60,
        height: obj.height || 40,
        stroke: obj.stroke || "#2176ff",
        fill: obj.fill || "#e3eeff",
        strokeWidth: obj.strokeWidth || 2,
        draggable: true,
        _type: obj.type
      });
    }
    if (shape) {
      shape._label = obj.label || "";
      window.shapes.push(shape);
      window.layer.add(shape);
    }
  });
  window.layer.draw();
  if (window.updateLabelsList) window.updateLabelsList();
}

// Helpers
function exportShapesToJSON() {
  const data = exportShapes();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shapes.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}

function importShapesFromJSON(json) {
  importShapes(json);
}

function downloadCanvasAsPNG() {
  if (!window.stage) return;
  const dataURL = window.stage.toDataURL();
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "canvas.png";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 200);
}

if (typeof window !== "undefined") {
  window.exportShapes = exportShapes;
  window.importShapes = importShapes;
  window.exportShapesToJSON = exportShapesToJSON;
  window.importShapesFromJSON = importShapesFromJSON;
  window.downloadCanvasAsPNG = downloadCanvasAsPNG;
}
/**
 * shapes.part7.layout.js
 * Golden Layout setup and integration for Shape Editor app
 * - Registers Canvas and Sidebar panels as GL components
 * - Sets up initial layout config (Canvas | Sidebar)
 * - Canvas panel calls setupCanvasPanel and setupImageLoaderHandlers
 * - Sidebar panel calls setupSidebar
 */

function registerGoldenLayout() {
  const layoutConfig = {
    settings: {
      showPopoutIcon: false,
      showMaximiseIcon: false,
      showCloseIcon: false,
      hasHeaders: false
    },
    content: [{
      type: "row",
      content: [
        {
          type: "component",
          componentName: "CanvasPanel",
          title: "Canvas",
          width: 70
        },
        {
          type: "component",
          componentName: "SidebarPanel",
          title: "Sidebar",
          width: 30
        }
      ]
    }]
  };

  const layoutRoot = document.getElementById("main-layout");
  layoutRoot.innerHTML = ""; // Remove any static markup

  // GoldenLayout global from CDN
  const myLayout = new GoldenLayout(layoutConfig, layoutRoot);

  // Register Canvas Panel
  myLayout.registerComponent("CanvasPanel", function(container, state) {
    // Canvas template: #container and #errorBox
    container.getElement().html('<main id="canvas-area"><div id="container"></div><div id="errorBox"></div></main>');
    // Setup canvas logic (Konva, handlers)
    if (window.setupCanvasPanel) window.setupCanvasPanel("container", window.setupImageLoaderHandlers);
  });

  // Register Sidebar Panel
  myLayout.registerComponent("SidebarPanel", function(container, state) {
    // Sidebar template: label box + labels list
    container.getElement().html(`
      <aside id="sidebar">
        <div id="labelEditBox">
          <label for="labelInput">Label:</label>
          <input type="text" id="labelInput" maxlength="40">
          <button type="button" id="saveLabelBtn">Save</button>
        </div>
        <div id="labels-list"></div>
      </aside>
    `);
    if (window.setupSidebar) window.setupSidebar();
  });

  myLayout.init();
}

if (typeof window !== "undefined") {
  window.registerGoldenLayout = registerGoldenLayout;
}

/**
 * Setup entrypoint (called by shapes.js after DOMContentLoaded)
 */
document.addEventListener("DOMContentLoaded", () => {
  registerGoldenLayout();
});
