/**
 * shapes.part7.layout.js
 * Golden Layout setup and integration for Shape Editor app
 * - Registers Canvas and Sidebar panels as GL components
 * - Sets up initial layout config (Canvas | Sidebar)
 * - Canvas panel calls setupCanvasPanel and setupImageLoaderHandlers
 * - Sidebar panel calls setupSidebar
 */

function registerGoldenLayout() {
  const layoutConfig = {
    settings: {
      showPopoutIcon: false,
      showMaximiseIcon: false,
      showCloseIcon: false,
      hasHeaders: false
    },
    content: [{
      type: "row",
      content: [
        {
          type: "component",
          componentName: "CanvasPanel",
          title: "Canvas",
          width: 70
        },
        {
          type: "component",
          componentName: "SidebarPanel",
          title: "Sidebar",
          width: 30
        }
      ]
    }]
  };

  const layoutRoot = document.getElementById("main-layout");
  layoutRoot.innerHTML = ""; // Remove any static markup

  // GoldenLayout global from CDN
  const myLayout = new GoldenLayout(layoutConfig, layoutRoot);

  // Register Canvas Panel
  myLayout.registerComponent("CanvasPanel", function(container, state) {
    // Canvas template: #container and #errorBox
    container.getElement().html('<main id="canvas-area"><div id="container"></div><div id="errorBox"></div></main>');
    // Setup canvas logic (Konva, handlers)
    if (window.setupCanvasPanel) window.setupCanvasPanel("container", window.setupImageLoaderHandlers);
  });

  // Register Sidebar Panel
  myLayout.registerComponent("SidebarPanel", function(container, state) {
    // Sidebar template: label box + labels list
    container.getElement().html(`
      <aside id="sidebar">
        <div id="labelEditBox">
          <label for="labelInput">Label:</label>
          <input type="text" id="labelInput" maxlength="40">
          <button type="button" id="saveLabelBtn">Save</button>
        </div>
        <div id="labels-list"></div>
      </aside>
    `);
    if (window.setupSidebar) window.setupSidebar();
  });

  myLayout.init();
}

if (typeof window !== "undefined") {
  window.registerGoldenLayout = registerGoldenLayout;
}

/**
 * Setup entrypoint (called by shapes.js after DOMContentLoaded)
 */
document.addEventListener("DOMContentLoaded", () => {
  registerGoldenLayout();
});
