/**
 * shapes.part1.settings.js
 * App settings and config management for scene-designer
 * - Loads/saves user settings (localStorage)
 * - Exports setupSettingsPanel for GL settings panel
 * - Handles settings form population and change events
 */

const DEFAULT_SETTINGS = {
  pointHitRadius: 12,
  defaultStrokeColor: "#2176ff",
  defaultFillColor: "#e3eeff",
  toolbarPosition: "top"
};

function getSetting(key) {
  const stored = localStorage.getItem("sceneDesignerSettings");
  let settings = DEFAULT_SETTINGS;
  if (stored) {
    try {
      settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(stored));
    } catch (e) {
      // ignore, use defaults
    }
  }
  return settings[key];
}

function saveSetting(key, value) {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem("sceneDesignerSettings")) || {};
  } catch (e) {}
  settings[key] = value;
  localStorage.setItem("sceneDesignerSettings", JSON.stringify(settings));
}

function setupSettingsPanel(containerId = "settingsPanel") {
  const panel = document.getElementById(containerId);
  if (!panel) return;

  // Settings UI (basic for now)
  panel.innerHTML = `
    <h2>Settings</h2>
    <form id="settingsForm">
      <label>
        Point Hit Radius:
        <input type="number" id="setting-pointHitRadius" value="${getSetting("pointHitRadius")}" min="1" max="40">
      </label>
      <label>
        Stroke Color:
        <input type="color" id="setting-defaultStrokeColor" value="${getSetting("defaultStrokeColor")}">
      </label>
      <label>
        Fill Color:
        <input type="color" id="setting-defaultFillColor" value="${getSetting("defaultFillColor")}">
      </label>
    </form>
  `;

  // Event listeners for settings changes
  panel.querySelector("#setting-pointHitRadius").addEventListener("change", e => {
    saveSetting("pointHitRadius", Number(e.target.value));
    if (window.redrawAllPoints) window.redrawAllPoints();
  });
  panel.querySelector("#setting-defaultStrokeColor").addEventListener("change", e => {
    saveSetting("defaultStrokeColor", e.target.value);
    if (window.redrawAllPoints) window.redrawAllPoints();
  });
  panel.querySelector("#setting-defaultFillColor").addEventListener("change", e => {
    saveSetting("defaultFillColor", e.target.value);
    if (window.redrawAllPoints) window.redrawAllPoints();
  });
}

if (typeof window !== "undefined") {
  window.getSetting = getSetting;
  window.saveSetting = saveSetting;
  window.setupSettingsPanel = setupSettingsPanel;
}

