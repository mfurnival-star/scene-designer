// COPILOT_PART_multiselect: 2025-09-12T10:45:00Z
/*********************************************************
 * [multiselect] Multi-Select, Group Drag, Highlights, Lock UI
 * ------------------------------------------------------
 * Handles all multi-selection, group drag, bounding box, and lock UI logic.
 * - Multi-select: Select All, marquee/box selection, multi-selection highlights.
 * - Multi-select drag, clamped group bounding box (with rotation/scale).
 * - Orange debug bounding box during group drag.
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
  let debugMultiDragBox = null;
  let multiDrag = { moving: false, dragOrigin: null, origPositions: null };
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
  function updateDebugMultiDragBox() {
    multiselect_logEnter("updateDebugMultiDragBox");
    const AppState = getAppState();
    if (debugMultiDragBox) debugMultiDragBox.destroy();
    if (!AppState.selectedShapes || AppState.selectedShapes.length < 2 || !AppState.konvaLayer) {
      multiselect_logExit("updateDebugMultiDragBox (not multi)");
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
    multiselect_logExit("updateDebugMultiDragBox");
  }
  function clearDebugMultiDragBox() {
    multiselect_logEnter("clearDebugMultiDragBox");
    const AppState = getAppState();
    if (debugMultiDragBox) {
      debugMultiDragBox.destroy();
      debugMultiDragBox = null;
      if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    }
    multiselect_logExit("clearDebugMultiDragBox");
  }

  // --- Multi-Drag Handlers ---
  function onMultiDragMove(evt) {
    multiselect_logEnter("onMultiDragMove", evt);
    const AppState = getAppState();
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
    updateDebugMultiDragBox();
    if (AppState.konvaLayer) AppState.konvaLayer.batchDraw();
    updateSelectionHighlights();
    multiselect_logExit("onMultiDragMove");
  }
  function onMultiDragEnd(evt) {
    multiselect_logEnter("onMultiDragEnd", evt);
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
    multiselect_logExit("onMultiDragEnd");
  }

  // --- Lock Checkbox UI Sync ---
  function updateLockCheckboxUI() {
    multiselect_logEnter("updateLockCheckboxUI");
    const AppState = getAppState();
    const lockCheckbox = document.getElementById("lockCheckbox");
    if (!lockCheckbox) {
      multiselect_log("WARN", "Lock checkbox not found in DOM.");
      multiselect_logExit("updateLockCheckboxUI (no checkbox)");
      return;
    }
    const shapes = AppState.selectedShapes || [];
    if (shapes.length === 0) {
      lockCheckbox.indeterminate = false;
      lockCheckbox.checked = false;
      multiselect_log("DEBUG", "updateLockCheckboxUI: none selected");
      multiselect_logExit("updateLockCheckboxUI (none selected)");
      return;
    }
    const allLocked = shapes.every(s => s.locked);
    const noneLocked = shapes.every(s => !s.locked);
    lockCheckbox.indeterminate = !(allLocked || noneLocked);
    lockCheckbox.checked = allLocked;
    multiselect_log("TRACE", "updateLockCheckboxUI: updated", {allLocked, noneLocked});
    multiselect_logExit("updateLockCheckboxUI");
  }
  window._sceneDesigner.updateLockCheckboxUI = updateLockCheckboxUI;

  // --- Attach/override selection logic to sync lock UI ---
  function attachSelectionOverrides() {
    multiselect_logEnter("attachSelectionOverrides");
    const AppState = getAppState();
    if (!AppState._multiSelectOverridesApplied) {
      const origSelectShape = AppState.selectShape;
      AppState.selectShape = function(shape) {
        multiselect_log("TRACE", "selectShape override called", {shape});
        setSelectedShapes(shape ? [shape] : []);
        if (typeof origSelectShape === "function") origSelectShape(shape);
      };
      const origDeselectShape = AppState.deselectShape;
      AppState.deselectShape = function() {
        multiselect_log("TRACE", "deselectShape override called");
        setSelectedShapes([]);
        if (typeof origDeselectShape === "function") origDeselectShape();
      };
      AppState._multiSelectOverridesApplied = true;
      multiselect_log("DEBUG", "Selection overrides attached.");
    }
    multiselect_logExit("attachSelectionOverrides");
  }

  // --- Select All logic: uses setSelectedShapes() SSOT setter ---
  function selectAllShapes() {
    multiselect_logEnter("selectAllShapes");
    const AppState = getAppState();
    if (AppState.shapes && AppState.shapes.length > 0) {
      multiselect_log("INFO", "Selecting all shapes.", {shape_ids: AppState.shapes.map(s => s._id)});
      setSelectedShapes(AppState.shapes.slice());
    }
    multiselect_logExit("selectAllShapes");
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
          multiselect_log("INFO", "Lock checkbox changed", {newLocked, selectedShapes: AppState.selectedShapes.map(s => s._id)});
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
    multiselect_logEnter("exportMultiSelectAPI");
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
    multiselect_log("INFO", "Exported _multiSelect API to AppState.");
    multiselect_logExit("exportMultiSelectAPI");
  }

  // --- Deferred Initialization ---
  function initMultiselect() {
    multiselect_logEnter("initMultiselect");
    attachSelectionOverrides();
    attachSelectAllHook();
    attachLockCheckboxHook();
    exportMultiSelectAPI();
    multiselect_logExit("initMultiselect");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMultiselect);
  } else {
    setTimeout(initMultiselect, 0);
  }
})();
