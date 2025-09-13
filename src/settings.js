/**
 * settings.js
 * -----------------------------------------------------------
 * Settings Panel for Scene Designer (Golden Layout)
 * - Provides a dynamic settings UI (collapsible) with Pickr color pickers.
 * - Reads/writes all settings from AppState.settings via state.js.
 * - Persists settings in localStorage.
 * - All settings metadata is defined in settingsRegistry.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { AppState, setSettings, setSetting, getSetting } from './state.js';
import { log } from './log.js';
import Pickr from '@simonwep/pickr';

// Settings registry: extend or modify as needed for new settings.
export const settingsRegistry = [
  {
    key: "multiDragBox",
    label: "Show Multi-Drag Box",
    type: "boolean",
    default: true
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

// Load settings from localStorage (initialization)
function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem("sceneDesignerSettings") || "{}");
    let merged = {};
    for (const reg of settingsRegistry) {
      merged[reg.key] = (reg.key in stored) ? stored[reg.key] : reg.default;
    }
    setSettings(merged);
    log("DEBUG", "[settings] Settings loaded", merged);
  } catch (e) {
    log("ERROR", "[settings] loadSettings error", e);
  }
}

// Save settings to localStorage
function saveSettings() {
  try {
    localStorage.setItem("sceneDesignerSettings", JSON.stringify(AppState.settings));
    log("DEBUG", "[settings] Settings saved", AppState.settings);
  } catch (e) {
    log("ERROR", "[settings] saveSettings error", e);
  }
}

// Build the settings panel UI
export function buildSettingsPanel(rootElement, container) {
  try {
    log("INFO", "[settings] buildSettingsPanel called", { rootElement, container });
    loadSettings();

    // Panel skeleton
    rootElement.innerHTML = `
      <div id="settings-panel-container" style="width:100%;height:100%;background:#e7f8eb;display:flex;flex-direction:column;overflow:auto;">
        <div style="padding:10px 8px 4px 8px;font-weight:bold;font-size:1.2em;color:#0a6e2c;">
          Settings
          <button id="settings-save-btn" style="float:right;font-size:0.9em;">Save</button>
        </div>
        <div id="settings-fields-div" style="flex:1 1 0;overflow:auto;padding:8px;"></div>
      </div>
    `;

    const fieldsDiv = rootElement.querySelector("#settings-fields-div");
    const saveBtn = rootElement.querySelector("#settings-save-btn");

    // Keep references to Pickr instances to destroy them on re-render
    const pickrInstances = {};

    // Helper to generate setting field
    function renderSettingField(reg) {
      const field = document.createElement("div");
      field.className = "settings-field";
      field.style = "margin-bottom:10px;";

      const label = document.createElement("label");
      label.textContent = reg.label;
      label.style = "display:inline-block;width:200px;vertical-align:middle;";
      label.setAttribute("for", "setting-" + reg.key);

      let input;
      if (reg.type === "boolean") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!getSetting(reg.key);
        input.id = "setting-" + reg.key;
        input.addEventListener("change", () => {
          setSetting(reg.key, !!input.checked);
        });
        field.appendChild(label);
        field.appendChild(input);
      } else if (reg.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = getSetting(reg.key);
        input.min = reg.min;
        input.max = reg.max;
        input.step = reg.step || 1;
        input.id = "setting-" + reg.key;
        input.style = "width:80px;margin-left:8px;";
        input.addEventListener("input", () => {
          let val = Number(input.value);
          if (isNaN(val)) val = reg.default;
          setSetting(reg.key, val);
        });
        field.appendChild(label);
        field.appendChild(input);
      } else if (reg.type === "pickr") {
        // Color picker using Pickr (ES module import)
        const pickrDiv = document.createElement("div");
        pickrDiv.className = "pickr";
        pickrDiv.id = "setting-" + reg.key + "-pickr";
        pickrDiv.style.display = "inline-block";
        pickrDiv.style.marginLeft = "0.5em";
        field.appendChild(label);
        field.appendChild(pickrDiv);
        setTimeout(() => {
          if (pickrInstances[reg.key]) {
            pickrInstances[reg.key].destroyAndRemove();
            delete pickrInstances[reg.key];
          }
          pickrInstances[reg.key] = Pickr.create({
            el: '#' + pickrDiv.id,
            theme: 'monolith',
            default: getSetting(reg.key),
            components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, input: true } }
          });
          pickrInstances[reg.key].on('change', color => {
            setSetting(reg.key, color.toHEXA().toString());
          });
          pickrInstances[reg.key].setColor(getSetting(reg.key));
        }, 1);
      } else if (reg.type === "select") {
        input = document.createElement("select");
        input.id = "setting-" + reg.key;
        for (const opt of reg.options) {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          input.appendChild(o);
        }
        input.value = getSetting(reg.key);
        input.addEventListener("change", () => {
          setSetting(reg.key, input.value);
        });
        field.appendChild(label);
        field.appendChild(input);
      }
      fieldsDiv.appendChild(field);
    }

    // Render all settings fields
    for (const reg of settingsRegistry) {
      renderSettingField(reg);
    }

    // Save button
    saveBtn.onclick = () => {
      saveSettings();
      log("INFO", "[settings] Settings saved by user");
      alert("Settings saved!");
    };

    log("INFO", "[settings] Settings panel rendered");
  } catch (e) {
    log("ERROR", "[settings] buildSettingsPanel ERROR", e);
    if (window.debugLog) window.debugLog("buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message);
    throw e;
  }
}
