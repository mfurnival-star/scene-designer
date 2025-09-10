/*********************************************************
 * PART 2A: CanvasPanel - Image Display & Shape Placement
 * ------------------------------------------------------
 * Implements the Canvas panel logic for Golden Layout:
 *   - Displays an image (from upload or server select) using Konva.
 *   - Shapes are added by clicking the "Add" button, not by clicking the canvas.
 *   - Supports:
 *       - Point: reticle (circle + crosshair), draggable, selection halo
 *       - Rectangle: Konva.Rect, draggable, square corners, transformer on select
 *       - Circle: Konva.Circle, draggable, transformer on select
 *         - Circle always remains a true circle after resizing (no ellipse)
 *         - Only 4 corner anchors, proportional scaling, no rotation
 *         - Resizing is clamped to a reasonable min/max radius to prevent vanishing or exploding
 *         - Circle radius is only updated on transformend, not live
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

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = "Anonymous";
      img.src = src;
    });
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function makeReticlePointShape(x, y, color = "#2176ff") {
    const group = new Konva.Group({ x, y, draggable: true, name: "reticle-point" });
    const hitCircle = new Konva.Circle({
      x: 0, y: 0, radius: 22,
      fill: "#fff", opacity: 0, listening: true
    });
    group.add(hitCircle);
    const halo = new Konva.Circle({
      x: 0, y: 0, radius: 12,
      stroke: color, strokeWidth: 2, opacity: 0.8, listening: false
    });
    const crossLen = 14;
    const crossH = new Konva.Line({
      points: [-crossLen / 2, 0, crossLen / 2, 0],
      stroke: color, strokeWidth: 2, lineCap: 'round', listening: false
    });
    const crossV = new Konva.Line({
      points: [0, -crossLen / 2, 0, crossLen / 2],
      stroke: color, strokeWidth: 2, lineCap: 'round', listening: false
    });
    const selHalo = new Konva.Circle({
      x: 0, y: 0, radius: 16,
      stroke: "#0057d8", strokeWidth: 2,
      opacity: 0.6, visible: false, listening: false
    });
    group.add(selHalo); group.add(halo); group.add(crossH); group.add(crossV);
    group.showSelection = function(isSelected) { selHalo.visible(isSelected); };
    group._type = "point"; group._label = "Point"; group.locked = false;
    group.on("dragstart", () => { group.showSelection(true); });
    group.on("dragend", () => { group.showSelection(false); });
    group.on("mouseenter", () => { document.body.style.cursor = 'pointer'; });
    group.on("mouseleave", () => { document.body.style.cursor = ''; });
    return group;
  }

  function makeRectShape(x, y, width = 80, height = 48, stroke = "#2176ff", fill = "#ffffff00") {
    const rect = new Konva.Rect({
      x: x, y: y, width: width, height: height,
      stroke: stroke, strokeWidth: 1,
      fill: fill, opacity: 0.92, draggable: true, name: "rect-shape"
    });
    rect.showSelection = function() {};
    rect._type = "rect"; rect._label = "Rectangle"; rect.locked = false;
    rect.on("mouseenter", () => { document.body.style.cursor = 'move'; });
    rect.on("mouseleave", () => { document.body.style.cursor = ''; });
    return rect;
  }

  function makeCircleShape(x, y, radius = 24, stroke = "#2176ff", fill = "#ffffff00") {
    const circle = new Konva.Circle({
      x: x, y: y, radius: radius,
      stroke: stroke, strokeWidth: 1,
      fill: fill, opacity: 0.92, draggable: true, name: "circle-shape"
    });
    circle.showSelection = function() {};
    circle._type = "circle"; circle._label = "Circle"; circle.locked = false;
    circle.on("mouseenter", () => { document.body.style.cursor = 'move'; });
    circle.on("mouseleave", () => { document.body.style.cursor = ''; });
    return circle;
  }

  window.buildCanvasPanel = async function (rootDiv, container, state) {
    clearNode(rootDiv);
    const outer = document.createElement("div");
    outer.style.width = "100%";
    outer.style.height = "100%";
    outer.style.display = "block";
    outer.style.overflow = "auto";
    const konvaDiv = document.createElement("div");
    konvaDiv.id = "container";
    konvaDiv.style.background = "#eee";
    konvaDiv.style.display = "inline-block";
    outer.appendChild(konvaDiv);
    rootDiv.appendChild(outer);

    AppState.konvaDiv = konvaDiv;
    AppState.konvaStage = null;
    AppState.konvaLayer = null;
    AppState.imageObj = null;
    AppState.shapes = AppState.shapes || [];
    AppState.selectedShape = null;
    AppState.transformer = null;

    async function renderCanvas(imageSrc) {
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

      let img;
      try { img = await loadImage(imageSrc); }
      catch (e) {
        konvaDiv.innerHTML = "<p style='color:crimson;text-align:center;'>Failed to load image.</p>";
        return;
      }
      AppState.imageObj = img;
      konvaDiv.style.width = img.width + "px";
      konvaDiv.style.height = img.height + "px";
      const stage = new Konva.Stage({
        container: konvaDiv, width: img.width, height: img.height,
      });
      const layer = new Konva.Layer();
      stage.add(layer);
      AppState.konvaStage = stage;
      AppState.konvaLayer = layer;
      const konvaImage = new Konva.Image({
        image: img,
        x: 0, y: 0, width: img.width, height: img.height, listening: false,
      });
      layer.add(konvaImage);

      for (const shape of AppState.shapes) {
        layer.add(shape);
      }
      layer.batchDraw();

      function selectShape(shape) {
        if (AppState.transformer) {
          AppState.transformer.destroy();
          AppState.transformer = null;
        }
        if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection)
          AppState.selectedShape.showSelection(false);
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
          transformer.on("transformend", () => {
            shape.strokeWidth(1);
            shape.width(shape.width() * shape.scaleX());
            shape.height(shape.height() * shape.scaleY());
            shape.scaleX(1);
            shape.scaleY(1);
            layer.draw();
          });
          layer.draw();
        } else if (shape._type === "circle") {
          // Only 4 anchors, proportional scaling, no rotation, radius only updated on transformend
          const minRadius = 4;
          const maxRadius = Math.min(layer.width(), layer.height()) / 2 - 2;
          const transformer = new Konva.Transformer({
            nodes: [shape],
            enabledAnchors: [
              "top-left", "top-right", "bottom-left", "bottom-right"
            ],
            rotateEnabled: false,
            boundBoxFunc: function(oldBox, newBox) {
              // Force proportional scaling
              const size = Math.max(newBox.width, newBox.height);
              return {
                x: newBox.x,
                y: newBox.y,
                width: size,
                height: size
              };
            }
          });
          layer.add(transformer);
          AppState.transformer = transformer;
          // Do NOT update radius live, only on transformend
          transformer.on("transform", () => {
            // Preview: force proportional and keep stroke width, but don't update radius
            shape.scaleY(shape.scaleX());
            shape.strokeWidth(1);
            layer.batchDraw();
          });
          transformer.on("transformend", () => {
            // On end, update radius and clamp
            let scale = shape.scaleX();
            let newRadius = shape.radius() * scale;
            if (newRadius < minRadius) newRadius = minRadius;
            if (newRadius > maxRadius) newRadius = maxRadius;
            shape.radius(newRadius);
            shape.scaleX(1);
            shape.scaleY(1);
            shape.strokeWidth(1);
            layer.batchDraw();
          });
          layer.draw();
        } else if (shape._type === "point") {
          shape.showSelection(true);
        }
      }

      function deselectShape() {
        if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection)
          AppState.selectedShape.showSelection(false);
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

    function getCurrentImageSrc() {
      if (AppState.uploadedImageURL) return AppState.uploadedImageURL;
      const serverSel = document.getElementById("serverImageSelect");
      if (serverSel && serverSel.value) {
        return "images/" + serverSel.value;
      }
      return null;
    }

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
    const startingImage = getCurrentImageSrc();
    await renderCanvas(startingImage);

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
      if (AppState.transformer) {
        AppState.transformer.destroy();
        AppState.transformer = null;
      }
      // Only 4 corner anchors, proportional scaling, no rotation
      const minRadius = 4;
      const maxRadius =
        Math.min(AppState.konvaLayer.width(), AppState.konvaLayer.height()) / 2 - 2;
      const transformer = new Konva.Transformer({
        nodes: [circle],
        enabledAnchors: [
          "top-left", "top-right", "bottom-left", "bottom-right"
        ],
        rotateEnabled: false,
        boundBoxFunc: function(oldBox, newBox) {
          const size = Math.max(newBox.width, newBox.height);
          return {
            x: newBox.x,
            y: newBox.y,
            width: size,
            height: size
          };
        }
      });
      AppState.konvaLayer.add(transformer);
      AppState.transformer = transformer;
      AppState.konvaLayer.draw();
      transformer.on("transform", () => {
        // Just preview proportional scaling, don't update radius live
        circle.scaleY(circle.scaleX());
        circle.strokeWidth(1);
        AppState.konvaLayer.batchDraw();
      });
      transformer.on("transformend", () => {
        let scale = circle.scaleX();
        let newRadius = circle.radius() * scale;
        if (newRadius < minRadius) newRadius = minRadius;
        if (newRadius > maxRadius) newRadius = maxRadius;
        circle.radius(newRadius);
        circle.scaleX(1);
        circle.scaleY(1);
        circle.strokeWidth(1);
        AppState.konvaLayer.draw();
      });
    }

    function addShapeFromToolbar() {
      const type = getSelectedShapeType();
      if (type === "point") addPointShape();
      else if (type === "rect") addRectShape();
      else if (type === "circle") addCircleShape();
      else alert("Only point, rectangle, and circle shapes are implemented in this build.");
    }

    setTimeout(() => {
      const addBtn = document.getElementById("newBtn");
      if (addBtn) {
        addBtn.onclick = addShapeFromToolbar;
      }
    }, 0);
  };
})();

