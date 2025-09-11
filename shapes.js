// COPILOT_PART_0B: 2025-09-11T14:15:00Z
/*********************************************************
 * PART 0B: UI Event Handler Attachment
 * ----------------------------------------
 * Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
 * Ensures handlers are wired only after the DOM is fully constructed (including Golden Layout panels).
 * All event handler logic is centralized here for maintainability.
 * - Should be loaded/concatenated immediately after shapes.part0.layout.js.
 *********************************************************/

(function() {
  // This function will be called after Golden Layout and all panel DOMs are ready.
  function attachToolbarHandlers() {
    // --- Add Shape ---
    const addBtn = document.getElementById("newBtn");
    if (addBtn) {
      addBtn.onclick = function(e) {
        e.preventDefault();
        // Use the exported addShapeFromToolbar if available
        if (window._sceneDesigner && typeof window._sceneDesigner.addShapeFromToolbar === "function") {
          window._sceneDesigner.addShapeFromToolbar();
        } else if (window._sceneDesigner && typeof window._sceneDesigner.makeReticlePointShape === "function") {
          // fallback: always add a point if generic addShapeFromToolbar is not defined
          window._sceneDesigner.makeReticlePointShape(100, 100);
        } else {
          alert("Shape creation function not found (modular code error)");
        }
      };
    }

    // --- Duplicate ---
    const duplicateBtn = document.getElementById("duplicateBtn");
    if (duplicateBtn) {
      duplicateBtn.onclick = function(e) {
        e.preventDefault();
        // Placeholder for future logic or custom handler.
      };
    }

    // --- Delete ---
    const deleteBtn = document.getElementById("deleteBtn");
    if (deleteBtn) {
      deleteBtn.onclick = function(e) {
        e.preventDefault();
        // Placeholder for future logic or custom handler.
      };
    }

    // --- Reset Rotation ---
    const resetRotationBtn = document.getElementById("resetRotationBtn");
    if (resetRotationBtn) {
      resetRotationBtn.onclick = function(e) {
        e.preventDefault();
        // Placeholder for future logic or custom handler.
      };
    }

    // --- Select All ---
    const selectAllBtn = document.getElementById("selectAllBtn");
    if (selectAllBtn) {
      selectAllBtn.onclick = function(e) {
        e.preventDefault();
        if (
          window._sceneDesigner &&
          window._sceneDesigner._multiSelect &&
          typeof window._sceneDesigner._multiSelect.selectAllShapes === "function"
        ) {
          window._sceneDesigner._multiSelect.selectAllShapes();
        }
      };
    }

    // --- Lock Checkbox ---
    const lockCheckbox = document.getElementById("lockCheckbox");
    if (lockCheckbox) {
      lockCheckbox.addEventListener("change", function(e) {
        if (
          window._sceneDesigner &&
          window._sceneDesigner._multiSelect &&
          typeof window._sceneDesigner._multiSelect.updateLockCheckboxUI === "function"
        ) {
          window._sceneDesigner._multiSelect.updateLockCheckboxUI();
        }
      });
    }

    // --- Align Select ---
    const alignSelect = document.getElementById("alignSelect");
    if (alignSelect) {
      alignSelect.onchange = function(e) {
        // Placeholder for align logic; actual implementation may be in part2b or future part.
      };
    }

    // --- Log: Handlers attached ---
    if (window.console) {
      console.log("[HANDLERS] Toolbar event handlers attached by shapes.part0b.handlers.js");
    }
  }

  // Register a global hook so layout can call this after DOM is ready
  window.onGoldenLayoutReady = function() {
    setTimeout(attachToolbarHandlers, 0);
  };
})();
/*********************************************************
 * PART 0: Golden Layout Bootstrapping & Panel Registration
 * - Always enables at least ERROR level logging (even if settings panel is missing)
 * - Supports optional remote log streaming via window._externalLogStream
 * - Initializes Golden Layout with three panels (Sidebar, Canvas, Settings).
 * - Registers panel components and placeholder logic.
 * - Handles show/hide logic for Settings panel and exposes `myLayout` for debugging.
 * - Integration: Requires <div id="main-layout"></div> in index.html.
 *********************************************************/

/*************************************
 * Logging helper with log levels (ALWAYS ENABLE ERROR)
 * (Injected at top for easier debugging when settings panel is not available)
 *************************************/
window.LOG_LEVELS = window.LOG_LEVELS || { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };

// Always enable at least ERROR level logging if settings are not yet available
function getSetting(key) {
  // fallback for DEBUG_LOG_LEVEL
  if (key === "DEBUG_LOG_LEVEL") return "ERROR";
  // fallback for all others
  return undefined;
}

function log(level, ...args) {
  // Use ERROR level if settings not available
  let curLevel = window.LOG_LEVELS["ERROR"];
  try {
    // If settings panel is available, use its setting
    if (typeof window.getSetting === "function") curLevel = window.LOG_LEVELS[window.getSetting("DEBUG_LOG_LEVEL") || "ERROR"];
  } catch (e) {}
  const msgLevel = window.LOG_LEVELS[level];
  if (msgLevel && curLevel >= msgLevel) {
    console.log(`[${level}]`, ...args);
    // Stream logs to your server if stream function set
    if (typeof window._externalLogStream === "function" && level === "ERROR") {
      try {
        window._externalLogStream(level, ...args);
      } catch (e) {
        // avoid recursive logging
      }
    }
  }
}
function logEnter(fnName, ...args) {
  log("TRACE", `>> Enter ${fnName}`, ...args);
}
function logExit(fnName, ...result) {
  log("TRACE", `<< Exit ${fnName}`, ...result);
}

// Example: Set this function somewhere in your app to stream error logs to your server
// window._externalLogStream = function(level, ...args) {
//   try {
//     fetch("https://your-server/log", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ level, args, time: Date.now() })
//     });
//   } catch (e) {}
// };

/*********************************************************
 * Golden Layout Bootstrapping & Panel Registration
 *********************************************************/

(function initGoldenLayout() {
  if (window._GL_HELLO_WORLD_INITIALIZED) return;
  window._GL_HELLO_WORLD_INITIALIZED = true;

  function doInit() {
    try {
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
			    componentName: "CanvasPanel",
			    title: "Canvas",
			    width: 80 // main panel on the left
			},
			{
			    type: "column",
			    width: 20, // right-hand side column
			    content: [
				{
				    type: "component",
				    componentName: "SidebarPanel",
				    title: "Shapes",
				    height: 50 // top half
				},
				{
				    type: "component",
				    componentName: "SettingsPanel",
				    title: "Settings",
				    height: 50, // bottom half
				    isClosable: true
				}
			    ]
			}
		    ]
		}]
      };

      // ---- 2. Create and attach Golden Layout instance ----
      const glRoot = document.getElementById("main-layout");
      if (!glRoot) {
        log("ERROR", "Golden Layout root #main-layout not found!");
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
    } catch (e) {
      log("ERROR", "Exception in Golden Layout bootstrapping", e);
      throw e;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
})();
/*********************************************************
 * PART 1: SidebarPanel Logic
 * ----------------------------------------
 * Implements the content and UI logic for the Sidebar panel (shape table/list).
 * Current: Placeholder/hello world.
 * Future: Will show the table of annotation shapes and handle selection, lock, delete, etc.
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
// COPILOT_PART_2A: 2025-09-11T14:18:00Z
/*********************************************************
 * PART 2A: CanvasPanel – Image Display & Shape Creation
 * ------------------------------------------------------
 * Handles Canvas setup, image loading, and single-shape creation/selection.
 * - Loads and displays the selected/uploaded image.
 * - Provides creation for "Point", "Rectangle", and "Circle" shapes.
 * - Handles single-shape selection and transformer UI.
 * - Exports key hooks for PART 2B (multi-select, drag, highlights).
 * - All state is kept in window._sceneDesigner (SSOT).
 * - UPDATED: Multi-select group drag triggers PART 2B handlers.
 *********************************************************/

(function () {
  // App-wide state for the canvas panel (Single Source of Truth)
  window._sceneDesigner = window._sceneDesigner || {};
  const AppState = window._sceneDesigner;

  // --- SHAPE CREATION HELPERS ---

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
    group._type = "point"; group._label = "Point";
    group.locked = false;
    group._id = "pt_" + Math.random().toString(36).slice(2, 10);
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
    rect._type = "rect"; rect._label = "Rectangle";
    rect.locked = false;
    rect._id = "rect_" + Math.random().toString(36).slice(2, 10);
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
    circle._type = "circle"; circle._label = "Circle";
    circle.locked = false;
    circle._id = "circ_" + Math.random().toString(36).slice(2, 10);
    circle.on("mouseenter", () => { document.body.style.cursor = 'move'; });
    circle.on("mouseleave", () => { document.body.style.cursor = ''; });
    return circle;
  }

  // --- SINGLE-SHAPE SELECTION/TRANSFORMER ---

  function selectShape(shape) {
    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }
    if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection)
      AppState.selectedShape.showSelection(false);
    AppState.selectedShape = shape;
    AppState.selectedShapes = shape ? [shape] : [];
    if (!shape) return;

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
  }

  function deselectShape() {
    if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection)
      AppState.selectedShape.showSelection(false);
    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }
    AppState.selectedShape = null;
    AppState.selectedShapes = [];
    if (AppState.konvaLayer) AppState.konvaLayer.draw();
  }

  // --- SHAPE LOCKING ---

  function setShapeLocked(shape, locked) {
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
  }

  // --- IMAGE LOADING AND CANVAS INIT ---

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

  // --- MULTI-DRAG HOOKUP (NEW) ---
  function attachMultiDragHandler(shape) {
    shape.on("dragstart.multiselect", function(evt) {
      const AppState = window._sceneDesigner;
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
          if (AppState._multiSelect.showLockedHighlightForShapes) {
            AppState._multiSelect.showLockedHighlightForShapes(AppState.selectedShapes.filter(s => s.locked));
          }
          evt.target.stopDrag();
          return;
        }
        // Cancel native drag and start group drag
        evt.target.stopDrag();
        AppState.multiDrag = {
          moving: true,
          dragOrigin: AppState.konvaStage.getPointerPosition(),
          origPositions: AppState.selectedShapes.map(s => ({ shape: s, x: s.x(), y: s.y() }))
        };
        AppState.konvaStage.on('mousemove.multidrag touchmove.multidrag', AppState._multiSelect.onMultiDragMove);
        AppState.konvaStage.on('mouseup.multidrag touchend.multidrag', AppState._multiSelect.onMultiDragEnd);
        if (AppState._multiSelect.updateDebugMultiDragBox) AppState._multiSelect.updateDebugMultiDragBox();
      }
    });
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
    AppState.selectedShapes = [];
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

      // Re-add all shapes from AppState.shapes
      for (const shape of AppState.shapes) {
        layer.add(shape);
        // --- Attach multi-drag handler to each shape ---
        attachMultiDragHandler(shape);
      }
      layer.batchDraw();

      // Selection logic: click on stage or image to deselect
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
      attachMultiDragHandler(point);
      AppState.konvaLayer.batchDraw();
      if (AppState.selectedShape && typeof AppState.selectedShape.showSelection === "function")
        AppState.selectedShape.showSelection(false);
      AppState.selectedShape = point;
      AppState.selectedShapes = [point];
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
    }

    function addShapeFromToolbar() {
      const type = getSelectedShapeType();
      if (type === "point") addPointShape();
      else if (type === "rect") addRectShape();
      else if (type === "circle") addCircleShape();
      else alert("Only point, rectangle, and circle shapes are implemented in this build.");
    }

    // REMOVE old handler wiring. Handlers now in part0b.handlers.js

    // Export hooks for PART 2B and PART 0B (handler file)
    AppState.makeReticlePointShape = makeReticlePointShape;
    AppState.makeRectShape = makeRectShape;
    AppState.makeCircleShape = makeCircleShape;
    AppState.selectShape = selectShape;
    AppState.deselectShape = deselectShape;
    AppState.setShapeLocked = setShapeLocked;
    AppState.addShapeFromToolbar = addShapeFromToolbar; // <-- REQUIRED FOR PART 0B HANDLERS
  };
})();
/*********************************************************
 * PART 2B: Multi-Select, Group Drag, Highlights, Lock UI
 * ------------------------------------------------------
 * Handles all multi-selection, group drag, bounding box, and lock UI logic.
 * Depends on PART 2A (CanvasPanel) for shape creation and single selection.
 * - Multi-select: Select All, marquee/box selection, multi-selection highlights.
 * - Multi-select drag, clamped group bounding box (with rotation/scale).
 * - Orange debug bounding box during group drag.
 * - Locking: Locked shapes block group drag and show red highlight feedback.
 * - Lock checkbox UI always reflects current selection.
 * - Uses setSelectedShapes() as the only way to change selection state.
 *********************************************************/
// checking concat is working
(function () {
  // Use shared AppState from PART 2A as the SINGLE SOURCE OF TRUTH!
  function getAppState() {
    return window._sceneDesigner || {};
  }

  let multiSelectHighlightShapes = [];
  let debugMultiDragBox = null;
  let multiDrag = { moving: false, dragOrigin: null, origPositions: null };
  let _lockedDragAttemptedIDs = [];

  // --- Centralized Selection Setter ---
  function setSelectedShapes(shapesArr) {
    const AppState = getAppState();
    AppState.selectedShapes = shapesArr || [];
    AppState.selectedShape = (shapesArr && shapesArr.length === 1) ? shapesArr[0] : null;

    // Remove transformer if multiselect or none
    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }

    // If single selection and it's a rect or circle, add transformer
    if (AppState.selectedShapes.length === 1) {
      const shape = AppState.selectedShapes[0];
      if (shape._type === "rect" || shape._type === "circle") {
        const transformer = new Konva.Transformer({
          nodes: [shape],
          enabledAnchors: shape.locked ? [] :
            (shape._type === "rect"
              ? ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
              : ["top-left", "top-right", "bottom-left", "bottom-right"]),
          rotateEnabled: !shape.locked
        });
        AppState.konvaLayer.add(transformer);
        AppState.transformer = transformer;
        AppState.konvaLayer.draw();
      }
      if (shape._type === "point" && typeof shape.showSelection === "function") {
        shape.showSelection(true);
      }
    } else {
      // Hide selection for points if multi or none
      if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection) {
        AppState.selectedShape.showSelection(false);
      }
    }

    updateLockCheckboxUI();
    updateSelectionHighlights();
    if (AppState.konvaLayer) AppState.konvaLayer.draw();
    // If you have a sidebar table/list, update it here:
    if (typeof window.updateList === "function") window.updateList();
    // If you have label UI, update it here:
    if (typeof window.updateLabelUI === "function") window.updateLabelUI();
  }

  // --- Selection Highlight Logic ---
  function updateSelectionHighlights() {
    const AppState = getAppState();
    if (multiSelectHighlightShapes.length && AppState.konvaLayer) {
      multiSelectHighlightShapes.forEach(g => g.destroy && g.destroy());
      multiSelectHighlightShapes = [];
      AppState.konvaLayer.draw();
    }
    if (!AppState.selectedShapes || AppState.selectedShapes.length < 2 || !AppState.konvaLayer) return;
    const pad = 6;
    AppState.selectedShapes.forEach(shape => {
      let highlight;
      let color = _lockedDragAttemptedIDs.includes(shape._id) ? "#e53935" : "#2176ff";
      if (shape._type === 'rect') {
        highlight = new Konva.Rect({
          x: shape.x() - pad / 2,
          y: shape.y() - pad / 2,
          width: shape.width() + pad,
          height: shape.height() + pad,
          stroke: color,
          strokeWidth: 2.5,
          dash: [7, 4],
          listening: false,
          cornerRadius: 6,
          offsetX: shape.offsetX ? shape.offsetX() : 0,
          offsetY: shape.offsetY ? shape.offsetY() : 0,
          rotation: shape.rotation ? shape.rotation() : 0
        });
      } else if (shape._type === 'circle') {
        highlight = new Konva.Circle({
          x: shape.x(),
          y: shape.y(),
          radius: shape.radius() + pad,
          stroke: color,
          strokeWidth: 2.5,
          dash: [7, 4],
          listening: false
        });
      } else if (shape._type === 'point') {
        highlight = new Konva.Circle({
          x: shape.x(),
          y: shape.y(),
          radius: 15,
          stroke: color,
          strokeWidth: 2.5,
          dash: [7, 4],
          listening: false
        });
      }
      if (highlight) {
        AppState.konvaLayer.add(highlight);
        multiSelectHighlightShapes.push(highlight);
      }
    });
    AppState.konvaLayer.batchDraw();
  }
  window._sceneDesigner = window._sceneDesigner || {};
  window._sceneDesigner.updateSelectionHighlights = updateSelectionHighlights;

  // --- Locked Drag Red Feedback ---
  function showLockedHighlightForShapes(shapesArr) {
    _lockedDragAttemptedIDs = shapesArr.map(s => s._id);
    updateSelectionHighlights();
    setTimeout(() => {
      _lockedDragAttemptedIDs = [];
      updateSelectionHighlights();
    }, 1000);
  }
  window._sceneDesigner.showLockedHighlightForShapes = showLockedHighlightForShapes;

  // --- Group Drag Bounding Box ---
  function getMultiSelectionBounds(origPositions, dx = 0, dy = 0) {
    const AppState = getAppState();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    origPositions.forEach(obj => {
      const origShape = obj.shape;
      let clone;
      if (origShape._type === "rect") {
        clone = new Konva.Rect({
          x: obj.x + dx,
          y: obj.y + dy,
          width: origShape.width(),
          height: origShape.height(),
          rotation: origShape.rotation ? origShape.rotation() : 0,
          scaleX: origShape.scaleX ? origShape.scaleX() : 1,
          scaleY: origShape.scaleY ? origShape.scaleY() : 1
        });
      } else if (origShape._type === "circle") {
        clone = new Konva.Circle({
          x: obj.x + dx,
          y: obj.y + dy,
          radius: origShape.radius(),
          rotation: origShape.rotation ? origShape.rotation() : 0,
          scaleX: origShape.scaleX ? origShape.scaleX() : 1,
          scaleY: origShape.scaleY ? origShape.scaleY() : 1
        });
      } else if (origShape._type === "point") {
        clone = origShape.clone({ x: obj.x + dx, y: obj.y + dy });
      }
      const rect = clone.getClientRect();
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });
    return { minX, minY, maxX, maxY };
  }
  function clampMultiDragDelta(dx, dy, origPositions) {
    const AppState = getAppState();
    const stageW = AppState.konvaStage ? AppState.konvaStage.width() : 1;
    const stageH = AppState.konvaStage ? AppState.konvaStage.height() : 1;
    let groupBounds = getMultiSelectionBounds(origPositions, dx, dy);
    let adjDx = dx, adjDy = dy;

    if (groupBounds.minX < 0) adjDx += -groupBounds.minX;
    if (groupBounds.maxX > stageW) adjDx += stageW - groupBounds.maxX;
    if (groupBounds.minY < 0) adjDy += -groupBounds.minY;
    if (groupBounds.maxY > stageH) adjDy += stageH - groupBounds.maxY;

    groupBounds = getMultiSelectionBounds(origPositions, adjDx, adjDy);
    if (groupBounds.minX < 0) adjDx += -groupBounds.minX;
    if (groupBounds.maxX > stageW) adjDx += stageW - groupBounds.maxX;
    if (groupBounds.minY < 0) adjDy += -groupBounds.minY;
    if (groupBounds.maxY > stageH) adjDy += stageH - groupBounds.maxY;

    return [adjDx, adjDy];
  }
  function updateDebugMultiDragBox() {
    const AppState = getAppState();
    if (debugMultiDragBox) debugMultiDragBox.destroy();
    if (!AppState.selectedShapes || AppState.selectedShapes.length < 2 || !AppState.konvaLayer) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    AppState.selectedShapes.forEach(shape => {
      const rect = shape.getClientRect({ relativeTo: AppState.konvaStage });
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });

    debugMultiDragBox = new Konva.Rect({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      stroke: '#fa0',
      strokeWidth: 2,
      dash: [6, 3],
      listening: false,
      fill: '#fa0a0a09'
    });
    AppState.konvaLayer.add(debugMultiDragBox);
    AppState.konvaLayer.batchDraw();
  }
  function clearDebugMultiDragBox() {
    const AppState = getAppState();
    if (debugMultiDragBox) {
      debugMultiDragBox.destroy();
      debugMultiDragBox = null;
      if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    }
  }

  // --- Multi-Drag Handlers ---
  function onMultiDragMove(evt) {
    const AppState = getAppState();
    if (!multiDrag.moving || !multiDrag.dragOrigin || !AppState.konvaStage) return;
    const pos = AppState.konvaStage.getPointerPosition();
    let dx = pos.x - multiDrag.dragOrigin.x;
    let dy = pos.y - multiDrag.dragOrigin.y;
    let [clampedDx, clampedDy] = clampMultiDragDelta(dx, dy, multiDrag.origPositions);
    multiDrag.origPositions.forEach(obj => {
      obj.shape.x(obj.x + clampedDx);
      obj.shape.y(obj.y + clampedDy);
    });
    updateDebugMultiDragBox();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    updateSelectionHighlights();
  }
  function onMultiDragEnd(evt) {
    const AppState = getAppState();
    multiDrag.moving = false;
    multiDrag.dragOrigin = null;
    multiDrag.origPositions = null;
    clearDebugMultiDragBox();
    if (AppState.konvaStage) {
      AppState.konvaStage.off('mousemove.multidrag touchmove.multidrag');
      AppState.konvaStage.off('mouseup.multidrag touchend.multidrag');
    }
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    updateSelectionHighlights();
  }

  // --- Lock Checkbox UI Sync ---
  function updateLockCheckboxUI() {
    const AppState = getAppState();
    const lockCheckbox = document.getElementById("lockCheckbox");
    if (!lockCheckbox) return;
    const shapes = AppState.selectedShapes || [];
    if (shapes.length === 0) {
      lockCheckbox.indeterminate = false;
      lockCheckbox.checked = false;
      return;
    }
    const allLocked = shapes.every(s => s.locked);
    const noneLocked = shapes.every(s => !s.locked);
    lockCheckbox.indeterminate = !(allLocked || noneLocked);
    lockCheckbox.checked = allLocked;
  }
  window._sceneDesigner.updateLockCheckboxUI = updateLockCheckboxUI;

  // --- Attach/override selection logic to sync lock UI ---
  function attachSelectionOverrides() {
    const AppState = getAppState();
    // Only override if not already wrapped
    if (!AppState._multiSelectOverridesApplied) {
      const origSelectShape = AppState.selectShape;
      AppState.selectShape = function(shape) {
        setSelectedShapes(shape ? [shape] : []);
        if (typeof origSelectShape === "function") origSelectShape(shape);
      };
      const origDeselectShape = AppState.deselectShape;
      AppState.deselectShape = function() {
        setSelectedShapes([]);
        if (typeof origDeselectShape === "function") origDeselectShape();
      };
      AppState._multiSelectOverridesApplied = true;
    }
  }

  // --- Select All logic: NOW uses setSelectedShapes() SSOT setter ---
  function selectAllShapes() {
    const AppState = getAppState();
    if (AppState.shapes && AppState.shapes.length > 0) {
      setSelectedShapes(AppState.shapes.slice());
    }
  }

  function attachSelectAllHook() {
    document.addEventListener("DOMContentLoaded", function () {
      const selectAllBtn = document.getElementById("selectAllBtn");
      if (selectAllBtn) {
        selectAllBtn.onclick = function (e) {
          e.preventDefault();
          selectAllShapes();
        };
      }
    });
  }

  // --- Lock checkbox logic: all logic uses single source of truth ---
  function attachLockCheckboxHook() {
    document.addEventListener("DOMContentLoaded", function () {
      const lockCheckbox = document.getElementById("lockCheckbox");
      if (lockCheckbox) {
        lockCheckbox.addEventListener('change', function () {
          const AppState = getAppState();
          if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) return;
          const newLocked = lockCheckbox.checked;
          AppState.selectedShapes.forEach(s => {
            if (AppState.setShapeLocked) AppState.setShapeLocked(s, newLocked);
            else s.locked = !!newLocked;
          });
          updateLockCheckboxUI();
          updateSelectionHighlights();
          if (typeof window.updateList === "function") window.updateList();
          if (AppState.konvaLayer) AppState.konvaLayer.draw();
        });
      }
    });
  }

  // --- Export handlers for event attachment in PART 2A ---
  function exportMultiSelectAPI() {
    const AppState = getAppState();
    AppState._multiSelect = {
      setSelectedShapes,
      updateSelectionHighlights,
      showLockedHighlightForShapes,
      updateLockCheckboxUI,
      onMultiDragMove,
      onMultiDragEnd,
      updateDebugMultiDragBox,
      clearDebugMultiDragBox,
      selectAllShapes // Export for external use if needed
    };
  }

  // --- Deferred Initialization ---
  function initPart2B() {
    attachSelectionOverrides();
    attachSelectAllHook();
    attachLockCheckboxHook();
    exportMultiSelectAPI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPart2B);
  } else {
    setTimeout(initPart2B, 0);
  }
})();
/*********************************************************
 * PART 3: SettingsPanel Logic
 * ----------------------------------------
 * Implements the content and UI for the Settings panel.
 * Current: Placeholder/hello world.
 * Future: Scene name, logic selector, color/tolerance, export, etc.
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
