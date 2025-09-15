/**
 * settings.js
 * -------------------------------------------------------------------
 * Settings Panel for Scene Designer (Golden Layout)
 * - Dynamic settings UI using Tweakpane (ESM) for all controls and color pickers.
 * - All settings are stored in AppState.settings via state.js.
 * - Persists settings asynchronously using localForage (IndexedDB/localStorage fallback).
 * - All settings metadata is defined in settingsRegistry.
 * - Logging via log.js.
 * - Updates log.js config at runtime when log level/destination/server/token is changed.
 * - Now includes setting for enabling/disabling full console interception (for mobile/dev).
 * - Logging policy: Use INFO for panel/user actions, DEBUG for settings changes, ERROR for problems.
 * - TRACE-level entry/exit logging for all functions.
 * - Log level normalization and validation is enforced on save/load.
 * -------------------------------------------------------------------
 */

import { AppState, setSettings, setSetting, getSetting } from './state.js';
import { log, setLogLevel, setLogDestination, setLogServerURL, setLogServerToken } from './log.js';
import { enableConsoleInterception, disableConsoleInterception, isConsoleInterceptionEnabled } from './console-stream.js';
import { Pane } from 'tweakpane';
import localforage from 'localforage';
import { setErrorLogPanelVisible } from './layout.js';

// --- Log Level Options (UPPERCASE, no OFF, use SILENT for off) ---
const LOG_LEVEL_OPTIONS = [
  { value: "SILENT", label: "Silent" },
  { value: "ERROR", label: "Error" },
  { value: "WARN", label: "Warning" },
  { value: "INFO", label: "Info" },
  { value: "DEBUG", label: "Debug" },
  { value: "TRACE", label: "Trace (very verbose)" }
];
const LOG_LEVEL_VALUES = LOG_LEVEL_OPTIONS.map(opt => opt.value);

// --- Settings Registry ---
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
    type: "color",
    default: "#000000ff"
  },
  {
    key: "defaultFillColor",
    label: "Default Fill Color",
    type: "color",
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
    options: LOG_LEVEL_OPTIONS,
    default: "SILENT"
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
    key: "INTERCEPT_CONSOLE",
    label: "Intercept All Console Logs (for Mobile/Dev)",
    type: "boolean",
    default: false
  },
  {
    key: "showErrorLogPanel",
    label: "Show Error Log Panel",
    type: "boolean",
    default: true
  }
];

// --- Persistence using localForage (async) ---
localforage.config({
  name: 'scene-designer',
  storeName: 'settings'
});

// --- Merge in window._settings and window._externalLogServerURL on first load ---
// Only use window._settings if storage is empty for that key.
function mergeInitialSettingsFromWindow(stored) {
  let winSettings = {};
  if (typeof window !== "undefined" && window._settings && typeof window._settings === "object") {
    winSettings = { ...window._settings };
  }
  if (typeof window !== "undefined" && window._externalLogServerURL) {
    winSettings.LOG_SERVER_URL = window._externalLogServerURL;
  }
  if (typeof window !== "undefined" && window._externalLogServerToken) {
    winSettings.LOG_SERVER_TOKEN = window._externalLogServerToken;
  }
  // Normalize log level to UPPERCASE and map "OFF" to "SILENT"
  if ("DEBUG_LOG_LEVEL" in winSettings) {
    let v = String(winSettings.DEBUG_LOG_LEVEL).toUpperCase();
    if (v === "OFF") v = "SILENT";
    if (!LOG_LEVEL_VALUES.includes(v)) v = "SILENT";
    winSettings.DEBUG_LOG_LEVEL = v;
  }
  if ("LOG_OUTPUT_DEST" in winSettings) {
    winSettings.LOG_OUTPUT_DEST = String(winSettings.LOG_OUTPUT_DEST);
  }
  // Only use winSettings for keys not yet in stored
  const merged = { ...winSettings, ...stored };
  return merged;
}

// --- Normalize and validate log level ---
function normalizeLogLevel(val) {
  if (typeof val !== "string") return "SILENT";
  let v = val.toUpperCase();
  if (v === "OFF") v = "SILENT";
  if (!LOG_LEVEL_VALUES.includes(v)) v = "SILENT";
  return v;
}

export async function loadSettings() {
  log("TRACE", "[settings] loadSettings entry");
  try {
    let stored = (await localforage.getItem("sceneDesignerSettings")) || {};
    // Use window._settings only for keys not present in storage
    stored = mergeInitialSettingsFromWindow(stored);
    let merged = {};
    for (const reg of settingsRegistry) {
      let val = (reg.key in stored) ? stored[reg.key] : reg.default;
      // Always normalize log level to UPPERCASE and map "OFF" to "SILENT"
      if (reg.key === "DEBUG_LOG_LEVEL" && typeof val === "string") {
        val = normalizeLogLevel(val);
      }
      merged[reg.key] = val;
    }
    setSettings(merged);
    updateLogConfigFromSettings(merged);
    updateConsoleInterceptionFromSettings(merged);
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
    // Normalize log level before saving
    if (AppState.settings.DEBUG_LOG_LEVEL) {
      AppState.settings.DEBUG_LOG_LEVEL = normalizeLogLevel(AppState.settings.DEBUG_LOG_LEVEL);
    }
    await localforage.setItem("sceneDesignerSettings", AppState.settings);
    updateLogConfigFromSettings(AppState.settings);
    updateConsoleInterceptionFromSettings(AppState.settings);
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
export async function setSettingAndSave(key, value) {
  log("TRACE", "[settings] setSettingAndSave entry", { key, value });
  // Always normalize log level
  if (key === "DEBUG_LOG_LEVEL" && typeof value === "string") {
    value = normalizeLogLevel(value);
  }
  const prev = getSetting(key);
  _origSetSetting(key, value);
  await saveSettings();
  if (key === "showErrorLogPanel" && value !== prev) {
    log("INFO", "[settings] Show Error Log Panel toggled", { value });
    setErrorLogPanelVisible(value);
  }
  log("DEBUG", "[settings] setSettingAndSave", { key, value });
  log("TRACE", "[settings] setSettingAndSave exit");
}
export async function setSettingsAndSave(settingsObj) {
  log("TRACE", "[settings] setSettingsAndSave entry", settingsObj);
  if ("DEBUG_LOG_LEVEL" in settingsObj && typeof settingsObj.DEBUG_LOG_LEVEL === "string") {
    settingsObj.DEBUG_LOG_LEVEL = normalizeLogLevel(settingsObj.DEBUG_LOG_LEVEL);
  }
  _origSetSettings(settingsObj);
  await saveSettings();
  if (Object.prototype.hasOwnProperty.call(settingsObj, "showErrorLogPanel")) {
    setErrorLogPanelVisible(settingsObj.showErrorLogPanel);
  }
  log("DEBUG", "[settings] setSettingsAndSave", settingsObj);
  log("TRACE", "[settings] setSettingsAndSave exit");
}

function updateLogConfigFromSettings(settings) {
  log("TRACE", "[settings] updateLogConfigFromSettings entry", settings);
  if (!settings) {
    log("TRACE", "[settings] updateLogConfigFromSettings exit (no settings)");
    return;
  }
  if ("DEBUG_LOG_LEVEL" in settings) {
    let level = settings.DEBUG_LOG_LEVEL;
    if (typeof level === "string") {
      level = normalizeLogLevel(level);
    }
    setLogLevel(level);
  }
  if ("LOG_OUTPUT_DEST" in settings) setLogDestination(settings.LOG_OUTPUT_DEST);
  if ("LOG_SERVER_URL" in settings) setLogServerURL(settings.LOG_SERVER_URL);
  if ("LOG_SERVER_TOKEN" in settings) setLogServerToken(settings.LOG_SERVER_TOKEN);
  log("TRACE", "[settings] updateLogConfigFromSettings exit");
}

function updateConsoleInterceptionFromSettings(settings) {
  log("TRACE", "[settings] updateConsoleInterceptionFromSettings entry", settings);
  if (!settings) return;
  if (settings.INTERCEPT_CONSOLE) {
    if (!isConsoleInterceptionEnabled()) {
      enableConsoleInterception();
      log("INFO", "[settings] Console interception ENABLED");
    }
  } else {
    if (isConsoleInterceptionEnabled()) {
      disableConsoleInterception();
      log("INFO", "[settings] Console interception DISABLED");
    }
  }
  log("TRACE", "[settings] updateConsoleInterceptionFromSettings exit");
}

export function buildSettingsPanel(rootElement, container) {
  log("DEBUG", "[settings] buildSettingsPanel: TOP OF FUNCTION", {
    PaneType: typeof Pane,
    Pane
  });

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

    if (!rootElement) {
      log("ERROR", "[settings] buildSettingsPanel: rootElement is null or undefined");
      alert("Settings panel root element not found! (No content will be shown)");
      return;
    }
    if (rootElement.offsetParent === null) {
      log("ERROR", "[settings] buildSettingsPanel: rootElement is not visible (may be hidden)");
    }

    log("DEBUG", "[settings] Tweakpane import check (pre-panel)", { PaneType: typeof Pane, Pane });
    log("DEBUG", "[settings] settingsRegistry length", { len: settingsRegistry.length });

    if (typeof Pane !== "function") {
      rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane (Pane) not loaded as ES module.<br>
      Check your webpack and npm dependencies: tweakpane@4.x must be imported as <code>import { Pane } from 'tweakpane'</code>.</div>`;
      log("ERROR", "[settings] Pane (Tweakpane) is not a constructor/function! Check import.");
      return;
    }

    loadSettings()
      .then(() => {
        log("TRACE", "[settings] buildSettingsPanel after loadSettings (resolved)", {
          AppStateSettings: AppState.settings
        });

        const settingsPOJO = {};
        for (const reg of settingsRegistry) {
          if (!(reg.key in AppState.settings)) {
            AppState.settings[reg.key] = reg.default;
          }
          settingsPOJO[reg.key] = AppState.settings[reg.key];
        }
        log("DEBUG", "[settings] settingsPOJO plain object check", {
          proto: Object.getPrototypeOf(settingsPOJO),
          isPlain: Object.getPrototypeOf(settingsPOJO) === Object.prototype
        });

        log("DEBUG", "[settings] settingsPOJO keys/values", Object.entries(settingsPOJO));

        // UI: Only the settings fields, no header/title or save button, and white background
        rootElement.innerHTML = `
          <div id="settings-panel-container" style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;overflow:auto;">
            <div id="tweakpane-fields-div" style="flex:1 1 0;overflow:auto;padding:0 8px 8px 8px;"></div>
          </div>
        `;

        const fieldsDiv = rootElement.querySelector("#tweakpane-fields-div");

        if (!fieldsDiv) {
          log("ERROR", "[settings] tweakpane-fields-div not found in DOM");
          rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed to render (missing tweakpane-fields-div)</div>`;
          log("TRACE", "[settings] buildSettingsPanel exit (missing fieldsDiv)");
          return;
        }

        let pane;
        try {
          log("DEBUG", "[settings] Instantiating Tweakpane...", { PaneType: typeof Pane, Pane });
          pane = new Pane({
            container: fieldsDiv,
            expanded: true
          });
          log("DEBUG", "[settings] Tweakpane instance created", { paneType: typeof pane, pane });
        } catch (e) {
          log("ERROR", "[settings] Tweakpane instantiation failed", e);
          fieldsDiv.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane error (${e.message})</div>`;
          log("TRACE", "[settings] buildSettingsPanel exit (Tweakpane failed)");
          return;
        }

        settingsRegistry.forEach(reg => {
          const key = reg.key;
          try {
            if (reg.type === "boolean") {
              log("DEBUG", `[settings] Tweakpane addBinding: boolean for ${key}`);
              pane.addBinding(settingsPOJO, key, {
                label: reg.label,
              }).on('change', ev => {
                settingsPOJO[key] = ev.value;
                setSettingAndSave(key, ev.value);
              });
            } else if (reg.type === "number") {
              log("DEBUG", `[settings] Tweakpane addBinding: number for ${key}`);
              pane.addBinding(settingsPOJO, key, {
                label: reg.label,
                min: reg.min,
                max: reg.max,
                step: reg.step
              }).on('change', ev => {
                settingsPOJO[key] = ev.value;
                setSettingAndSave(key, ev.value);
              });
            } else if (reg.type === "color") {
              log("DEBUG", `[settings] Tweakpane addBinding: color for ${key}`);
              pane.addBinding(settingsPOJO, key, {
                label: reg.label,
                view: 'color'
              }).on('change', ev => {
                let val = ev.value;
                if (/^#[0-9a-f]{6}$/i.test(val)) val = val + "ff";
                settingsPOJO[key] = val;
                setSettingAndSave(key, val);
              });
            } else if (reg.type === "select") {
              log("DEBUG", `[settings] Tweakpane addBinding: select for ${key}`);
              pane.addBinding(settingsPOJO, key, {
                label: reg.label,
                options: reg.options.reduce((acc, cur) => { acc[cur.value] = cur.label; return acc; }, {}),
              }).on('change', ev => {
                let v = ev.value;
                // Always normalize log level
                if (key === "DEBUG_LOG_LEVEL" && typeof v === "string") {
                  v = normalizeLogLevel(v);
                }
                settingsPOJO[key] = v;
                setSettingAndSave(key, v);
              });
            } else if (reg.type === "text") {
              log("DEBUG", `[settings] Tweakpane addBinding: text for ${key}`);
              pane.addBinding(settingsPOJO, key, {
                label: reg.label,
              }).on('change', ev => {
                settingsPOJO[key] = ev.value;
                setSettingAndSave(key, ev.value);
              });
            }
          } catch (e) {
            log("ERROR", "[settings] Error rendering registry field", {
              key,
              reg,
              error: e,
              errorType: typeof e,
              message: e?.message,
              stack: e?.stack
            });
            alert(
              "Tweakpane error for setting: " + key + "\n\n" +
              (e && e.message ? e.message : e) +
              (e && e.stack ? "\n\n" + e.stack : "")
            );
          }
        });

        log("INFO", "[settings] Settings panel rendered (Tweakpane, no inner header)");
        log("TRACE", "[settings] buildSettingsPanel exit (rendered)");
      })
      .catch((e) => {
        log("ERROR", "[settings] Error in loadSettings().then for buildSettingsPanel", e);
        rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings failed to load: ${e.message}</div>`;
        log("TRACE", "[settings] buildSettingsPanel exit (loadSettings error)");
      });
  } catch (e) {
    log("ERROR", "[settings] buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message + (e && e.stack ? "\n\n" + e.stack : ""));
    log("TRACE", "[settings] buildSettingsPanel exit (error)");
    throw e;
  }
}

