import { getState, setSettings, setSetting } from './state.js';
import { log, reconfigureLoggingFromSettings } from './log.js';

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

export const settingsRegistry = [
  { key: "defaultStrokeWidth", label: "Stroke Width", type: "number", default: 1, min: 1, max: 20, step: 1 },
  { key: "defaultStrokeColor", label: "Stroke Color", type: "color", default: "#2176ff" },
  { key: "defaultFillColor", label: "Fill Color", type: "color", default: "#00000000" },
  { key: "canvasMaxWidth", label: "Canvas Max Width", type: "number", default: 2000, min: 100, max: 2000, step: 1 },
  { key: "canvasMaxHeight", label: "Canvas Max Height", type: "number", default: 2000, min: 100, max: 2000, step: 1 },
  { key: "defaultRectWidth", label: "Rect Width", type: "number", default: 50, min: 10, max: 500, step: 1 },
  { key: "defaultRectHeight", label: "Rect Height", type: "number", default: 30, min: 10, max: 500, step: 1 },
  { key: "defaultCircleRadius", label: "Circle Radius", type: "number", default: 15, min: 2, max: 200, step: 1 },
  { key: "shapeStartXPercent", label: "Shape Start X (%)", type: "number", default: 10, min: 0, max: 100, step: 1 },
  { key: "shapeStartYPercent", label: "Shape Start Y (%)", type: "number", default: 5, min: 0, max: 100, step: 1 },
  { key: "toolbarUIScale", label: "Toolbar UI Scale", type: "number", default: 1, min: 0.5, max: 2, step: 0.1 },
  { key: "showDiagnosticLabels", label: "Show Diagnostic Labels", type: "boolean", default: false },
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
  { key: "showErrorLogPanel", label: "Show Error Log Panel", type: "boolean", default: false },
  { key: "showScenarioRunner", label: "Show Scenario Runner Panel", type: "boolean", default: false },
  { key: "canvasResponsive", label: "Responsive Canvas", type: "boolean", default: true },
  { key: "loupeEnabled", label: "Loupe (Enable)", type: "boolean", default: false },
  { key: "loupeSizePx", label: "Loupe Size (px)", type: "number", default: 160, min: 40, max: 400, step: 10 },
  { key: "loupeMagnification", label: "Loupe Magnification", type: "number", default: 2, min: 1, max: 8, step: 0.5 },
  { key: "loupeCrosshair", label: "Loupe Crosshair", type: "boolean", default: true },
  { key: "loupeOffsetXPx", label: "Loupe Offset X (px)", type: "number", default: 140, min: -800, max: 800, step: 10 },
  { key: "loupeOffsetYPx", label: "Loupe Offset Y (px)", type: "number", default: -140, min: -800, max: 800, step: 10 },
  { key: "loupeSmartTether", label: "Loupe Smart Tether", type: "boolean", default: true },
  { key: "loupeShowTether", label: "Loupe Show Tether", type: "boolean", default: true },
  { key: "showRightSidebarPanel", label: "Show Right Sidebar", type: "boolean", default: true },
  { key: "showSettingsPanel", label: "Show Settings Panel", type: "boolean", default: true },
  { key: "showHistoryPanel", label: "Show History Panel", type: "boolean", default: false }
];

const STORAGE_KEY = "sceneDesignerSettings";

export function loadSettings() {
  let stored = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch (e) {
    log("ERROR", "[settings-core] loadSettings parse failed", e);
  }

  const settingsOut = {};
  for (const reg of settingsRegistry) {
    const key = reg.key;
    const val = (key in stored) ? stored[key] : reg.default;
    settingsOut[key] = val;
  }

  setSettings(settingsOut);
  reconfigureLoggingFromSettings({
    level: settingsOut.DEBUG_LOG_LEVEL,
    dest: settingsOut.LOG_OUTPUT_DEST
  });
  log("INFO", "[settings-core] Settings loaded", { keys: Object.keys(settingsOut).length });
  return Promise.resolve(settingsOut);
}

export function saveSettings() {
  try {
    const settings = getState().settings || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    log("INFO", "[settings-core] Settings saved");
  } catch (e) {
    log("ERROR", "[settings-core] saveSettings error", e);
  }
}

export function setSettingAndSave(key, value) {
  setSetting(key, value);
  if (key === "DEBUG_LOG_LEVEL" || key === "LOG_OUTPUT_DEST") {
    reconfigureLoggingFromSettings({
      level: key === "DEBUG_LOG_LEVEL" ? value : getState().settings.DEBUG_LOG_LEVEL,
      dest: key === "LOG_OUTPUT_DEST" ? value : getState().settings.LOG_OUTPUT_DEST
    });
  }
  saveSettings();
  log("INFO", "[settings-core] Setting saved", { key });
}

export function setSettingsAndSave(settingsObj) {
  for (const [key, value] of Object.entries(settingsObj || {})) {
    setSetting(key, value);
  }
  reconfigureLoggingFromSettings({
    level: settingsObj.DEBUG_LOG_LEVEL ?? getState().settings.DEBUG_LOG_LEVEL,
    dest: settingsObj.LOG_OUTPUT_DEST ?? getState().settings.LOG_OUTPUT_DEST
  });
  saveSettings();
  log("INFO", "[settings-core] Settings batch saved");
}
