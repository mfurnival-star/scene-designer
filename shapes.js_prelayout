// --- START OF PART 1 OF 6 ---

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
      {value: "fit", label: "Fit (aspect ratio, max width)"},
      {value: "fill", label: "Fill (aspect ratio, max w/h, may crop)"},
      {value: "stretch", label: "Stretch (fill max w/h, ignore ratio)"},
      {value: "actual", label: "Actual Size (image pixels, scroll if too large)"}
    ],
    default: "fit"
  },
  {
    key: "canvasResponsive",
    label: "Responsive: Resize on Window Change",
    type: "boolean",
    default: true
  },
  // --- Added settings for Point shape hit area and visuals ---
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
  // --- LOUPE SETTINGS ---
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
  // --- LOUPE OFFSET SETTINGS (NEW) ---
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
  // --- LOGGING SETTINGS ---
  {
    key: "DEBUG_LOG_LEVEL",
    label: "Debug: Log Level",
    type: "select",
    options: [
      {value: "OFF", label: "Off"},
      {value: "ERROR", label: "Error"},
      {value: "WARN", label: "Warning"},
      {value: "INFO", label: "Info"},
      {value: "DEBUG", label: "Debug"},
      {value: "TRACE", label: "Trace (very verbose)"}
    ],
    default: "OFF"
  }
];

let settings = {};
function getSetting(key) {
  //log("TRACE", "getSetting called", {key, result: (key in settings ? settings[key] : settingsRegistry.find(s => s.key === key)?.default)});
  return key in settings ? settings[key] : settingsRegistry.find(s => s.key === key)?.default;
}
function setSetting(key, value, triggerChange = true) {
  log("TRACE", "setSetting called", {key, value, triggerChange});
  settings[key] = value;
  if (triggerChange) {
    const reg = settingsRegistry.find(s => s.key === key);
    if (reg && typeof reg.onChange === "function") reg.onChange(value);
    if(['canvasMaxWidth','canvasMaxHeight','canvasScaleMode','canvasResponsive'].includes(key)) {
      updateCanvasToImage();
    }
    // Redraw all points if their style/hit settings changed
    if(['pointHitRadius','pointHaloRadius','pointCrossLen'].includes(key)) {
      if (typeof redrawAllPoints === "function") redrawAllPoints();
    }
  }
}

window.getSetting = getSetting;
window.setSetting = setSetting;

function loadSettings() {
  log("TRACE", "loadSettings called");
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
  log("TRACE", "saveSettings called");
  localStorage.setItem("sceneEditorSettings", JSON.stringify(settings));
}

function buildSettingsPanel() {
  log("TRACE", "buildSettingsPanel called");
  const panel = document.getElementById("settingsPanel");
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
      setTimeout(()=>{
        if(window._settingsPickrs[s.key]) {
          window._settingsPickrs[s.key].destroyAndRemove();
          delete window._settingsPickrs[s.key];
        }
        window._settingsPickrs[s.key] = Pickr.create({
          el: '#' + pickrDiv.id,
          theme: 'monolith',
          default: getSetting(s.key),
          components: {preview:true, opacity:true, hue:true, interaction:{hex:true, rgba:true, input:true}}
        });
        window._settingsPickrs[s.key].on('change', color=>{
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

// --- END OF PART 1 OF 6 ---
// --- START OF PART 2 OF 6 ---

/*************************************
 * Console log interception to errorBox, with levels
 *************************************/
(function interceptConsoleLogs() {
  // Do not call log() here! It may not be defined yet if script order changes.
  return;
  if (window._consoleIntercepted) return;
  window._consoleIntercepted = true;
  const errorBox = document.getElementById('errorBox');
  if (!errorBox) return;

  function formatArg(arg) {
    if (typeof arg === "undefined") return "undefined";
    if (arg === null) return "null";
    if (typeof arg === "object") {
      try {
        return JSON.stringify(arg, null, 1);
      } catch {
        return "[object]";
      }
    }
    return String(arg);
  }

  function appendLog(msg, type) {
    let color = "#444";
    if (type === "warn") color = "#a60";
    if (type === "error") color = "#a22d13";
    const time = (new Date).toLocaleTimeString();
    const div = document.createElement("div");
    div.style.whiteSpace = "pre-wrap";
    div.style.color = color;
    div.textContent = `[${time}] ${msg}`;
    errorBox.appendChild(div);
    errorBox.scrollTop = errorBox.scrollHeight;
    // also keep errorBox to last 100 lines
    while (errorBox.children.length > 100) {
      errorBox.removeChild(errorBox.firstChild);
    }
  }

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = function(...args) {
    origLog.apply(console, args);
    appendLog(args.map(formatArg).join(' '), "log");
  };
  console.warn = function(...args) {
    origWarn.apply(console, args);
    appendLog(args.map(formatArg).join(' '), "warn");
  };
  console.error = function(...args) {
    origError.apply(console, args);
    appendLog(args.map(formatArg).join(' '), "error");
  };
})();

/*************************************
 * Stage & layers, global variables
 *************************************/
let stageWidth = 320, stageHeight = 260;
let stage, layer, bgLayer, highlightLayer, debugLayer;
let shapes = [], selectedShape = null, transformer = null;
let selectedShapes = [];
let marqueeRect = null, marqueeStart = null;
let bgImageObj = null, bgKonvaImage = null;

/*************************************
 * Robust DOM and UI initialization
 *************************************/
document.addEventListener("DOMContentLoaded", ()=>{
  logEnter("DOMContentLoaded: Robust DOM and UI initialization");
  // Toolbar/label/controls
  window.shapeTypeSelect = document.getElementById('shapeType');
  window.newBtn = document.getElementById('newBtn');
  window.deleteBtn = document.getElementById('deleteBtn');
  window.resetRotationBtn = document.getElementById('resetRotationBtn');
  window.selectAllBtn = document.getElementById('selectAllBtn');
  window.alignSelect = document.getElementById('alignSelect');
  window.labelInput = document.getElementById('labelInput');
  window.labelEditBox = document.getElementById('labelEditBox');
  window.lockCheckbox = document.getElementById('lockCheckbox');
  window.saveLabelBtn = document.getElementById('saveLabelBtn');
  window.labelsList = document.getElementById('labels-list');

  // Duplicate button robust pattern
  let duplicateBtn = document.getElementById("duplicateBtn");
  if (!duplicateBtn) {
    duplicateBtn = document.createElement('button');
    duplicateBtn.type = "button";
    duplicateBtn.id = "duplicateBtn";
    duplicateBtn.title = "Duplicate selected shape(s)";
    duplicateBtn.innerText = "Duplicate";
    duplicateBtn.style.marginLeft = "0.3em";
    const toolbarGroups = document.querySelectorAll('.toolbar-group');
    if(toolbarGroups.length >= 3) {
      toolbarGroups[2].appendChild(duplicateBtn);
    }
  }
  window.duplicateBtn = duplicateBtn;

  // Add Point, Rectangle and Circle to shape type dropdown
  if (shapeTypeSelect) {
    shapeTypeSelect.innerHTML = `
      <option value="point">Point</option>
      <option value="rect">Rectangle</option>
      <option value="circle">Circle</option>
    `;
  }

  // Stage and layers
  if (stage) stage.destroy();
  stage = new Konva.Stage({ container: 'container', width: stageWidth, height: stageHeight });
  window.stage = stage;
  layer = new Konva.Layer();
  stage.add(layer);
  bgLayer = new Konva.Layer();
  stage.add(bgLayer);
  bgLayer.moveToBottom();
  highlightLayer = new Konva.Layer();
  stage.add(highlightLayer);
  debugLayer = new Konva.Layer();
  stage.add(debugLayer);
  shapes = [];
  selectedShape = null;
  transformer = null;
  selectedShapes = [];
  marqueeRect = null;
  marqueeStart = null;

  // --- ADDED: Unselect shapes by clicking on empty background ---
  stage.on("mousedown.unselect touchstart.unselect", function(e) {
    if (e.target === stage) {
      disableEdit();
    }
  });

  // --- ADDED: Unselect shapes by pressing Esc ---
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      disableEdit();
    }
  });

  // --- SETTINGS PANEL COLLAPSIBLE LOGIC ---
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsPanelToggle = document.getElementById("settingsPanelToggle");
  const settingsPanelChevron = document.getElementById("settingsPanelChevron");
  // Panel is open by default
  if (settingsPanel && settingsPanelToggle) {
    settingsPanel.classList.add("open");
    settingsPanelToggle.addEventListener("click", () => {
      const isNowOpen = settingsPanel.classList.toggle("open");
      // Chevron: right ("▶", Unicode 25B6) when closed, left ("◀", 25C0) when open
      settingsPanelChevron.innerHTML = isNowOpen ? "&#x25B6;" : "&#x25C0;";
    });
  }

  // --- LABEL SAVE LOGIC ---
  if (window.saveLabelBtn && window.labelInput) {
    saveLabelBtn.addEventListener("click", () => {
      if (selectedShapes.length === 1) {
        selectedShapes[0]._label = labelInput.value;
        updateList();
      }
    });
  }

  // --- RESPONSIVE #container SIZING LOGIC ---
  function adjustContainerSize() {
    const container = document.getElementById("container");
    if (!container || !window.stage) return;
    // Use the actual stage dimensions
    container.style.width = window.stage.width() + "px";
    container.style.height = window.stage.height() + "px";
  }
  // Call after canvas/image changes
  window.adjustContainerSize = adjustContainerSize;
  if (window.stage) adjustContainerSize();

  // Patch your updateCanvasToImage to call adjustContainerSize after resizing:
  if (typeof window.updateCanvasToImage === "function") {
    const origUpdateCanvasToImage = window.updateCanvasToImage;
    window.updateCanvasToImage = function(...args) {
      const result = origUpdateCanvasToImage.apply(this, args);
      setTimeout(adjustContainerSize, 5);
      return result;
    };
  }

  // Also call adjustContainerSize whenever the window resizes (in case of responsive canvas)
  window.addEventListener("resize", adjustContainerSize);

  // Call adjustContainerSize after image loads if needed (for phone screenshots, etc)
  // If you have your own image load logic, make sure to call window.adjustContainerSize() after image load as well!

  logExit("DOMContentLoaded: Robust DOM and UI initialization");
});

// --- END OF PART 2 OF 6 ---
// --- START OF PART 3 OF 6 ---

/*************************************
 * Responsive image/canvas scaling
 *************************************/
function updateCanvasToImage(imgNaturalW, imgNaturalH) {
  logEnter("updateCanvasToImage", {imgNaturalW, imgNaturalH});
  const container = document.getElementById('container');
  if ((!bgImageObj && !imgNaturalW) || !container) {
    stageWidth = getSetting("canvasMaxWidth");
    stageHeight = Math.round(stageWidth * 0.81);
    if (stage) {
      stage.width(stageWidth);
      stage.height(stageHeight);
    }
    if (container) {
      container.style.width = stageWidth + "px";
      container.style.height = stageHeight + "px";
    }
    logExit("updateCanvasToImage (no image)");
    return;
  }
  const maxW = getSetting("canvasMaxWidth");
  const maxH = getSetting("canvasMaxHeight");
  const scaleMode = getSetting("canvasScaleMode");
  let imgW = imgNaturalW || bgImageObj.naturalWidth || bgImageObj.width;
  let imgH = imgNaturalH || bgImageObj.naturalHeight || bgImageObj.height;
  let newW = imgW, newH = imgH;
  if (scaleMode === "fit") {
    const scale = Math.min(maxW / imgW, 1);
    newW = Math.round(imgW * scale);
    newH = Math.round(imgH * scale);
  } else if (scaleMode === "fill") {
    const scale = Math.max(maxW / imgW, maxH / imgH, 1);
    newW = Math.round(imgW * scale);
    newH = Math.round(imgH * scale);
    if (newW > maxW) { newW = maxW; newH = Math.round(imgH * (maxW / imgW)); }
    if (newH > maxH) { newH = maxH; newW = Math.round(imgW * (maxH / imgH)); }
  } else if (scaleMode === "stretch") {
    newW = maxW;
    newH = maxH;
  } else if (scaleMode === "actual") {
    newW = imgW;
    newH = imgH;
  }
  stageWidth = newW;
  stageHeight = newH;
  if (stage) {
    stage.width(stageWidth);
    stage.height(stageHeight);
  }
  if (container) {
    container.style.width = stageWidth + "px";
    container.style.height = stageHeight + "px";
  }
  if (bgKonvaImage) {
    bgKonvaImage.width(stageWidth);
    bgKonvaImage.height(stageHeight);
    bgKonvaImage.x(0);
    bgKonvaImage.y(0);
    bgLayer.batchDraw();
  }
  logExit("updateCanvasToImage");
}
function responsiveResize() {
  logEnter("responsiveResize");
  if (!getSetting("canvasResponsive")) {
    logExit("responsiveResize (not responsive)");
    return;
  }
  if (bgImageObj)
    updateCanvasToImage(bgImageObj.naturalWidth, bgImageObj.naturalHeight);
  else
    updateCanvasToImage();
  logExit("responsiveResize");
}
window.addEventListener("resize", responsiveResize);

/*************************************
 * Image loader UI
 *************************************/
document.addEventListener("DOMContentLoaded", ()=>{
  logEnter("DOMContentLoaded: Image loader UI");
  const imageUpload = document.getElementById('imageUpload');
  const serverImageSelect = document.getElementById('serverImageSelect');
  function setBackgroundImage(imgSrc) {
    logEnter("setBackgroundImage", {imgSrc});
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
    imageObj.onload = function() {
      bgImageObj = imageObj;
      window.bgImageObj = bgImageObj;
      updateCanvasToImage(imageObj.naturalWidth, imageObj.naturalHeight);
      if (stage) stage.setSize({width: stageWidth, height: stageHeight});
      bgKonvaImage = new Konva.Image({
        image: imageObj,
        x: 0,
        y: 0,
        width: stageWidth,
        height: stageHeight,
        listening: false
      });
      bgLayer.add(bgKonvaImage);
      bgKonvaImage.moveToBottom();
      bgLayer.draw();
      logExit("setBackgroundImage (loaded)");
    };
    imageObj.onerror = function() {
      window.alert("Failed to load image: " + imgSrc);
      log("ERROR", "Failed to load image:", imgSrc);
    };
    imageObj.src = imgSrc;
  }
  window.setBackgroundImage = setBackgroundImage;
  if (imageUpload) {
    imageUpload.addEventListener('change', function(e) {
      log("TRACE", "imageUpload changed", e);
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        setBackgroundImage(ev.target.result);
        serverImageSelect.value = "";
      };
      reader.readAsDataURL(file);
    });
  }
  if (serverImageSelect) {
    serverImageSelect.addEventListener('change', function(e) {
      log("TRACE", "serverImageSelect changed", e);
      const filename = e.target.value;
      if (!filename) {
        setBackgroundImage(null);
        return;
      }
      setBackgroundImage('./images/' + filename);
      imageUpload.value = "";
    });
  }
  logExit("DOMContentLoaded: Image loader UI");
});

/*************************************
 * Selection highlight and multi-drag support (option 2: locked shapes red, others blue)
 *************************************/
window._lockedDragAttempt = false;
let selectionHighlightShapes = [];
let _lockedDragAttemptedIDs = [];

// --- UPDATED: Only show highlight if more than one shape is selected ---
function updateSelectionHighlights() {
  logEnter("updateSelectionHighlights");
  selectionHighlightShapes.forEach(h => h.destroy());
  selectionHighlightShapes = [];

  // Only show highlight if more than one shape is selected
  if (selectedShapes.length === 0 || selectedShapes.length === 1) {
    highlightLayer.draw();
    logExit("updateSelectionHighlights (none or single selected)");
    return;
  }

  selectedShapes.forEach(shape => {
    let highlight, group = new Konva.Group(), pad = 6;
    let color = "#2176ff";
    if (_lockedDragAttemptedIDs.includes(shape._id)) color = "#e53935";
    if (shape._type === 'rect') {
      highlight = new Konva.Rect({
        x: shape.x() - pad / 2,
        y: shape.y() - pad / 2,
        width: shape.width() + pad,
        height: shape.height() + pad,
        stroke: color,
        strokeWidth: 2.5,
        dash: [7, 4],
        listening: false,
        cornerRadius: 6,
        offsetX: shape.offsetX(),
        offsetY: shape.offsetY(),
        rotation: shape.rotation()
      });
    } else if (shape._type === 'circle') {
      highlight = new Konva.Circle({
        x: shape.x(),
        y: shape.y(),
        radius: shape.radius() + pad,
        stroke: color,
        strokeWidth: 2.5,
        dash: [7, 4],
        listening: false
      });
    } else if (shape._type === 'point') {
      highlight = new Konva.Circle({
        x: shape.x(),
        y: shape.y(),
        radius: 15,
        stroke: color,
        strokeWidth: 2.5,
        dash: [7, 4],
        listening: false
      });
    }
    if (highlight) {
      group.add(highlight);
      highlightLayer.add(group);
      selectionHighlightShapes.push(group);
    }
  });
  highlightLayer.batchDraw();
  logExit("updateSelectionHighlights");
}

function showLockedHighlightForShapes(shapesArr) {
  logEnter("showLockedHighlightForShapes", {shapesArr});
  _lockedDragAttemptedIDs = shapesArr.map(s => s._id);
  updateSelectionHighlights();
  setTimeout(() => {
    _lockedDragAttemptedIDs = [];
    updateSelectionHighlights();
  }, 1000);
  logExit("showLockedHighlightForShapes");
}

function setupLockedDragFeedback() {
  logEnter("setupLockedDragFeedback");
  stage.on('dragstart.locked', (evt) => {
    const shape = evt.target;
    if (!shape || !shape._type) return;
    if (selectedShapes.length === 1 && shape.locked) {
      showLockedHighlightForShapes([shape]);
      shape.stopDrag();
    }
    else if (selectedShapes.length > 1 && selectedShapes.some(s => s.locked)) {
      let lockedShapes = selectedShapes.filter(s => s.locked);
      showLockedHighlightForShapes(lockedShapes);
      shape.stopDrag();
    }
  });
  logExit("setupLockedDragFeedback");
}
document.addEventListener("DOMContentLoaded", setupLockedDragFeedback);

// --- END OF PART 3 OF 6 ---
// --- START OF PART 4 OF 6 ---

// Multi-drag logic
let multiDrag = {
  moving: false,
  dragOrigin: null,
  origPositions: null
};
let debugMultiDragBox = null;

// --- MARQUEE (BOX) SELECTION STATE ---
// marqueeRect and marqueeStart are declared as globals in PART 2

function getMultiSelectionBounds(origPositions, dx = 0, dy = 0) {
  // Use true transformed bounds (including rotation) for all shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  origPositions.forEach(obj => {
    const origShape = obj.shape;
    let clone;
    if (origShape._type === "rect") {
      clone = new Konva.Rect({
        x: obj.x + dx,
        y: obj.y + dy,
        width: origShape.width(),
        height: origShape.height(),
        rotation: origShape.rotation(),
        scaleX: origShape.scaleX(),
        scaleY: origShape.scaleY()
      });
    } else if (origShape._type === "circle") {
      clone = new Konva.Circle({
        x: obj.x + dx,
        y: obj.y + dy,
        radius: origShape.radius(),
        rotation: origShape.rotation(),
        scaleX: origShape.scaleX(),
        scaleY: origShape.scaleY()
      });
    } else if (origShape._type === "point") {
      clone = origShape.clone({ x: obj.x + dx, y: obj.y + dy });
    }
    const rect = clone.getClientRect();
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  });
  return {minX, minY, maxX, maxY};
}
function clampMultiDragDelta(dx, dy, origPositions) {
  logEnter("clampMultiDragDelta", {dx, dy, origPositions});
  let groupBounds = getMultiSelectionBounds(origPositions, dx, dy);
  let adjDx = dx, adjDy = dy;

  if (groupBounds.minX < 0) adjDx += -groupBounds.minX;
  if (groupBounds.maxX > stageWidth) adjDx += stageWidth - groupBounds.maxX;
  if (groupBounds.minY < 0) adjDy += -groupBounds.minY;
  if (groupBounds.maxY > stageHeight) adjDy += stageHeight - groupBounds.maxY;

  groupBounds = getMultiSelectionBounds(origPositions, adjDx, adjDy);
  if (groupBounds.minX < 0) adjDx += -groupBounds.minX;
  if (groupBounds.maxX > stageWidth) adjDx += stageWidth - groupBounds.maxX;
  if (groupBounds.minY < 0) adjDy += -groupBounds.minY;
  if (groupBounds.maxY > stageHeight) adjDy += stageHeight - groupBounds.maxY;

  if (getSetting("multiDragBox")) {
    log("DEBUG", "Clamp multi-drag", {dx, dy, adjDx, adjDy, groupBounds});
  }
  logExit("clampMultiDragDelta");
  return [adjDx, adjDy];
}
function clampSingleShapePosition(shape) {
  logEnter("clampSingleShapePosition", {shape});
  const bounds = getShapeBounds(shape);
  let dx = 0, dy = 0;
  if (bounds.minX < 0) dx = -bounds.minX;
  if (bounds.maxX > stageWidth) dx = stageWidth - bounds.maxX;
  if (bounds.minY < 0) dy = -bounds.minY;
  if (bounds.maxY > stageHeight) dy = stageHeight - bounds.maxY;
  if (dx !== 0 || dy !== 0) {
    shape.x(shape.x() + dx);
    shape.y(shape.y() + dy);
  }
  logExit("clampSingleShapePosition");
}

function getShapeBoundsFromAttrs(shape, attrs) {
  logEnter("getShapeBoundsFromAttrs", {shape, attrs});
  if (shape._type === 'rect') {
    const x = attrs.x, y = attrs.y;
    logExit("getShapeBoundsFromAttrs");
    return { minX: x, minY: y, maxX: x + attrs.width, maxY: y + attrs.height };
  } else if (shape._type === 'circle') {
    const x = attrs.x, y = attrs.y, r = attrs.radius;
    logExit("getShapeBoundsFromAttrs");
    return { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
  } else if (shape._type === 'point') {
    const x = attrs.x, y = attrs.y;
    logExit("getShapeBoundsFromAttrs");
    return { minX: x-15, minY: y-15, maxX: x+15, maxY: y+15 };
  }
  logExit("getShapeBoundsFromAttrs");
  return {minX:0, minY:0, maxX:0, maxY:0};
}
function getShapeBounds(shape) {
  logEnter("getShapeBounds", {shape});
  if (shape._type === 'rect') {
    const x = shape.x(), y = shape.y();
    logExit("getShapeBounds");
    return { minX: x, minY: y, maxX: x + shape.width(), maxY: y + shape.height() };
  } else if (shape._type === 'circle') {
    const x = shape.x(), y = shape.y(), r = shape.radius();
    logExit("getShapeBounds");
    return { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
  } else if (shape._type === 'point') {
    const x = shape.x(), y = shape.y();
    logExit("getShapeBounds");
    return { minX: x-15, minY: y-15, maxX: x+15, maxY: y+15 };
  }
  logExit("getShapeBounds");
  return {minX:0, minY:0, maxX:0, maxY:0};
}

function updateDebugMultiDragBox() {
  logEnter("updateDebugMultiDragBox");
  if (!getSetting("multiDragBox")) {
    logExit("updateDebugMultiDragBox (not enabled)");
    return;
  }
  if (debugMultiDragBox) debugMultiDragBox.destroy();
  if (selectedShapes.length === 0) {
    logExit("updateDebugMultiDragBox (no shapes)");
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selectedShapes.forEach(shape => {
    const rect = shape.getClientRect({ relativeTo: stage });
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  });

  debugMultiDragBox = new Konva.Rect({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    stroke: '#fa0',
    strokeWidth: 2,
    dash: [6, 3],
    listening: false,
    fill: '#fa0a0a09'
  });
  debugLayer.add(debugMultiDragBox);
  debugLayer.batchDraw();
  logExit("updateDebugMultiDragBox");
}
function clearDebugMultiDragBox() {
  logEnter("clearDebugMultiDragBox");
  if (debugMultiDragBox) {
    debugMultiDragBox.destroy();
    debugMultiDragBox = null;
    debugLayer.batchDraw();
  }
  logExit("clearDebugMultiDragBox");
}

/*************************************
 * Marquee (Box) Selection Logic
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Add marquee select logic to stage background only
  if (!stage) return;
  let isMarqueeSelecting = false;

  stage.on("mousedown.marquee touchstart.marquee", function(e) {
    // Only start marquee if background is clicked (not on a shape)
    if (e.target !== stage) return;
    const pos = stage.getPointerPosition();
    marqueeStart = pos;
    isMarqueeSelecting = true;

    if (marqueeRect) {
      marqueeRect.destroy();
      marqueeRect = null;
      layer.batchDraw();
    }
    marqueeRect = new Konva.Rect({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      fill: "#2176ff22",
      stroke: "#2176ff",
      strokeWidth: 1.5,
      dash: [4, 4],
      listening: false
    });
    layer.add(marqueeRect);
    layer.batchDraw();
  });

  stage.on("mousemove.marquee touchmove.marquee", function(e) {
    if (!isMarqueeSelecting || !marqueeStart) return;
    const pos = stage.getPointerPosition();
    const x = Math.min(pos.x, marqueeStart.x);
    const y = Math.min(pos.y, marqueeStart.y);
    const w = Math.abs(pos.x - marqueeStart.x);
    const h = Math.abs(pos.y - marqueeStart.y);
    if (marqueeRect) {
      marqueeRect.x(x);
      marqueeRect.y(y);
      marqueeRect.width(w);
      marqueeRect.height(h);
      layer.batchDraw();
    }
  });

  function boxIntersectsShape(box, shape) {
    const b = getShapeBounds(shape);
    return !(box.x > b.maxX || box.x + box.width < b.minX ||
             box.y > b.maxY || box.y + box.height < b.minY);
  }

  stage.on("mouseup.marquee touchend.marquee", function(e) {
    if (!isMarqueeSelecting || !marqueeStart) return;
    const pos = stage.getPointerPosition();
    const x = Math.min(pos.x, marqueeStart.x);
    const y = Math.min(pos.y, marqueeStart.y);
    const w = Math.abs(pos.x - marqueeStart.x);
    const h = Math.abs(pos.y - marqueeStart.y);
    const box = { x, y, width: w, height: h };

    // Select all shapes that intersect the box
    const hits = shapes.filter(s => boxIntersectsShape(box, s) && !s.locked);
    if (hits.length > 0) {
      selectedShapes = hits;
      selectedShape = hits.length === 1 ? hits[0] : null;
      if (transformer) {
        transformer.destroy();
        transformer = null;
      }
      updateLabelUI();
      updateList();
      updateSelectionHighlights();
    }

    if (marqueeRect) {
      marqueeRect.destroy();
      marqueeRect = null;
      layer.batchDraw();
    }
    isMarqueeSelecting = false;
    marqueeStart = null;
  });
});

/*************************************
 * Shape event attachment (and enableEdit/disableEdit definitions)
 *************************************/
function attachShapeEvents(shape) {
  logEnter("attachShapeEvents", {shape});
  // CHANGED: Only remove .shape events, not all drag events!
  shape.off('mousedown.shape touchstart.shape');
  shape.off('dragstart.shape dragmove.shape dragend.shape');

  // Selection logic
  shape.on('mousedown.shape touchstart.shape', e=>{
    log("TRACE", "shape mousedown/touchstart", {e, shape});
    e.cancelBubble = true;
    if (!selectedShapes.includes(shape)) {
      enableEdit(shape);
    }
  });

  // --- Drag logic ---
  shape.on('dragstart.shape', (e) => {
    log("TRACE", "shape dragstart", {e, shape});
    // Custom multi-drag logic
    if(selectedShapes.length > 1 && selectedShapes.includes(shape)) {
      if (selectedShapes.some(s => s.locked)) {
        shape.stopDrag();
        return;
      }
      // Cancel native drag, do our own
      shape.stopDrag();
      multiDrag.moving = true;
      multiDrag.dragOrigin = stage.getPointerPosition();
      multiDrag.origPositions = selectedShapes.map(s => {
        return { shape: s, x: s.x(), y: s.y() };
      });
      stage.on('mousemove.multidrag touchmove.multidrag', onMultiDragMove);
      stage.on('mouseup.multidrag touchend.multidrag', onMultiDragEnd);
    }
  });

  // Only clamp for single drag, never for multi (handled in multi logic)
  shape.on('dragmove.shape', ()=>{
    log("TRACE", "shape dragmove", {shape});
    if(selectedShapes.length === 1 && selectedShapes[0] === shape) {
      clampSingleShapePosition(shape);
      updateSelectionHighlights();
      updateList();
    }
  });

  shape.on('transformend.shape', ()=>{
    log("TRACE", "shape transformend", {shape});
    if(selectedShapes.includes(shape)) updateSelectionHighlights();
  });
}

// --- Multi-drag event handlers ---
function onMultiDragMove(evt) {
  logEnter("onMultiDragMove", {evt});
  if (!multiDrag.moving || !multiDrag.dragOrigin) {
    logExit("onMultiDragMove (not moving)");
    return;
  }
  const pos = stage.getPointerPosition();
  let dx = pos.x - multiDrag.dragOrigin.x;
  let dy = pos.y - multiDrag.dragOrigin.y;
  let [clampedDx, clampedDy] = clampMultiDragDelta(dx, dy, multiDrag.origPositions);
  multiDrag.origPositions.forEach(obj => {
    obj.shape.x(obj.x + clampedDx);
    obj.shape.y(obj.y + clampedDy);
  });
  updateDebugMultiDragBox();
  layer.batchDraw();
  updateSelectionHighlights();
  updateList();
  logExit("onMultiDragMove");
}
function onMultiDragEnd(evt) {
  logEnter("onMultiDragEnd", {evt});
  multiDrag.moving = false;
  multiDrag.dragOrigin = null;
  multiDrag.origPositions = null;
  clearDebugMultiDragBox();
  stage.off('mousemove.multidrag touchmove.multidrag');
  stage.off('mouseup.multidrag touchend.multidrag');
  layer.batchDraw();
  updateSelectionHighlights();
  updateList();
  logExit("onMultiDragEnd");
}

function enableEdit(shape){
  logEnter("enableEdit", {shape});
  if(transformer){transformer.destroy(); transformer=null;}
  selectedShape = shape;
  selectedShapes = [shape];
  updateLabelUI();
  labelInput.value = shape._label;
  lockCheckbox.checked = shape.locked;

  let anchors = shape.locked ? [] : ['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'];
  if(shape._type==='circle' && !shape.locked) anchors = ['top-left','top-right','bottom-left','bottom-right'];
  // No anchors for points
  if(shape._type==='point') anchors = [];

  transformer = new Konva.Transformer({
    nodes:[shape],
    enabledAnchors: anchors,
    rotateEnabled: !shape.locked && shape._type !== 'point'
  });

  transformer.on('transformend.shape', ()=>{
    log("TRACE", "transformer transformend", {selectedShape});
    if(selectedShape){
      const scaleX = selectedShape.scaleX(), scaleY = selectedShape.scaleY();
      if(selectedShape._type==='rect'){
        selectedShape.width(selectedShape.width()*scaleX);
        selectedShape.height(selectedShape.height()*scaleY);
      } else if(selectedShape._type==='circle'){
        selectedShape.radius(selectedShape.radius()*scaleX);
      }
      selectedShape.scaleX(1);
      selectedShape.scaleY(1);
      selectedShape.strokeWidth(1);
      layer.draw();
      updateList();
      updateSelectionHighlights();
    }
  });

  layer.add(transformer);
  layer.draw();
  updateSelectionHighlights();
  logExit("enableEdit");
}

function disableEdit(){
  logEnter("disableEdit");
  if(transformer){transformer.destroy(); transformer=null;}
  selectedShape=null;
  selectedShapes = [];
  updateLabelUI();
  layer.draw();
  updateSelectionHighlights();
  logExit("disableEdit");
}

/*********************************
 * Add: Point Shape (crosshair + halo + full hit area)
 *********************************/
function makePointShape(x, y) {
  logEnter("makePointShape", {x, y});
  const crossLen = getSetting("pointCrossLen");
  const haloR = getSetting("pointHaloRadius");
  const hitR = getSetting("pointHitRadius");
  const group = new Konva.Group({ x: x, y: y, draggable: true });

  // Invisible hit area (for easy tap/drag)
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: hitR,
    fill: "#fff",
    opacity: 0, // fully transparent
    listening: true
  });

  // Halo (faint circle for visibility/selection)
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: haloR,
    stroke: '#2176ff',
    strokeWidth: 1.5,
    opacity: 0.4,
    listening: false
  });

  // Horizontal crosshair line
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Vertical crosshair line
  const crossV = new Konva.Line({
    points: [0, -crossLen / 2, 0, crossLen / 2],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // For selection feedback
  const selHalo = new Konva.Circle({
    x: 0, y: 0,
    radius: haloR + 3,
    stroke: "#0057d8",
    strokeWidth: 2,
    opacity: 0.8,
    visible: false,
    listening: false
  });

  // Add invisible hit area first (so it's below everything)
  group.add(hitCircle);
  group.add(selHalo);
  group.add(halo);
  group.add(crossH);
  group.add(crossV);

  group._type = 'point';
  group._label = 'Point' + (shapes.filter(s => s._type === 'point').length + 1);
  group.locked = false;

  group.getSampleCoords = function() {
    log("TRACE", "getSampleCoords called", {group});
    return {x: group.x(), y: group.y()};
  };

  group.showSelection = function(isSelected) {
    log("TRACE", "showSelection called", {isSelected});
    selHalo.visible(isSelected);
  };

  group.on('mouseenter', () => {
    log("TRACE", "point mouseenter", {group});
    stage.container().style.cursor = 'pointer';
  });
  group.on('mouseleave', () => {
    log("TRACE", "point mouseleave", {group});
    stage.container().style.cursor = '';
  });

  // IMPORTANT: attach shape events before loupe events!
  attachShapeEvents(group);

  // --- LOUPE INTEGRATION: Attach loupe drag handlers (these remain!)
  attachLoupeToPointShape(group);

  logExit("makePointShape");
  return group;
}

// --- END OF PART 4 OF 6 ---
// --- START OF PART 5 OF 6 ---

/*********************************
 * Redraw all points if radius/length/hit settings change
 *********************************/
function redrawAllPoints() {
  logEnter("redrawAllPoints");
  shapes.forEach((shape, idx) => {
    if (shape._type === 'point') {
      const parent = shape.getParent && shape.getParent();
      const x = shape.x(), y = shape.y();
      const isSelected = selectedShapes.includes(shape);
      const label = shape._label;
      const locked = shape.locked;
      shape.destroy();
      const newShape = makePointShape(x, y);
      newShape._label = label;
      newShape.locked = locked;
      newShape.draggable(!locked ? true : false);
      shapes[idx] = newShape;
      if (parent) parent.add(newShape);
      if (isSelected) selectedShapes[selectedShapes.indexOf(shape)] = newShape;
    }
  });
  layer.draw();
  updateList();
  updateSelectionHighlights();
  logExit("redrawAllPoints");
}

/*********************************
 * Shape Creation - Point, Rect & Circle
 *********************************/
function makeShape(type){
  logEnter("makeShape", {type});
  const label = type.charAt(0).toUpperCase() + type.slice(1) + (shapes.filter(s => s._type === type).length + 1);
  const stroke = getSetting("defaultStrokeColor") || "#000";
  const fill = getSetting("defaultFillColor") || "#0000";
  const x = stageWidth / 2, y = x;
  let shape;
  if(type==='rect'){
    shape = new Konva.Rect({
      x:x-Number(getSetting("defaultRectWidth"))/2,
      y:y-Number(getSetting("defaultRectHeight"))/2,
      width:Number(getSetting("defaultRectWidth")),
      height:Number(getSetting("defaultRectHeight")),
      stroke, strokeWidth: 1, fill, draggable:true
    });
  }
  else if(type==='circle'){
    shape = new Konva.Circle({
      x:x, y:y, radius:Number(getSetting("defaultCircleRadius")),
      stroke, strokeWidth: 1, fill, draggable:true
    });
  }
  else if(type==='point'){
    shape = makePointShape(x, y);
  }
  if (!shape) {
    logExit("makeShape (no shape)");
    return null;
  }
  shape._type = type;
  shape._label = label;
  shape.locked = false;
  shape.draggable(true); // unlocked by default
  attachShapeEvents(shape);
  logExit("makeShape");
  return shape;
}

/*********************************
 * Robust lock state handling (UI and shapes)
 *********************************/

function setShapeLocked(shape, locked) {
  shape.locked = !!locked;
  // For Konva.Shape: disable drag
  if (shape.draggable) shape.draggable(!locked);
  // For Groups (points), also disable drag
  if (shape instanceof Konva.Group) shape.draggable(!locked);
  // If there's a transformer and this shape is selected, lock disables transform
  if (transformer && transformer.nodes().includes(shape)) {
    if (locked) {
      transformer.enabledAnchors([]);
      transformer.rotateEnabled(false);
    } else {
      // Reset anchors as appropriate per shape type
      let anchors = ['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'];
      if(shape._type==='circle') anchors = ['top-left','top-right','bottom-left','bottom-right'];
      if(shape._type==='point') anchors = [];
      transformer.enabledAnchors(anchors);
      transformer.rotateEnabled(shape._type !== 'point');
    }
  }
}

function syncAllShapeLocks() {
  // Ensures all shapes' .draggable and lock UI are in sync with locked prop
  shapes.forEach(s => setShapeLocked(s, s.locked));
}

/*********************************
 * Lock checkbox handling: for single or multi selection
 *********************************/
document.addEventListener("DOMContentLoaded", ()=>{
  lockCheckbox.addEventListener('change', ()=>{
    if (selectedShapes.length === 0) return;
    // If indeterminate, apply to all as per new state
    const newLocked = lockCheckbox.checked;
    selectedShapes.forEach(s => setShapeLocked(s, newLocked));
    updateList();
    updateLabelUI();
  });
});

/*********************************
 * Shape Creation, Duplication, Deletion, Selection
 *********************************/
document.addEventListener("DOMContentLoaded", ()=>{
  logEnter("DOMContentLoaded: main shape event handlers");
  newBtn.addEventListener('click', ()=>{
    log("TRACE", "newBtn clicked");
    const type = shapeTypeSelect.value;
    const shape = makeShape(type);
    if (!shape) return;
    shapes.push(shape);
    layer.add(shape);
    enableEdit(shape);
    layer.draw();
    updateList();
    updateSelectionHighlights();
  });

  duplicateBtn.addEventListener('click', ()=>{
    log("TRACE", "duplicateBtn clicked");
    if(selectedShapes.length === 0) return;
    let newShapes = [];
    const offset = 20;
    selectedShapes.forEach(orig => {
      let clone;
      const type = orig._type;
      const attrs = orig.getAttrs();
      if(type === 'rect') {
        clone = new Konva.Rect({
          x: attrs.x + offset,
          y: attrs.y + offset,
          width: attrs.width,
          height: attrs.height,
          stroke: attrs.stroke,
          strokeWidth: 1,
          fill: attrs.fill,
          draggable: !orig.locked,
          rotation: orig.rotation()
        });
      } else if(type === 'circle') {
        clone = new Konva.Circle({
          x: attrs.x + offset,
          y: attrs.y + offset,
          radius: attrs.radius,
          stroke: attrs.stroke,
          strokeWidth: 1,
          fill: attrs.fill,
          draggable: !orig.locked,
          rotation: orig.rotation ? orig.rotation() : 0
        });
      } else if(type === 'point') {
        clone = makePointShape(attrs.x + offset, attrs.y + offset);
      }
      if(!clone) return;
      clone._type = type;
      let baseLabel = orig._label.replace(/-copy(\d*)$/, '');
      let newLabel = baseLabel + "-copy";
      let labelIndex = 1;
      while(shapes.concat(newShapes).some(s => s._label === newLabel)) {
        labelIndex++;
        newLabel = baseLabel + "-copy" + labelIndex;
      }
      clone._label = newLabel;
      setShapeLocked(clone, orig.locked);
      attachShapeEvents(clone);
      newShapes.push(clone);
      layer.add(clone);
    });
    shapes = shapes.concat(newShapes);
    selectedShapes = newShapes;
    selectedShape = (newShapes.length===1) ? newShapes[0] : null;
    updateLabelUI();
    updateList();
    layer.draw();
    updateSelectionHighlights();
  });

  deleteBtn.addEventListener('click', ()=>{
    log("TRACE", "deleteBtn clicked");
    if(selectedShapes.length > 0) {
      const toDelete = selectedShapes.filter(s => !s.locked);
      toDelete.forEach(s => s.destroy());
      shapes = shapes.filter(s => !toDelete.includes(s));
      disableEdit();
      layer.draw();
      updateList();
      updateSelectionHighlights();
    }
  });

  if (resetRotationBtn) {
    resetRotationBtn.addEventListener('click', ()=>{
      log("TRACE", "resetRotationBtn clicked");
      if(selectedShapes.length > 0) {
        selectedShapes.forEach(shape=>{
          if (!shape.locked && shape.rotation) {
            shape.rotation(0);
          }
        });
        if(transformer){
          transformer.rotation(0);
          transformer.forceUpdate();
        }
        layer.draw();
        updateList();
        updateSelectionHighlights();
      }
    });
  }

  selectAllBtn.addEventListener('click', () => {
    log("TRACE", "selectAllBtn clicked");
    if (shapes.length === 0) return;
    selectedShapes = shapes.slice();
    selectedShape = null;
    if (transformer) {
      transformer.destroy();
      transformer = null;
    }
    syncAllShapeLocks();
    updateLabelUI();
    updateList();
    updateSelectionHighlights();
  });

  alignSelect.addEventListener('change', function() {
    log("TRACE", "alignSelect changed", {value:this.value});
    if (selectedShapes.length < 2 || !this.value) {
      this.value = "";
      return;
    }
    const unlocked = selectedShapes.filter(s=>!s.locked);
    if (unlocked.length < 2) {
      this.value = "";
      return;
    }

    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    let centersX = [], centersY = [];
    unlocked.forEach(s => {
      const b = getShapeBounds(s);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);
      centersX.push((b.minX + b.maxX) / 2);
      centersY.push((b.minY + b.maxY) / 2);
    });

    function setShapeX(shape, targetX) {
      if (shape._type === 'rect') {
        shape.x(targetX);
      } else if (shape._type === 'circle') {
        shape.x(targetX + shape.radius());
      } else if (shape._type === 'point') {
        shape.x(targetX);
      }
    }
    function setShapeY(shape, targetY) {
      if (shape._type === 'rect') {
        shape.y(targetY);
      } else if (shape._type === 'circle') {
        shape.y(targetY + shape.radius());
      } else if (shape._type === 'point') {
        shape.y(targetY);
      }
    }
    function setShapeCenterX(shape, centerX) {
      const b = getShapeBounds(shape);
      const currentCenter = (b.minX + b.maxX) / 2;
      const dx = centerX - currentCenter;
      shape.x(shape.x() + dx);
    }
    function setShapeCenterY(shape, centerY) {
      const b = getShapeBounds(shape);
      const cy = (b.minY + b.maxY) / 2;
      const dy = centerY - cy;
      shape.y(shape.y() + dy);
    }

    // For points, left/right/center and top/bottom/middle all mean center
    if (this.value === "left") {
      unlocked.forEach(s => {
        if (s._type === 'point') setShapeX(s, minX);
        else setShapeX(s, minX);
      });
    } else if (this.value === "right") {
      unlocked.forEach(s => {
        if (s._type === 'point') setShapeX(s, maxX);
        else {
          const b = getShapeBounds(s);
          setShapeX(s, maxX - (b.maxX - b.minX));
        }
      });
    } else if (this.value === "center") {
      const cx = (minX + maxX) / 2;
      unlocked.forEach(s => setShapeCenterX(s, cx));
    } else if (this.value === "top") {
      unlocked.forEach(s => {
        if (s._type === 'point') setShapeY(s, minY);
        else setShapeY(s, minY);
      });
    } else if (this.value === "bottom") {
      unlocked.forEach(s => {
        if (s._type === 'point') setShapeY(s, maxY);
        else {
          const b = getShapeBounds(s);
          setShapeY(s, maxY - (b.maxY - b.minY));
        }
      });
    } else if (this.value === "middle") {
      const cy = (minY + maxY) / 2;
      unlocked.forEach(s => setShapeCenterY(s, cy));
    }
    layer.draw();
    updateList();
    updateSelectionHighlights();
    this.value = "";
  });
  logExit("DOMContentLoaded: main shape event handlers");
});

/*********************************
 * Pickr Color Picker: Unified for All Shapes
 *********************************/
document.addEventListener("DOMContentLoaded", ()=>{
  logEnter("DOMContentLoaded: Pickr color picker setup");
  window.strokePickr = Pickr.create({
    el:'#strokePickr', theme:'monolith', default:getSetting("defaultStrokeColor") || 'rgba(0,0,0,1)',
    components:{preview:true, opacity:true, hue:true, interaction:{hex:true, rgba:true, input:true}}
  });
  window.fillPickr = Pickr.create({
    el:'#fillPickr', theme:'monolith', default:getSetting("defaultFillColor") || 'rgba(0,0,0,0)',
    components:{preview:true, opacity:true, hue:true, interaction:{hex:true, rgba:true, input:true}}
  });

  strokePickr.on('change', color=>{
    log("TRACE", "strokePickr changed", {color});
    const unlocked = selectedShapes.filter(s=>!s.locked);
    if(unlocked.length > 0){
      unlocked.forEach(s=>{
        if (s._type === "point") {
          // For points, update crosshair and halo strokes
          (s.find("Line") || []).forEach(line => line.stroke(color.toRGBA().toString()));
          (s.find("Circle") || []).forEach(circle => {
            // Only change visible stroke (not invisible hit area)
            if (circle.stroke && typeof circle.stroke === "function" && circle.stroke() && circle.stroke() !== "") {
              circle.stroke(color.toRGBA().toString());
            }
          });
        } else if (typeof s.stroke === "function") {
          s.stroke(color.toRGBA().toString());
        }
      });
      layer.draw();
      updateList();
      updateSelectionHighlights();
    }
  });
  fillPickr.on('change', color=>{
    log("TRACE", "fillPickr changed", {color});
    const unlocked = selectedShapes.filter(s=>!s.locked);
    if(unlocked.length > 0){
      unlocked.forEach(s=>{
        if (s._type === "point") {
          // For points, set fill on the visible halo only
          (s.find("Circle") || []).forEach(circle => {
            if (circle.opacity && circle.opacity() > 0 && circle.opacity() < 1) {
              circle.fill(color.toRGBA().toString());
            }
          });
        } else if (typeof s.fill === "function") {
          s.fill(color.toRGBA().toString());
        }
      });
      layer.draw();
      updateList();
      updateSelectionHighlights();
    }
  });
  logExit("DOMContentLoaded: Pickr color picker setup");
});

/*********************************
 * Label UI, List UI, Label locking
 *********************************/
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
    const allLocked = selectedShapes.every(s=>s.locked);
    const noneLocked = selectedShapes.every(s=>!s.locked);
    lockCheckbox.indeterminate = !(allLocked || noneLocked);
    lockCheckbox.checked = allLocked;
  } else {
    lockCheckbox.indeterminate = false;
    lockCheckbox.checked = false;
  }
  logExit("updateLabelUI");
}

function updateList(){
  logEnter("updateList");
  let html='<table class="coords-table"><tr><th>Label</th><th>Type</th><th>Fill</th><th>Line</th><th>x</th><th>y</th><th>w/r</th><th>h</th><th>Lock</th></tr>';
  shapes.forEach((s,i)=>{
    const t = s._type;
    const lbl = s._label;
    const attrs = s.getAttrs();
    let x=0,y=0,w=0,h=0;
    if(t==='rect'){x=attrs.x;y=attrs.y;w=attrs.width;h=attrs.height;}
    else if(t==='circle'){x=attrs.x;y=attrs.y;w=h=attrs.radius;}
    else if(t==='point'){x=attrs.x;y=attrs.y;w=h="--";}
    const isSelected = selectedShapes.includes(s);
    html+=`<tr${isSelected?' class="selected"':''}>
      <td><span class="select-label" data-idx="${i}" style="color:#2176ff;cursor:pointer;text-decoration:underline;">${lbl}</span></td>
      <td>${t}</td>
      <td><span class="swatch fill-swatch" data-idx="${i}" title="Change fill color" style="background:${s.fill ? (s.fill()||'transparent') : 'transparent'}"></span></td>
      <td><span class="swatch stroke-swatch" data-idx="${i}" title="Change line color" style="background:${s.stroke ? s.stroke() : ''}"></span></td>
      <td>${Math.round(x)}</td><td>${Math.round(y)}</td><td>${w}</td><td>${h}</td>
      <td>${s.locked ? '🔒' : ''}</td>
    </tr>`;
  });
  html+='</table>';
  labelsList.innerHTML = html;

  document.querySelectorAll('.select-label').forEach(el=>{
    el.onclick = function(){
      const idx = parseInt(this.dataset.idx,10);
      enableEdit(shapes[idx]);
    }
  });
  document.querySelectorAll('.fill-swatch').forEach(el=>{
    el.onclick = function(e){
      const idx = parseInt(this.dataset.idx,10);
      enableEdit(shapes[idx]);
      setTimeout(()=>fillPickr.show(), 50);
      e.stopPropagation();
    };
  });
  document.querySelectorAll('.stroke-swatch').forEach(el=>{
    el.onclick = function(e){
      const idx = parseInt(this.dataset.idx,10);
      enableEdit(shapes[idx]);
      setTimeout(()=>strokePickr.show(), 50);
      e.stopPropagation();
    };
  });
  updateLabelUI();
  logExit("updateList");
}

// --- END OF PART 5 OF 6 ---
// --- START OF PART 6 OF 6 ---

/*************************************
 * LOUPE (MAGNIFIER) SUPPORT
 *************************************/
const LOUPE_DEFAULTS = {
  loupeEnabled: true,
  loupeSize: 120,
  loupeZoom: 2,
  loupeFPS: 40,
  loupeCrosshair: true,
  loupeShowOverlays: false,
  loupeOffsetX: 0,
  loupeOffsetY: 0
};

let loupeDiv = null;
let loupeCanvas = null;
let loupeCtx = null;
let loupeActive = false;
let loupePoint = { x: 0, y: 0 };
let loupeRAF = null;

function getLoupeSetting(key) {
  logEnter("getLoupeSetting", {key});
  const val = getSetting(key) ?? LOUPE_DEFAULTS[key];
  logExit("getLoupeSetting", {val});
  return val;
}

function ensureLoupeDOM() {
  logEnter("ensureLoupeDOM");
  if (loupeDiv) {
    logExit("ensureLoupeDOM (already present)");
    return;
  }
  loupeDiv = document.createElement("div");
  loupeDiv.id = "loupeDiv";
  // All styling is now in styles.css
  loupeCanvas = document.createElement("canvas");
  loupeDiv.appendChild(loupeCanvas);
  document.body.appendChild(loupeDiv);
  loupeCtx = loupeCanvas.getContext("2d");
  logExit("ensureLoupeDOM");
}

function showLoupeAt(x, y) {
  logEnter("showLoupeAt", {x, y});
  if (!getLoupeSetting("loupeEnabled")) {
    log("TRACE", "showLoupeAt: Loupe not enabled");
    logExit("showLoupeAt (not enabled)");
    return;
  }
  if (!bgImageObj || !stage) {
    log("TRACE", "showLoupeAt: bgImageObj or stage missing");
    logExit("showLoupeAt (no bgImageObj/stage)");
    return;
  }
  ensureLoupeDOM();
  const size = Number(getLoupeSetting("loupeSize")) || 120;
  const zoom = Number(getLoupeSetting("loupeZoom")) || 2;
  const offsetX = Number(getLoupeSetting("loupeOffsetX")) || 0;
  const offsetYSetting = Number(getLoupeSetting("loupeOffsetY")) || 0;
  loupeDiv.style.width = loupeDiv.style.height = size + "px";
  loupeCanvas.width = size;
  loupeCanvas.height = size;

  // Position loupe DOM (now with manual offsets)
  let offsetY = 24;
  let loupeScreenX = x - size / 2 + offsetX;
  let loupeScreenY = y - size - offsetY + offsetYSetting;
  if (loupeScreenY < 0) loupeScreenY = y + offsetY + offsetYSetting;
  loupeScreenX = Math.max(4, Math.min(window.innerWidth - size - 4, loupeScreenX));
  loupeScreenY = Math.max(4, Math.min(window.innerHeight - size - 4, loupeScreenY));
  loupeDiv.style.left = loupeScreenX + "px";
  loupeDiv.style.top = loupeScreenY + "px";
  loupeDiv.style.display = "block";

  loupePoint.x = x;
  loupePoint.y = y;
  loupeActive = true;

  requestLoupeDraw();
  logExit("showLoupeAt");
}

function hideLoupe() {
  logEnter("hideLoupe");
  loupeActive = false;
  if (loupeDiv) loupeDiv.style.display = "none";
  if (loupeRAF) {
    cancelAnimationFrame(loupeRAF);
    loupeRAF = null;
  }
  logExit("hideLoupe");
}

function requestLoupeDraw() {
  logEnter("requestLoupeDraw", {loupeRAF});
  if (loupeRAF) {
    logExit("requestLoupeDraw (already scheduled)");
    return;
  }
  loupeRAF = requestAnimationFrame(drawLoupe);
  logExit("requestLoupeDraw");
}

function drawLoupe() {
  logEnter("drawLoupe", {loupeActive, loupeDiv, loupeCanvas, loupeCtx});
  loupeRAF = null;
  if (!loupeActive || !loupeDiv || !loupeCanvas || !loupeCtx) {
    logExit("drawLoupe (inactive or missing dom/canvas/ctx)");
    return;
  }
  if (!bgImageObj || !stage) {
    logExit("drawLoupe (missing bgImageObj or stage)");
    return;
  }

  const size = Number(getLoupeSetting("loupeSize")) || 120;
  const zoom = Number(getLoupeSetting("loupeZoom")) || 2;
  const showCross = !!getLoupeSetting("loupeCrosshair");
  const showOverlays = !!getLoupeSetting("loupeShowOverlays");

  loupeCtx.clearRect(0, 0, size, size);

  // Find canvas coordinates to magnify
  const stageRect = stage.container().getBoundingClientRect();
  const stageScaleX = stage.width() / stageRect.width;
  const stageScaleY = stage.height() / stageRect.height;

  // Convert screen (pageX/pageY) to stage coordinates
  const stageX = (loupePoint.x - stageRect.left) * stageScaleX;
  const stageY = (loupePoint.y - stageRect.top) * stageScaleY;

  // Region of image to magnify
  const srcR = size / (2 * zoom);

  // Clamp image region
  let imgRegionX = (stageX - srcR) * (bgImageObj.naturalWidth / stage.width());
  let imgRegionY = (stageY - srcR) * (bgImageObj.naturalHeight / stage.height());
  let imgRegionW = (size / zoom) * (bgImageObj.naturalWidth / stage.width());
  let imgRegionH = (size / zoom) * (bgImageObj.naturalHeight / stage.height());

  imgRegionX = Math.max(0, Math.min(bgImageObj.naturalWidth - imgRegionW, imgRegionX));
  imgRegionY = Math.max(0, Math.min(bgImageObj.naturalHeight - imgRegionH, imgRegionY));

  try {
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    loupeCtx.closePath();
    loupeCtx.clip();

    loupeCtx.drawImage(
      bgImageObj,
      imgRegionX, imgRegionY, imgRegionW, imgRegionH,
      0, 0, size, size
    );

    if (showOverlays && stage && typeof stage.toCanvas === "function") {
      const loupeStageCanvas = stage.toCanvas({
        x: stageX - srcR,
        y: stageY - srcR,
        width: size / zoom,
        height: size / zoom,
        pixelRatio: zoom
      });
      loupeCtx.globalAlpha = 1.0;
      loupeCtx.drawImage(loupeStageCanvas, 0, 0, size, size);
    }

    if (showCross) {
      loupeCtx.lineWidth = 1;
      loupeCtx.strokeStyle = "#ff2222";
      loupeCtx.beginPath();
      loupeCtx.moveTo(size/2, 0);
      loupeCtx.lineTo(size/2, size);
      loupeCtx.moveTo(0, size/2);
      loupeCtx.lineTo(size, size/2);
      loupeCtx.stroke();
    }

    loupeCtx.restore();
  } catch (e) {
    log("ERROR", "drawLoupe error", e);
    // Ignore out-of-bounds draw errors
  }
  logExit("drawLoupe");
}

// Throttle update to FPS
let lastLoupeDraw = 0;
function scheduleLoupeUpdate() {
  logEnter("scheduleLoupeUpdate");
  if (!loupeActive) {
    logExit("scheduleLoupeUpdate (not active)");
    return;
  }
  const fps = Number(getLoupeSetting("loupeFPS")) || 40;
  const now = performance.now();
  const interval = 1000 / fps;
  if (now - lastLoupeDraw >= interval) {
    lastLoupeDraw = now;
    requestLoupeDraw();
  } else {
    setTimeout(requestLoupeDraw, interval - (now - lastLoupeDraw));
  }
  logExit("scheduleLoupeUpdate");
}

// Attach drag listeners to point shapes (call after point is created)
function attachLoupeToPointShape(pointShape) {
  logEnter("attachLoupeToPointShape", {pointShape});
  if (!pointShape || pointShape._type !== "point") {
    logExit("attachLoupeToPointShape (not a point)");
    return;
  }
  pointShape.on("dragstart.loupe", e => {
    log("TRACE", "point dragstart.loupe", {e, pointShape});
    if (!getLoupeSetting("loupeEnabled")) return;
    loupeActive = true;
    const evt = e.evt || window.event;
    let px = evt.touches ? evt.touches[0].clientX : evt.clientX;
    let py = evt.touches ? evt.touches[0].clientY : evt.clientY;
    showLoupeAt(px, py);
    scheduleLoupeUpdate();
  });
  pointShape.on("dragmove.loupe", e => {
    log("TRACE", "point dragmove.loupe", {e, pointShape});
    if (!loupeActive) return;
    const evt = e.evt || window.event;
    let px = evt.touches ? evt.touches[0].clientX : evt.clientX;
    let py = evt.touches ? evt.touches[0].clientY : evt.clientY;
    showLoupeAt(px, py);
    scheduleLoupeUpdate();
  });
  pointShape.on("dragend.loupe", () => {
    log("TRACE", "point dragend.loupe", {pointShape});
    hideLoupe();
  });
  logExit("attachLoupeToPointShape");
}

document.addEventListener("DOMContentLoaded", function() {
  const toggleBtn = document.getElementById("settingsPanelToggle");
  const panel = document.getElementById("settingsPanel");
  const icon = document.getElementById("settingsPanelToggleIcon");
  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", function() {
      const isOpen = panel.classList.toggle("open");
      panel.style.display = isOpen ? "flex" : "none";
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (icon) icon.innerHTML = isOpen ? "&#x25B2;" : "&#x25BC;";
      if (isOpen) buildSettingsPanel();
    });
  }
});

// --- END OF PART 6 OF 6 ---
