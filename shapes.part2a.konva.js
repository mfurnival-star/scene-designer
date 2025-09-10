/*********************************************************
 * PART 2A: CanvasPanel - Image Display & Point & Rectangle Placement
 * ------------------------------------------------------
 * Implements the Canvas panel logic for Golden Layout:
 *   - Displays an image (from upload or server select) using Konva.
 *   - Shapes are added by clicking the "Add" button, not by clicking the canvas.
 *   - Supports "Point" shape: reticle (circle + crosshair), draggable (with hit area).
 *   - Supports "Rectangle" shape: plain Konva.Rect, square corners, draggable, transformer on select.
 *   - Shapes are placed at the visible center of the canvas panel.
 *   - Future: Circle support.
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

  // Helper: Make a classic Konva.Rect (draggable, square corners, transformer on select)
  function makeRectShape(x, y, width = 80, height = 48, stroke = "#2176ff", fill = "#ffffff00") {
    const rect = new Konva.Rect({
      x: x,
      y: y,
      width: width,
      height: height,
      stroke: stroke,
      strokeWidth: 2,
      fill: fill,
      opacity: 0.92,
      draggable: true,
      name: "rect-shape"
      // NO cornerRadius!
    });

    // For selection (for compatibility with old logic)
    rect.showSelection = function(isSelected) {
      // No-op; selection is shown by Konva.Transformer
    };

    rect._type = "rect";
    rect._label = "Rectangle";
    rect.locked = false;

    // Dragging: update state
    rect.on("dragstart", () => {
      // No custom visual needed; transformer handles show selection
    });
    rect.on("dragend", () => {
      // No custom visual needed
    });

    // UI cursor feedback
    rect.on("mouseenter", () => {
      document.body.style.cursor = 'move';
    });
    rect.on("mouseleave", () => {
      document.body.style.cursor = '';
    });

    return rect;
  }

  // Main builder for the Canvas panel
  window.buildCanvasPanel = async function (rootDiv, container, state) {
    clearNode(rootDiv);

    // --- 1. UI scaffolding ---
    // Canvas container for Konva
    const outer = document.createElement("div");
    outer.style.width = "100%";
    outer.style.height = "100%";
    outer.style.display = "block"; // anchor at top-left
    outer.style.alignItems = "";
    outer.style.justifyContent = "";
    outer.style.overflow = "auto"; // allow scrollbars if needed

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
      // Only one transformer (handles) at a time
      function selectShape(shape) {
        if (AppState.transformer) {
          AppState.transformer.destroy();
          AppState.transformer = null;
        }
        AppState.selectedShape = shape;
        if (!shape) return;

        if (shape._type === "rect") {
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
          layer.draw();
        } else if (shape._type === "point") {
          // No transformer for point, use custom selection
          shape.showSelection(true);
        }
      }

      // Deselect shape, remove transformer
      function deselectShape() {
        if (AppState.selectedShape && AppState.selectedShape._type === "point") {
          AppState.selectedShape.showSelection(false);
        }
        if (AppState.transformer) {
          AppState.transformer.destroy();
          AppState.transformer = null;
        }
        AppState.selectedShape = null;
        layer.draw();
      }

      // Click-to-select logic
      stage.on("mousedown tap", function(evt) {
        if (evt.target === stage || evt.target === konvaImage) {
          deselectShape();
        } else if (evt.target.getParent()?.name() === "reticle-point" || evt.target.name() === "reticle-point") {
          if (AppState.selectedShape && AppState.selectedShape !== evt.target.getParent() && AppState.selectedShape.showSelection)
            AppState.selectedShape.showSelection(false);
          selectShape(evt.target.getParent());
        } else if (evt.target.name() === "rect-shape") {
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

      // Find visible panel center within image
      const canvasArea = document.getElementById("canvas-area");
      let x = Math.round(img.width / 2), y = Math.round(img.height / 2); // fallback

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

      // select and show halo
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = point;
      point.showSelection(true);
    }

    function addRectShape() {
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) return;
      // Default size
      const defaultW = 80, defaultH = 48;
      // Center in visible panel
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

      // select and show transformer
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
    }

    function addShapeFromToolbar() {
      const type = getSelectedShapeType();
      if (type === "point") {
        addPointShape();
      } else if (type === "rect") {
        addRectShape();
      } else {
        alert("Only point and rectangle shapes are implemented in this build.");
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
