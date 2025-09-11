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
