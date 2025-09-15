/**
 * settings.js
 * -------------------------------------------------------------------
 * Scene Designer – Settings Core/Panel (ESM ONLY, NO LEGACY HTML INJECTION)
 * - Robust settings system with force mode, no window._settings or other legacy globals.
 * - All config values from localForage (persistent browser storage) unless force mode is enabled.
 * - "Force mode": inject settings at deploy/debug time via SCENE_DESIGNER_FORCE/SCENE_DESIGNER_FORCE_SETTINGS in HTML.
 * - If force mode is enabled, SCENE_DESIGNER_FORCE_SETTINGS always overrides storage for those keys.
 * - All settings defaults come from settingsRegistry.
 * - LOG LEVEL IS STORED AND HANDLED AS A NUMBER (no strings, no backwards compatibility).
 * - Logs all loads, saves, and force actions via log.js.
 * - All imports/exports are ES module only, no window/global access.
 * - Adheres to Engineering Manifesto and file policies.
 * -------------------------------------------------------------------
 */

import { AppState, setSettings, setSetting, getSetting } from './state.js';
import { log, setLogLevel, setLogDestination, setLogServerURL, setLogServerToken } from './log.js';
import { enableConsoleInterception, disableConsoleInterception, isConsoleInterceptionEnabled } from './console-stream.js';
import { Pane } from 'tweakpane';
import localforage from 'localforage';
import { setErrorLogPanelVisible } from './layout.js';

// --- Log Level Options (NUMERIC, no strings, no OFF; 0 = SILENT) ---
export const LOG_LEVELS = [
  { num: 0, label: "Silent" },
  { num: 1, label: "Error" },
  { num: 2, label: "Warning" },
  { num: 3, label: "Info" },
  { num: 4, label: "Debug" },
  { num: 5, label: "Trace (very verbose)" }
];
export const LOG_LEVEL_NUMS = LOG_LEVELS.map(l => l.num);
export const LOG_LEVEL_NUM_TO_NAME = ["SILENT", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"];
export const LOG_LEVEL_NAME_TO_NUM = {
  "SILENT": 0,
  "ERROR": 1,
  "WARN": 2,
  "INFO": 3,
  "DEBUG": 4,
  "TRACE": 5
};

// --- Extra diagnostic dropdowns ---
export const settingsRegistry = [
  { key: "multiDragBox", label: "Show Multi-Drag Box", type: "boolean", default: true },
  { key: "defaultRectWidth", label: "Default Rectangle Width", type: "number", default: 50, min: 10, max: 300, step: 1 },
  { key: "defaultRectHeight", label: "Default Rectangle Height", type: "number", default: 30, min: 10, max: 200, step: 1 },
  { key: "defaultCircleRadius", label: "Default Circle Radius", type: "number", default: 15, min: 4, max: 100, step: 1 },
  { key: "defaultStrokeColor", label: "Default Stroke Color", type: "color", default: "#000000ff" },
  { key: "defaultFillColor", label: "Default Fill Color", type: "color", default: "#00000000" },
  { key: "canvasMaxWidth", label: "Canvas Max Width (px)", type: "number", default: 430, min: 100, max: 4000, step: 10 },
  { key: "canvasMaxHeight", label: "Canvas Max Height (px)", type: "number", default: 9999, min: 100, max: 4000, step: 10 },
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
  { key: "canvasResponsive", label: "Responsive: Resize on Window Change", type: "boolean", default: true },
  // --- The real debug log level select ---
  {
    key: "DEBUG_LOG_LEVEL",
    label: "Debug: Log Level (DIAGNOSTIC)",
    type: "select",
    options: LOG_LEVELS.map(l => ({ value: l.num, label: l.label })),
    default: 0 // SILENT
  },
  // --- Diagnostic: store the raw value passed from Tweakpane for log level select ---
  {
    key: "DEBUG_LOG_LEVEL_RAW",
    label: "[DIAG] Debug Log Level RAW Value",
    type: "text",
    default: ""
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
  { key: "LOG_SERVER_URL", label: "Log Server URL", type: "text", default: "" },
  { key: "LOG_SERVER_TOKEN", label: "Log Server Token", type: "text", default: "" },
  { key: "INTERCEPT_CONSOLE", label: "Intercept All Console Logs (for Mobile/Dev)", type: "boolean", default: false },
  { key: "showErrorLogPanel", label: "Show Error Log Panel", type: "boolean", default: true },
  // DIAGNOSTIC: Add more select dropdowns of various types
  {
    key: "TEST_SELECT_NUMERIC",
    label: "Test Select Numeric",
    type: "select",
    options: [
      { value: 0, label: "Zero" },
      { value: 1, label: "One" },
      { value: 2, label: "Two" }
    ],
    default: 1
  },
  {
    key: "TEST_SELECT_STRING",
    label: "Test Select String",
    type: "select",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" }
    ],
    default: "b"
  }
];

// --- Persistence using localForage (async) ---
localforage.config({
  name: 'scene-designer',
  storeName: 'settings'
});

function normalizeLogLevelNum(val) {
  if (typeof val === "number" && LOG_LEVEL_NUMS.includes(val)) return val;
  if (typeof val === "string" && /^\d+$/.test(val)) {
    const num = Number(val);
    if (LOG_LEVEL_NUMS.includes(num)) return num;
  }
  if (typeof val === "string" && val in LOG_LEVEL_NAME_TO_NUM) return LOG_LEVEL_NAME_TO_NUM[val];
  return 0; // SILENT
}

// --- DIAGNOSTIC: Log all settings merge, persist, and retrieval flows ---
function mergeSettingsWithForce(stored) {
  log("TRACE", "[settings] mergeSettingsWithForce", { stored });
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  const merged = {};
  for (const reg of settingsRegistry) {
    let val;
    if (forceMode && reg.key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
      val = window.SCENE_DESIGNER_FORCE_SETTINGS[reg.key];
      log("INFO", `[settings] FORCE MODE: Overriding ${reg.key} with forced value`, val);
    } else if (reg.key in stored) {
      val = stored[reg.key];
    } else {
      val = reg.default;
    }
    if (reg.key === "DEBUG_LOG_LEVEL") {
      log("TRACE", "[settings] merge DEBUG_LOG_LEVEL raw", val, typeof val);
      val = normalizeLogLevelNum(val);
      log("TRACE", "[settings] merge DEBUG_LOG_LEVEL normalized", val, typeof val);
    }
    merged[reg.key] = val;
  }
  log("DEBUG", "[settings] [merge] merged result", merged);
  return merged;
}

/** Load settings from storage (with force mode if present). */
export async function loadSettings() {
  log("TRACE", "[settings] loadSettings entry");
  try {
    let stored = (await localforage.getItem("sceneDesignerSettings")) || {};
    log("DEBUG", "[settings] loadSettings: raw stored from localforage:", stored);
    let merged = mergeSettingsWithForce(stored);
    setSettings(merged);
    updateLogConfigFromSettings(merged);
    updateConsoleInterceptionFromSettings(merged);
    log("DEBUG", "[settings] Settings loaded and applied", merged);
    log("TRACE", "[settings] loadSettings exit");
    return merged;
  } catch (e) {
    log("ERROR", "[settings] loadSettings error", e);
    throw e;
  }
}

export async function saveSettings() {
  log("TRACE", "[settings] saveSettings entry");
  try {
    const forceMode = typeof window !== "undefined" &&
      window.SCENE_DESIGNER_FORCE === true &&
      window.SCENE_DESIGNER_FORCE_SETTINGS &&
      typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
    let toSave = {};
    for (const reg of settingsRegistry) {
      if (forceMode && reg.key in window.SCENE_DESIGNER_FORCE_SETTINGS) continue;
      toSave[reg.key] = AppState.settings[reg.key];
    }
    // Always normalize DEBUG_LOG_LEVEL before saving
    if ("DEBUG_LOG_LEVEL" in AppState.settings) {
      log("TRACE", "[settings] saveSettings DEBUG_LOG_LEVEL raw", AppState.settings.DEBUG_LOG_LEVEL, typeof AppState.settings.DEBUG_LOG_LEVEL);
      toSave.DEBUG_LOG_LEVEL = normalizeLogLevelNum(AppState.settings.DEBUG_LOG_LEVEL);
      log("TRACE", "[settings] saveSettings DEBUG_LOG_LEVEL normalized", toSave.DEBUG_LOG_LEVEL, typeof toSave.DEBUG_LOG_LEVEL);
    }
    log("DEBUG", "[settings] saveSettings: about to persist", toSave);
    await localforage.setItem("sceneDesignerSettings", toSave);
    updateLogConfigFromSettings(AppState.settings);
    updateConsoleInterceptionFromSettings(AppState.settings);
    log("DEBUG", "[settings] Settings saved", toSave);
    log("TRACE", "[settings] saveSettings exit");
  } catch (e) {
    log("ERROR", "[settings] saveSettings error", e);
    throw e;
  }
}

// Patch setSetting/setSettings to persist to localForage immediately and update log config
const _origSetSetting = setSetting;
const _origSetSettings = setSettings;
export async function setSettingAndSave(key, value) {
  log("TRACE", "[settings] setSettingAndSave entry", { key, value, type: typeof value });
  // Do not allow saving forced keys
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  if (forceMode && key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
    log("WARN", `[settings] setSettingAndSave: Attempted to save forced setting '${key}'; ignored.`);
    return;
  }
  let valToSet = value;
  if (key === "DEBUG_LOG_LEVEL") {
    log("TRACE", "[settings] setSettingAndSave DEBUG_LOG_LEVEL incoming", value, typeof value);
    // Store the raw value for diagnostics
    _origSetSetting("DEBUG_LOG_LEVEL_RAW", value);
    valToSet = normalizeLogLevelNum(value);
    log("TRACE", "[settings] setSettingAndSave DEBUG_LOG_LEVEL normalized", valToSet, typeof valToSet);
    setLogLevelByNum(valToSet);
    log("DEBUG", "[settings] setSettingAndSave: setLogLevelByNum called", valToSet);
  }
  _origSetSetting(key, valToSet);
  log("DEBUG", "[settings] setSettingAndSave: after setSetting", AppState.settings);
  await saveSettings();
  if (key === "showErrorLogPanel") setErrorLogPanelVisible(valToSet);
  log("TRACE", "[settings] setSettingAndSave exit");
}
export async function setSettingsAndSave(settingsObj) {
  log("TRACE", "[settings] setSettingsAndSave entry", settingsObj);
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  if (forceMode) {
    for (const key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
      if (key in settingsObj) {
        log("WARN", `[settings] setSettingsAndSave: Attempted to save forced setting '${key}'; ignored.`);
        delete settingsObj[key];
      }
    }
  }
  if ("DEBUG_LOG_LEVEL" in settingsObj) {
    log("TRACE", "[settings] setSettingsAndSave DEBUG_LOG_LEVEL incoming", settingsObj.DEBUG_LOG_LEVEL, typeof settingsObj.DEBUG_LOG_LEVEL);
    // Store the raw value for diagnostics
    _origSetSetting("DEBUG_LOG_LEVEL_RAW", settingsObj.DEBUG_LOG_LEVEL);
    settingsObj.DEBUG_LOG_LEVEL = normalizeLogLevelNum(settingsObj.DEBUG_LOG_LEVEL);
    log("TRACE", "[settings] setSettingsAndSave DEBUG_LOG_LEVEL normalized", settingsObj.DEBUG_LOG_LEVEL, typeof settingsObj.DEBUG_LOG_LEVEL);
    setLogLevelByNum(settingsObj.DEBUG_LOG_LEVEL);
  }
  _origSetSettings(settingsObj);
  log("DEBUG", "[settings] setSettingsAndSave: after setSettings", AppState.settings);
  await saveSettings();
  if ("showErrorLogPanel" in settingsObj) setErrorLogPanelVisible(settingsObj.showErrorLogPanel);
  log("TRACE", "[settings] setSettingsAndSave exit");
}

function setLogLevelByNum(numLevel) {
  let name = LOG_LEVEL_NUM_TO_NAME[numLevel] ?? "SILENT";
  log("TRACE", "[settings] setLogLevelByNum", { numLevel, name });
  setLogLevel(name);
}

function updateLogConfigFromSettings(settings) {
  log("TRACE", "[settings] updateLogConfigFromSettings entry", settings);
  if (!settings) return;
  if ("DEBUG_LOG_LEVEL" in settings) {
    const num = normalizeLogLevelNum(settings.DEBUG_LOG_LEVEL);
    log("TRACE", "[settings] updateLogConfigFromSettings DEBUG_LOG_LEVEL", { raw: settings.DEBUG_LOG_LEVEL, num });
    setLogLevelByNum(num);
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
    if (typeof Pane !== "function") {
      rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane (Pane) not loaded as ES module.<br>
      Check your webpack and npm dependencies: tweakpane@4.x must be imported as <code>import { Pane } from 'tweakpane'</code>.</div>`;
      log("ERROR", "[settings] Pane (Tweakpane) is not a constructor/function! Check import.");
      return;
    }
    const buildPanel = () => {
      const settingsPOJO = {};
      for (const reg of settingsRegistry) {
        settingsPOJO[reg.key] = AppState.settings[reg.key];
      }
      log("DEBUG", "[settings] buildSettingsPanel: settingsPOJO for Tweakpane", settingsPOJO);
      rootElement.innerHTML = `
        <div id="settings-panel-container" style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;overflow:auto;">
          <div id="tweakpane-fields-div" style="flex:1 1 0;overflow:auto;padding:0 8px 8px 8px;"></div>
        </div>
      `;
      const fieldsDiv = rootElement.querySelector("#tweakpane-fields-div");
      if (!fieldsDiv) {
        log("ERROR", "[settings] tweakpane-fields-div not found in DOM");
        rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed to render (missing tweakpane-fields-div)</div>`;
        return;
      }
      let pane;
      try {
        log("DEBUG", "[settings] Instantiating Tweakpane...", { PaneType: typeof Pane, Pane });
        pane = new Pane({ container: fieldsDiv, expanded: true });
        log("DEBUG", "[settings] Tweakpane instance created", { paneType: typeof pane, pane });
      } catch (e) {
        log("ERROR", "[settings] Tweakpane instantiation failed", e);
        fieldsDiv.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane error (${e.message})</div>`;
        return;
      }
      settingsRegistry.forEach(reg => {
        const key = reg.key;
        try {
          const optionsObj = reg.options ? reg.options.reduce((acc, cur) => { acc[cur.value] = cur.label; return acc; }, {}) : undefined;
          if (reg.type === "select") {
            log("DEBUG", `[settings] Tweakpane addBinding: select for ${key}`);
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
              options: optionsObj
            }).on('change', ev => {
              log("TRACE", `[settings] Tweakpane select change: ${key}`, { value: ev.value, type: typeof ev.value });
              setSettingAndSave(key, ev.value);
            });
          } else if (reg.type === "boolean") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "number") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
              min: reg.min,
              max: reg.max,
              step: reg.step
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "color") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
              view: 'color'
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "text") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
            }).on('change', ev => setSettingAndSave(key, ev.value));
          }
        } catch (e) {
          log("ERROR", "[settings] Error rendering registry field", { key, reg, error: e });
          alert("Tweakpane error for setting: " + key + "\n\n" + (e && e.message ? e.message : e));
        }
      });
      log("INFO", "[settings] Settings panel rendered (Tweakpane, no inner header)");
    };
    loadSettings().then(() => {
      log("DEBUG", "[settings] buildSettingsPanel: AppState.settings after loadSettings", AppState.settings);
      buildPanel();
    }).catch((e) => {
      log("ERROR", "[settings] Error in loadSettings().then for buildSettingsPanel", e);
      rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings failed to load: ${e.message}</div>`;
    });
  } catch (e) {
    log("ERROR", "[settings] buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message + (e && e.stack ? "\n\n" + e.stack : ""));
    throw e;
  }
}
