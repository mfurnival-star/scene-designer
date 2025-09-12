// COPILOT_PART_multiselect: 2025-09-12T14:28:00Z
/*********************************************************
 * [multiselect] Multi-Select, Group Drag, Highlights, Lock UI
 * ----------------------------------------------------------
 * Handles all multi-selection, group drag, bounding box, and lock UI logic.
 * - Multi-select: Select All, marquee/box selection, multi-selection highlights.
 * - Multi-select drag, clamped group bounding box (with rotation/scale).
 * - Orange debug bounding box during group drag.
 * - Locking: Locked shapes block group drag and show red highlight feedback.
 * - Lock checkbox UI always reflects current selection.
 * - Depends on shapes.konva.js for shape creation and single selection.
 * - All state is kept in window._sceneDesigner (SSOT).
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
function multiselect_logEnter(fn, ...a) { multiselect_log("TRACE", `>> Enter ${fn}`, ...a); }
function multiselect_logExit(fn, ...r) { multiselect_log("TRACE", `<< Exit ${fn}`, ...r); }

(function() {
  // Canonical AppState reference
  const getAppState = () => window._sceneDesigner;

  // --- Selection Highlight State ---
  let highlightOverlays = [];
  let groupBoundingBox = null;
  let lockedHighlightTimeout = null;

  // --- Canonical selection setter: always call this for multi-select changes! ---
  function setSelectedShapes(newSelection) {
    multiselect_logEnter("setSelectedShapes", {newSelection});
    const AppState = getAppState();
    if (!Array.isArray(newSelection)) newSelection = [];
    AppState.selectedShapes = newSelection;
    AppState.selectedShape = (newSelection.length === 1) ? newSelection[0] : null;

    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }

    updateSelectionHighlights();

    if (newSelection.length > 1) {
      updateGroupBoundingBox();
    } else {
      clearGroupBoundingBox();
    }

    // Sync lock UI (checkbox indeterminate, etc.)
    if (typeof window.lockCheckbox !== "undefined") {
      const allLocked = newSelection.length > 0 && newSelection.every(s => s.locked);
      const noneLocked = newSelection.length > 0 && newSelection.every(s => !s.locked);
      if (newSelection.length === 0) {
        window.lockCheckbox.indeterminate = false;
        window.lockCheckbox.checked = false;
      } else {
        window.lockCheckbox.indeterminate = !(allLocked || noneLocked);
        window.lockCheckbox.checked = allLocked;
      }
    }

    // Redraw layer if present
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();

    multiselect_logExit("setSelectedShapes");
  }

  // --- Select All API ---
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

  // --- Selection highlight overlays ---
  function updateSelectionHighlights() {
    multiselect_logEnter("updateSelectionHighlights");
    const AppState = getAppState();

    // Clear any previous overlays
    if (highlightOverlays.length > 0 && AppState.konvaLayer) {
      highlightOverlays.forEach(h => h.destroy());
      highlightOverlays = [];
      AppState.konvaLayer.batchDraw();
    }

    const sel = AppState.selectedShapes || [];
    if (sel.length <= 1) {
      multiselect_log("TRACE", "No multi-select highlights needed.");
      multiselect_logExit("updateSelectionHighlights (none)");
      return;
    }

    sel.forEach(shape => {
      let highlight = null;
      if (shape._type === 'rect') {
        highlight = new Konva.Rect({
          x: shape.x() - 4,
          y: shape.y() - 4,
          width: shape.width() + 8,
          height: shape.height() + 8,
          stroke: "#2176ff",
          strokeWidth: 2.5,
          dash: [5, 5],
          listening: false,
          cornerRadius: 7
        });
      } else if (shape._type === 'circle') {
        highlight = new Konva.Circle({
          x: shape.x(),
          y: shape.y(),
          radius: shape.radius() + 6,
          stroke: "#2176ff",
          strokeWidth: 2.5,
          dash: [5, 5],
          listening: false
        });
      } else if (shape._type === 'point') {
        highlight = new Konva.Circle({
          x: shape.x(),
          y: shape.y(),
          radius: 18,
          stroke: "#2176ff",
          strokeWidth: 2.5,
          dash: [5, 5],
          listening: false
        });
      }
      if (highlight && AppState.konvaLayer) {
        AppState.konvaLayer.add(highlight);
        highlight.moveToTop();
        highlightOverlays.push(highlight);
      }
    });

    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    multiselect_logExit("updateSelectionHighlights");
  }

  // --- Group bounding box (orange) ---
  function updateGroupBoundingBox() {
    multiselect_logEnter("updateGroupBoundingBox");
    const AppState = getAppState();

    clearGroupBoundingBox();

    const sel = AppState.selectedShapes || [];
    if (sel.length <= 1 || !AppState.konvaLayer) {
      multiselect_logExit("updateGroupBoundingBox (none)");
      return;
    }

    // Compute group bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    sel.forEach(shape => {
      let rect = null;
      if (shape._type === "rect") {
        rect = {
          x: shape.x(),
          y: shape.y(),
          width: shape.width(),
          height: shape.height()
        };
      } else if (shape._type === "circle") {
        rect = {
          x: shape.x() - shape.radius(),
          y: shape.y() - shape.radius(),
          width: shape.radius() * 2,
          height: shape.radius() * 2
        };
      } else if (shape._type === "point") {
        rect = {
          x: shape.x() - 12,
          y: shape.y() - 12,
          width: 24,
          height: 24
        };
      }
      if (rect) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
      }
    });

    groupBoundingBox = new Konva.Rect({
      x: minX - 8,
      y: minY - 8,
      width: (maxX - minX) + 16,
      height: (maxY - minY) + 16,
      stroke: "#fa0",
      strokeWidth: 2.5,
      dash: [7, 5],
      listening: false,
      cornerRadius: 11
    });

    AppState.konvaLayer.add(groupBoundingBox);
    groupBoundingBox.moveToTop();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    multiselect_logExit("updateGroupBoundingBox");
  }

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

  // --- Locked feedback highlight (for group drag attempts) ---
  function showLockedHighlightForShapes(shapesArr) {
    multiselect_logEnter("showLockedHighlightForShapes", {shapesArr});
    // For simplicity, just flash the highlight overlays red briefly
    updateSelectionHighlights();
    highlightOverlays.forEach(h => h.stroke("#e53935"));
    const AppState = getAppState();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    if (lockedHighlightTimeout) clearTimeout(lockedHighlightTimeout);
    lockedHighlightTimeout = setTimeout(() => {
      updateSelectionHighlights();
      if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    }, 900);
    multiselect_logExit("showLockedHighlightForShapes");
  }

  // --- Multi-drag handlers (attached by konva.js on dragstart) ---
  function onMultiDragMove(evt) {
    multiselect_logEnter("onMultiDragMove", {evt});
    const AppState = getAppState();
    if (!AppState.multiDrag || !AppState.multiDrag.moving || !AppState.konvaStage) {
      multiselect_logExit("onMultiDragMove (not moving)");
      return;
    }
    const pos = AppState.konvaStage.getPointerPosition();
    const dx = pos.x - AppState.multiDrag.dragOrigin.x;
    const dy = pos.y - AppState.multiDrag.dragOrigin.y;
    AppState.selectedShapes.forEach((shape, idx) => {
      const orig = AppState.multiDrag.origPositions[idx];
      shape.x(orig.x + dx);
      shape.y(orig.y + dy);
    });
    updateGroupBoundingBox();
    updateSelectionHighlights();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    multiselect_logExit("onMultiDragMove");
  }

  function onMultiDragEnd(evt) {
    multiselect_logEnter("onMultiDragEnd", {evt});
    const AppState = getAppState();
    AppState.multiDrag = { moving: false, dragOrigin: null, origPositions: null };
    if (AppState.konvaStage) {
      AppState.konvaStage.off('mousemove.multidrag touchmove.multidrag');
      AppState.konvaStage.off('mouseup.multidrag touchend.multidrag');
    }
    clearGroupBoundingBox();
    updateSelectionHighlights();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    multiselect_logExit("onMultiDragEnd");
  }

  // Attach exported API to AppState
  window._sceneDesigner._multiSelect = {
    setSelectedShapes,
    selectAllShapes,
    updateSelectionHighlights,
    updateGroupBoundingBox,
    clearGroupBoundingBox,
    showLockedHighlightForShapes,
    onMultiDragMove,
    onMultiDragEnd
  };
})();
