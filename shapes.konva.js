// COPILOT_PART_konva: 2025-09-12T10:37:41Z
/*********************************************************
 * [konva] Canvas Panel – Image Display & Shape Creation
 * ------------------------------------------------------
 * Handles Canvas setup, image loading, and single-shape creation/selection.
 * - Loads and displays the selected/uploaded image.
 * - Provides creation for "Point", "Rectangle", and "Circle" shapes.
 * - Handles single-shape selection and transformer UI.
 * - Exports key hooks for shapes.multiselect.js (multi-select, drag, highlights).
 * - All state is kept in window._sceneDesigner (SSOT).
 * - Applies project logging schema (see COPILOT_MANIFESTO.md).
 *********************************************************/

// Logging helpers (module tag: [konva])
function konva_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[konva]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[konva]", level, ...args);
  }
}
function konva_logEnter(fnName, ...args) { konva_log("TRACE", `>> Enter ${fnName}`, ...args); }
function konva_logExit(fnName, ...result) { konva_log("TRACE", `<< Exit ${fnName}`, ...result); }

(function () {
  // App-wide state for the canvas panel (Single Source of Truth)
  window._sceneDesigner = window._sceneDesigner || {};
  const AppState = window._sceneDesigner;

  // --- SHAPE CREATION HELPERS ---

  function makeReticlePointShape(x, y, color = "#2176ff") {
    konva_logEnter("makeReticlePointShape", {x, y, color});
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
    group._type = "point"; group._label = "Point";
    group.locked = false;
    group._id = "pt_" + Math.random().toString(36).slice(2, 10);
    group.on("dragstart", () => { group.showSelection(true); });
    group.on("dragend", () => { group.showSelection(false); });
    group.on("mouseenter", () => { document.body.style.cursor = 'pointer'; });
    group.on("mouseleave", () => { document.body.style.cursor = ''; });

    // ENHANCED LOG: Point shape created
    konva_log("DEBUG", "Created reticle point shape", {id: group._id, x, y, color});

    konva_logExit("makeReticlePointShape", group);
    return group;
  }

  function makeRectShape(x, y, width = 80, height = 48, stroke = "#2176ff", fill = "#ffffff00") {
    konva_logEnter("makeRectShape", {x, y, width, height, stroke, fill});
    const rect = new Konva.Rect({
      x: x, y: y, width: width, height: height,
      stroke: stroke, strokeWidth: 1,
      fill: fill, opacity: 0.92, draggable: true, name: "rect-shape"
    });
    rect.showSelection = function() {};
    rect._type = "rect"; rect._label = "Rectangle";
    rect.locked = false;
    rect._id = "rect_" + Math.random().toString(36).slice(2, 10);
    rect.on("mouseenter", () => { document.body.style.cursor = 'move'; });
    rect.on("mouseleave", () => { document.body.style.cursor = ''; });

    // ENHANCED LOG: Rect shape created
    konva_log("DEBUG", "Created rect shape", {id: rect._id, x, y, width, height, stroke, fill});

    konva_logExit("makeRectShape", rect);
    return rect;
  }

  function makeCircleShape(x, y, radius = 24, stroke = "#2176ff", fill = "#ffffff00") {
    konva_logEnter("makeCircleShape", {x, y, radius, stroke, fill});
    const circle = new Konva.Circle({
      x: x, y: y, radius: radius,
      stroke: stroke, strokeWidth: 1,
      fill: fill, opacity: 0.92, draggable: true, name: "circle-shape"
    });
    circle.showSelection = function() {};
    circle._type = "circle"; circle._label = "Circle";
    circle.locked = false;
    circle._id = "circ_" + Math.random().toString(36).slice(2, 10);
    circle.on("mouseenter", () => { document.body.style.cursor = 'move'; });
    circle.on("mouseleave", () => { document.body.style.cursor = ''; });

    // ENHANCED LOG: Circle shape created
    konva_log("DEBUG", "Created circle shape", {id: circle._id, x, y, radius, stroke, fill});

    konva_logExit("makeCircleShape", circle);
    return circle;
  }

  // --- SINGLE-SHAPE SELECTION/TRANSFORMER ---

  function selectShape(shape) {
    konva_logEnter("selectShape", {shape});
    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }
    if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection)
      AppState.selectedShape.showSelection(false);
    AppState.selectedShape = shape;
    AppState.selectedShapes = shape ? [shape] : [];
    if (!shape) {
      konva_logExit("selectShape");
      return;
    }

    if (shape._type === "rect") {
      const transformer = new Konva.Transformer({
        nodes: [shape],
        enabledAnchors: shape.locked ? [] : [
          "top-left", "top-center", "top-right",
          "middle-left", "middle-right",
          "bottom-left", "bottom-center", "bottom-right"
        ],
        rotateEnabled: !shape.locked
      });
      AppState.konvaLayer.add(transformer);
      AppState.transformer = transformer;
      transformer.on("transformend", () => {
        shape.strokeWidth(1);
        shape.width(shape.width() * shape.scaleX());
        shape.height(shape.height() * shape.scaleY());
        shape.scaleX(1);
        shape.scaleY(1);
        AppState.konvaLayer.draw();
      });
      AppState.konvaLayer.draw();
    } else if (shape._type === "circle") {
      const transformer = new Konva.Transformer({
        nodes: [shape],
        enabledAnchors: shape.locked ? [] : [
          "top-left", "top-right", "bottom-left", "bottom-right"
        ],
        rotateEnabled: !shape.locked
      });
      AppState.konvaLayer.add(transformer);
      AppState.transformer = transformer;
      transformer.on("transformend", () => {
        let scaleX = shape.scaleX();
        shape.radius(shape.radius() * scaleX);
        shape.scaleX(1);
        shape.scaleY(1);
        shape.strokeWidth(1);
        AppState.konvaLayer.draw();
      });
      AppState.konvaLayer.draw();
    } else if (shape._type === "point") {
      shape.showSelection(true);
    }
    konva_logExit("selectShape");
  }

  function deselectShape() {
    konva_logEnter("deselectShape");
    if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection)
      AppState.selectedShape.showSelection(false);
    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }
    AppState.selectedShape = null;
    AppState.selectedShapes = [];
    if (AppState.konvaLayer) AppState.konvaLayer.draw();
    konva_logExit("deselectShape");
  }

  // --- SHAPE LOCKING ---

  function setShapeLocked(shape, locked) {
    konva_logEnter("setShapeLocked", {shape, locked});
    shape.locked = !!locked;
    if (shape.draggable) shape.draggable(!locked);
    if (shape instanceof Konva.Group) shape.draggable(!locked);
    if (AppState.transformer && AppState.transformer.nodes().includes(shape)) {
      if (locked) {
        AppState.transformer.enabledAnchors([]);
        AppState.transformer.rotateEnabled(false);
      } else {
        let anchors = ['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'];
        if(shape._type==='circle') anchors = ['top-left','top-right','bottom-left','bottom-right'];
        if(shape._type==='point') anchors = [];
        AppState.transformer.enabledAnchors(anchors);
        AppState.transformer.rotateEnabled(shape._type !== 'point');
      }
    }
    konva_logExit("setShapeLocked");
  }

  // --- IMAGE LOADING AND CANVAS INIT ---

  function loadImage(src) {
    konva_logEnter("loadImage", {src});
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => { konva_log("DEBUG", "Image loaded", {src}); resolve(img); };
      img.onerror = (e) => { konva_log("ERROR", "Image failed to load", {src, e}); reject(e); };
      img.crossOrigin = "Anonymous";
      img.src = src;
    });
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // --- MULTI-DRAG HOOKUP (ENHANCED LOGGING) ---
  function attachMultiDragHandler(shape) {
    konva_log("TRACE", "attachMultiDragHandler called", {shape_id: shape._id, type: shape._type});
    shape.on("dragstart.multiselect", function(evt) {
      konva_log("TRACE", "dragstart.multiselect fired", {
        shape_id: shape._id,
        shape_type: shape._type,
        selectedShapes: (AppState.selectedShapes || []).map(s => s._id),
        isSelected: (AppState.selectedShapes || []).includes(shape),
        event: evt
      });
      // Only intercept if multiple shapes are selected, and this shape is among them
      if (
        AppState.selectedShapes &&
        AppState.selectedShapes.length > 1 &&
        AppState.selectedShapes.includes(shape) &&
        AppState._multiSelect &&
        typeof AppState._multiSelect.onMultiDragMove === "function"
      ) {
        // If any selected shape is locked, abort drag attempt and give feedback
        if (AppState.selectedShapes.some(s => s.locked)) {
          konva_log("DEBUG", "Multi-drag blocked by locked shape", {
            lockedShapes: AppState.selectedShapes.filter(s => s.locked).map(s => s._id)
          });
          if (AppState._multiSelect.showLockedHighlightForShapes) {
            AppState._multiSelect.showLockedHighlightForShapes(AppState.selectedShapes.filter(s => s.locked));
          }
          evt.target.stopDrag();
          konva_log("TRACE", "dragstart.multiselect: stopped drag due to lock", {shape_id: shape._id});
          return;
        }
        // Cancel native drag and start group drag
        evt.target.stopDrag();
        AppState.multiDrag = {
          moving: true,
          dragOrigin: AppState.konvaStage.getPointerPosition(),
          origPositions: AppState.selectedShapes.map(s => ({ shape: s, x: s.x(), y: s.y() }))
        };
        konva_log("DEBUG", "Multi-drag initialized", {
          moving: true,
          dragOrigin: AppState.multiDrag.dragOrigin,
          origPositions: AppState.multiDrag.origPositions.map(obj => ({id: obj.shape._id, x: obj.x, y: obj.y}))
        });
        AppState.konvaStage.on('mousemove.multidrag touchmove.multidrag', AppState._multiSelect.onMultiDragMove);
        AppState.konvaStage.on('mouseup.multidrag touchend.multidrag', AppState._multiSelect.onMultiDragEnd);
        if (AppState._multiSelect.updateDebugMultiDragBox) AppState._multiSelect.updateDebugMultiDragBox();
      } else {
        konva_log("TRACE", "dragstart.multiselect: not a valid multi-drag scenario", {
          selectedShapes: AppState.selectedShapes ? AppState.selectedShapes.map(s => s._id) : [],
          shape_id: shape._id,
          multiSelectPresent: !!AppState._multiSelect
        });
      }
    });

    // Also log attachment of shape event handlers for future diagnostics
    shape.on("dragstart", (evt) => {
      konva_log("TRACE", "dragstart (native Konva event)", {
        shape_id: shape._id,
        selectedShapes: (AppState.selectedShapes || []).map(s => s._id)
      });
    });
  }

  window.buildCanvasPanel = async function (rootDiv, container, state) {
    konva_logEnter("buildCanvasPanel", {rootDiv, container, state});
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
    AppState.selectedShapes = [];
    AppState.transformer = null;

    async function renderCanvas(imageSrc) {
      konva_logEnter("renderCanvas", {imageSrc});
      if (AppState.konvaStage) {
        AppState.konvaStage.destroy();
        AppState.konvaStage = null;
      }
      clearNode(konvaDiv);

      if (!imageSrc) {
        const msg = document.createElement("div");
        msg.innerHTML = "<p style='text-align:center;font-size:1.1em;color:#888;'>Select or upload an image to begin.</p>";
        konvaDiv.appendChild(msg);
        konva_logExit("renderCanvas (no imageSrc)");
        return;
      }

      let img;
      try { img = await loadImage(imageSrc); }
      catch (e) {
        konvaDiv.innerHTML = "<p style='color:crimson;text-align:center;'>Failed to load image.</p>";
        konva_log("ERROR", "Failed to load image", {imageSrc, error: e});
        konva_logExit("renderCanvas (load error)");
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

      // Re-add all shapes from AppState.shapes
      for (const shape of AppState.shapes) {
        layer.add(shape);
        // --- Attach multi-drag handler to each shape ---
        attachMultiDragHandler(shape);
        konva_log("TRACE", "Shape re-added to canvas", {shape_id: shape._id, type: shape._type});
      }
      layer.batchDraw();

      // Selection logic: click on stage or image to deselect
      stage.on("mousedown tap", function(evt) {
        konva_log("TRACE", "stage mousedown/tap", {evt_target: evt.target});
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
      konva_logExit("renderCanvas");
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
      konva_logEnter("setupImageLoaderListeners");
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
      konva_logExit("setupImageLoaderListeners");
    }

    setupImageLoaderListeners();
    const startingImage = getCurrentImageSrc();
    await renderCanvas(startingImage);

    function getSelectedShapeType() {
      const sel = document.getElementById("shapeType");
      return sel ? sel.value : "point";
    }

    function addPointShape() {
      konva_logEnter("addPointShape");
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) {
        konva_logExit("addPointShape (no image/layer)");
        return;
      }
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
      attachMultiDragHandler(point);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = point;
      AppState.selectedShapes = [point];
      point.showSelection(true);
      konva_log("INFO", "Added point shape to canvas", {id: point._id, x, y});
      konva_logExit("addPointShape");
    }

    function addRectShape() {
      konva_logEnter("addRectShape");
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) {
        konva_logExit("addRectShape (no image/layer)");
        return;
      }
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
      attachMultiDragHandler(rect);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = rect;
      AppState.selectedShapes = [rect];
      if (AppState.transformer) {
        AppState.transformer.destroy();
        AppState.transformer = null;
      }
      const transformer = new Konva.Transformer({
        nodes: [rect],
        enabledAnchors: rect.locked ? [] : [
          "top-left", "top-center", "top-right",
          "middle-left", "middle-right",
          "bottom-left", "bottom-center", "bottom-right"
        ],
        rotateEnabled: !rect.locked
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
      konva_log("INFO", "Added rectangle shape to canvas", {id: rect._id, x, y, width: defaultW, height: defaultH});
      konva_logExit("addRectShape");
    }

    function addCircleShape() {
      konva_logEnter("addCircleShape");
      const img = AppState.imageObj;
      if (!img || !AppState.konvaLayer) {
        konva_logExit("addCircleShape (no image/layer)");
        return;
      }
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
      attachMultiDragHandler(circle);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = circle;
      AppState.selectedShapes = [circle];
      if (AppState.transformer) {
        AppState.transformer.destroy();
        AppState.transformer = null;
      }
      const transformer = new Konva.Transformer({
        nodes: [circle],
        enabledAnchors: circle.locked ? [] : [
          "top-left", "top-right", "bottom-left", "bottom-right"
        ],
        rotateEnabled: !circle.locked
      });
      AppState.konvaLayer.add(transformer);
      AppState.transformer = transformer;
      AppState.konvaLayer.draw();
      transformer.on("transformend", () => {
        let scaleX = circle.scaleX();
        circle.radius(circle.radius() * scaleX);
        circle.scaleX(1);
        circle.scaleY(1);
        circle.strokeWidth(1);
        AppState.konvaLayer.draw();
      });
      konva_log("INFO", "Added circle shape to canvas", {id: circle._id, x, y, radius: defaultRadius});
      konva_logExit("addCircleShape");
    }

    function addShapeFromToolbar() {
      konva_logEnter("addShapeFromToolbar");
      const type = getSelectedShapeType();
      if (type === "point") addPointShape();
      else if (type === "rect") addRectShape();
      else if (type === "circle") addCircleShape();
      else alert("Only point, rectangle, and circle shapes are implemented in this build.");
      konva_logExit("addShapeFromToolbar");
    }

    // Export hooks for shapes.multiselect.js and shapes.handlers.js
    AppState.makeReticlePointShape = makeReticlePointShape;
    AppState.makeRectShape = makeRectShape;
    AppState.makeCircleShape = makeCircleShape;
    AppState.selectShape = selectShape;
    AppState.deselectShape = deselectShape;
    AppState.setShapeLocked = setShapeLocked;
    AppState.addShapeFromToolbar = addShapeFromToolbar;

    konva_logExit("buildCanvasPanel");
  };
})();
