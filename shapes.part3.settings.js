// COPILOT_PART_3: 2025-09-11T14:39:00Z
/*********************************************************
 * PART 3: SettingsPanel Logic
 * ----------------------------------------
 * Implements the content and UI for the Settings panel.
 * Now provides a working "Log Level" selector wired to window.setSetting/getSetting,
 * affecting runtime logging verbosity for the modular log() system.
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
  // Registry-driven, but minimal UI for now
  const logLevelDiv = document.createElement("div");
  logLevelDiv.className = "settings-field";

  const logLabel = document.createElement("label");
  logLabel.setAttribute("for", "setting-DEBUG_LOG_LEVEL");
  logLabel.innerText = "Debug: Log Level";
  logLevelDiv.appendChild(logLabel);

  const select = document.createElement("select");
  select.id = "setting-DEBUG_LOG_LEVEL";
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
    select.appendChild(o);
  });
  // Use window.getSetting if available, else default to ERROR
  let currentLevel = "ERROR";
  if (typeof window.getSetting === "function") {
    currentLevel = window.getSetting("DEBUG_LOG_LEVEL") || "ERROR";
  }
  select.value = currentLevel;

  select.addEventListener("change", function() {
    if (typeof window.setSetting === "function") {
      window.setSetting("DEBUG_LOG_LEVEL", select.value);
    } else {
      // fallback for pre-settings systems
      window._settings = window._settings || {};
      window._settings["DEBUG_LOG_LEVEL"] = select.value;
    }
    // Optionally force log level update immediately
    if (window.LOG_LEVELS && window._currentLogLevel !== undefined) {
      window._currentLogLevel = window.LOG_LEVELS[select.value] || window.LOG_LEVELS.ERROR;
    }
    if (window.console && typeof window.console.log === "function") {
      window.console.log(`[SETTINGS] Log level set to ${select.value}`);
    }
  });

  logLevelDiv.appendChild(select);
  rootDiv.appendChild(logLevelDiv);

  // ---- Future: Add more settings here from registry ----
  // e.g. scene name, AND/OR logic, export options, etc.

  // Minimal styling for clarity
  rootDiv.style.fontFamily = "Segoe UI, Arial, sans-serif";
  rootDiv.style.fontSize = "16px";
  rootDiv.style.padding = "12px 8px";
};
