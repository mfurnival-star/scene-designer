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
 * - Now: TRACE-level entry/exit logging for all functions.
 * -----------------------------------------------------------
 */

import { AppState, setSettings, setSetting, getSetting } from './state.js';
import { log, setLogLevel, setLogDestination, setLogServerURL, setLogServerToken } from './log.js';
import Pickr from '@simonwep/pickr';
import { Pane as Tweakpane } from 'tweakpane';
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

export async function loadSettings() {
  log("TRACE", "[settings] loadSettings entry");
  try {
    const stored = (await localforage.getItem("sceneDesignerSettings")) || {};
    let merged = {};
    for (const reg of settingsRegistry) {
      merged[reg.key] = (reg.key in stored) ? stored[reg.key] : reg.default;
    }
    setSettings(merged);
    updateLogConfigFromSettings(merged);
    log("DEBUG", "[settings] Settings loaded", merged);
    log("TRACE", "[settings] loadSettings exit");
    return merged;
  } catch (e) {
    log("ERROR", "[settings] loadSettings error", e);
    log("TRACE", "[settings] loadSettings exit (error)");
    throw e;
  }
}

export async function saveSettings() {
  log("TRACE", "[settings] saveSettings entry");
  try {
    await localforage.setItem("sceneDesignerSettings", AppState.settings);
    updateLogConfigFromSettings(AppState.settings);
    log("DEBUG", "[settings] Settings saved", AppState.settings);
    log("TRACE", "[settings] saveSettings exit");
  } catch (e) {
    log("ERROR", "[settings] saveSettings error", e);
    log("TRACE", "[settings] saveSettings exit (error)");
    throw e;
  }
}

// Patch setSetting/setSettings to persist to localForage immediately and update log config
const _origSetSetting = setSetting;
const _origSetSettings = setSettings;
async function setSettingAndSave(key, value) {
  log("TRACE", "[settings] setSettingAndSave entry", { key, value });
  _origSetSetting(key, value);
  await saveSettings();
  log("DEBUG", "[settings] setSettingAndSave", { key, value });
  log("TRACE", "[settings] setSettingAndSave exit");
}
async function setSettingsAndSave(settingsObj) {
  log("TRACE", "[settings] setSettingsAndSave entry", settingsObj);
  _origSetSettings(settingsObj);
  await saveSettings();
  log("DEBUG", "[settings] setSettingsAndSave", settingsObj);
  log("TRACE", "[settings] setSettingsAndSave exit");
}

function updateLogConfigFromSettings(settings) {
  log("TRACE", "[settings] updateLogConfigFromSettings entry", settings);
  if (!settings) {
    log("TRACE", "[settings] updateLogConfigFromSettings exit (no settings)");
    return;
  }
  if ("DEBUG_LOG_LEVEL" in settings) setLogLevel(settings.DEBUG_LOG_LEVEL);
  if ("LOG_OUTPUT_DEST" in settings) setLogDestination(settings.LOG_OUTPUT_DEST);
  if ("LOG_SERVER_URL" in settings) setLogServerURL(settings.LOG_SERVER_URL);
  if ("LOG_SERVER_TOKEN" in settings) setLogServerToken(settings.LOG_SERVER_TOKEN);
  log("TRACE", "[settings] updateLogConfigFromSettings exit");
}

export function buildSettingsPanel(rootElement, container) {
  log("TRACE", "[settings] buildSettingsPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
  try {
    log("INFO", "[settings] buildSettingsPanel called", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      containerComponentName: container?.componentName
    });

    // Log Tweakpane and Pickr before usage for diagnostics
    log("DEBUG", "[settings] Tweakpane import check", { TweakpaneType: typeof Tweakpane });
    log("DEBUG", "[settings] Pickr import check", { PickrType: typeof Pickr });
    log("DEBUG", "[settings] settingsRegistry length", { len: settingsRegistry.length });

    loadSettings()
      .then(() => {
        log("TRACE", "[settings] buildSettingsPanel after loadSettings (resolved)", {
          AppStateSettings: AppState.settings
        });
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

        if (!fieldsDiv) {
          log("ERROR", "[settings] tweakpane-fields-div not found in DOM");
          rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed to render (missing tweakpane-fields-div)</div>`;
          log("TRACE", "[settings] buildSettingsPanel exit (missing fieldsDiv)");
          return;
        }

        let pane;
        try {
          pane = new Tweakpane({
            container: fieldsDiv,
            title: 'Settings',
            expanded: true
          });
        } catch (e) {
          log("ERROR", "[settings] Tweakpane instantiation failed", e);
          fieldsDiv.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane error (${e.message})</div>`;
          log("TRACE", "[settings] buildSettingsPanel exit (Tweakpane failed)");
          return;
        }

        // Pickr color pickers
        const pickrInstances = {};

        // Helper: render a Tweakpane input for each setting
        settingsRegistry.forEach(reg => {
          const key = reg.key;
          try {
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
          } catch (e) {
            log("ERROR", "[settings] Error rendering registry field", { key, reg, error: e });
          }
        });

        // Save button
        if (saveBtn) {
          saveBtn.onclick = async () => {
            await saveSettings();
            log("INFO", "[settings] Settings saved by user");
            alert("Settings saved!");
          };
        } else {
          log("WARN", "[settings] Save button not found");
        }

        log("INFO", "[settings] Settings panel rendered (Tweakpane)");
        log("TRACE", "[settings] buildSettingsPanel exit (rendered)");
      })
      .catch((e) => {
        log("ERROR", "[settings] Error in loadSettings().then for buildSettingsPanel", e);
        rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings failed to load: ${e.message}</div>`;
        log("TRACE", "[settings] buildSettingsPanel exit (loadSettings error)");
      });
  } catch (e) {
    log("ERROR", "[settings] buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message);
    log("TRACE", "[settings] buildSettingsPanel exit (error)");
    throw e;
  }
}

// Always patch setters at module load
export { setSettingAndSave as setSetting, setSettingsAndSave as setSettings };

