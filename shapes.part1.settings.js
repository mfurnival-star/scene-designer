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
