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
 * PART 2A: CanvasPanel - Image Display & Shape Placement
 * ------------------------------------------------------
 * Implements the Canvas panel logic for Golden Layout:
 *   - Displays an image (from upload or server select) using Konva.
 *   - Shapes are added by clicking the "Add" button, not by clicking the canvas.
 *   - Supports:
 *       - Point: reticle (circle + crosshair), draggable, selection halo
 *       - Rectangle: plain Konva.Rect, draggable, square corners, transformer on select
 *       - Circle: Konva.Circle, draggable, transformer on select
 *         - Circle always remains a true circle after resizing (no ellipse)
 *   - Shapes are placed at the visible center of the canvas panel.
 *   - Stroke width for rect/circle always remains 1, even after resizing.
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

  // Helper: Draw a point as a reticle (circle + crosshair + improved hit area)
  function makeReticlePointShape(x, y, color = "#2176ff") {
    const group = new Konva.Group({ x, y, draggable: true, name: "reticle-point" });

    // --- Invisible hit area for easier touch (MUST BE FIRST CHILD) ---
    const hitCircle = new Konva.Circle({
      x: 0,
      y: 0,
      radius: 22, // Larger for mobile touch
      fill: "#fff",
      opacity: 0,
      listening: true
    });
    group.add(hitCircle);

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

  // Helper: Make a Konva.Rect (draggable, square corners, transformer on select, strokeWidth always 1)
  function makeRectShape(x, y, width = 80, height = 48, stroke = "#2176ff", fill = "#ffffff00") {
    const rect = new Konva.Rect({
      x: x,
      y: y,
      width: width,
      height: height,
      stroke: stroke,
      strokeWidth: 1,
      fill: fill,
      opacity: 0.92,
      draggable: true,
      name: "rect-shape"
    });

    rect.showSelection = function(isSelected) {
      // No-op; selection is shown by Konva.Transformer
    };

    rect._type = "rect";
    rect._label = "Rectangle";
    rect.locked = false;

    rect.on("dragstart", () => {});
    rect.on("dragend", () => {});

    rect.on("mouseenter", () => {
      document.body.style.cursor = 'move';
    });
    rect.on("mouseleave", () => {
      document.body.style.cursor = '';
    });

    return rect;
  }

  // Helper: Make a Konva.Circle (draggable, transformer on select, strokeWidth always 1, always a true circle)
  function makeCircleShape(x, y, radius = 24, stroke = "#2176ff", fill = "#ffffff00") {
    const circle = new Konva.Circle({
      x: x,
      y: y,
      radius: radius,
      stroke: stroke,
      strokeWidth: 1,
      fill: fill,
      opacity: 0.92,
      draggable: true,
      name: "circle-shape"
    });

    circle.showSelection = function(isSelected) {
      // No-op; selection is shown by Konva.Transformer
    };

    circle._type = "circle";
    circle._label = "Circle";
    circle.locked = false;

    circle.on("dragstart", () => {});
    circle.on("dragend", () => {});

    circle.on("mouseenter", () => {
      document.body.style.cursor = 'move';
    });
    circle.on("mouseleave", () => {
      document.body.style.cursor = '';
    });

    return circle;
  }

  // Main builder for the Canvas panel
  window.buildCanvasPanel = async function (rootDiv, container, state) {
    clearNode(rootDiv);

    // --- 1. UI scaffolding ---
    // Canvas container for Konva
    const outer = document.createElement("div");
    outer.style.width = "100%";
    outer.style.height = "100%";
    outer.style.display = "block";
    outer.style.alignItems = "";
    outer.style.justifyContent = "";
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
    AppState.transformer = null;

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
      function selectShape(shape) {
        // Remove previous transformer
        if (AppState.transformer) {
          AppState.transformer.destroy();
          AppState.transformer = null;
        }
        if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection) {
          AppState.selectedShape.showSelection(false);
        }
        AppState.selectedShape = shape;
        if (!shape) return;

        if (shape._type === "rect" || shape._type === "circle") {
          const transformer = new Konva.Transformer({
            nodes: [shape],
            enabledAnchors: [
              "top-left", "top-center", "top-right",
              "middle-left", "middle-right",
              "bottom-left", "bottom-center", "bottom-right"
            ],
            rotateEnabled: true
          });
          layer.add(transformer);
          AppState.transformer = transformer;

          // Keep strokeWidth at 1 after transform
          transformer.on("transformend", () => {
            if (shape._type === "rect") {
              // Reset strokeWidth
              shape.strokeWidth(1);
              // Update size and reset scaling
              shape.width(shape.width() * shape.scaleX());
              shape.height(shape.height() * shape.scaleY());
              shape.scaleX(1);
              shape.scaleY(1);
            } else if (shape._type === "circle") {
              // Force to remain a true circle (no ellipse)
              // Use average scale in case user dragged non-uniformly
              const avgScale = (shape.scaleX() + shape.scaleY()) / 2;
              shape.strokeWidth(1);
              shape.radius(shape.radius() * avgScale);
              shape.scaleX(1);
              shape.scaleY(1);
            }
            layer.draw();
          });
          layer.draw();
        } else if (shape._type === "point") {
          shape.showSelection(true);
        }
      }

      function deselectShape() {
        if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection) {
          AppState.selectedShape.showSelection(false);
        }
        if (AppState.transformer) {
          AppState.transformer.destroy();
          AppState.transformer = null;
        }
        AppState.selectedShape = null;
        layer.draw();
      }

      stage.on("mousedown tap", function(evt) {
        if (evt.target === stage || evt.target === konvaImage) {
          deselectShape();
        } else if (evt.target.getParent()?.name() === "reticle-point" || evt.target.name() === "reticle-point") {
          if (AppState.selectedShape && AppState.selectedShape !== evt.target.getParent() && AppState.selectedShape.showSelection)
            AppState.selectedShape.showSelection(false);
          selectShape(evt.target.getParent());
        } else if (evt.target.name() === "rect-shape" || evt.target.name() === "circle-shape") {
          selectShape(evt.target);
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
      const canvasArea = document.getElementById("canvas-area");
      let x = Math.round(img.width / 2), y = Math.round(img.height / 2);

      if (canvasArea && AppState.konvaDiv) {
        const scrollLeft = AppState.konvaDiv.parentElement.scrollLeft || 0;
        const scrollTop = AppState.konvaDiv.parentElement.scrollTop || 0;
        const panelRect = canvasArea.getBoundingClientRect();
        const visibleWidth = Math.min(panelRect.width, img.width);
        const visibleHeight = Math.min(panelRect.height, img.height);
        x = Math.round(scrollLeft + visibleWidth / 2);
        y = Math.round(scrollTop + visibleHeight / 2);
        x = Math.max(0, Math.min(img.width, x));
        y = Math.max(0, Math.min(img.height, y));
      }
      const color = "#2176ff";
      const point = makeReticlePointShape(x, y, color);
      AppState.shapes.push(point);
      AppState.konvaLayer.add(point);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = point;
      point.showSelection(true);
    }

    function addRectShape() {
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) return;
      const defaultW = 80, defaultH = 48;
      const canvasArea = document.getElementById("canvas-area");
      let x = Math.round(img.width / 2 - defaultW / 2), y = Math.round(img.height / 2 - defaultH / 2);
      if (canvasArea && AppState.konvaDiv) {
        const scrollLeft = AppState.konvaDiv.parentElement.scrollLeft || 0;
        const scrollTop = AppState.konvaDiv.parentElement.scrollTop || 0;
        const panelRect = canvasArea.getBoundingClientRect();
        const visibleWidth = Math.min(panelRect.width, img.width);
        const visibleHeight = Math.min(panelRect.height, img.height);
        x = Math.round(scrollLeft + visibleWidth / 2 - defaultW / 2);
        y = Math.round(scrollTop + visibleHeight / 2 - defaultH / 2);
        x = Math.max(0, Math.min(img.width - defaultW, x));
        y = Math.max(0, Math.min(img.height - defaultH, y));
      }
      const stroke = "#2176ff";
      const fill = "#ffffff00";
      const rect = makeRectShape(x, y, defaultW, defaultH, stroke, fill);
      AppState.shapes.push(rect);
      AppState.konvaLayer.add(rect);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = rect;
      // Use transformer for selection/resize handles
      if (AppState.transformer) {
        AppState.transformer.destroy();
        AppState.transformer = null;
      }
      const transformer = new Konva.Transformer({
        nodes: [rect],
        enabledAnchors: [
          "top-left", "top-center", "top-right",
          "middle-left", "middle-right",
          "bottom-left", "bottom-center", "bottom-right"
        ],
        rotateEnabled: true
      });
      AppState.konvaLayer.add(transformer);
      AppState.transformer = transformer;
      AppState.konvaLayer.draw();

      // Keep strokeWidth at 1 after transform
      transformer.on("transformend", () => {
        rect.strokeWidth(1);
        rect.width(rect.width() * rect.scaleX());
        rect.height(rect.height() * rect.scaleY());
        rect.scaleX(1);
        rect.scaleY(1);
        AppState.konvaLayer.draw();
      });
    }

    function addCircleShape() {
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) return;
      const defaultRadius = 24;
      const canvasArea = document.getElementById("canvas-area");
      let x = Math.round(img.width / 2), y = Math.round(img.height / 2);
      if (canvasArea && AppState.konvaDiv) {
        const scrollLeft = AppState.konvaDiv.parentElement.scrollLeft || 0;
        const scrollTop = AppState.konvaDiv.parentElement.scrollTop || 0;
        const panelRect = canvasArea.getBoundingClientRect();
        const visibleWidth = Math.min(panelRect.width, img.width);
        const visibleHeight = Math.min(panelRect.height, img.height);
        x = Math.round(scrollLeft + visibleWidth / 2);
        y = Math.round(scrollTop + visibleHeight / 2);
        x = Math.max(defaultRadius, Math.min(img.width - defaultRadius, x));
        y = Math.max(defaultRadius, Math.min(img.height - defaultRadius, y));
      }
      const stroke = "#2176ff";
      const fill = "#ffffff00";
      const circle = makeCircleShape(x, y, defaultRadius, stroke, fill);
      AppState.shapes.push(circle);
      AppState.konvaLayer.add(circle);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = circle;
      // Use transformer for selection/resize handles
      if (AppState.transformer) {
        AppState.transformer.destroy();
        AppState.transformer = null;
      }
      const transformer = new Konva.Transformer({
        nodes: [circle],
        enabledAnchors: [
          "top-left", "top-center", "top-right",
          "middle-left", "middle-right",
          "bottom-left", "bottom-center", "bottom-right"
        ],
        rotateEnabled: true
      });
      AppState.konvaLayer.add(transformer);
      AppState.transformer = transformer;
      AppState.konvaLayer.draw();

      // Keep strokeWidth at 1 after transform, and always force shape to be a true circle (no ellipse)
      transformer.on("transformend", () => {
        // Compute average scale so both axes are the same
        const avgScale = (circle.scaleX() + circle.scaleY()) / 2;
        circle.strokeWidth(1);
        circle.radius(circle.radius() * avgScale);
        circle.scaleX(1);
        circle.scaleY(1);
        AppState.konvaLayer.draw();
      });
    }

    function addShapeFromToolbar() {
      const type = getSelectedShapeType();
      if (type === "point") {
        addPointShape();
      } else if (type === "rect") {
        addRectShape();
      } else if (type === "circle") {
        addCircleShape();
      } else {
        alert("Only point, rectangle, and circle shapes are implemented in this build.");
      }
    }

    // Wire up the "Add" button
    setTimeout(() => {
      const addBtn = document.getElementById("newBtn");
      if (addBtn) {
        addBtn.onclick = addShapeFromToolbar;
      }
    }, 0);
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
