/*********************************************************
 * PART 0: Golden Layout Bootstrapping & Panel Registration
 * - Always enables at least ERROR level logging (even if settings panel is missing)
 * - Supports optional remote log streaming via window._externalLogStream
 * - Initializes Golden Layout with three panels (Sidebar, Canvas, Settings).
 * - Registers panel components and placeholder logic.
 * - Handles show/hide logic for Settings panel and exposes `myLayout` for debugging.
 * - Integration: Requires <div id="main-layout"></div> in index.html.
 *********************************************************/

/*************************************
 * Logging helper with log levels (ALWAYS ENABLE ERROR)
 * (Injected at top for easier debugging when settings panel is not available)
 *************************************/
window.LOG_LEVELS = window.LOG_LEVELS || { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };

// Always enable at least ERROR level logging if settings are not yet available
function getSetting(key) {
  // fallback for DEBUG_LOG_LEVEL
  if (key === "DEBUG_LOG_LEVEL") return "ERROR";
  // fallback for all others
  return undefined;
}

function log(level, ...args) {
  // Use ERROR level if settings not available
  let curLevel = window.LOG_LEVELS["ERROR"];
  try {
    // If settings panel is available, use its setting
    if (typeof window.getSetting === "function") curLevel = window.LOG_LEVELS[window.getSetting("DEBUG_LOG_LEVEL") || "ERROR"];
  } catch (e) {}
  const msgLevel = window.LOG_LEVELS[level];
  if (msgLevel && curLevel >= msgLevel) {
    console.log(`[${level}]`, ...args);
    // Stream logs to your server if stream function set
    if (typeof window._externalLogStream === "function" && level === "ERROR") {
      try {
        window._externalLogStream(level, ...args);
      } catch (e) {
        // avoid recursive logging
      }
    }
  }
}
function logEnter(fnName, ...args) {
  log("TRACE", `>> Enter ${fnName}`, ...args);
}
function logExit(fnName, ...result) {
  log("TRACE", `<< Exit ${fnName}`, ...result);
}

// Example: Set this function somewhere in your app to stream error logs to your server
// window._externalLogStream = function(level, ...args) {
//   try {
//     fetch("https://your-server/log", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ level, args, time: Date.now() })
//     });
//   } catch (e) {}
// };

/*********************************************************
 * Golden Layout Bootstrapping & Panel Registration
 *********************************************************/

(function initGoldenLayout() {
  if (window._GL_HELLO_WORLD_INITIALIZED) return;
  window._GL_HELLO_WORLD_INITIALIZED = true;

  function doInit() {
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
			    width: 60 // main panel on the left
			},
			{
			    type: "column",
			    width: 40, // right-hand side column
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
        return;
      }
      // Remove any previous children (if hot reload)
      while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

      const myLayout = new GoldenLayout(layoutConfig, glRoot);

      // ---- 3. Register panels ----

      myLayout.registerComponent("SidebarPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "sidebar";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSidebarPanel) {
          window.buildSidebarPanel(div, container, state);
        }
      });

      myLayout.registerComponent("CanvasPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "canvas-area";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildCanvasPanel) {
          window.buildCanvasPanel(div, container, state);
        }
      });

      myLayout.registerComponent("SettingsPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "settingsPanel";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSettingsPanel) {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
})();
