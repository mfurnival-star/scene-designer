/**
 * settings-core.js
 * -------------------------------------------------------------------
 * Scene Designer – Settings Core Module (ESM ONLY)
 * Purpose:
 * - Centralized settings registry, persistence, mutators, and side effects.
 * - No UI logic; only registry, load/save, and mutator functions.
 * - Used by settings.js (facade), settings-ui.js (panel), and toolbar-color.js.
 *
 * Exports:
 * - LOG_LEVELS, LOG_LEVEL_LABEL_TO_NUM, LOG_LEVEL_NUM_TO_LABEL
 * - settingsRegistry
 * - loadSettings, saveSettings
 * - setSettingAndSave, setSettingsAndSave
 *
 * Dependencies:
 * - state.js (getState, setSettings, setSetting)
 * - log.js (log, reconfigureLoggingFromSettings)
 * -------------------------------------------------------------------
 */

import { getState, setSettings, setSetting } from './state.js';
import { log, reconfigureLoggingFromSettings } from './log.js';

// --- Log Level Constants ---
export const LOG_LEVELS = {
  Silent: 0,
  Error: 1,
  Warning: 2,
  Info: 3,
  Debug: 4
};

export const LOG_LEVEL_LABEL_TO_NUM = {
  Silent: 0,
  Error: 1,
  Warning: 2,
  Info: 3,
  Debug: 4
};

export const LOG_LEVEL_NUM_TO_LABEL = {
  0: "Silent",
  1: "Error",
  2: "Warning",
  3: "Info",
  4: "Debug"
};

// --- Settings Registry ---
// Each entry: { key, label, type, default, [min, max, step, options] }
export const settingsRegistry = [
  { key: "defaultStrokeWidth", label: "Stroke Width", type: "number", default: 1, min: 1, max: 20, step: 1 },
  { key: "defaultStrokeColor", label: "Stroke Color", type: "color", default: "#2176ff" },
  { key: "defaultFillColor", label: "Fill Color", type: "color", default: "#00000000" },
  { key: "canvasMaxWidth", label: "Canvas Max Width", type: "number", default: 2000, min: 100, max: 2000, step: 1 },
  { key: "canvasMaxHeight", label: "Canvas Max Height", type: "number", default: 2000, min: 100, max: 2000, step: 1 },
  { key: "defaultRectWidth", label: "Rect Width", type: "number", default: 50, min: 10, max: 500, step: 1 },
  { key: "defaultRectHeight", label: "Rect Height", type: "number", default: 30, min: 10, max: 500, step: 1 },
  { key: "defaultCircleRadius", label: "Circle Radius", type: "number", default: 15, min: 2, max: 200, step: 1 },
  { key: "shapeStartXPercent", label: "Shape Start X (%)", type: "number", default: 50, min: 0, max: 100, step: 1 },
  { key: "shapeStartYPercent", label: "Shape Start Y (%)", type: "number", default: 50, min: 0, max: 100, step: 1 },
  { key: "toolbarUIScale", label: "Toolbar UI Scale", type: "number", default: 1, min: 0.5, max: 2, step: 0.1 },
  { key: "showDiagnosticLabels", label: "Show Diagnostic Labels", type: "boolean", default: true },
  { key: "multiDragBox", label: "Show Multi-Drag Box", type: "boolean", default: true },
  { key: "reticleSize", label: "Point Reticle Size", type: "number", default: 14, min: 4, max: 60, step: 1 },
  { key: "reticleStyle", label: "Point Reticle Style", type: "select", default: "crosshairHalo", options: [
      { value: "crosshair", label: "Crosshair" },
      { value: "crosshairHalo", label: "Crosshair + Halo" },
      { value: "bullseye", label: "Bullseye" },
      { value: "dot", label: "Dot (center cutout)" },
      { value: "target", label: "Target (ring + cross)" }
    ]
  },
  { key: "DEBUG_LOG_LEVEL", label: "Debug Log Level", type: "select", default: "Info", options: [
      { value: "Silent", label: "Silent" },
      { value: "Error", label: "Error" },
      { value: "Warning", label: "Warning" },
      { value: "Info", label: "Info" },
      { value: "Debug", label: "Debug" }
    ]
  },
  { key: "LOG_OUTPUT_DEST", label: "Log Output", type: "select", default: "console", options: [
      { value: "console", label: "Console Only" },
      { value: "both", label: "Console + Remote" }
    ]
  },
  { key: "INTERCEPT_CONSOLE", label: "Intercept Console", type: "boolean", default: false },
  { key: "showErrorLogPanel", label: "Show Error Log Panel", type: "boolean", default: true },
  { key: "showScenarioRunner", label: "Show Scenario Runner Panel", type: "boolean", default: false },
  { key: "canvasResponsive", label: "Responsive Canvas", type: "boolean", default: true }
  // Add more settings here as needed
];

// --- Persistence Helpers ---
const STORAGE_KEY = "sceneDesignerSettings";

/**
 * Load settings from localStorage, apply defaults for missing keys,
 * and update the store.
 * Returns a Promise for async compatibility.
 */
export function loadSettings() {
  log("DEBUG", "[settings-core] loadSettings ENTRY");
  let stored = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch (e) {
    log("ERROR", "[settings-core] loadSettings: failed to parse", e);
  }

  // Apply defaults for missing keys
  const settingsOut = {};
  for (const reg of settingsRegistry) {
    const key = reg.key;
    const val = (key in stored) ? stored[key] : reg.default;
    settingsOut[key] = val;
  }

  setSettings(settingsOut);

  // Side effect: reconfigure logging if relevant settings present
  reconfigureLoggingFromSettings({
    level: settingsOut.DEBUG_LOG_LEVEL,
    dest: settingsOut.LOG_OUTPUT_DEST
  });

  log("INFO", "[settings-core] Settings loaded and applied", { settings: settingsOut });
  log("DEBUG", "[settings-core] loadSettings EXIT");
  return Promise.resolve(settingsOut);
}

/**
 * Save current settings to localStorage.
 */
export function saveSettings() {
  log("DEBUG", "[settings-core] saveSettings ENTRY");
  try {
    const settings = getState().settings || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    log("INFO", "[settings-core] Settings saved to localStorage", { settings });
  } catch (e) {
    log("ERROR", "[settings-core] saveSettings error", e);
  }
  log("DEBUG", "[settings-core] saveSettings EXIT");
}

/**
 * Set a single setting and persist.
 * Triggers relevant side effects.
 */
export function setSettingAndSave(key, value) {
  log("DEBUG", "[settings-core] setSettingAndSave ENTRY", { key, value });
  setSetting(key, value);

  // Side effect: if log settings, update logger
  if (key === "DEBUG_LOG_LEVEL" || key === "LOG_OUTPUT_DEST") {
    reconfigureLoggingFromSettings({
      level: key === "DEBUG_LOG_LEVEL" ? value : getState().settings.DEBUG_LOG_LEVEL,
      dest: key === "LOG_OUTPUT_DEST" ? value : getState().settings.LOG_OUTPUT_DEST
    });
  }

  saveSettings();
  log("INFO", "[settings-core] Setting updated and saved", { key, value });
  log("DEBUG", "[settings-core] setSettingAndSave EXIT");
}

/**
 * Set multiple settings and persist.
 * Accepts an object of key-value pairs.
 */
export function setSettingsAndSave(settingsObj) {
  log("DEBUG", "[settings-core] setSettingsAndSave ENTRY", { settingsObj });
  for (const [key, value] of Object.entries(settingsObj)) {
    setSetting(key, value);
  }

  // Side effect: reconfigure logger if log settings present
  reconfigureLoggingFromSettings({
    level: settingsObj.DEBUG_LOG_LEVEL ?? getState().settings.DEBUG_LOG_LEVEL,
    dest: settingsObj.LOG_OUTPUT_DEST ?? getState().settings.LOG_OUTPUT_DEST
  });

  saveSettings();
  log("INFO", "[settings-core] Multiple settings updated and saved", { settingsObj });
  log("DEBUG", "[settings-core] setSettingsAndSave EXIT");
}
