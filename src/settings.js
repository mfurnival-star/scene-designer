/**
 * settings.js
 * -----------------------------------------------------------
 * Settings Panel Module for Scene Designer (Golden Layout)
 * - Defines the settings registry (type, label, default, UI metadata, onChange)
 * - Loads and saves settings from localStorage
 * - Renders the settings panel dynamically (including Pickr color pickers)
 * - Integrates with AppState.settings as single source of truth
 * - Updates logging config on settings change (log.js)
 * - Adheres to SCENE_DESIGNER_MANIFESTO.md and COPILOT_MANIFESTO.md
 * -----------------------------------------------------------
 */

import { AppState, setSetting, setSettings, getSetting } from './state.js';
import { log, configureLogging } from './log.js';

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
  // Logging settings
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
    default: "ERROR"
  },
  {
    key: "DEBUG_LOG_DEST",
    label: "Log Destination",
    type: "select",
    options: [
      { value: "console", label: "Console" },
      { value: "server", label: "Server" },
      { value: "both", label: "Both" }
    ],
    default: "console"
  },
  {
    key: "LOG_SERVER_URL",
    label: "Log Server URL",
    type: "text",
    default: ""
  },
  {
    key: "LOG_SERVER_TOKEN",
    label: "Log Server Token",
    type: "text",
    default: ""
  }
];

// Load settings from localStorage (or use defaults)
export function loadSettings() {
  log("INFO", "[settings] Loading settings from localStorage");
  let fromStorage = {};
  try {
    fromStorage = JSON.parse(localStorage.getItem("sceneDesignerSettings") || "{}");
  } catch (e) {
    log("ERROR", "[settings] Failed to parse settings from localStorage", e);
    fromStorage = {};
  }
  const newSettings = {};
  for (const reg of settingsRegistry) {
    newSettings[reg.key] = (fromStorage[reg.key] !== undefined) ? fromStorage[reg.key] : reg.default;
  }
  setSettings(newSettings);
  AppState.settingsRegistry = settingsRegistry;
  log("DEBUG", "[settings] Settings loaded", newSettings);
  applyLoggingSettings();
}

// Save settings to localStorage
export function saveSettings() {
  try {
    localStorage.setItem("sceneDesignerSettings", JSON.stringify(AppState.settings));
    log("INFO", "[settings] Settings saved to localStorage");
  } catch (e) {
    log("ERROR", "[settings] Failed to save settings", e);
  }
}

// Apply logging settings to log.js
function applyLoggingSettings() {
  configureLogging({
    level: AppState.settings.DEBUG_LOG_LEVEL,
    dest: AppState.settings.DEBUG_LOG_DEST,
    serverURL: AppState.settings.LOG_SERVER_URL,
    token: AppState.settings.LOG_SERVER_TOKEN
  });
  log("INFO", "[settings] Logging configuration applied", {
    level: AppState.settings.DEBUG_LOG_LEVEL,
    dest: AppState.settings.DEBUG_LOG_DEST
  });
}

// Build the settings panel UI (as a Golden Layout panel)
export function buildSettingsPanel(rootElement, container) {
  log("INFO", "[settings] Building settings panel UI");
  rootElement.innerHTML = "";

  // Helper: create a field row
  function createField(reg) {
    const field = document.createElement("div");
    field.className = "settings-field";
    const label = document.createElement("label");
    label.textContent = reg.label;
    label.setAttribute("for", "setting-" + reg.key);

    let input;
    if (reg.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!AppState.settings[reg.key];
      input.id = "setting-" + reg.key;
      input.addEventListener("change", () => {
        setSetting(reg.key, input.checked);
        saveSettings();
        if (reg.key.startsWith("DEBUG_LOG")) applyLoggingSettings();
      });
      field.append(label, input);
    } else if (reg.type === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.value = AppState.settings[reg.key];
      input.min = reg.min;
      input.max = reg.max;
      input.step = reg.step || 1;
      input.id = "setting-" + reg.key;
      input.addEventListener("input", () => {
        let val = Number(input.value);
        if (isNaN(val)) val = reg.default;
        setSetting(reg.key, val);
        saveSettings();
      });
      field.append(label, input);
    } else if (reg.type === "pickr") {
      // Pickr color picker
      const pickrDiv = document.createElement("div");
      pickrDiv.className = "pickr";
      pickrDiv.id = "setting-" + reg.key + "-pickr";
      pickrDiv.style.display = "inline-block";
      pickrDiv.style.marginLeft = "0.5em";
      field.append(label, pickrDiv);
      // Delay Pickr init to after DOM append (Pickr needs actual DOM node)
      setTimeout(() => {
        if (!window.Pickr) {
          log("ERROR", "[settings] Pickr not loaded");
          return;
        }
        if (!window._settingsPickrs) window._settingsPickrs = {};
        if (window._settingsPickrs[reg.key]) {
          window._settingsPickrs[reg.key].destroyAndRemove();
          delete window._settingsPickrs[reg.key];
        }
        window._settingsPickrs[reg.key] = window.Pickr.create({
          el: '#' + pickrDiv.id,
          theme: 'monolith',
          default: AppState.settings[reg.key],
          components: {
            preview: true, opacity: true, hue: true,
            interaction: { hex: true, rgba: true, input: true }
          }
        });
        window._settingsPickrs[reg.key]
          .on('change', color => {
            const hex = color.toHEXA().toString();
            setSetting(reg.key, hex);
            saveSettings();
          })
          .setColor(AppState.settings[reg.key]);
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
      input.value = AppState.settings[reg.key];
      input.addEventListener("change", () => {
        setSetting(reg.key, input.value);
        saveSettings();
        if (reg.key.startsWith("DEBUG_LOG")) applyLoggingSettings();
      });
      field.append(label, input);
    } else if (reg.type === "text") {
      input = document.createElement("input");
      input.type = "text";
      input.value = AppState.settings[reg.key];
      input.id = "setting-" + reg.key;
      input.addEventListener("change", () => {
        setSetting(reg.key, input.value);
        saveSettings();
        if (reg.key.startsWith("LOG_SERVER")) applyLoggingSettings();
      });
      field.append(label, input);
    }
    return field;
  }

  // Create all fields
  for (const reg of settingsRegistry) {
    rootElement.appendChild(createField(reg));
  }

  // Save on blur for all inputs
  rootElement.querySelectorAll("input,select").forEach(input => {
    input.addEventListener("blur", saveSettings);
  });

  // Re-apply Pickr color if settings change
  if (window._settingsPickrs) {
    for (const key in window._settingsPickrs) {
      if (AppState.settings[key]) {
        window._settingsPickrs[key].setColor(AppState.settings[key]);
      }
    }
  }
}

// --- Auto-load settings on module load ---
loadSettings();

