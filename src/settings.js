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
  {
    key: "DEBUG_LOG_LEVEL",
    label: "Debug: Log Level",
    type: "select",
    options: LOG_LEVELS.map(l => ({ value: l.num, label: l.label })),
    default: 0 // SILENT
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
  { key: "showErrorLogPanel", label: "Show Error Log Panel", type: "boolean", default: true }
];

// --- Persistence using localForage (async) ---
localforage.config({
  name: 'scene-designer',
  storeName: 'settings'
});

/**
 * Merge settings using new force mode ONLY (no legacy HTML injection).
 * - If SCENE_DESIGNER_FORCE and SCENE_DESIGNER_FORCE_SETTINGS are present, use those keys as forced values.
 * - Otherwise, use storage, then registry defaults.
 * - All log level values are numbers only (no strings).
 */
function mergeSettingsWithForce(stored) {
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";

  // Build merged object in registry key order
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
    // Special: Normalize log level to number
    if (reg.key === "DEBUG_LOG_LEVEL") {
      val = normalizeLogLevelNum(val);
    }
    merged[reg.key] = val;
  }

  if (forceMode) {
    log("INFO", "[settings] FORCE MODE ACTIVE: SCENE_DESIGNER_FORCE_SETTINGS applied", window.SCENE_DESIGNER_FORCE_SETTINGS);
  }
  log("DEBUG", "[settings] [merge] storage:", stored);
  log("DEBUG", "[settings] [merge] merged result:", merged);
  return merged;
}

function normalizeLogLevelNum(val) {
  if (typeof val === "number" && LOG_LEVEL_NUMS.includes(val)) return val;
  // Allow string names for force/debugging, but always convert to number
  if (typeof val === "string" && val in LOG_LEVEL_NAME_TO_NUM) return LOG_LEVEL_NAME_TO_NUM[val];
  return 0; // SILENT
}

/**
 * Load settings from storage (with force mode if present).
 * - Always uses localForage as primary store unless force mode is active for a key.
 */
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
    log("TRACE", "[settings] loadSettings exit (error)");
    throw e;
  }
}

export async function saveSettings() {
  log("TRACE", "[settings] saveSettings entry");
  try {
    // Never save forced values to storage
    const forceMode = typeof window !== "undefined" &&
      window.SCENE_DESIGNER_FORCE === true &&
      window.SCENE_DESIGNER_FORCE_SETTINGS &&
      typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";

    let toSave = {};
    for (const reg of settingsRegistry) {
      // Don't persist forced keys (they are always overridden)
      if (forceMode && reg.key in window.SCENE_DESIGNER_FORCE_SETTINGS) continue;
      toSave[reg.key] = AppState.settings[reg.key];
    }
    if ("DEBUG_LOG_LEVEL" in AppState.settings) {
      toSave.DEBUG_LOG_LEVEL = normalizeLogLevelNum(AppState.settings.DEBUG_LOG_LEVEL);
    }
    log("DEBUG", "[settings] saveSettings: about to persist", toSave);
    await localforage.setItem("sceneDesignerSettings", toSave);
    updateLogConfigFromSettings(AppState.settings);
    updateConsoleInterceptionFromSettings(AppState.settings);
    log("DEBUG", "[settings] Settings saved", toSave);
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

  // Do not allow saving forced keys
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  if (forceMode && key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
    log("WARN", `[settings] setSettingAndSave: Attempted to save forced setting '${key}'; ignored.`);
    setLogLevelByNum(window.SCENE_DESIGNER_FORCE_SETTINGS.DEBUG_LOG_LEVEL ?? 0);
    return;
  }

  if (key === "DEBUG_LOG_LEVEL") {
    value = normalizeLogLevelNum(value);
    setLogLevelByNum(value); // <--- IMMEDIATE reconfiguration!
    log("DEBUG", "[settings] setSettingAndSave: setLogLevelByNum called immediately", value);
  }
  const prev = getSetting(key);
  _origSetSetting(key, value);
  log("DEBUG", "[settings] setSettingAndSave: after setSetting", AppState.settings);
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

  // Do not allow saving forced keys
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
    settingsObj.DEBUG_LOG_LEVEL = normalizeLogLevelNum(settingsObj.DEBUG_LOG_LEVEL);
    setLogLevelByNum(settingsObj.DEBUG_LOG_LEVEL); // <--- IMMEDIATE reconfiguration!
    log("DEBUG", "[settings] setSettingsAndSave: setLogLevelByNum called immediately", settingsObj.DEBUG_LOG_LEVEL);
  }
  _origSetSettings(settingsObj);
  log("DEBUG", "[settings] setSettingsAndSave: after setSettings", AppState.settings);
  await saveSettings();
  if (Object.prototype.hasOwnProperty.call(settingsObj, "showErrorLogPanel")) {
    setErrorLogPanelVisible(settingsObj.showErrorLogPanel);
  }
  log("DEBUG", "[settings] setSettingsAndSave", settingsObj);
  log("TRACE", "[settings] setSettingsAndSave exit");
}

function setLogLevelByNum(numLevel) {
  // Convert number to string for logger
  let name = LOG_LEVEL_NUM_TO_NAME[numLevel] ?? "SILENT";
  setLogLevel(name);
}

function updateLogConfigFromSettings(settings) {
  log("TRACE", "[settings] updateLogConfigFromSettings entry", settings);
  if (!settings) {
    log("TRACE", "[settings] updateLogConfigFromSettings exit (no settings)");
    return;
  }
  if ("DEBUG_LOG_LEVEL" in settings) {
    const num = normalizeLogLevelNum(settings.DEBUG_LOG_LEVEL);
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

    log("DEBUG", "[settings] Tweakpane import check (pre-panel)", { PaneType: typeof Pane, Pane });
    log("DEBUG", "[settings] settingsRegistry length", { len: settingsRegistry.length });

    if (typeof Pane !== "function") {
      rootElement.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane (Pane) not loaded as ES module.<br>
      Check your webpack and npm dependencies: tweakpane@4.x must be imported as <code>import { Pane } from 'tweakpane'</code>.</div>`;
      log("ERROR", "[settings] Pane (Tweakpane) is not a constructor/function! Check import.");
      return;
    }

    // --- CRITICAL: Always reload settings from AppState before building panel ---
    // This ensures that the latest, persisted settings are reflected in the UI, not a stale object.
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
              if (key === "DEBUG_LOG_LEVEL") {
                v = normalizeLogLevelNum(v);
                setLogLevelByNum(v); // <--- IMMEDIATE reconfiguration for select as well
                log("DEBUG", "[settings] Tweakpane onChange: setLogLevelByNum called immediately", v);
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
    };

    // --- Always reload the persisted settings before building the panel ---
    loadSettings().then(() => {
      log("DEBUG", "[settings] buildSettingsPanel: AppState.settings after loadSettings", AppState.settings);
      buildPanel();
    }).catch((e) => {
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
