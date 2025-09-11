// COPILOT_PART_settings: 2025-09-11T21:27:00Z
/*********************************************************
 * SettingsPanel Logic (modular)
 * ----------------------------------------
 * Implements the content and UI for the Settings panel.
 * - Provides "Log Level" and "Log Output Destination" selectors.
 * - Both are wired to window.setSetting/getSetting,
 *   affecting runtime logging and streaming for the modular log() system.
 * - Will grow to support more settings as features expand.
 *********************************************************/

window.buildSettingsPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Settings Panel Title
  const h2 = document.createElement("h2");
  h2.innerText = "Settings";
  rootDiv.appendChild(h2);

  // --- Log Level Setting ---
  const logLevelDiv = document.createElement("div");
  logLevelDiv.className = "settings-field";

  const logLabel = document.createElement("label");
  logLabel.setAttribute("for", "setting-DEBUG_LOG_LEVEL");
  logLabel.innerText = "Debug: Log Level";
  logLevelDiv.appendChild(logLabel);

  const logLevelSelect = document.createElement("select");
  logLevelSelect.id = "setting-DEBUG_LOG_LEVEL";
  const levels = [
    {value: "OFF", label: "Off"},
    {value: "ERROR", label: "Error"},
    {value: "WARN", label: "Warning"},
    {value: "INFO", label: "Info"},
    {value: "DEBUG", label: "Debug"},
    {value: "TRACE", label: "Trace (very verbose)"}
  ];
  levels.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.innerText = opt.label;
    logLevelSelect.appendChild(o);
  });
  let currentLevel = "ERROR";
  if (typeof window.getSetting === "function") {
    currentLevel = window.getSetting("DEBUG_LOG_LEVEL") || "ERROR";
  }
  logLevelSelect.value = currentLevel;

  logLevelSelect.addEventListener("change", function() {
    if (typeof window.setSetting === "function") {
      window.setSetting("DEBUG_LOG_LEVEL", logLevelSelect.value);
    } else {
      window._settings = window._settings || {};
      window._settings["DEBUG_LOG_LEVEL"] = logLevelSelect.value;
    }
    if (window.LOG_LEVELS && window._currentLogLevel !== undefined) {
      window._currentLogLevel = window.LOG_LEVELS[logLevelSelect.value] || window.LOG_LEVELS.ERROR;
    }
    if (window.console && typeof window.console.log === "function") {
      window.console.log(`[SETTINGS] Log level set to ${logLevelSelect.value}`);
    }
  });

  logLevelDiv.appendChild(logLevelSelect);
  rootDiv.appendChild(logLevelDiv);

  // --- Log Output Destination Setting ---
  const logDestDiv = document.createElement("div");
  logDestDiv.className = "settings-field";
  const destLabel = document.createElement("label");
  destLabel.setAttribute("for", "setting-LOG_OUTPUT_DEST");
  destLabel.innerText = "Log Output Destination";
  logDestDiv.appendChild(destLabel);

  const logDestSelect = document.createElement("select");
  logDestSelect.id = "setting-LOG_OUTPUT_DEST";
  const destOptions = [
    { value: "console", label: "Console Only" },
    { value: "server", label: "Server Only" },
    { value: "both", label: "Both" }
  ];
  destOptions.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.innerText = opt.label;
    logDestSelect.appendChild(o);
  });
  let currentDest = "console";
  if (typeof window.getSetting === "function") {
    currentDest = window.getSetting("LOG_OUTPUT_DEST") || "console";
  }
  logDestSelect.value = currentDest;

  logDestSelect.addEventListener("change", function() {
    if (typeof window.setSetting === "function") {
      window.setSetting("LOG_OUTPUT_DEST", logDestSelect.value);
    } else {
      window._settings = window._settings || {};
      window._settings["LOG_OUTPUT_DEST"] = logDestSelect.value;
    }
    if (window.console && typeof window.console.log === "function") {
      window.console.log(`[SETTINGS] Log output destination set to ${logDestSelect.value}`);
    }
  });

  logDestDiv.appendChild(logDestSelect);
  rootDiv.appendChild(logDestDiv);

  // ---- Future: Add more settings here from registry ----

  // Minimal styling for clarity
  rootDiv.style.fontFamily = "Segoe UI, Arial, sans-serif";
  rootDiv.style.fontSize = "16px";
  rootDiv.style.padding = "12px 8px";
};
