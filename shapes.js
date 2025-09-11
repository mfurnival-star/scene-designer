// COPILOT_PART_logserver: 2025-09-11T21:14:00Z
/*********************************************************
 * Log Server / Streaming Integration Module
 * -----------------------------------------
 * Provides a hook for streaming log/error messages to an external server
 * or backend endpoint. Intended to be loaded FIRST in modular shapes.js.
 * - Exposes window._externalLogStream(level, ...args)
 * - Destination controlled by LOG_OUTPUT_DEST setting:
 *     "console" (default): logs to console only
 *     "server": logs to server only (if URL set)
 *     "both": logs to both
 * - To enable server logging, set window._externalLogServerURL, or
 *   use Settings panel (future).
 * - Future: Supports batching, retries, queueing, and log level config.
 *********************************************************/

// (Optionally set this before loading shapes.js)
window._externalLogServerURL = window._externalLogServerURL || ""; // e.g. "http://143.47.247.184/log"

// LOG_OUTPUT_DEST: "console" | "server" | "both"
window._settingsRegistry = window._settingsRegistry || [];
if (!window._settingsRegistry.some(s => s.key === "LOG_OUTPUT_DEST")) {
  window._settingsRegistry.push({
    key: "LOG_OUTPUT_DEST",
    label: "Log Output Destination",
    type: "select",
    options: [
      { value: "console", label: "Console Only" },
      { value: "server", label: "Server Only" },
      { value: "both", label: "Both" }
    ],
    default: "console"
  });
}

// Default if not yet set
window._settings = window._settings || {};
if (!window._settings.LOG_OUTPUT_DEST) {
  window._settings.LOG_OUTPUT_DEST = "console";
}

// Core streaming logic
window._externalLogStream = async function(level, ...args) {
  // Read current setting
  let dest = (typeof window.getSetting === "function")
    ? window.getSetting("LOG_OUTPUT_DEST")
    : (window._settings && window._settings.LOG_OUTPUT_DEST) || "console";

  // Fallback for unknown value
  if (!["console", "server", "both"].includes(dest)) dest = "console";

  // Helper: Send to server if allowed and configured
  async function sendToServer() {
    if (!window._externalLogServerURL) return;
    try {
      const payload = {
        level,
        message: args.map(a =>
          (typeof a === "object" ? JSON.stringify(a) : String(a))
        ).join(" "),
        timestamp: (new Date()).toISOString(),
        page: location.pathname,
        userAgent: navigator.userAgent
      };
      await fetch(window._externalLogServerURL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // If streaming fails, log locally as fallback
      if (dest === "server") {
        // If server-only, show error in console
        console.error("[LogStream][FAIL]", level, ...args, e);
      }
    }
  }

  // Helper: Send to console
  function sendToConsole() {
    if (window.LOG_LEVELS) {
      // Show warn/error to console.warn, others to console.log
      if (window.LOG_LEVELS[level] <= window.LOG_LEVELS.WARN) {
        console.warn("[LogStream]", level, ...args);
      } else {
        console.log("[LogStream]", level, ...args);
      }
    } else {
      console.log("[LogStream]", level, ...args);
    }
  }

  // Route as per setting
  if (dest === "console") {
    sendToConsole();
  } else if (dest === "server") {
    await sendToServer();
  } else if (dest === "both") {
    sendToConsole();
    await sendToServer();
  }
};

// Optionally, provide a no-op flush (for future batching support)
window._externalLogStream.flush = function() {};

// For debugging: test hook
if (!window._logserverTested) {
  window._logserverTested = true;
  window._externalLogStream("INFO", "LogServer module loaded and ready.");
}
// COPILOT_PART_layout: 2025-09-11T21:17:00Z
/*********************************************************
 * Golden Layout Bootstrapping & Panel Registration
 * - Defines logging system and settings registry
 * - Initializes Golden Layout with Sidebar, Canvas, Settings panels
 * - Registers panel builder hooks
 * - Exposes show/hide logic for Settings panel, myLayout for debugging
 *********************************************************/

/*************************************
 * Logging helper with log levels (ALWAYS ENABLE ERROR)
 * (Injected at top for easier debugging when settings panel is not available)
 *************************************/
window.LOG_LEVELS = window.LOG_LEVELS || { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };

// Centralized settings registry (to be used by settings panel and log system)
window._settingsRegistry = window._settingsRegistry || [
  {
    key: "DEBUG_LOG_LEVEL",
    label: "Debug: Log Level",
    type: "select",
    options: [
      { value: "OFF", label: "Off" },
      { value: "ERROR", label: "Error" },
      { value: "WARN", label: "Warning" },
      { value: "INFO", label: "Info" },
      { value: "DEBUG", label: "Debug" },
      { value: "TRACE", label: "Trace (very verbose)" }
    ],
    default: "ERROR"
  },
  {
    key: "LOG_OUTPUT_DEST",
    label: "Log Output Destination",
    type: "select",
    options: [
      { value: "console", label: "Console Only" },
      { value: "server", label: "Server Only" },
      { value: "both", label: "Both" }
    ],
    default: "console"
  }
];

// Minimal settings backing store
window._settings = window._settings || {};
function getSetting(key) {
  if (key in window._settings) return window._settings[key];
  const reg = (window._settingsRegistry || []).find(s => s.key === key);
  return reg && "default" in reg ? reg.default : undefined;
}
function setSetting(key, value) {
  window._settings[key] = value;
  // Update log level immediately for log()
  if (key === "DEBUG_LOG_LEVEL") window._currentLogLevel = window.LOG_LEVELS[value] || window.LOG_LEVELS.ERROR;
}
window.getSetting = getSetting;
window.setSetting = setSetting;

// --- Robust log() system ---
window._currentLogLevel = window.LOG_LEVELS[getSetting("DEBUG_LOG_LEVEL") || "ERROR"];
function log(level, ...args) {
  let curLevel = window._currentLogLevel;
  // Allow runtime update via settings panel
  try {
    if (typeof window.getSetting === "function") {
      const setLevel = window.getSetting("DEBUG_LOG_LEVEL");
      curLevel = window.LOG_LEVELS[setLevel] !== undefined ? window.LOG_LEVELS[setLevel] : window._currentLogLevel;
      window._currentLogLevel = curLevel;
    }
  } catch (e) {}
  const msgLevel = window.LOG_LEVELS[level];
  if (msgLevel && curLevel >= msgLevel) {
    console.log(`[${level}]`, ...args);
    // Optionally stream logs for ERROR level
    if (typeof window._externalLogStream === "function") {
      try {
        window._externalLogStream(level, ...args);
      } catch (e) {}
    }
  }
}
function logEnter(fnName, ...args) {
  log("TRACE", `>> Enter ${fnName}`, ...args);
}
function logExit(fnName, ...result) {
  log("TRACE", `<< Exit ${fnName}`, ...result);
}

/*********************************************************
 * Golden Layout Bootstrapping & Panel Registration
 *********************************************************/

(function initGoldenLayout() {
  logEnter("initGoldenLayout");
  if (window._GL_HELLO_WORLD_INITIALIZED) {
    log("DEBUG", "Golden Layout already initialized");
    logExit("initGoldenLayout");
    return;
  }
  window._GL_HELLO_WORLD_INITIALIZED = true;

  function doInit() {
    logEnter("doInit");
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
        logExit("doInit");
        return;
      }
      while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

      const myLayout = new GoldenLayout(layoutConfig, glRoot);

      // ---- 3. Register panels ----
      myLayout.registerComponent("SidebarPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "sidebar";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSidebarPanel) {
          log("DEBUG", "buildSidebarPanel called");
          window.buildSidebarPanel(div, container, state);
        }
      });

      myLayout.registerComponent("CanvasPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "canvas-area";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildCanvasPanel) {
          log("DEBUG", "buildCanvasPanel called");
          window.buildCanvasPanel(div, container, state);
        }
      });

      myLayout.registerComponent("SettingsPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "settingsPanel";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSettingsPanel) {
          log("DEBUG", "buildSettingsPanel called");
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
    logExit("doInit");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
  logExit("initGoldenLayout");
})();
// COPILOT_PART_handlers: 2025-09-11T21:19:00Z
/*********************************************************
 * UI Event Handler Attachment
 * ------------------------------------------------------
 * Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
 * Centralizes event handler logic for maintainability.
 * Ensures handlers are attached only after the DOM is fully constructed
 * (including dynamically generated panels).
 * Should be loaded/concatenated immediately after shapes.layout.js.
 *********************************************************/

// Logging helpers from layout part (assumed loaded before this part)
function handlers_log(level, ...args) { if (typeof log === "function") log(level, ...args); }
function handlers_logEnter(fn, ...a) { handlers_log("TRACE", `>> Enter ${fn}`, ...a); }
function handlers_logExit(fn, ...r) { handlers_log("TRACE", `<< Exit ${fn}`, ...r); }

(function attachToolbarHandlers() {
  handlers_logEnter("attachToolbarHandlers");
  // Only attach after DOM and Golden Layout panels are ready
  function safeAttach() {
    handlers_logEnter("safeAttach");

    // Wait for window._sceneDesigner (created by CanvasPanel)
    if (!window._sceneDesigner || typeof window._sceneDesigner.addShapeFromToolbar !== "function") {
      handlers_log("DEBUG", "Waiting for _sceneDesigner.addShapeFromToolbar...");
      setTimeout(safeAttach, 120);
      handlers_logExit("safeAttach (not ready)");
      return;
    }

    // Reference to shared AppState
    const AppState = window._sceneDesigner;

    // Toolbar controls
    const newBtn = document.getElementById("newBtn");
    const duplicateBtn = document.getElementById("duplicateBtn");
    const deleteBtn = document.getElementById("deleteBtn");
    const resetRotationBtn = document.getElementById("resetRotationBtn");
    const selectAllBtn = document.getElementById("selectAllBtn");
    const shapeTypeSelect = document.getElementById("shapeType");

    // Defensive: Ensure all exist
    if (!newBtn || !shapeTypeSelect) {
      handlers_log("ERROR", "Toolbar controls not found");
      handlers_logExit("safeAttach (missing controls)");
      return;
    }

    // ADD button
    newBtn.onclick = function (e) {
      handlers_logEnter("newBtn.onclick", e);
      if (typeof AppState.addShapeFromToolbar === "function") {
        handlers_log("TRACE", "Add button clicked. Shape type:", shapeTypeSelect.value);
        AppState.addShapeFromToolbar();
      } else {
        handlers_log("ERROR", "AppState.addShapeFromToolbar not defined");
      }
      handlers_logExit("newBtn.onclick");
    };

    // DUPLICATE button (placeholder, to be implemented)
    if (duplicateBtn) {
      duplicateBtn.onclick = function (e) {
        handlers_log("TRACE", "Duplicate button clicked. TODO: implement shape duplication.");
        // TODO: implement duplication as a function in AppState and call here
      };
    }

    // DELETE button (placeholder, to be implemented)
    if (deleteBtn) {
      deleteBtn.onclick = function (e) {
        handlers_log("TRACE", "Delete button clicked. TODO: implement shape deletion.");
        // TODO: implement deletion as a function in AppState and call here
      };
    }

    // RESET ROTATION button (placeholder, to be implemented)
    if (resetRotationBtn) {
      resetRotationBtn.onclick = function (e) {
        handlers_log("TRACE", "Reset Rotation button clicked. TODO: implement reset rotation.");
        // TODO: implement rotation reset as a function in AppState and call here
      };
    }

    // SELECT ALL button (optional: implemented in shapes.multiselect.js)
    if (selectAllBtn) {
      selectAllBtn.onclick = function (e) {
        handlers_log("TRACE", "Select All button clicked.");
        if (AppState._multiSelect && typeof AppState._multiSelect.selectAllShapes === "function") {
          AppState._multiSelect.selectAllShapes();
        } else if (Array.isArray(AppState.shapes)) {
          AppState.selectedShapes = AppState.shapes.slice();
          handlers_log("DEBUG", "Selected all shapes (fallback)");
        }
      };
    }

    // For debugging: mark handlers as attached
    window._toolbarHandlersAttached = true;
    handlers_log("INFO", "Toolbar event handlers attached.");
    handlers_logExit("safeAttach");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeAttach);
  } else {
    setTimeout(safeAttach, 0);
  }
  handlers_logExit("attachToolbarHandlers");
})();
// COPILOT_PART_sidebar: 2025-09-11T21:21:00Z
/*********************************************************
 * Sidebar Panel Logic
 * ----------------------------------------
 * Implements the content and UI logic for the Sidebar panel (shape table/list).
 * Current: Placeholder/hello world.
 * Planned: Will show the table of annotation shapes and handle selection, lock, delete, etc.
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

  // Example debugging: log panel construction
  if (typeof logEnter === "function") logEnter("buildSidebarPanel", {rootDiv, container, state});
  if (typeof logExit === "function") logExit("buildSidebarPanel");
};
// COPILOT_PART_konva: 2025-09-11T21:23:00Z
/*********************************************************
 * CanvasPanel – Image Display & Shape Creation
 * ------------------------------------------------------
 * Handles Canvas setup, image loading, and single-shape creation/selection.
 * - Loads and displays the selected/uploaded image.
 * - Provides creation for "Point", "Rectangle", and "Circle" shapes.
 * - Handles single-shape selection and transformer UI.
 * - Exports key hooks for shapes.multiselect.js (multi-select, drag, highlights).
 * - All state is kept in window._sceneDesigner (SSOT).
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

    // Export hooks for shapes.multiselect.js and shapes.handlers.js
    AppState.makeReticlePointShape = makeReticlePointShape;
    AppState.makeRectShape = makeRectShape;
    AppState.makeCircleShape = makeCircleShape;
    AppState.selectShape = selectShape;
    AppState.deselectShape = deselectShape;
    AppState.setShapeLocked = setShapeLocked;
    AppState.addShapeFromToolbar = addShapeFromToolbar;
  };
})();
// COPILOT_PART_multiselect: 2025-09-11T21:25:00Z
/*********************************************************
 * Multi-Select, Group Drag, Highlights, Lock UI
 * ------------------------------------------------------
 * Handles all multi-selection, group drag, bounding box, and lock UI logic.
 * Depends on shapes.konva.js for shape creation and single selection.
 * - Multi-select: Select All, marquee/box selection, multi-selection highlights.
 * - Multi-select drag, clamped group bounding box (with rotation/scale).
 * - Orange debug bounding box during group drag.
 * - Locking: Locked shapes block group drag and show red highlight feedback.
 * - Lock checkbox UI always reflects current selection.
 * - Uses setSelectedShapes() as the only way to change selection state.
 *********************************************************/

(function () {
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
    if (typeof window.updateList === "function") window.updateList();
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

  // --- Select All logic: uses setSelectedShapes() SSOT setter ---
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

  // --- Export handlers for event attachment in shapes.konva.js ---
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
      selectAllShapes
    };
  }

  // --- Deferred Initialization ---
  function initMultiselect() {
    attachSelectionOverrides();
    attachSelectAllHook();
    attachLockCheckboxHook();
    exportMultiSelectAPI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMultiselect);
  } else {
    setTimeout(initMultiselect, 0);
  }
})();
// COPILOT_PART_settings: 2025-09-11T21:27:00Z
/*********************************************************
 * SettingsPanel Logic (modular)
 * ----------------------------------------
 * Implements the content and UI for the Settings panel.
 * - Provides "Log Level" and "Log Output Destination" selectors.
 * - Both are wired to window.setSetting/getSetting,
 *   affecting runtime logging and streaming for the modular log() system.
 * - Will grow to support more settings as features expand.
 *********************************************************/

window.buildSettingsPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Settings Panel Title
  const h2 = document.createElement("h2");
  h2.innerText = "Settings";
  rootDiv.appendChild(h2);

  // --- Log Level Setting ---
  const logLevelDiv = document.createElement("div");
  logLevelDiv.className = "settings-field";

  const logLabel = document.createElement("label");
  logLabel.setAttribute("for", "setting-DEBUG_LOG_LEVEL");
  logLabel.innerText = "Debug: Log Level";
  logLevelDiv.appendChild(logLabel);

  const logLevelSelect = document.createElement("select");
  logLevelSelect.id = "setting-DEBUG_LOG_LEVEL";
  const levels = [
    {value: "OFF", label: "Off"},
    {value: "ERROR", label: "Error"},
    {value: "WARN", label: "Warning"},
    {value: "INFO", label: "Info"},
    {value: "DEBUG", label: "Debug"},
    {value: "TRACE", label: "Trace (very verbose)"}
  ];
  levels.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.innerText = opt.label;
    logLevelSelect.appendChild(o);
  });
  let currentLevel = "ERROR";
  if (typeof window.getSetting === "function") {
    currentLevel = window.getSetting("DEBUG_LOG_LEVEL") || "ERROR";
  }
  logLevelSelect.value = currentLevel;

  logLevelSelect.addEventListener("change", function() {
    if (typeof window.setSetting === "function") {
      window.setSetting("DEBUG_LOG_LEVEL", logLevelSelect.value);
    } else {
      window._settings = window._settings || {};
      window._settings["DEBUG_LOG_LEVEL"] = logLevelSelect.value;
    }
    if (window.LOG_LEVELS && window._currentLogLevel !== undefined) {
      window._currentLogLevel = window.LOG_LEVELS[logLevelSelect.value] || window.LOG_LEVELS.ERROR;
    }
    if (window.console && typeof window.console.log === "function") {
      window.console.log(`[SETTINGS] Log level set to ${logLevelSelect.value}`);
    }
  });

  logLevelDiv.appendChild(logLevelSelect);
  rootDiv.appendChild(logLevelDiv);

  // --- Log Output Destination Setting ---
  const logDestDiv = document.createElement("div");
  logDestDiv.className = "settings-field";
  const destLabel = document.createElement("label");
  destLabel.setAttribute("for", "setting-LOG_OUTPUT_DEST");
  destLabel.innerText = "Log Output Destination";
  logDestDiv.appendChild(destLabel);

  const logDestSelect = document.createElement("select");
  logDestSelect.id = "setting-LOG_OUTPUT_DEST";
  const destOptions = [
    { value: "console", label: "Console Only" },
    { value: "server", label: "Server Only" },
    { value: "both", label: "Both" }
  ];
  destOptions.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.innerText = opt.label;
    logDestSelect.appendChild(o);
  });
  let currentDest = "console";
  if (typeof window.getSetting === "function") {
    currentDest = window.getSetting("LOG_OUTPUT_DEST") || "console";
  }
  logDestSelect.value = currentDest;

  logDestSelect.addEventListener("change", function() {
    if (typeof window.setSetting === "function") {
      window.setSetting("LOG_OUTPUT_DEST", logDestSelect.value);
    } else {
      window._settings = window._settings || {};
      window._settings["LOG_OUTPUT_DEST"] = logDestSelect.value;
    }
    if (window.console && typeof window.console.log === "function") {
      window.console.log(`[SETTINGS] Log output destination set to ${logDestSelect.value}`);
    }
  });

  logDestDiv.appendChild(logDestSelect);
  rootDiv.appendChild(logDestDiv);

  // ---- Future: Add more settings here from registry ----

  // Minimal styling for clarity
  rootDiv.style.fontFamily = "Segoe UI, Arial, sans-serif";
  rootDiv.style.fontSize = "16px";
  rootDiv.style.padding = "12px 8px";
};
