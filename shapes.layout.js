// COPILOT_PART_layout: 2025-09-11T21:17:00Z
/*********************************************************
 * Golden Layout Bootstrapping & Panel Registration
 * - Defines logging system and settings registry
 * - Initializes Golden Layout with Sidebar, Canvas, Settings panels
 * - Registers panel builder hooks
 * - Exposes show/hide logic for Settings panel, myLayout for debugging
 *********************************************************/

/*************************************
 * Logging helper with log levels (ALWAYS ENABLE ERROR)
 * (Injected at top for easier debugging when settings panel is not available)
 *************************************/
window.LOG_LEVELS = window.LOG_LEVELS || { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };

// Centralized settings registry (to be used by settings panel and log system)
window._settingsRegistry = window._settingsRegistry || [
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
    default: "ERROR"
  },
  {
    key: "LOG_OUTPUT_DEST",
    label: "Log Output Destination",
    type: "select",
    options: [
      { value: "console", label: "Console Only" },
      { value: "server", label: "Server Only" },
      { value: "both", label: "Both" }
    ],
    default: "console"
  }
];

// Minimal settings backing store
window._settings = window._settings || {};
function getSetting(key) {
  if (key in window._settings) return window._settings[key];
  const reg = (window._settingsRegistry || []).find(s => s.key === key);
  return reg && "default" in reg ? reg.default : undefined;
}
function setSetting(key, value) {
  window._settings[key] = value;
  // Update log level immediately for log()
  if (key === "DEBUG_LOG_LEVEL") window._currentLogLevel = window.LOG_LEVELS[value] || window.LOG_LEVELS.ERROR;
}
window.getSetting = getSetting;
window.setSetting = setSetting;

// --- Robust log() system ---
window._currentLogLevel = window.LOG_LEVELS[getSetting("DEBUG_LOG_LEVEL") || "ERROR"];
function log(level, ...args) {
  let curLevel = window._currentLogLevel;
  // Allow runtime update via settings panel
  try {
    if (typeof window.getSetting === "function") {
      const setLevel = window.getSetting("DEBUG_LOG_LEVEL");
      curLevel = window.LOG_LEVELS[setLevel] !== undefined ? window.LOG_LEVELS[setLevel] : window._currentLogLevel;
      window._currentLogLevel = curLevel;
    }
  } catch (e) {}
  const msgLevel = window.LOG_LEVELS[level];
  if (msgLevel && curLevel >= msgLevel) {
    console.log(`[${level}]`, ...args);
    // Optionally stream logs for ERROR level
    if (typeof window._externalLogStream === "function") {
      try {
        window._externalLogStream(level, ...args);
      } catch (e) {}
    }
  }
}
function logEnter(fnName, ...args) {
  log("TRACE", `>> Enter ${fnName}`, ...args);
}
function logExit(fnName, ...result) {
  log("TRACE", `<< Exit ${fnName}`, ...result);
}

/*********************************************************
 * Golden Layout Bootstrapping & Panel Registration
 *********************************************************/

(function initGoldenLayout() {
  logEnter("initGoldenLayout");
  if (window._GL_HELLO_WORLD_INITIALIZED) {
    log("DEBUG", "Golden Layout already initialized");
    logExit("initGoldenLayout");
    return;
  }
  window._GL_HELLO_WORLD_INITIALIZED = true;

  function doInit() {
    logEnter("doInit");
    try {
      // ---- 1. Golden Layout default configuration ----
      const layoutConfig = {
        settings: {
          showPopoutIcon: false,
          showCloseIcon: false,
          showMaximiseIcon: false,
          hasHeaders: true
        },
        content: [{
          type: "row",
          content: [
            {
              type: "component",
              componentName: "CanvasPanel",
              title: "Canvas",
              width: 80 // main panel on the left
            },
            {
              type: "column",
              width: 20, // right-hand side column
              content: [
                {
                  type: "component",
                  componentName: "SidebarPanel",
                  title: "Shapes",
                  height: 50 // top half
                },
                {
                  type: "component",
                  componentName: "SettingsPanel",
                  title: "Settings",
                  height: 50, // bottom half
                  isClosable: true
                }
              ]
            }
          ]
        }]
      };

      // ---- 2. Create and attach Golden Layout instance ----
      const glRoot = document.getElementById("main-layout");
      if (!glRoot) {
        log("ERROR", "Golden Layout root #main-layout not found!");
        logExit("doInit");
        return;
      }
      while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

      const myLayout = new GoldenLayout(layoutConfig, glRoot);

      // ---- 3. Register panels ----
      myLayout.registerComponent("SidebarPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "sidebar";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSidebarPanel) {
          log("DEBUG", "buildSidebarPanel called");
          window.buildSidebarPanel(div, container, state);
        }
      });

      myLayout.registerComponent("CanvasPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "canvas-area";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildCanvasPanel) {
          log("DEBUG", "buildCanvasPanel called");
          window.buildCanvasPanel(div, container, state);
        }
      });

      myLayout.registerComponent("SettingsPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "settingsPanel";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSettingsPanel) {
          log("DEBUG", "buildSettingsPanel called");
          window.buildSettingsPanel(div, container, state);
        }
      });

      // ---- 4. Initialize layout ----
      myLayout.init();

      // ---- 5. Settings panel show/hide ----
      window.hideSettingsPanel = function() {
        const settings = myLayout.root.getItemsByFilter(item => item.config && item.config.componentName === "SettingsPanel");
        if (settings.length > 0) settings[0].remove();
      };
      window.showSettingsPanel = function() {
        const settings = myLayout.root.getItemsByFilter(item => item.config && item.config.componentName === "SettingsPanel");
        if (settings.length > 0) return;
        const row = myLayout.root.contentItems[0];
        row.addChild({
          type: "component",
          componentName: "SettingsPanel",
          title: "Settings",
          width: 18,
          isClosable: true
        });
      };

      // ---- 6. Expose layout for debugging ----
      window.myLayout = myLayout;

      // ---- 7. Ready event ----
      if (typeof window.onGoldenLayoutReady === "function") {
        window.onGoldenLayoutReady(myLayout);
      }
    } catch (e) {
      log("ERROR", "Exception in Golden Layout bootstrapping", e);
      throw e;
    }
    logExit("doInit");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
  logExit("initGoldenLayout");
})();
