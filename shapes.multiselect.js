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
