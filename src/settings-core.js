/**
 * settings-core.js
 * -------------------------------------------------------------------
 * Scene Designer – Settings Core (ESM ONLY)
 * Purpose:
 * - Owns the settings registry, persistence (localForage), coercion/merging,
 *   and non-UI side effects (logging config, console interception, diagnostics).
 * - NO UI code here. The Tweakpane panel lives in settings-ui.js.
 *
 * Exports:
 * - LOG_LEVELS, LOG_LEVEL_LABEL_TO_NUM, LOG_LEVEL_NUM_TO_LABEL
 * - settingsRegistry
 * - loadSettings(), saveSettings()
 * - setSettingAndSave(key, value), setSettingsAndSave(obj)
 *
 * Dependencies:
 * - state.js (getState, setSettings, setSetting)
 * - log.js (log, setLogLevel, setLogDestination)
 * - console-stream.js (enable/disable/isConsoleInterceptionEnabled)
 * - localforage
 * - shapes.js (applyDiagnosticLabelsVisibility, setStrokeWidthForSelectedShapes)
 * -------------------------------------------------------------------
 */

import {
  getState,
  setSettings,
  setSetting
} from './state.js';
import {
  log,
  setLogLevel,
  setLogDestination,
} from './log.js';
import {
  enableConsoleInterception,
  disableConsoleInterception,
  isConsoleInterceptionEnabled
} from './console-stream.js';
import localforage from 'localforage';
import { applyDiagnosticLabelsVisibility, setStrokeWidthForSelectedShapes } from './shapes.js';

// --- Log Level Options (label and value are identical) ---
export const LOG_LEVELS = [
  { value: "Silent", label: "Silent" },
  { value: "Error", label: "Error" },
  { value: "Warning", label: "Warning" },
  { value: "Info", label: "Info" },
  { value: "Debug", label: "Debug" }
];
export const LOG_LEVEL_LABEL_TO_NUM = {
  "Silent": 0,
  "Error": 1,
  "Warning": 2,
  "Info": 3,
  "Debug": 4
};
export const LOG_LEVEL_NUM_TO_LABEL = [
  "Silent", "Error", "Warning", "Info", "Debug"
];

// --- Settings Registry ---
export const settingsRegistry = [
  // UI/UX
  { key: "multiDragBox", label: "Show Multi-Drag Box", type: "boolean", default: true },

  // Shape defaults
  { key: "defaultRectWidth", label: "Default Rectangle Width", type: "number", default: 50, min: 10, max: 300, step: 1 },
  { key: "defaultRectHeight", label: "Default Rectangle Height", type: "number", default: 30, min: 10, max: 200, step: 1 },
  { key: "defaultCircleRadius", label: "Default Circle Radius", type: "number", default: 15, min: 4, max: 100, step: 1 },
  { key: "defaultStrokeColor", label: "Default Stroke Color", type: "color", default: "#000000ff" },
  { key: "defaultFillColor", label: "Default Fill Color", type: "color", default: "#00000000" },
  { key: "defaultStrokeWidth", label: "Default Stroke Width (px)", type: "number", default: 1, min: 0.5, max: 10, step: 0.5 },

  // Point reticle customization
  {
    key: "reticleStyle",
    label: "Point Reticle Style",
    type: "select",
    options: [
      { value: "crosshair", label: "Crosshair" },
      { value: "crosshairHalo", label: "Crosshair + Halo" },
      { value: "bullseye", label: "Bullseye (rings)" },
      { value: "dot", label: "Dot" },
      { value: "target", label: "Target (ring + cross)" }
    ],
    default: "crosshairHalo"
  },
  { key: "reticleSize", label: "Point Reticle Size (px)", type: "number", default: 14, min: 4, max: 60, step: 1 },

  // Diagnostics
  { key: "showDiagnosticLabels", label: "Show Diagnostic Labels (IDs)", type: "boolean", default: false },

  // Canvas/image
  { key: "canvasMaxWidth", label: "Canvas Max Width (px)", type: "number", default: 430, min: 100, max: 4000, step: 10 },
  { key: "canvasMaxHeight", label: "Canvas Max Height (px)", type:  "number", default: 9999, min: 100, max: 4000, step: 10 },
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

  // Toolbar/UI
  {
    key: "toolbarUIScale",
    label: "Toolbar UI Scale",
    type: "number",
    default: 1,
    min: 0.5,
    max: 2,
    step: 0.05
  },
  {
    key: "shapeStartXPercent",
    label: "Shape Start X (%)",
    type: "number",
    default: 50,
    min: 0,
    max: 100,
    step: 1
  },
  {
    key: "shapeStartYPercent",
    label: "Shape Start Y (%)",
    type: "number",
    default: 50,
    min: 0,
    max: 100,
    step: 1
  },

  // Panels
  { key: "showErrorLogPanel", label: "Show Error Log Panel", type: "boolean", default: true },
  { key: "showScenarioRunner", label: "Show Scenario Runner (Debug)", type: "boolean", default: false },

  // Logging
  {
    key: "DEBUG_LOG_LEVEL",
    label: "Debug: Log Level",
    type: "select",
    options: LOG_LEVELS,
    default: "Info"
  },
  {
    key: "LOG_OUTPUT_DEST",
    label: "Log Output Destination",
    type: "select",
    options: [
      { value: "console", label: "console" },
      { value: "both", label: "both" }
    ],
    default: "console"
  },
  { key: "INTERCEPT_CONSOLE", label: "Intercept All Console Logs (for Mobile/Dev)", type: "boolean", default: false }
];

// --- Persistence using localForage (async) ---
localforage.config({
  name: 'scene-designer',
  storeName: 'settings'
});

// Normalize log level label (string) to number for runtime/log.js
function normalizeLogLevelNum(val) {
  if (typeof val === "string" && val in LOG_LEVEL_LABEL_TO_NUM) return LOG_LEVEL_LABEL_TO_NUM[val];
  if (typeof val === "number" && LOG_LEVEL_NUM_TO_LABEL[val]) return val;
  return 3; // Info
}

// --- Robust Boolean Coercion for FORCE Settings ---
function coerceBoolean(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val === "true" || val === "1") return true;
    if (val === "false" || val === "0") return false;
  }
  if (typeof val === "number") {
    return Boolean(val);
  }
  return false;
}

function mergeSettingsWithForce(stored) {
  log("DEBUG", "[settings-core] mergeSettingsWithForce", { stored });
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  const merged = {};
  for (const reg of settingsRegistry) {
    let val;
    if (forceMode && reg.key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
      val = window.SCENE_DESIGNER_FORCE_SETTINGS[reg.key];
      if (reg.type === "boolean") val = coerceBoolean(val);
      log("INFO", `[settings-core] FORCE MODE: Overriding ${reg.key} with forced value`, val);
    } else if (reg.key in stored) {
      val = stored[reg.key];
    } else {
      val = reg.default;
    }
    if (reg.key === "DEBUG_LOG_LEVEL") {
      if (typeof val === "number" && LOG_LEVEL_NUM_TO_LABEL[val]) val = LOG_LEVEL_NUM_TO_LABEL[val];
      if (typeof val !== "string" || !(val in LOG_LEVEL_LABEL_TO_NUM)) val = "Info";
    }
    merged[reg.key] = val;
  }
  log("DEBUG", "[settings-core] [merge] merged result", merged);
  return merged;
}

export async function loadSettings() {
  log("DEBUG", "[settings-core] loadSettings entry");
  try {
    let stored = (await localforage.getItem("sceneDesignerSettings")) || {};
    log("DEBUG", "[settings-core] loadSettings: raw stored from localforage:", stored);
    let merged = mergeSettingsWithForce(stored);
    setSettings(merged);
    updateLogConfigFromSettings(merged);
    updateConsoleInterceptionFromSettings(merged);
    // Apply diagnostic label visibility to all existing shapes
    try {
      applyDiagnosticLabelsVisibility(!!merged.showDiagnosticLabels);
    } catch (e) {
      log("WARN", "[settings-core] Applying diagnostic labels visibility failed (non-fatal)", e);
    }
    log("DEBUG", "[settings-core] Settings loaded and applied", merged);
    log("DEBUG", "[settings-core] Full settings after load", { settings: getState().settings });
    return merged;
  } catch (e) {
    log("ERROR", "[settings-core] loadSettings error", e);
    throw e;
  }
}

export async function saveSettings() {
  log("DEBUG", "[settings-core] saveSettings entry");
  try {
    const forceMode = typeof window !== "undefined" &&
      window.SCENE_DESIGNER_FORCE === true &&
      window.SCENE_DESIGNER_FORCE_SETTINGS &&
      typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
    let toSave = {};
    for (const reg of settingsRegistry) {
      if (forceMode && reg.key in window.SCENE_DESIGNER_FORCE_SETTINGS) continue;
      toSave[reg.key] = getState().settings[reg.key];
    }
    if ("DEBUG_LOG_LEVEL" in getState().settings) {
      let label = getState().settings.DEBUG_LOG_LEVEL;
      if (typeof label === "number" && LOG_LEVEL_NUM_TO_LABEL[label]) label = LOG_LEVEL_NUM_TO_LABEL[label];
      if (typeof label !== "string" || !(label in LOG_LEVEL_LABEL_TO_NUM)) label = "Info";
      toSave.DEBUG_LOG_LEVEL = label;
    }
    log("DEBUG", "[settings-core] saveSettings: about to persist", toSave);
    await localforage.setItem("sceneDesignerSettings", toSave);
    updateLogConfigFromSettings(getState().settings);
    updateConsoleInterceptionFromSettings(getState().settings);
    log("DEBUG", "[settings-core] Settings saved", toSave);
    log("DEBUG", "[settings-core] Full settings after save", { settings: getState().settings });
  } catch (e) {
    log("ERROR", "[settings-core] saveSettings error", e);
    throw e;
  }
}

export async function setSettingAndSave(key, value) {
  log("DEBUG", "[settings-core] setSettingAndSave entry", { key, value, type: typeof value });
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  if (forceMode && key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
    log("WARN", `[settings-core] setSettingAndSave: Attempted to save forced setting '${key}'; ignored.`);
    return;
  }
  let valToSet = value;
  if (key === "DEBUG_LOG_LEVEL") {
    if (typeof value === "number" && LOG_LEVEL_NUM_TO_LABEL[value]) valToSet = LOG_LEVEL_NUM_TO_LABEL[value];
    if (typeof valToSet !== "string" || !(valToSet in LOG_LEVEL_LABEL_TO_NUM)) valToSet = "Info";
    setLogLevelByNum(normalizeLogLevelNum(valToSet));
  }

  // Persist to store (synchronous, immediate for subscribers like layout.js)
  setSetting(key, valToSet);
  log("DEBUG", "[settings-core] setSettingAndSave: after setSetting", getState().settings);
  log("DEBUG", `[settings-core] setSettingAndSave: setting '${key}' changed`, { value: valToSet, fullSettings: getState().settings });

  // Side effects handled here for non-layout concerns
  if (key === "showDiagnosticLabels") {
    try {
      applyDiagnosticLabelsVisibility(!!valToSet);
      log("INFO", "[settings-core] Diagnostic labels visibility updated", { visible: !!valToSet });
    } catch (e) {
      log("ERROR", "[settings-core] Failed to update diagnostic labels visibility", e);
    }
  }

  if (key === "defaultStrokeWidth") {
    try {
      const w = Number(valToSet);
      if (!Number.isNaN(w) && w > 0) {
        setStrokeWidthForSelectedShapes(w);
        log("INFO", "[settings-core] Applied default stroke width to selected shapes", { width: w });
      }
    } catch (e) {
      log("ERROR", "[settings-core] Failed to apply default stroke width to selection", e);
    }
  }

  // Note: Panel visibility toggles (showErrorLogPanel, showScenarioRunner) are applied by layout.js via store subscription.

  await saveSettings();
  log("DEBUG", "[settings-core] setSettingAndSave exit");
}

export async function setSettingsAndSave(settingsObj) {
  log("DEBUG", "[settings-core] setSettingsAndSave entry", settingsObj);
  const forceMode = typeof window !== "undefined" &&
    window.SCENE_DESIGNER_FORCE === true &&
    window.SCENE_DESIGNER_FORCE_SETTINGS &&
    typeof window.SCENE_DESIGNER_FORCE_SETTINGS === "object";
  if (forceMode) {
    for (const key in window.SCENE_DESIGNER_FORCE_SETTINGS) {
      if (key in settingsObj) {
        log("WARN", `[settings-core] setSettingsAndSave: Attempted to save forced setting '${key}'; ignored.`);
        delete settingsObj[key];
      }
    }
  }
  if ("DEBUG_LOG_LEVEL" in settingsObj) {
    let label = settingsObj.DEBUG_LOG_LEVEL;
    if (typeof label === "number" && LOG_LEVEL_NUM_TO_LABEL[label]) label = LOG_LEVEL_NUM_TO_LABEL[label];
    if (typeof label !== "string" || !(label in LOG_LEVEL_LABEL_TO_NUM)) label = "Info";
    settingsObj.DEBUG_LOG_LEVEL = label;
    setLogLevelByNum(normalizeLogLevelNum(label));
  }

  // Persist to store
  setSettings(settingsObj);
  log("DEBUG", "[settings-core] setSettingsAndSave: after setSettings", getState().settings);
  log("DEBUG", "[settings-core] setSettingsAndSave: all settings changed", { fullSettings: getState().settings });

  // Side effects handled here for non-layout concerns
  if ("showDiagnosticLabels" in settingsObj) {
    try {
      applyDiagnosticLabelsVisibility(!!settingsObj.showDiagnosticLabels);
      log("INFO", "[settings-core] Diagnostic labels visibility updated (bulk)", { visible: !!settingsObj.showDiagnosticLabels });
    } catch (e) {
      log("ERROR", "[settings-core] Failed to update diagnostic labels visibility (bulk)", e);
    }
  }

  if ("defaultStrokeWidth" in settingsObj) {
    try {
      const w = Number(settingsObj.defaultStrokeWidth);
      if (!Number.isNaN(w) && w > 0) {
        setStrokeWidthForSelectedShapes(w);
        log("INFO", "[settings-core] Applied default stroke width to selected shapes (bulk)", { width: w });
      }
    } catch (e) {
      log("ERROR", "[settings-core] Failed to apply default stroke width to selection (bulk)", e);
    }
  }

  // Note: Panel visibility toggles (showErrorLogPanel, showScenarioRunner) are applied by layout.js via store subscription.

  await saveSettings();
  log("DEBUG", "[settings-core] setSettingsAndSave exit");
}

function setLogLevelByNum(numLevel) {
  let name = LOG_LEVEL_NUM_TO_LABEL[numLevel] ?? "Silent";
  setLogLevel(numLevel);
  log("DEBUG", "[settings-core] Log level changed", { numLevel, name });
}

function updateLogConfigFromSettings(settings) {
  if (!settings) return;
  if ("DEBUG_LOG_LEVEL" in settings) {
    const num = normalizeLogLevelNum(settings.DEBUG_LOG_LEVEL);
    setLogLevelByNum(num);
  }
  if ("LOG_OUTPUT_DEST" in settings) setLogDestination(settings.LOG_OUTPUT_DEST);
  log("DEBUG", "[settings-core] Logging config updated", {
    logLevel: settings.DEBUG_LOG_LEVEL,
    logDest: settings.LOG_OUTPUT_DEST
  });
}

function updateConsoleInterceptionFromSettings(settings) {
  if (!settings) return;
  if (settings.INTERCEPT_CONSOLE) {
    if (!isConsoleInterceptionEnabled()) {
      enableConsoleInterception();
      log("INFO", "[settings-core] Console interception ENABLED");
    }
  } else {
    if (isConsoleInterceptionEnabled()) {
      disableConsoleInterception();
      log("INFO", "[settings-core] Console interception DISABLED");
    }
  }
}

