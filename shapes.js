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
 * PART 2A: CanvasPanel - Image Display & Point Placement
 * ------------------------------------------------------
 * Implements the Canvas panel logic for Golden Layout:
 *   - Displays an image (from upload or server select) using Konva.
 *   - Shapes are added by clicking the "Add" button, not by clicking the canvas.
 *   - Supports "Point" shape: reticle (circle + crosshair), draggable.
 *   - Points are placed at a default position (centered, offset down).
 *   - Future: Rectangle and Circle support.
 *
 * Integration:
 * - Requires Konva.js loaded globally.
 * - Called by Golden Layout during CanvasPanel init.
 * - Depends on #canvas-area div being present in the panel.
 *********************************************************/

(function () {
  // App-wide state for the canvas panel
  window._sceneDesigner = window._sceneDesigner || {};
  const AppState = window._sceneDesigner;

  // Utility: Load image from file or URL, return a Promise that resolves to HTMLImageElement
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = "Anonymous";
      img.src = src;
    });
  }

  // Utility: Clear a DOM node
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // Helper: Draw a point as a reticle (circle + crosshair)
  function makeReticlePointShape(x, y, color = "#2176ff") {
    const group = new Konva.Group({ x, y, draggable: true, name: "reticle-point" });

    // Main circle (halo)
    const halo = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 12,
      stroke: color,
      strokeWidth: 2,
      opacity: 0.8,
      listening: false
    });

    // Crosshair lines
    const crossLen = 14;
    const crossH = new Konva.Line({
      points: [-crossLen / 2, 0, crossLen / 2, 0],
      stroke: color,
      strokeWidth: 2,
      lineCap: 'round',
      listening: false
    });
    const crossV = new Konva.Line({
      points: [0, -crossLen / 2, 0, crossLen / 2],
      stroke: color,
      strokeWidth: 2,
      lineCap: 'round',
      listening: false
    });

    // Select halo (thicker, only visible when selected)
    const selHalo = new Konva.Circle({
      x: 0, y: 0,
      radius: 16,
      stroke: "#0057d8",
      strokeWidth: 2,
      opacity: 0.6,
      visible: false,
      listening: false
    });

    group.add(selHalo);
    group.add(halo);
    group.add(crossH);
    group.add(crossV);

    // For selection
    group.showSelection = function(isSelected) {
      selHalo.visible(isSelected);
    };

    // For list/table
    group._type = "point";
    group._label = "Point";
    group.locked = false;

    // Dragging: update state and selection halo
    group.on("dragstart", () => {
      group.showSelection(true);
    });
    group.on("dragend", () => {
      group.showSelection(false);
      // Clamp to image bounds if needed (optional)
    });

    // UI cursor feedback
    group.on("mouseenter", () => {
      document.body.style.cursor = 'pointer';
    });
    group.on("mouseleave", () => {
      document.body.style.cursor = '';
    });

    return group;
  }

  // Main builder for the Canvas panel
  window.buildCanvasPanel = async function (rootDiv, container, state) {
    clearNode(rootDiv);

    // --- 1. UI scaffolding ---
    // Canvas container for Konva
    const outer = document.createElement("div");
    outer.style.width = "100%";
    outer.style.height = "100%";
    outer.style.display = "flex";
    outer.style.alignItems = "center";
    outer.style.justifyContent = "center";
    outer.style.overflow = "auto";

    // Konva container
    const konvaDiv = document.createElement("div");
    konvaDiv.id = "container";
    konvaDiv.style.background = "#eee";
    konvaDiv.style.display = "inline-block";
    outer.appendChild(konvaDiv);
    rootDiv.appendChild(outer);

    // --- 2. Setup state & handlers ---
    AppState.konvaDiv = konvaDiv;
    AppState.konvaStage = null;
    AppState.konvaLayer = null;
    AppState.imageObj = null;
    AppState.shapes = AppState.shapes || [];
    AppState.selectedShape = null;

    // --- 3. Image loading logic ---
    async function renderCanvas(imageSrc) {
      // Remove previous stage if exists
      if (AppState.konvaStage) {
        AppState.konvaStage.destroy();
        AppState.konvaStage = null;
      }
      clearNode(konvaDiv);

      if (!imageSrc) {
        const msg = document.createElement("div");
        msg.innerHTML = "<p style='text-align:center;font-size:1.1em;color:#888;'>Select or upload an image to begin.</p>";
        konvaDiv.appendChild(msg);
        return;
      }

      // Load image
      let img;
      try {
        img = await loadImage(imageSrc);
      } catch (e) {
        konvaDiv.innerHTML = "<p style='color:crimson;text-align:center;'>Failed to load image.</p>";
        return;
      }
      AppState.imageObj = img;

      // Set container size to image size
      konvaDiv.style.width = img.width + "px";
      konvaDiv.style.height = img.height + "px";

      // Create Konva stage and layer
      const stage = new Konva.Stage({
        container: konvaDiv,
        width: img.width,
        height: img.height,
      });
      const layer = new Konva.Layer();
      stage.add(layer);
      AppState.konvaStage = stage;
      AppState.konvaLayer = layer;

      // Image layer
      const konvaImage = new Konva.Image({
        image: img,
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        listening: false,
      });
      layer.add(konvaImage);

      // Draw all shapes
      for (const shape of AppState.shapes) {
        layer.add(shape);
      }
      layer.batchDraw();

      // --- 4. Selection logic (click shape to select) ---
      stage.on("mousedown tap", function(evt) {
        if (evt.target === stage || evt.target === konvaImage) {
          if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function") {
            AppState.selectedShape.showSelection(false);
            AppState.selectedShape = null;
          }
        } else if (evt.target.getParent()?.name() === "reticle-point") {
          // select parent group if child is clicked
          const group = evt.target.getParent();
          if (AppState.selectedShape && AppState.selectedShape !== group && AppState.selectedShape.showSelection)
            AppState.selectedShape.showSelection(false);
          AppState.selectedShape = group;
          group.showSelection(true);
        }
      });
    }

    // --- 5. Image source management ---
    function getCurrentImageSrc() {
      if (AppState.uploadedImageURL) return AppState.uploadedImageURL;
      const serverSel = document.getElementById("serverImageSelect");
      if (serverSel && serverSel.value) {
        return "images/" + serverSel.value;
      }
      return null;
    }

    // Listen to image loader UI
    function setupImageLoaderListeners() {
      const imageUpload = document.getElementById("imageUpload");
      if (imageUpload) {
        imageUpload.addEventListener("change", function (e) {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          AppState.uploadedImageURL = url;
          renderCanvas(url);
        });
      }
      const serverSel = document.getElementById("serverImageSelect");
      if (serverSel) {
        serverSel.addEventListener("change", function (e) {
          AppState.uploadedImageURL = null;
          const src = getCurrentImageSrc();
          renderCanvas(src);
        });
      }
    }

    setupImageLoaderListeners();

    // Initial render
    const startingImage = getCurrentImageSrc();
    await renderCanvas(startingImage);

    // --- 6. "Add" button logic for shape creation ---
    function getSelectedShapeType() {
      const sel = document.getElementById("shapeType");
      return sel ? sel.value : "point";
    }

    function addPointShape() {
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) return;
      // Default position: halfway across, same distance from left and from top
      const x = Math.round(img.width / 2);
      const y = Math.round(img.width / 2); // Note: width, not height, to match your original logic
      const color = "#2176ff";
      const point = makeReticlePointShape(x, y, color);
      AppState.shapes.push(point);
      AppState.konvaLayer.add(point);
      AppState.konvaLayer.batchDraw();
      // select and show halo
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = point;
      point.showSelection(true);
    }

    function addShapeFromToolbar() {
      const type = getSelectedShapeType();
      if (type === "point") {
        addPointShape();
      } else {
        // Rectangle and Circle logic to be implemented
        alert("Only point shape is implemented in this build.");
      }
    }

    // Wire up the "Add" button
    setTimeout(() => {
      const addBtn = document.getElementById("newBtn");
      if (addBtn) {
        addBtn.onclick = addShapeFromToolbar;
      }
    }, 0);

    // Remove any click-to-add logic from the canvas (enforced by not wiring it up).
  };
})();

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
