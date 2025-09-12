// COPILOT_PART_layout: 2025-09-12T10:05:00Z
/*********************************************************
 * [layout] Golden Layout Bootstrapping & Panel Registration
 * --------------------------------------------------------
 * - Initializes Golden Layout with Sidebar, Canvas, and Settings panels.
 * - Registers panel builder hooks.
 * - Exposes show/hide logic for Settings panel, myLayout for debugging.
 * - Applies project logging schema (see COPILOT_MANIFESTO.md).
 *********************************************************/

// --- LOGGING HELPERS (module tag: [layout]) ---
function layout_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[layout]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[layout]", level, ...args);
  }
}
function layout_logEnter(fnName, ...args) { layout_log("TRACE", `>> Enter ${fnName}`, ...args); }
function layout_logExit(fnName, ...result) { layout_log("TRACE", `<< Exit ${fnName}`, ...result); }

// --- GOLDEN LAYOUT BOOTSTRAP ---
(function initGoldenLayout() {
  layout_logEnter("initGoldenLayout");
  if (window._GL_LAYOUT_INITIALIZED) {
    layout_log("DEBUG", "Golden Layout already initialized");
    layout_logExit("initGoldenLayout");
    return;
  }
  window._GL_LAYOUT_INITIALIZED = true;

  function doInit() {
    layout_logEnter("doInit");
    try {
      // 1. Layout config
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
              width: 80
            },
            {
              type: "column",
              width: 20,
              content: [
                {
                  type: "component",
                  componentName: "SidebarPanel",
                  title: "Shapes",
                  height: 50
                },
                {
                  type: "component",
                  componentName: "SettingsPanel",
                  title: "Settings",
                  height: 50,
                  isClosable: true
                }
              ]
            }
          ]
        }]
      };

      // 2. Find root
      const glRoot = document.getElementById("main-layout");
      if (!glRoot) {
        layout_log("ERROR", "Golden Layout root #main-layout not found!");
        layout_logExit("doInit");
        return;
      }
      while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

      const myLayout = new GoldenLayout(layoutConfig, glRoot);

      // 3. Register panels
      myLayout.registerComponent("SidebarPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "sidebar";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSidebarPanel) {
          layout_log("DEBUG", "buildSidebarPanel called");
          window.buildSidebarPanel(div, container, state);
        }
      });

      myLayout.registerComponent("CanvasPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "canvas-area";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildCanvasPanel) {
          layout_log("DEBUG", "buildCanvasPanel called");
          window.buildCanvasPanel(div, container, state);
        }
      });

      myLayout.registerComponent("SettingsPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "settingsPanel";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSettingsPanel) {
          layout_log("DEBUG", "buildSettingsPanel called");
          window.buildSettingsPanel(div, container, state);
        }
      });

      // 4. Initialize layout
      myLayout.init();

      // 5. Settings panel show/hide
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

      // 6. Expose layout for debugging
      window.myLayout = myLayout;

      // 7. Ready event
      if (typeof window.onGoldenLayoutReady === "function") {
        window.onGoldenLayoutReady(myLayout);
      }
    } catch (e) {
      layout_log("ERROR", "Exception in Golden Layout bootstrapping", e);
      throw e;
    }
    layout_logExit("doInit");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
  layout_logExit("initGoldenLayout");
})();

