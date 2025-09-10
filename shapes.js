/*******************************************************
 * shapes.part1.settings.js
 * Part 1 of N for shapes.js modular build
 * 
 * Feature Area: Settings registry, settings panel UI and logic
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Logging helper with log levels (MUST BE FIRST!)
 *************************************/
window.LOG_LEVELS = window.LOG_LEVELS || { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };
function log(level, ...args) {
  const curLevel = window.LOG_LEVELS[getSetting("DEBUG_LOG_LEVEL") || "OFF"];
  const msgLevel = window.LOG_LEVELS[level];
  if (msgLevel && curLevel >= msgLevel) {
    console.log(`[${level}]`, ...args);
  }
}
function logEnter(fnName, ...args) {
  log("TRACE", `>> Enter ${fnName}`, ...args);
}
function logExit(fnName, ...result) {
  log("TRACE", `<< Exit ${fnName}`, ...result);
}

/*************************************
 * Settings Registry + Panel (collapsible, dynamic, now with Pickr color pickers)
 *************************************/
const settingsRegistry = [
  {
    key: "multiDragBox",
    label: "Show Multi-Drag Box",
    type: "boolean",
    default: true,
    onChange: val => { /* No global needed, just use getSetting everywhere */ }
  },
  {
    key: "defaultRectWidth",
    label: "Default Rectangle Width",
    type: "number",
    default: 50,
    min: 10,
    max: 300,
    step: 1
  },
  {
    key: "defaultRectHeight",
    label: "Default Rectangle Height",
    type: "number",
    default: 30,
    min: 10,
    max: 200,
    step: 1
  },
  {
    key: "defaultCircleRadius",
    label: "Default Circle Radius",
    type: "number",
    default: 15,
    min: 4,
    max: 100,
    step: 1
  },
  {
    key: "anchorRadius",
    label: "Drag Anchor Radius",
    type: "number",
    default: 8,
    min: 2,
    max: 32,
    step: 1,
    onChange: val => { window.anchorRadius = val; }
  },
  {
    key: "defaultStrokeColor",
    label: "Default Stroke Color",
    type: "pickr",
    default: "#000000"
  },
  {
    key: "defaultFillColor",
    label: "Default Fill Color",
    type: "pickr",
    default: "#00000000"
  },
  {
    key: "canvasMaxWidth",
    label: "Canvas Max Width (px)",
    type: "number",
    default: 430,
    min: 100,
    max: 4000,
    step: 10
  },
  {
    key: "canvasMaxHeight",
    label: "Canvas Max Height (px)",
    type: "number",
    default: 9999,
    min: 100,
    max: 4000,
    step: 10
  },
  {
    key: "canvasScaleMode",
    label: "Image Scale Mode",
    type: "select",
    options: [
      { value: "fit", label: "Fit (aspect ratio, max width)" },
      { value: "fill", label: "Fill (aspect ratio, max w/h, may crop)" },
      { value: "stretch", label: "Stretch (fill max w/h, ignore ratio)" },
      { value: "actual", label: "Actual Size (image pixels, scroll if too large)" }
    ],
    default: "fit"
  },
  {
    key: "canvasResponsive",
    label: "Responsive: Resize on Window Change",
    type: "boolean",
    default: true
  },
  {
    key: "pointHitRadius",
    label: "Point Hit Area Radius",
    type: "number",
    default: 16,
    min: 8,
    max: 50,
    step: 1
  },
  {
    key: "pointHaloRadius",
    label: "Point Halo (Circle) Radius",
    type: "number",
    default: 12,
    min: 4,
    max: 40,
    step: 1
  },
  {
    key: "pointCrossLen",
    label: "Point Crosshair Length",
    type: "number",
    default: 14,
    min: 4,
    max: 40,
    step: 1
  },
  {
    key: "loupeEnabled",
    label: "Loupe (Magnifier) Enabled",
    type: "boolean",
    default: true
  },
  {
    key: "loupeSize",
    label: "Loupe Diameter (px)",
    type: "number",
    default: 120,
    min: 60,
    max: 300,
    step: 2
  },
  {
    key: "loupeZoom",
    label: "Loupe Zoom Factor",
    type: "number",
    default: 2,
    min: 1,
    max: 8,
    step: 0.1
  },
  {
    key: "loupeFPS",
    label: "Loupe Max FPS",
    type: "number",
    default: 40,
    min: 10,
    max: 60,
    step: 1
  },
  {
    key: "loupeCrosshair",
    label: "Loupe Crosshair",
    type: "boolean",
    default: true
  },
  {
    key: "loupeShowOverlays",
    label: "Loupe Shows Overlays",
    type: "boolean",
    default: false
  },
  {
    key: "loupeOffsetX",
    label: "Loupe Manual X Offset (px)",
    type: "number",
    default: 0,
    min: -200,
    max: 200,
    step: 1
  },
  {
    key: "loupeOffsetY",
    label: "Loupe Manual Y Offset (px)",
    type: "number",
    default: 0,
    min: -200,
    max: 200,
    step: 1
  },
  {
    key: "DEBUG_LOG_LEVEL",
    label: "Debug: Log Level",
    type: "select",
    options: [
      { value: "OFF", label: "Off" },
      { value: "ERROR", label: "Error" },
      { value: "WARN", label: "Warning" },
      { value: "INFO", label: "Info" },
      { value: "DEBUG", label: "Debug" },
      { value: "TRACE", label: "Trace (very verbose)" }
    ],
    default: "OFF"
  }
];

let settings = {};
function getSetting(key) {
  return key in settings ? settings[key] : settingsRegistry.find(s => s.key === key)?.default;
}
function setSetting(key, value, triggerChange = true) {
  log("TRACE", "setSetting called", { key, value, triggerChange });
  settings[key] = value;
  if (triggerChange) {
    const reg = settingsRegistry.find(s => s.key === key);
    if (reg && typeof reg.onChange === "function") reg.onChange(value);
    if (['canvasMaxWidth', 'canvasMaxHeight', 'canvasScaleMode', 'canvasResponsive'].includes(key)) {
      if (window.updateCanvasToImage) updateCanvasToImage();
    }
    if (['pointHitRadius', 'pointHaloRadius', 'pointCrossLen'].includes(key)) {
      if (typeof window.redrawAllPoints === "function") window.redrawAllPoints();
    }
  }
}
window.getSetting = getSetting;
window.setSetting = setSetting;

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem("sceneEditorSettings") || "{}");
    for (const s of settingsRegistry) {
      setSetting(s.key, (s.key in stored) ? stored[s.key] : s.default, false);
      if (typeof s.onChange === "function") s.onChange(getSetting(s.key));
    }
  } catch (e) {
    log("ERROR", "loadSettings error", e);
  }
}
function saveSettings() {
  localStorage.setItem("sceneEditorSettings", JSON.stringify(settings));
}

/**
 * Build the settings panel DOM from registry.
 * Expects #settingsPanel to exist in the panel container.
 */
function buildSettingsPanel() {
  log("TRACE", "buildSettingsPanel called");
  const panel = document.getElementById("settingsPanel");
  if (!panel) return;
  panel.innerHTML = "";
  window._settingsPickrs = window._settingsPickrs || {};
  for (const s of settingsRegistry) {
    const field = document.createElement("div");
    field.className = "settings-field";
    const label = document.createElement("label");
    label.textContent = s.label;
    label.setAttribute("for", "setting-" + s.key);

    let input;
    if (s.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = getSetting(s.key);
      input.id = "setting-" + s.key;
      input.addEventListener("change", e => {
        setSetting(s.key, !!input.checked);
        saveSettings();
      });
      field.appendChild(label);
      field.appendChild(input);
    } else if (s.type === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.value = getSetting(s.key);
      input.min = s.min;
      input.max = s.max;
      input.step = s.step || 1;
      input.id = "setting-" + s.key;
      input.addEventListener("input", e => {
        let val = Number(input.value);
        if (isNaN(val)) val = s.default;
        setSetting(s.key, val);
        saveSettings();
      });
      field.appendChild(label);
      field.appendChild(input);
    } else if (s.type === "pickr") {
      const pickrDiv = document.createElement("div");
      pickrDiv.className = "pickr";
      pickrDiv.id = "setting-" + s.key + "-pickr";
      pickrDiv.style.display = "inline-block";
      pickrDiv.style.marginLeft = "0.5em";
      field.appendChild(label);
      field.appendChild(pickrDiv);
      setTimeout(() => {
        if (window._settingsPickrs[s.key]) {
          window._settingsPickrs[s.key].destroyAndRemove();
          delete window._settingsPickrs[s.key];
        }
        window._settingsPickrs[s.key] = Pickr.create({
          el: '#' + pickrDiv.id,
          theme: 'monolith',
          default: getSetting(s.key),
          components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, input: true } }
        });
        window._settingsPickrs[s.key].on('change', color => {
          setSetting(s.key, color.toHEXA().toString());
          saveSettings();
        });
        window._settingsPickrs[s.key].setColor(getSetting(s.key));
      }, 1);
    } else if (s.type === "select") {
      input = document.createElement("select");
      input.id = "setting-" + s.key;
      for (const opt of s.options) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        input.appendChild(o);
      }
      input.value = getSetting(s.key);
      input.addEventListener("change", e => {
        setSetting(s.key, input.value);
        saveSettings();
      });
      field.appendChild(label);
      field.appendChild(input);
    }
    panel.appendChild(field);
  }
}
/*******************************************************
 * shapes.part2a.konva.js
 * Part 2a of N for shapes.js modular build
 * 
 * Feature Area: Konva stage, layers, background image, and canvas resizing (A)
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Konva Stage & Layers Setup
 *************************************/
let stage = null;
let layer = null;
let highlightLayer = null;
let bgLayer = null;
let debugLayer = null;
let bgKonvaImage = null;
let bgImageObj = null;
let stageWidth = 1400;
let stageHeight = 1000;

/**
 * Sets up the main canvas panel with Konva and layers.
 * 
 * @param {Element} root - The root DOM element (or null for default)
 * @param {Function} onReady - Optional callback after canvas/layers are fully initialized
 */
function setupCanvasPanel(root, onReady) {
  // Find container element
  const el = root && root.querySelector ? root.querySelector("#canvas-panel") : document.getElementById("canvas-panel");
  if (!el) {
    log("ERROR", "No #canvas-panel found");
    return;
  }
  // Clear if exists
  el.innerHTML = "";

  // Stage and layers
  stage = new Konva.Stage({
    container: el,
    width: stageWidth,
    height: stageHeight
  });

  bgLayer = new Konva.Layer({ listening: false });
  layer = new Konva.Layer();
  highlightLayer = new Konva.Layer({ listening: false });
  debugLayer = new Konva.Layer({ listening: false });

  stage.add(bgLayer);
  stage.add(layer);
  stage.add(highlightLayer);
  stage.add(debugLayer);

  // For other modules
  window.stage = stage;
  window.layer = layer;
  window.bgLayer = bgLayer;
  window.highlightLayer = highlightLayer;
  window.debugLayer = debugLayer;

  // Callbacks for other systems (loupe, drag feedback)
  if (window.setupLoupeEvents) window.setupLoupeEvents();
  if (window.setupLockedDragFeedback) window.setupLockedDragFeedback();

  // If a callback is provided, call it after setup
  if (typeof onReady === "function") {
    onReady();
  }
}

/*************************************
 * Canvas/Image Size Management
 *************************************/
function updateCanvasToImage(imgW, imgH) {
  stageWidth = imgW;
  stageHeight = imgH;
  if (stage) stage.size({ width: stageWidth, height: stageHeight });
  // Resize all layers
  [bgLayer, layer, highlightLayer, debugLayer].forEach(l => {
    if (l) l.size({ width: stageWidth, height: stageHeight });
  });
}

/*************************************
 * Background Image Logic
 *************************************/
function setBackgroundImage(imgSrc) {
  logEnter("setBackgroundImage", { imgSrc });
  if (!bgLayer) {
    log("ERROR", "setBackgroundImage called before bgLayer is initialized");
    window.alert("Canvas not ready: please reload the page.");
    logExit("setBackgroundImage (no bgLayer)");
    return;
  }
  if (bgKonvaImage) {
    bgKonvaImage.destroy();
    bgKonvaImage = null;
    bgLayer.draw();
  }
  if (!imgSrc) {
    bgLayer.draw();
    logExit("setBackgroundImage (no imgSrc)");
    return;
  }
  const imageObj = new window.Image();
  imageObj.onload = function () {
    bgImageObj = imageObj;
    window.bgImageObj = bgImageObj;
    updateCanvasToImage(imageObj.naturalWidth, imageObj.naturalHeight);
    if (stage) stage.setSize({ width: stageWidth, height: stageHeight });
    bgKonvaImage = new Konva.Image({
      image: imageObj,
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight,
      listening: false
    });
    if (!bgLayer) {
      log("ERROR", "bgLayer missing at imageObj.onload");
      window.alert("Canvas not ready: please reload the page.");
      return;
    }
    bgLayer.add(bgKonvaImage);
    bgKonvaImage.moveToBottom();
    bgLayer.draw();
    logExit("setBackgroundImage (loaded)");
  };
  imageObj.onerror = function () {
    window.alert("Failed to load image: " + imgSrc);
    log("ERROR", "Failed to load image:", imgSrc);
  };
  imageObj.src = imgSrc;
}
window.setBackgroundImage = setBackgroundImage;

/*************************************
 * Exported for global access
 *************************************/
window.setupCanvasPanel = setupCanvasPanel;
window.updateCanvasToImage = updateCanvasToImage;

/*************************************
 * Logging Utility (minimal stub)
 *************************************/
function log(...args) {
  if (window.DEBUG) console.log("[shapes.js]", ...args);
}
function logEnter(fn, obj) {
  if (window.DEBUG) console.log("→", fn, obj || "");
}
function logExit(fn) {
  if (window.DEBUG) console.log("←", fn);
}
/*******************************************************
 * shapes.part6.utils.js
 * Part 6 of N for shapes.js modular build
 * 
 * Feature Area: Utility functions, general helpers, debug tools, and export/import logic
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Utility: Export/Import Shapes as JSON
 *************************************/
function exportShapesToJSON() {
  const data = shapes.map(s => ({
    type: s._type,
    label: s._label,
    attrs: s.getAttrs(),
    locked: !!s.locked
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shapes-export.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importShapesFromJSON(jsonStr) {
  logEnter("importShapesFromJSON");
  try {
    const arr = JSON.parse(jsonStr);
    layer.destroyChildren();
    shapes.length = 0;
    arr.forEach(obj => {
      let s;
      if (obj.type === "rect") {
        s = new Konva.Rect(obj.attrs);
      } else if (obj.type === "circle") {
        s = new Konva.Circle(obj.attrs);
      } else if (obj.type === "point") {
        s = new Konva.Circle(obj.attrs);
      }
      if (s) {
        s._type = obj.type;
        s._label = obj.label;
        s.locked = !!obj.locked;
        setupShapeEvents(s);
        shapes.push(s);
        layer.add(s);
      }
    });
    layer.draw();
    updateList();
  } catch (e) {
    window.alert("Failed to import shapes: " + e);
  }
  logExit("importShapesFromJSON");
}

/*************************************
 * Utility: Download PNG of current canvas
 *************************************/
function downloadCanvasAsPNG() {
  logEnter("downloadCanvasAsPNG");
  if (!stage) return;
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "scene.png";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
  logExit("downloadCanvasAsPNG");
}

/*************************************
 * Debug: Dump all shapes to console
 *************************************/
function debugDumpShapes() {
  logEnter("debugDumpShapes");
  console.log("Current shapes:", shapes.map(s => ({
    type: s._type,
    label: s._label,
    attrs: s.getAttrs(),
    locked: !!s.locked
  })));
  logExit("debugDumpShapes");
}

/*************************************
 * General Helper: Enable edit on shape from list
 *************************************/
function enableEdit(shape) {
  if (!shape) return;
  selectedShapes = [shape];
  updateSelectionHighlights();
  updateList();
}

/*************************************
 * Redraw all points (used by settings changes)
 *************************************/
function redrawAllPoints() {
  shapes.forEach(s => {
    if (s._type === "point") {
      s.radius(getSetting("pointHitRadius"));
      s.strokeWidth(2);
      s.fill(getSetting("defaultFillColor"));
      s.stroke(getSetting("defaultStrokeColor"));
    }
  });
  layer.batchDraw();
}
window.redrawAllPoints = redrawAllPoints;

/*************************************
 * Export/Import Buttons Setup
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const btnExport = document.getElementById("btnExportShapes");
  const btnImport = document.getElementById("btnImportShapes");
  const btnDownload = document.getElementById("btnDownloadPNG");
  if (btnExport) btnExport.onclick = exportShapesToJSON;
  if (btnImport) btnImport.onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.addEventListener('change', (e) => {
      if (!e.target.files.length) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        importShapesFromJSON(ev.target.result);
      };
      reader.readAsText(file);
    });
    fileInput.click();
  };
  if (btnDownload) btnDownload.onclick = downloadCanvasAsPNG;
});
/*******************************************************
 * shapes.part3.sidebar.js
 * Part 3 of N for shapes.js modular build
 * 
 * Feature Area: Sidebar, label UI, label editing, and shape list/table
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Sidebar/Label UI Setup
 *************************************/
let elSidebar = null;
function setupSidebarPanel(root) {
  elSidebar = root.querySelector('#sidebar');
  window.labelEditBox = elSidebar.querySelector('#labelEditBox');
  window.labelInput = elSidebar.querySelector('#labelInput');
  window.saveLabelBtn = elSidebar.querySelector('#saveLabelBtn');
  window.labelsList = elSidebar.querySelector('#labels-list');

  // Label save logic
  if (window.saveLabelBtn && window.labelInput) {
    saveLabelBtn.addEventListener("click", () => {
      if (selectedShapes.length === 1) {
        selectedShapes[0]._label = labelInput.value;
        updateList();
      }
    });
  }
}

/*************************************
 * Label UI, List UI, Label locking
 *************************************/
function updateLabelUI() {
  logEnter("updateLabelUI");
  if (selectedShapes.length === 1) {
    labelEditBox.style.display = 'flex';
    labelInput.disabled = false;
    saveLabelBtn.disabled = false;
    labelInput.value = selectedShapes[0]._label;
  } else {
    labelEditBox.style.display = 'none';
  }
  if (selectedShapes.length > 0) {
    const allLocked = selectedShapes.every(s => s.locked);
    const noneLocked = selectedShapes.every(s => !s.locked);
    lockCheckbox.indeterminate = !(allLocked || noneLocked);
    lockCheckbox.checked = allLocked;
  } else {
    lockCheckbox.indeterminate = false;
    lockCheckbox.checked = false;
  }
  logExit("updateLabelUI");
}

function updateList() {
  logEnter("updateList");
  let html = '<table class="coords-table"><tr><th>Label</th><th>Type</th><th>Fill</th><th>Line</th><th>x</th><th>y</th><th>w/r</th><th>h</th><th>Lock</th></tr>';
  shapes.forEach((s, i) => {
    const t = s._type;
    const lbl = s._label;
    const attrs = s.getAttrs();
    let x = 0, y = 0, w = 0, h = 0;
    if (t === 'rect') { x = attrs.x; y = attrs.y; w = attrs.width; h = attrs.height; }
    else if (t === 'circle') { x = attrs.x; y = attrs.y; w = h = attrs.radius; }
    else if (t === 'point') { x = attrs.x; y = attrs.y; w = h = "--"; }
    const isSelected = selectedShapes.includes(s);
    html += `<tr${isSelected ? ' class="selected"' : ''}>
      <td><span class="select-label" data-idx="${i}" style="color:#2176ff;cursor:pointer;text-decoration:underline;">${lbl}</span></td>
      <td>${t}</td>
      <td><span class="swatch fill-swatch" data-idx="${i}" title="Change fill color" style="background:${s.fill ? (s.fill() || 'transparent') : 'transparent'}"></span></td>
      <td><span class="swatch stroke-swatch" data-idx="${i}" title="Change line color" style="background:${s.stroke ? s.stroke() : ''}"></span></td>
      <td>${Math.round(x)}</td><td>${Math.round(y)}</td><td>${w}</td><td>${h}</td>
      <td>${s.locked ? '🔒' : ''}</td>
    </tr>`;
  });
  html += '</table>';
  labelsList.innerHTML = html;

  // Events for label/table interactions
  document.querySelectorAll('.select-label').forEach(el => {
    el.onclick = function () {
      const idx = parseInt(this.dataset.idx, 10);
      enableEdit(shapes[idx]);
    }
  });
  document.querySelectorAll('.fill-swatch').forEach(el => {
    el.onclick = function (e) {
      const idx = parseInt(this.dataset.idx, 10);
      enableEdit(shapes[idx]);
      setTimeout(() => fillPickr.show(), 50);
      e.stopPropagation();
    };
  });
  document.querySelectorAll('.stroke-swatch').forEach(el => {
    el.onclick = function (e) {
      const idx = parseInt(this.dataset.idx, 10);
      enableEdit(shapes[idx]);
      setTimeout(() => strokePickr.show(), 50);
      e.stopPropagation();
    };
  });
  updateLabelUI();
  logExit("updateList");
}

/*************************************
 * Lock checkbox handling: for single or multi selection
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lockCheckbox !== "undefined" && lockCheckbox) {
    lockCheckbox.addEventListener('change', () => {
      if (selectedShapes.length === 0) return;
      // If indeterminate, apply to all as per new state
      const newLocked = lockCheckbox.checked;
      selectedShapes.forEach(s => setShapeLocked(s, newLocked));
      updateList();
      updateLabelUI();
    });
  }
});
/*******************************************************
 * shapes.part4.toolbar.js
 * Part 4 of N for shapes.js modular build
 * 
 * Feature Area: Toolbar actions, shape creation, deletion, and general shape utilities
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Toolbar and shape creation logic
 *************************************/
function createRectangle(x = 50, y = 50, w = getSetting("defaultRectWidth"), h = getSetting("defaultRectHeight")) {
  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: w,
    height: h,
    fill: getSetting("defaultFillColor"),
    stroke: getSetting("defaultStrokeColor"),
    strokeWidth: 2,
    draggable: true,
    name: 'rect'
  });
  rect._type = 'rect';
  rect._label = `Rect ${shapes.length + 1}`;
  rect.locked = false;
  setupShapeEvents(rect);
  shapes.push(rect);
  layer.add(rect);
  layer.draw();
  updateList();
  return rect;
}

function createCircle(x = 120, y = 90, r = getSetting("defaultCircleRadius")) {
  const circ = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    fill: getSetting("defaultFillColor"),
    stroke: getSetting("defaultStrokeColor"),
    strokeWidth: 2,
    draggable: true,
    name: 'circle'
  });
  circ._type = 'circle';
  circ._label = `Circle ${shapes.length + 1}`;
  circ.locked = false;
  setupShapeEvents(circ);
  shapes.push(circ);
  layer.add(circ);
  layer.draw();
  updateList();
  return circ;
}

function createPoint(x = 80, y = 80) {
  const pt = new Konva.Circle({
    x: x,
    y: y,
    radius: getSetting("pointHitRadius"),
    fill: getSetting("defaultFillColor"),
    stroke: getSetting("defaultStrokeColor"),
    strokeWidth: 2,
    draggable: true,
    name: 'point'
  });
  pt._type = 'point';
  pt._label = `Point ${shapes.length + 1}`;
  pt.locked = false;
  setupShapeEvents(pt);
  shapes.push(pt);
  layer.add(pt);
  layer.draw();
  updateList();
  return pt;
}

function deleteSelectedShapes() {
  logEnter("deleteSelectedShapes");
  if (!selectedShapes.length) return;
  selectedShapes.forEach(s => {
    shapes = shapes.filter(obj => obj !== s);
    s.destroy();
  });
  selectedShapes = [];
  updateList();
  layer.draw();
  highlightLayer.draw();
  logExit("deleteSelectedShapes");
}

function setupToolbar() {
  logEnter("setupToolbar");
  const btnRect = document.getElementById("btnAddRect");
  const btnCircle = document.getElementById("btnAddCircle");
  const btnPoint = document.getElementById("btnAddPoint");
  const btnDelete = document.getElementById("btnDeleteShape");

  if (btnRect) btnRect.onclick = () => createRectangle();
  if (btnCircle) btnCircle.onclick = () => createCircle();
  if (btnPoint) btnPoint.onclick = () => createPoint();
  if (btnDelete) btnDelete.onclick = () => deleteSelectedShapes();

  logExit("setupToolbar");
}
document.addEventListener("DOMContentLoaded", setupToolbar);

/*************************************
 * Shape Events and Utility
 *************************************/
function setupShapeEvents(shape) {
  shape.on('mousedown touchstart', (e) => {
    if (e.evt && (e.evt.shiftKey || e.evt.ctrlKey)) {
      if (selectedShapes.includes(shape)) {
        selectedShapes = selectedShapes.filter(s => s !== shape);
      } else {
        selectedShapes.push(shape);
      }
    } else {
      selectedShapes = [shape];
    }
    updateSelectionHighlights();
    updateList();
  });
  shape.on('dragmove', (e) => {
    updateSelectionHighlights();
    updateList();
  });
  shape.on('mouseenter', () => {
    document.body.style.cursor = 'pointer';
  });
  shape.on('mouseleave', () => {
    document.body.style.cursor = '';
  });
  // Lock logic (for completeness; can be extended)
  shape.on('dragstart', (e) => {
    if (shape.locked) {
      shape.stopDrag();
      showLockedHighlightForShapes([shape]);
    }
  });
}

/*************************************
 * Lock Shape Utility
 *************************************/
function setShapeLocked(shape, locked) {
  shape.locked = locked;
  shape.draggable(!locked);
  updateList();
}

/*******************************************************
 * shapes.part5.loupe.js
 * Part 5 of N for shapes.js modular build
 * 
 * Feature Area: Loupe (magnifier) logic, loupe UI management, loupe rendering
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Loupe (Magnifier) Feature
 *************************************/

// Loupe state and settings
let loupeCanvas = null;
let loupeCtx = null;
let loupeVisible = false;
let loupeLastX = 0, loupeLastY = 0;
let loupeRAF = null;

// Loupe DOM creation and setup
function setupLoupe() {
  logEnter("setupLoupe");
  loupeCanvas = document.getElementById("loupeCanvas");
  if (!loupeCanvas) {
    loupeCanvas = document.createElement("canvas");
    loupeCanvas.id = "loupeCanvas";
    loupeCanvas.style.position = "absolute";
    loupeCanvas.style.display = "none";
    loupeCanvas.style.zIndex = 1000;
    document.body.appendChild(loupeCanvas);
  }
  loupeCtx = loupeCanvas.getContext("2d");
  loupeVisible = false;
  logExit("setupLoupe");
}

// Loupe show/hide logic
function showLoupe(x, y) {
  logEnter("showLoupe", { x, y });
  loupeVisible = true;
  loupeLastX = x;
  loupeLastY = y;
  loupeCanvas.style.display = "block";
  updateLoupePosition(x, y);
  if (!loupeRAF) loupeRAF = requestAnimationFrame(drawLoupe);
  logExit("showLoupe");
}
function hideLoupe() {
  loupeVisible = false;
  loupeCanvas.style.display = "none";
  if (loupeRAF) cancelAnimationFrame(loupeRAF);
  loupeRAF = null;
}

// Update loupe position (so it doesn't cover the cursor)
function updateLoupePosition(x, y) {
  const size = getSetting("loupeSize");
  const offsetX = getSetting("loupeOffsetX");
  const offsetY = getSetting("loupeOffsetY");
  loupeCanvas.width = size;
  loupeCanvas.height = size;
  loupeCanvas.style.width = size + "px";
  loupeCanvas.style.height = size + "px";
  loupeCanvas.style.left = (x + 30 + offsetX) + "px";
  loupeCanvas.style.top = (y - size / 2 + offsetY) + "px";
}

// Loupe drawing logic (copies a region of the stage canvas, scales it up)
function drawLoupe() {
  if (!loupeVisible || !stage) return;
  const size = getSetting("loupeSize");
  const zoom = getSetting("loupeZoom");
  const fps = getSetting("loupeFPS");
  const showCrosshair = getSetting("loupeCrosshair");
  loupeCanvas.width = size;
  loupeCanvas.height = size;
  const stageCanvas = stage.content.getElementsByTagName('canvas')[0];
  const scale = zoom;
  const sx = Math.max(0, loupeLastX - size / (2 * scale));
  const sy = Math.max(0, loupeLastY - size / (2 * scale));
  const sw = size / scale;
  const sh = size / scale;

  loupeCtx.clearRect(0, 0, size, size);
  loupeCtx.save();
  loupeCtx.beginPath();
  loupeCtx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
  loupeCtx.closePath();
  loupeCtx.clip();

  // Draw zoomed region from stage canvas into loupe
  loupeCtx.drawImage(stageCanvas, sx, sy, sw, sh, 0, 0, size, size);

  if (showCrosshair) {
    loupeCtx.strokeStyle = "#2176ff";
    loupeCtx.lineWidth = 1.2;
    loupeCtx.beginPath();
    loupeCtx.moveTo(size / 2, 0);
    loupeCtx.lineTo(size / 2, size);
    loupeCtx.moveTo(0, size / 2);
    loupeCtx.lineTo(size, size / 2);
    loupeCtx.stroke();
  }
  loupeCtx.restore();

  if (loupeVisible) {
    loupeRAF = setTimeout(() => requestAnimationFrame(drawLoupe), 1000 / fps);
  }
}

// Loupe event handlers
function handleLoupeMouseMove(e) {
  if (!getSetting("loupeEnabled")) return;
  const rect = stage.content.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  showLoupe(x, y);
}
function handleLoupeMouseOut() {
  hideLoupe();
}

// Loupe panel setup (to be called after stage exists)
function setupLoupeEvents() {
  if (!stage) return;
  stage.content.addEventListener("mousemove", handleLoupeMouseMove);
  stage.content.addEventListener("mouseout", handleLoupeMouseOut);
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  setupLoupe();
  if (typeof stage !== "undefined") setupLoupeEvents();
});

/*******************************************************
 * shapes.part6.utils.js
 * Part 6 of N for shapes.js modular build
 * 
 * Feature Area: Utility functions, general helpers, debug tools, and export/import logic
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Image Upload/Server Image Loader
 * (Now called after Canvas panel is ready)
 *************************************/
function setupImageLoaderHandlers() {
  // Server image dropdown
  const serverSelect = document.getElementById("serverImageSelect");
  if (serverSelect) {
    serverSelect.onchange = function () {
      if (serverSelect.value) setBackgroundImage("images/" + serverSelect.value);
    };
  }
  // File input
  const fileInput = document.getElementById("imageUpload");
  if (fileInput) {
    fileInput.onchange = function (e) {
      if (!e.target.files.length) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = function (ev) {
        setBackgroundImage(ev.target.result);
      };
      reader.readAsDataURL(file);
    };
  }
}

/*************************************
 * Export/Import Shapes as JSON
 *************************************/
function exportShapesToJSON() {
  const data = shapes.map(s => ({
    type: s._type,
    label: s._label,
    attrs: s.getAttrs(),
    locked: !!s.locked
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shapes-export.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importShapesFromJSON(jsonStr) {
  logEnter("importShapesFromJSON");
  try {
    const arr = JSON.parse(jsonStr);
    layer.destroyChildren();
    shapes.length = 0;
    arr.forEach(obj => {
      let s;
      if (obj.type === "rect") {
        s = new Konva.Rect(obj.attrs);
      } else if (obj.type === "circle") {
        s = new Konva.Circle(obj.attrs);
      } else if (obj.type === "point") {
        s = new Konva.Circle(obj.attrs);
      }
      if (s) {
        s._type = obj.type;
        s._label = obj.label;
        s.locked = !!obj.locked;
        setupShapeEvents(s);
        shapes.push(s);
        layer.add(s);
      }
    });
    layer.draw();
    updateList();
  } catch (e) {
    window.alert("Failed to import shapes: " + e);
  }
  logExit("importShapesFromJSON");
}

/*************************************
 * Download PNG of current canvas
 *************************************/
function downloadCanvasAsPNG() {
  logEnter("downloadCanvasAsPNG");
  if (!stage) return;
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "scene.png";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
  logExit("downloadCanvasAsPNG");
}

/*************************************
 * Debug: Dump all shapes to console
 *************************************/
function debugDumpShapes() {
  logEnter("debugDumpShapes");
  console.log("Current shapes:", shapes.map(s => ({
    type: s._type,
    label: s._label,
    attrs: s.getAttrs(),
    locked: !!s.locked
  })));
  logExit("debugDumpShapes");
}

/*************************************
 * General Helper: Enable edit on shape from list
 *************************************/
function enableEdit(shape) {
  if (!shape) return;
  selectedShapes = [shape];
  updateSelectionHighlights();
  updateList();
}

/*************************************
 * Redraw all points (used by settings changes)
 *************************************/
function redrawAllPoints() {
  shapes.forEach(s => {
    if (s._type === "point") {
      s.radius(getSetting("pointHitRadius"));
      s.strokeWidth(2);
      s.fill(getSetting("defaultFillColor"));
      s.stroke(getSetting("defaultStrokeColor"));
    }
  });
  layer.batchDraw();
}
window.redrawAllPoints = redrawAllPoints;

/*************************************
 * Export/Import Buttons Setup
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const btnExport = document.getElementById("btnExportShapes");
  const btnImport = document.getElementById("btnImportShapes");
  const btnDownload = document.getElementById("btnDownloadPNG");
  if (btnExport) btnExport.onclick = exportShapesToJSON;
  if (btnImport) btnImport.onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.addEventListener('change', (e) => {
      if (!e.target.files.length) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        importShapesFromJSON(ev.target.result);
      };
      reader.readAsText(file);
    });
    fileInput.click();
  };
  if (btnDownload) btnDownload.onclick = downloadCanvasAsPNG;
});
| Part | Filename                  | Description                                      | Key Features / Responsibilities              | Main Functions/Classes (or Exports)      | Keywords/Notes                | See Also                  |
|------|---------------------------|--------------------------------------------------|----------------------------------------------|------------------------------------------|-------------------------------|---------------------------|
| 1    | shapes.part1.settings.js  | App settings and config management               | Settings loading, user prefs                 | setupSettingsPanel                       | settings, config              |                           |
| 2a   | shapes.part2a.konva.js    | Konva stage and layer setup                      | Stage init, main drawing surface             | konvaStageInit, createKonvaStage         | konva, stage, canvas          | part2b.konva.js           |
| 2b   | shapes.part2b.konva.js    | Konva shapes/tools/extensions                    | Shape tool setup, drawing logic              | setupShapeTools, addShapeHandlers        | shape, tool, konva            | part2a.konva.js           |
| 3    | shapes.part3.sidebar.js   | Sidebar UI: component layout & events            | Sidebar rendering, events                    | setupSidebar, sidebarEventHandlers       | sidebar, ui                   |                           |
| 4    | shapes.part4.toolbar.js   | Toolbar and tool selection                       | Toolbar rendering, tool switching            | setupToolbar, handleToolChange           | toolbar, tools                |                           |
| 5    | shapes.part5.loupe.js     | Loupe/magnifier feature                          | Magnifier display, zoom logic                | setupLoupe, loupeZoomHandler             | loupe, zoom                   |                           |
| 6    | shapes.part6.utils.js     | Utility functions/helpers                        | Common helpers, export/import                | exportShapes, importShapes, helpers      | utils, helpers                |                           |
| 7    | shapes.part7.layout.js    | Golden Layout setup & integration                | GoldenLayout config/registration, Canvas/Sidebar panel setup, Canvas panel calls setupCanvasPanel and setupImageLoaderHandlers | registerGoldenLayout, setupCanvasPanel, setupImageLoaderHandlers | goldenlayout, layout, canvas | part2a.konva.js, part2b.konva.js |
