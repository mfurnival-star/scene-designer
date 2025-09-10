/*********************************************************
 * PART 2A: CanvasPanel - Image Display & Point Placement
 * ------------------------------------------------------
 * This file implements the Canvas panel logic:
 *   - Displays an image (from upload or server select) using Konva.
 *   - Allows "Point" shape placement on click.
 *   - Points are displayed as small colored circles.
 *   - Integrates with image loader in header.
 *
 * Integration:
 * - Requires Konva.js loaded globally.
 * - Called by Golden Layout during CanvasPanel init.
 * - Depends on #canvas-area div being present in the panel.
 *********************************************************/

(function () {
  // Global app state for demo (replace with proper state mgmt later)
  window._sceneDesigner = window._sceneDesigner || {};
  const AppState = window._sceneDesigner;

  // Utility: Load image from file or URL, return a Promise that resolves to HTMLImageElement
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = "Anonymous"; // supports CORS for server images
      img.src = src;
    });
  }

  // Utility: Clear a DOM node
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
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
    // Store refs for resize/redraw
    AppState.konvaDiv = konvaDiv;
    AppState.konvaStage = null;
    AppState.konvaLayer = null;
    AppState.imageObj = null;
    AppState.points = AppState.points || [];

    // --- 3. Image loading logic ---
    // Function to actually set up the Konva Stage and Layer
    async function renderCanvas(imageSrc) {
      // Remove previous stage if exists
      if (AppState.konvaStage) {
        AppState.konvaStage.destroy();
        AppState.konvaStage = null;
      }
      clearNode(konvaDiv);

      if (!imageSrc) {
        // No image selected
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

      // Draw all points
      AppState.points.forEach(pt => drawPoint(pt, layer));

      layer.batchDraw();

      // --- 4. Click handler for placing points ---
      stage.on("mousedown touchstart", function (evt) {
        // Only add if shapeType is "point"
        const shapeType = document.getElementById("shapeType")?.value || "point";
        if (shapeType !== "point") return;

        // Don't add if click is not on image
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Add point to state
        const newPoint = {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          color: "#ff3b3b", // default color for now
        };
        AppState.points.push(newPoint);

        // Draw new point
        drawPoint(newPoint, layer);
        layer.batchDraw();
      });
    }

    // Helper: Draw a point shape at given location
    function drawPoint(pt, layer) {
      const circle = new Konva.Circle({
        x: pt.x,
        y: pt.y,
        radius: 7,
        fill: pt.color || "#ff3b3b",
        stroke: "#222",
        strokeWidth: 2,
        draggable: true,
        shadowColor: "#000",
        shadowBlur: 2,
        shadowOpacity: 0.2,
        name: "pointShape"
      });

      // Dragging: update point coordinates
      circle.on("dragend", function (evt) {
        pt.x = Math.round(circle.x());
        pt.y = Math.round(circle.y());
      });

      // Optional: highlight on hover
      circle.on("mouseenter", () => {
        document.body.style.cursor = "pointer";
        circle.stroke("#2176ff");
        layer.batchDraw();
      });
      circle.on("mouseleave", () => {
        document.body.style.cursor = "";
        circle.stroke("#222");
        layer.batchDraw();
      });

      layer.add(circle);
    }

    // --- 5. Image source management ---
    // Helper: get the current image source from app state or UI
    function getCurrentImageSrc() {
      // Priority: uploaded image > server image select
      if (AppState.uploadedImageURL) return AppState.uploadedImageURL;
      const serverSel = document.getElementById("serverImageSelect");
      if (serverSel && serverSel.value) {
        // adjust path as needed for your server; placeholder:
        return "images/" + serverSel.value;
      }
      return null;
    }

    // Listen to image loader UI
    function setupImageLoaderListeners() {
      // File upload
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

      // Server image select
      const serverSel = document.getElementById("serverImageSelect");
      if (serverSel) {
        serverSel.addEventListener("change", function (e) {
          AppState.uploadedImageURL = null; // clear uploaded image if picking from server
          const src = getCurrentImageSrc();
          renderCanvas(src);
        });
      }
    }

    setupImageLoaderListeners();

    // Initial render
    const startingImage = getCurrentImageSrc();
    await renderCanvas(startingImage);

    // --- 6. Responsive: re-render on resize ---
    // (Optional, for MVP: skip for now, or implement as needed)
  };

})();
