/*********************************************************
 * PART 0: Golden Layout Bootstrapping & Panel Registration
 * (Standardized for modular structure)
 *********************************************************/

(function initGoldenLayout() {
  if (window._GL_HELLO_WORLD_INITIALIZED) return;
  window._GL_HELLO_WORLD_INITIALIZED = true;

  function doInit() {
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
            componentName: "SidebarPanel",
            title: "Shapes",
            width: 28 // percent
          },
          {
            type: "component",
            componentName: "CanvasPanel",
            title: "Canvas",
            width: 54
          },
          {
            type: "component",
            componentName: "SettingsPanel",
            title: "Settings",
            width: 18,
            isClosable: true
          }
        ]
      }]
    };

    // ---- 2. Create and attach Golden Layout instance ----
    const glRoot = document.getElementById("main-layout");
    if (!glRoot) {
      console.error("Golden Layout root #main-layout not found!");
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
})();
