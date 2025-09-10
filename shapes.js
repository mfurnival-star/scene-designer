/*********************************************************
 * PART 0: Golden Layout Bootstrapping & Panel Registration (Hello World)
 * -------------------------------------------------------
 * This file initializes Golden Layout (GL) for the main workspace.
 *  - Panels: Sidebar | Canvas | Settings
 *  - Each panel renders a simple placeholder message for testing.
 *  - Header and toolbar remain outside the GL root (#main-layout).
 *
 * Integration:
 * - Add this file FIRST in your concatenation order for shapes.js.
 * - Requires index.html to have <div id="main-layout"></div> as the GL root.
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
        hasHeaders: false
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

    // ---- 3. Register "hello world" panels/components ----

    myLayout.registerComponent("SidebarPanel", function(container, state) {
      const div = document.createElement("div");
      div.id = "sidebar";
      div.style.height = "100%";
      div.style.display = "flex";
      div.style.flexDirection = "column";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";
      div.innerHTML = `<h2>Hello, Sidebar!</h2><p>This is the shape table panel.</p>`;
      container.getElement().append(div);
    });

    myLayout.registerComponent("CanvasPanel", function(container, state) {
      const div = document.createElement("div");
      div.id = "canvas-area";
      div.style.height = "100%";
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";
      div.innerHTML = `<h2>Hello, Canvas!</h2><p>This is where your image and shapes will be drawn.</p>`;
      container.getElement().append(div);
    });

    myLayout.registerComponent("SettingsPanel", function(container, state) {
      const div = document.createElement("div");
      div.id = "settingsPanel";
      div.style.height = "100%";
      div.style.display = "flex";
      div.style.flexDirection = "column";
      div.style.justifyContent = "center";
      div.style.alignItems = "center";
      div.innerHTML = `<h2>Hello, Settings!</h2><p>This is the settings panel.</p>`;
      container.getElement().append(div);
    });

    // ---- 4. Initialize layout ----
    myLayout.init();

    // ---- 5. Hide/show logic for Settings panel ----
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

/*********************************************************
 * PART 1: SidebarPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Sidebar panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real shape table,
 * replace this with the actual UI logic.
 *********************************************************/

window.buildSidebarPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Sidebar!";
  const p = document.createElement("p");
  p.innerText = "This is the shape table panel (sidebar).";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
/*********************************************************
 * PART 2: CanvasPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Canvas panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real canvas/image/konva logic,
 * replace this with the actual UI logic.
 *********************************************************/

window.buildCanvasPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Canvas!";
  const p = document.createElement("p");
  p.innerText = "This is where your image and shapes will be drawn.";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
/*********************************************************
 * PART 3: SettingsPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Settings panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real settings UI,
 * replace this with the actual logic/settings controls.
 *********************************************************/

window.buildSettingsPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Settings!";
  const p = document.createElement("p");
  p.innerText = "This is the settings panel.";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
/*********************************************************
 * PART 1: SidebarPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Sidebar panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real shape table,
 * replace this with the actual UI logic.
 *********************************************************/

window.buildSidebarPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Sidebar!";
  const p = document.createElement("p");
  p.innerText = "This is the shape table panel (sidebar).";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
/*********************************************************
 * PART 2: CanvasPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Canvas panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real canvas/image/konva logic,
 * replace this with the actual UI logic.
 *********************************************************/

window.buildCanvasPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Canvas!";
  const p = document.createElement("p");
  p.innerText = "This is where your image and shapes will be drawn.";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
/*********************************************************
 * PART 3: SettingsPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Settings panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real settings UI,
 * replace this with the actual logic/settings controls.
 *********************************************************/

window.buildSettingsPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Settings!";
  const p = document.createElement("p");
  p.innerText = "This is the settings panel.";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};

