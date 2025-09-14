/**
 * settings.js
 * -----------------------------------------------------------
 * Settings Panel for Scene Designer (Golden Layout)
 * - Dynamic settings UI using Tweakpane (ESM) and Pickr (ESM) for color pickers.
 * - All settings are stored in AppState.settings via state.js.
 * - Persists settings asynchronously using localForage (IndexedDB/localStorage fallback).
 * - All settings metadata is defined in settingsRegistry.
 * - Logging via log.js.
 * - Updates log.js config at runtime when log level/destination/server/token is changed.
 * - Logging policy: Use INFO for panel/user actions, DEBUG for settings changes, ERROR for problems.
 * -----------------------------------------------------------
 */

import { AppState, setSettings, setSetting, getSetting } from './state.js';
import { log, setLogLevel, setLogDestination, setLogServerURL, setLogServerToken } from './log.js';
import Pickr from '@simonwep/pickr';
import Tweakpane from 'tweakpane';
import localforage from 'localforage';

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
  },
  {
    key: "LOG_OUTPUT_DEST",
    label: "Log Output Destination",
    type: "select",
    options: [
      { value: "console", label: "Console Only" },
      { value: "server", label: "Remote Server Only" },
      { value: "both", label: "Both Console and Server" }
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
  },
  {
    key: "showErrorLogPanel",
    label: "Show Error Log Panel",
    type: "boolean",
    default: true
  }
];

// -- Persistence using localForage (async) --
localforage.config({
  name: 'scene-designer',
  storeName: 'settings'
});

// Load settings from localForage (initialization)
export async function loadSettings() {
  try {
    const stored = (await localforage.getItem("sceneDesignerSettings")) || {};
    let merged = {};
    for (const reg of settingsRegistry) {
      merged[reg.key] = (reg.key in stored) ? stored[reg.key] : reg.default;
    }
    setSettings(merged);
    updateLogConfigFromSettings(merged);
    log("DEBUG", "[settings] Settings loaded", merged);
  } catch (e) {
    log("ERROR", "[settings] loadSettings error", e);
  }
}

// Save settings to localForage and update log config if relevant
export async function saveSettings() {
  try {
    await localforage.setItem("sceneDesignerSettings", AppState.settings);
    updateLogConfigFromSettings(AppState.settings);
    log("DEBUG", "[settings] Settings saved", AppState.settings);
  } catch (e) {
    log("ERROR", "[settings] saveSettings error", e);
  }
}

// Patch setSetting/setSettings to persist to localForage immediately and update log config
const _origSetSetting = setSetting;
const _origSetSettings = setSettings;
async function setSettingAndSave(key, value) {
  _origSetSetting(key, value);
  await saveSettings();
  log("DEBUG", "[settings] setSettingAndSave", { key, value });
}
async function setSettingsAndSave(settingsObj) {
  _origSetSettings(settingsObj);
  await saveSettings();
  log("DEBUG", "[settings] setSettingsAndSave", settingsObj);
}

// Sync log.js config any time relevant settings change
function updateLogConfigFromSettings(settings) {
  if (!settings) return;
  if ("DEBUG_LOG_LEVEL" in settings) setLogLevel(settings.DEBUG_LOG_LEVEL);
  if ("LOG_OUTPUT_DEST" in settings) setLogDestination(settings.LOG_OUTPUT_DEST);
  if ("LOG_SERVER_URL" in settings) setLogServerURL(settings.LOG_SERVER_URL);
  if ("LOG_SERVER_TOKEN" in settings) setLogServerToken(settings.LOG_SERVER_TOKEN);
}

// Build the settings panel UI using Tweakpane (with Pickr for color fields)
export function buildSettingsPanel(rootElement, container) {
  try {
    log("INFO", "[settings] buildSettingsPanel called", { rootElement, container });

    // Ensure settings are loaded
    loadSettings().then(() => {
      // Clear panel
      rootElement.innerHTML = `
        <div id="settings-panel-container" style="width:100%;height:100%;background:#e7f8eb;display:flex;flex-direction:column;overflow:auto;">
          <div style="padding:10px 8px 4px 8px;font-weight:bold;font-size:1.2em;color:#0a6e2c;">
            Settings
            <button id="settings-save-btn" style="float:right;font-size:0.9em;">Save</button>
          </div>
          <div id="tweakpane-fields-div" style="flex:1 1 0;overflow:auto;padding:0 8px 8px 8px;"></div>
        </div>
      `;

      const fieldsDiv = rootElement.querySelector("#tweakpane-fields-div");
      const saveBtn = rootElement.querySelector("#settings-save-btn");

      // Tweakpane instance
      fieldsDiv.innerHTML = '';
      const pane = new Tweakpane({
        container: fieldsDiv,
        title: 'Settings',
        expanded: true
      });

      // Pickr color pickers
      const pickrInstances = {};

      // Helper: render a Tweakpane input for each setting
      settingsRegistry.forEach(reg => {
        const key = reg.key;
        if (reg.type === "boolean") {
          pane.addInput(AppState.settings, key, {
            label: reg.label,
          }).on('change', ev => {
            setSettingAndSave(key, ev.value);
          });
        } else if (reg.type === "number") {
          pane.addInput(AppState.settings, key, {
            label: reg.label,
            min: reg.min,
            max: reg.max,
            step: reg.step
          }).on('change', ev => {
            setSettingAndSave(key, ev.value);
          });
        } else if (reg.type === "pickr") {
          // For Pickr, create a div container in the tweakpane
          const pickrDiv = document.createElement("div");
          pickrDiv.id = "pickr-" + key;
          pickrDiv.style.display = "inline-block";
          pickrDiv.style.verticalAlign = "middle";
          pickrDiv.style.marginLeft = "1em";
          const label = document.createElement("label");
          label.textContent = reg.label;
          label.style.marginRight = "0.7em";
          const row = document.createElement("div");
          row.style.margin = "0.4em 0";
          row.appendChild(label);
          row.appendChild(pickrDiv);
          fieldsDiv.appendChild(row);

          setTimeout(() => {
            if (pickrInstances[key]) {
              pickrInstances[key].destroyAndRemove();
              delete pickrInstances[key];
            }
            pickrInstances[key] = Pickr.create({
              el: '#' + pickrDiv.id,
              theme: 'monolith',
              default: AppState.settings[key],
              components: { preview: true, opacity: true, hue: true, interaction: { hex: true, rgba: true, input: true } }
            });
            pickrInstances[key].on('change', color => {
              setSettingAndSave(key, color.toHEXA().toString());
            });
            pickrInstances[key].setColor(AppState.settings[key]);
          }, 1);
        } else if (reg.type === "select") {
          pane.addInput(AppState.settings, key, {
            label: reg.label,
            options: reg.options.reduce((acc, cur) => { acc[cur.value] = cur.label; return acc; }, {}),
          }).on('change', ev => {
            setSettingAndSave(key, ev.value);
          });
        } else if (reg.type === "text") {
          pane.addInput(AppState.settings, key, {
            label: reg.label,
          }).on('change', ev => {
            setSettingAndSave(key, ev.value);
          });
        }
      });

      // Save button
      saveBtn.onclick = async () => {
        await saveSettings();
        log("INFO", "[settings] Settings saved by user");
        alert("Settings saved!");
      };

      log("INFO", "[settings] Settings panel rendered (Tweakpane)");
    });
  } catch (e) {
    log("ERROR", "[settings] buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message);
    throw e;
  }
}

// Always patch setters at module load
export { setSettingAndSave as setSetting, setSettingsAndSave as setSettings };


