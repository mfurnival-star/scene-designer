// COPILOT_PART_logserver: 2025-09-12T10:20:00Z
/*********************************************************
 * [logserver] Log Streaming and External Log Server Integration
 * ------------------------------------------------------------
 * - Exposes window._externalLogStream(level, ...args) for log streaming.
 * - Destination controlled by LOG_OUTPUT_DEST setting:
 *     "console" (default): logs to console only
 *     "server": logs to server only (if URL set)
 *     "both": logs to both
 * - Filters messages by the current log level (see COPILOT_MANIFESTO.md).
 * - To enable server logging, set window._externalLogServerURL, or
 *   use the Settings panel.
 * - Adheres to project logging schema and manifesto (see COPILOT_MANIFESTO.md).
 *********************************************************/

// --- LOG LEVEL DEFINITIONS (used across all modules) ---
window.LOG_LEVELS = window.LOG_LEVELS || {
  OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

// --- LOGGING SETTINGS DEFAULTS (safe fallback) ---
window._settings = window._settings || {};
if (!window._settings.DEBUG_LOG_LEVEL) window._settings.DEBUG_LOG_LEVEL = "ERROR";
if (!window._settings.LOG_OUTPUT_DEST) window._settings.LOG_OUTPUT_DEST = "console";
window._externalLogServerURL = window._externalLogServerURL || "";

// --- REGISTER LOGGING SETTINGS (if not already present) ---
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

// --- LOG STREAMING CORE (with log-level filtering) ---
window._externalLogStream = async function(level, ...args) {
  // Project-wide: always tag logs with [logserver]
  const tag = "[logserver]";

  // Determine current log level (fallback to "ERROR" if unset)
  let curLevel = "ERROR";
  if (typeof window.getSetting === "function") {
    curLevel = window.getSetting("DEBUG_LOG_LEVEL") || "ERROR";
  } else if (window._settings && window._settings.DEBUG_LOG_LEVEL) {
    curLevel = window._settings.DEBUG_LOG_LEVEL;
  }
  const curLevelNum = window.LOG_LEVELS[curLevel] ?? window.LOG_LEVELS.ERROR;
  const msgLevelNum = window.LOG_LEVELS[level] ?? 99; // Unknown levels excluded

  // Only log if message level is at or above current level (lower number = higher priority)
  if (msgLevelNum > curLevelNum) return;

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
        console.error(`${tag} [FAIL]`, level, ...args, e);
      }
    }
  }

  // Helper: Send to console (always log errors to console if unset)
  function sendToConsole() {
    // Level-specific console output
    if (window.LOG_LEVELS) {
      if (window.LOG_LEVELS[level] <= window.LOG_LEVELS.WARN) {
        console.warn(`${tag}`, level, ...args);
      } else {
        console.log(`${tag}`, level, ...args);
      }
    } else {
      console.log(`${tag}`, level, ...args);
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

// No-op flush for future batching support
window._externalLogStream.flush = function() {};

// --- DEBUG: Self-test ---
if (!window._logserverTested) {
  window._logserverTested = true;
  window._externalLogStream("INFO", "[logserver] LogServer module loaded and ready.");
}
// COPILOT_PART_layout: 2025-09-12T10:05:00Z
/*********************************************************
 * [layout] Golden Layout Bootstrapping & Panel Registration
 * --------------------------------------------------------
 * - Initializes Golden Layout with Sidebar, Canvas, and Settings panels.
 * - Registers panel builder hooks.
 * - Exposes show/hide logic for Settings panel, myLayout for debugging.
 * - Applies project logging schema (see COPILOT_MANIFESTO.md).
 *********************************************************/

// --- LOGGING HELPERS (module tag: [layout]) ---
function layout_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[layout]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[layout]", level, ...args);
  }
}
function layout_logEnter(fnName, ...args) { layout_log("TRACE", `>> Enter ${fnName}`, ...args); }
function layout_logExit(fnName, ...result) { layout_log("TRACE", `<< Exit ${fnName}`, ...result); }

// --- GOLDEN LAYOUT BOOTSTRAP ---
(function initGoldenLayout() {
  layout_logEnter("initGoldenLayout");
  if (window._GL_LAYOUT_INITIALIZED) {
    layout_log("DEBUG", "Golden Layout already initialized");
    layout_logExit("initGoldenLayout");
    return;
  }
  window._GL_LAYOUT_INITIALIZED = true;

  function doInit() {
    layout_logEnter("doInit");
    try {
      // 1. Layout config
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
              width: 80
            },
            {
              type: "column",
              width: 20,
              content: [
                {
                  type: "component",
                  componentName: "SidebarPanel",
                  title: "Shapes",
                  height: 50
                },
                {
                  type: "component",
                  componentName: "SettingsPanel",
                  title: "Settings",
                  height: 50,
                  isClosable: true
                }
              ]
            }
          ]
        }]
      };

      // 2. Find root
      const glRoot = document.getElementById("main-layout");
      if (!glRoot) {
        layout_log("ERROR", "Golden Layout root #main-layout not found!");
        layout_logExit("doInit");
        return;
      }
      while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

      const myLayout = new GoldenLayout(layoutConfig, glRoot);

      // 3. Register panels
      myLayout.registerComponent("SidebarPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "sidebar";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSidebarPanel) {
          layout_log("DEBUG", "buildSidebarPanel called");
          window.buildSidebarPanel(div, container, state);
        }
      });

      myLayout.registerComponent("CanvasPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "canvas-area";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildCanvasPanel) {
          layout_log("DEBUG", "buildCanvasPanel called");
          window.buildCanvasPanel(div, container, state);
        }
      });

      myLayout.registerComponent("SettingsPanel", function(container, state) {
        const div = document.createElement("div");
        div.id = "settingsPanel";
        div.style.height = "100%";
        container.getElement().append(div);
        if (window.buildSettingsPanel) {
          layout_log("DEBUG", "buildSettingsPanel called");
          window.buildSettingsPanel(div, container, state);
        }
      });

      // 4. Initialize layout
      myLayout.init();

      // 5. Settings panel show/hide
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

      // 6. Expose layout for debugging
      window.myLayout = myLayout;

      // 7. Ready event
      if (typeof window.onGoldenLayoutReady === "function") {
        window.onGoldenLayoutReady(myLayout);
      }
    } catch (e) {
      layout_log("ERROR", "Exception in Golden Layout bootstrapping", e);
      throw e;
    }
    layout_logExit("doInit");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", doInit);
  } else {
    doInit();
  }
  layout_logExit("initGoldenLayout");
})();

// COPILOT_PART_handlers: 2025-09-12T10:07:00Z
/*********************************************************
 * [handlers] UI Event Handler Attachment
 * ------------------------------------------------------
 * Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
 * Centralizes event handler logic for maintainability.
 * Ensures handlers are attached only after the DOM is fully constructed
 * (including dynamically generated panels).
 * Adheres to project logging schema and manifesto (see COPILOT_MANIFESTO.md).
 *********************************************************/

// Logging helpers (module tag: [handlers])
function handlers_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[handlers]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[handlers]", level, ...args);
  }
}
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
// COPILOT_PART_sidebar: 2025-09-12T10:09:00Z
/*********************************************************
 * [sidebar] Sidebar Panel Logic
 * ------------------------------------------------------
 * Implements the content and UI logic for the Sidebar panel (shape table/list).
 * - Will display the table of annotation shapes and handle selection, lock, delete, etc.
 * - Applies standardized logging as per COPILOT_MANIFESTO.md.
 *********************************************************/

// Logging helpers (module tag: [sidebar])
function sidebar_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[sidebar]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[sidebar]", level, ...args);
  }
}
function sidebar_logEnter(fnName, ...args) { sidebar_log("TRACE", `>> Enter ${fnName}`, ...args); }
function sidebar_logExit(fnName, ...result) { sidebar_log("TRACE", `<< Exit ${fnName}`, ...result); }

window.buildSidebarPanel = function(rootDiv, container, state) {
  sidebar_logEnter("buildSidebarPanel", {rootDiv, container, state});
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Placeholder "Hello, Sidebar!"
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Sidebar!";
  const p = document.createElement("p");
  p.innerText = "This is the shape table panel (sidebar).";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);

  // Log panel construction
  sidebar_log("DEBUG", "Sidebar panel built (placeholder)");
  sidebar_logExit("buildSidebarPanel");
};
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
// COPILOT_PART_multiselect: 2025-09-12T13:23:00Z
/*********************************************************
 * [multiselect] Multi-Select, Group Drag, Highlights, Lock UI
 * ------------------------------------------------------
 * Handles all multi-selection, group drag, bounding box, and lock UI logic.
 * - Multi-select: Select All, marquee/box selection, multi-selection highlights.
 * - Multi-select drag, clamped group bounding box (with rotation/scale).
 * - Orange group bounding box during group drag (not debug, now permanent setting).
 * - Locking: Locked shapes block group drag and show red highlight feedback.
 * - Lock checkbox UI always reflects current selection.
 * - Uses setSelectedShapes() as the only way to change selection state.
 * - Applies project logging schema (see COPILOT_MANIFESTO.md).
 *********************************************************/

// Logging helpers (module tag: [multiselect])
function multiselect_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[multiselect]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[multiselect]", level, ...args);
  }
}
function multiselect_logEnter(fnName, ...args) { multiselect_log("TRACE", `>> Enter ${fnName}`, ...args); }
function multiselect_logExit(fnName, ...result) { multiselect_log("TRACE", `<< Exit ${fnName}`, ...result); }

(function () {
  function getAppState() {
    return window._sceneDesigner || {};
  }

  let multiSelectHighlightShapes = [];
  // RENAMED: groupBoundingBox (was debugMultiDragBox)
  let groupBoundingBox = null;
  let _lockedDragAttemptedIDs = [];

  // --- Centralized Selection Setter ---
  function setSelectedShapes(shapesArr) {
    multiselect_logEnter("setSelectedShapes", shapesArr);
    const AppState = getAppState();
    AppState.selectedShapes = shapesArr || [];
    AppState.selectedShape = (shapesArr && shapesArr.length === 1) ? shapesArr[0] : null;

    // Remove transformer if multiselect or none
    if (AppState.transformer) {
      multiselect_log("DEBUG", "Destroyed transformer due to multi-select or deselect.");
      AppState.transformer.destroy();
      AppState.transformer = null;
    }

    // If single selection and it's a rect or circle, add transformer
    if (AppState.selectedShapes.length === 1) {
      const shape = AppState.selectedShapes[0];
      if (shape._type === "rect" || shape._type === "circle") {
        multiselect_log("DEBUG", "Adding transformer for single selection", {shape_id: shape._id, type: shape._type});
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
        multiselect_log("DEBUG", "Showing selection for point", {shape_id: shape._id});
        shape.showSelection(true);
      }
    } else {
      // Hide selection for points if multi or none
      if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection) {
        multiselect_log("DEBUG", "Hiding selection for point", {shape_id: AppState.selectedShape._id});
        AppState.selectedShape.showSelection(false);
      }
    }

    updateLockCheckboxUI();
    updateSelectionHighlights();

    // Always clear group bounding box if selection <2
    if (!AppState.selectedShapes || AppState.selectedShapes.length < 2) {
      clearGroupBoundingBox();
      multiselect_log("TRACE", "Cleared group bounding box due to single/no selection.");
    }

    if (AppState.konvaLayer) AppState.konvaLayer.draw();
    if (typeof window.updateList === "function") window.updateList();
    if (typeof window.updateLabelUI === "function") window.updateLabelUI();
    multiselect_logExit("setSelectedShapes");
  }

  // --- Selection Highlight Logic ---
  function updateSelectionHighlights() {
    multiselect_logEnter("updateSelectionHighlights");
    const AppState = getAppState();
    if (multiSelectHighlightShapes.length && AppState.konvaLayer) {
      multiSelectHighlightShapes.forEach(g => g.destroy && g.destroy());
      multiSelectHighlightShapes = [];
      AppState.konvaLayer.draw();
    }
    if (!AppState.selectedShapes || AppState.selectedShapes.length < 2 || !AppState.konvaLayer) {
      multiselect_log("DEBUG", "No multiselect highlights needed.", {selectedShapes: AppState.selectedShapes});
      multiselect_logExit("updateSelectionHighlights (not multi)");
      return;
    }
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
    multiselect_logExit("updateSelectionHighlights");
  }
  window._sceneDesigner = window._sceneDesigner || {};
  window._sceneDesigner.updateSelectionHighlights = updateSelectionHighlights;

  // --- Locked Drag Red Feedback ---
  function showLockedHighlightForShapes(shapesArr) {
    multiselect_logEnter("showLockedHighlightForShapes", shapesArr);
    _lockedDragAttemptedIDs = shapesArr.map(s => s._id);
    updateSelectionHighlights();
    setTimeout(() => {
      _lockedDragAttemptedIDs = [];
      updateSelectionHighlights();
    }, 1000);
    multiselect_logExit("showLockedHighlightForShapes");
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
    multiselect_logEnter("clampMultiDragDelta", dx, dy, origPositions);
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

    multiselect_log("DEBUG", "clampMultiDragDelta calculated", {input: {dx, dy}, output: {adjDx, adjDy}, origPositions, groupBounds});
    multiselect_logExit("clampMultiDragDelta", adjDx, adjDy);
    return [adjDx, adjDy];
  }
  // RENAMED: updateGroupBoundingBox (was updateDebugMultiDragBox)
  function updateGroupBoundingBox() {
    multiselect_logEnter("updateGroupBoundingBox");
    const AppState = getAppState();
    if (groupBoundingBox) groupBoundingBox.destroy();
    if (!AppState.selectedShapes || AppState.selectedShapes.length < 2 || !AppState.konvaLayer) {
      multiselect_logExit("updateGroupBoundingBox (not multi)");
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    AppState.selectedShapes.forEach(shape => {
      const rect = shape.getClientRect({ relativeTo: AppState.konvaStage });
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });

    groupBoundingBox = new Konva.Rect({
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
    AppState.konvaLayer.add(groupBoundingBox);
    AppState.konvaLayer.batchDraw();
    multiselect_logExit("updateGroupBoundingBox");
  }
  // RENAMED: clearGroupBoundingBox (was clearDebugMultiDragBox)
  function clearGroupBoundingBox() {
    multiselect_logEnter("clearGroupBoundingBox");
    const AppState = getAppState();
    if (groupBoundingBox) {
      groupBoundingBox.destroy();
      groupBoundingBox = null;
      if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    }
    multiselect_logExit("clearGroupBoundingBox");
  }

  // --- Multi-Drag Handlers ---
  function onMultiDragMove(evt) {
    multiselect_logEnter("onMultiDragMove", evt);
    const AppState = getAppState();
    const multiDrag = AppState.multiDrag || {};
    if (!multiDrag.moving || !multiDrag.dragOrigin || !AppState.konvaStage) {
      multiselect_log("DEBUG", "onMultiDragMove: not moving or missing dragOrigin/stage", {multiDrag, evt});
      multiselect_logExit("onMultiDragMove (not moving)");
      return;
    }
    const pos = AppState.konvaStage.getPointerPosition();
    let dx = pos.x - multiDrag.dragOrigin.x;
    let dy = pos.y - multiDrag.dragOrigin.y;
    let [clampedDx, clampedDy] = clampMultiDragDelta(dx, dy, multiDrag.origPositions);
    multiDrag.origPositions.forEach(obj => {
      multiselect_log("TRACE", "onMultiDragMove: moving shape", {shape_id: obj.shape._id, from: {x: obj.x, y: obj.y}, to: {x: obj.x+clampedDx, y: obj.y+clampedDy}});
      obj.shape.x(obj.x + clampedDx);
      obj.shape.y(obj.y + clampedDy);
    });
    updateGroupBoundingBox();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    updateSelectionHighlights();
    multiselect_logExit("onMultiDragMove");
  }
  function onMultiDragEnd(evt) {
    multiselect_logEnter("onMultiDragEnd", evt);
    const AppState = getAppState();
    if (AppState.multiDrag) {
      AppState.multiDrag.moving = false;
      AppState.multiDrag.dragOrigin = null;
      AppState.multiDrag.origPositions = null;
    }
    clearGroupBoundingBox();
    if (AppState.konvaStage) {
      AppState.konvaStage.off('mousemove.multidrag touchmove.multidrag');
      AppState.konvaStage.off('mouseup.multidrag touchend.multidrag');
    }
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    updateSelectionHighlights();
    multiselect_logExit("onMultiDragEnd");
  }

  // --- Lock UI and Lock Checkbox Logic ---
  function updateLockCheckboxUI() {
    multiselect_logEnter("updateLockCheckboxUI");
    const AppState = getAppState();
    const lockCheckbox = document.getElementById("lockCheckbox");
    if (!lockCheckbox) {
      multiselect_log("DEBUG", "No lockCheckbox found");
      multiselect_logExit("updateLockCheckboxUI (no checkbox)");
      return;
    }
    if (!AppState.selectedShapes || AppState.selectedShapes.length === 0) {
      lockCheckbox.indeterminate = false;
      lockCheckbox.checked = false;
      multiselect_log("DEBUG", "No shapes selected, lockCheckbox unchecked");
      multiselect_logExit("updateLockCheckboxUI (no selection)");
      return;
    }
    const allLocked = AppState.selectedShapes.every(s => s.locked);
    const noneLocked = AppState.selectedShapes.every(s => !s.locked);
    lockCheckbox.indeterminate = !(allLocked || noneLocked);
    lockCheckbox.checked = allLocked;
    multiselect_log("DEBUG", "updateLockCheckboxUI: updated", {allLocked, noneLocked});
    multiselect_logExit("updateLockCheckboxUI");
  }

  // --- Select All Handler ---
  function selectAllShapes() {
    multiselect_logEnter("selectAllShapes");
    const AppState = getAppState();
    if (!Array.isArray(AppState.shapes)) {
      multiselect_log("ERROR", "No shapes array in AppState");
      multiselect_logExit("selectAllShapes (no shapes)");
      return;
    }
    setSelectedShapes(AppState.shapes.slice());
    multiselect_log("INFO", "Selecting all shapes.", {shape_ids: AppState.shapes.map(s => s._id)});
    multiselect_logExit("selectAllShapes");
  }

  // --- Export core API to AppState ---
  window._sceneDesigner._multiSelect = {
    setSelectedShapes,
    updateSelectionHighlights,
    onMultiDragMove,
    onMultiDragEnd,
    updateGroupBoundingBox,
    clearGroupBoundingBox,
    showLockedHighlightForShapes,
    selectAllShapes
  };

})();
// COPILOT_PART_settings: 2025-09-12T10:17:00Z
/*********************************************************
 * [settings] Settings Panel Logic (modular)
 * ------------------------------------------------------
 * Implements the content and UI for the Settings panel.
 * - Provides "Log Level" and "Log Output Destination" selectors.
 * - Both are wired to window.setSetting/getSetting,
 *   affecting runtime logging and streaming for the modular log() system.
 * - Adheres to project logging schema (see COPILOT_MANIFESTO.md).
 *********************************************************/

// Logging helpers (module tag: [settings])
function settings_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[settings]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[settings]", level, ...args);
  }
}
function settings_logEnter(fnName, ...args) { settings_log("TRACE", `>> Enter ${fnName}`, ...args); }
function settings_logExit(fnName, ...result) { settings_log("TRACE", `<< Exit ${fnName}`, ...result); }

window.buildSettingsPanel = function(rootDiv, container, state) {
  settings_logEnter("buildSettingsPanel", {rootDiv, container, state});
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
    settings_log("INFO", "Log level changed to", logLevelSelect.value);
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
      window.console.log(`[settings] Log level set to ${logLevelSelect.value}`);
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
    settings_log("INFO", "Log output destination changed to", logDestSelect.value);
    if (typeof window.setSetting === "function") {
      window.setSetting("LOG_OUTPUT_DEST", logDestSelect.value);
    } else {
      window._settings = window._settings || {};
      window._settings["LOG_OUTPUT_DEST"] = logDestSelect.value;
    }
    if (window.console && typeof window.console.log === "function") {
      window.console.log(`[settings] Log output destination set to ${logDestSelect.value}`);
    }
  });

  logDestDiv.appendChild(logDestSelect);
  rootDiv.appendChild(logDestDiv);

  // ---- Future: Add more settings here from registry ----

  // Minimal styling for clarity
  rootDiv.style.fontFamily = "Segoe UI, Arial, sans-serif";
  rootDiv.style.fontSize = "16px";
  rootDiv.style.padding = "12px 8px";

  settings_logExit("buildSettingsPanel");
};
