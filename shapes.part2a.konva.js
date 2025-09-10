/*********************************************************
 * PART 2A: CanvasPanel - Image Display & Point Placement
 * ------------------------------------------------------
 * Implements the Canvas panel logic for Golden Layout:
 *   - Displays an image (from upload or server select) using Konva.
 *   - Shapes are added by clicking the "Add" button, not by clicking the canvas.
 *   - Supports "Point" shape: reticle (circle + crosshair), draggable (now with improved hit area for touch/mobile).
 *   - Points are placed at the visible center of the canvas panel.
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
        } else if (evt.target.getParent()?.name() === "reticle-point" || evt.target.name() === "reticle-point") {
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

      // Find visible panel center within image
      const canvasArea = document.getElementById("canvas-area");
      let x = Math.round(img.width / 2), y = Math.round(img.height / 2); // fallback

      if (canvasArea && AppState.konvaDiv) {
        // Get scroll position of canvas panel relative to image
        const scrollLeft = AppState.konvaDiv.parentElement.scrollLeft || 0;
        const scrollTop = AppState.konvaDiv.parentElement.scrollTop || 0;
        const panelRect = canvasArea.getBoundingClientRect();
        const containerRect = AppState.konvaDiv.getBoundingClientRect();

        const visibleWidth = Math.min(panelRect.width, img.width);
        const visibleHeight = Math.min(panelRect.height, img.height);

        // The visible center in image coordinates is:
        x = Math.round(scrollLeft + visibleWidth / 2);
        y = Math.round(scrollTop + visibleHeight / 2);

        // Clamp to image bounds
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

