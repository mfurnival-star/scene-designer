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

  // --- Centralized Selection Setter: SINGLE SOURCE OF TRUTH for all selection logic ---
  function setSelectedShapes(shapesToSelect) {
    const AppState = getAppState();
    
    // Normalize input: ensure it's an array
    const shapesArray = Array.isArray(shapesToSelect) ? shapesToSelect : 
                       (shapesToSelect ? [shapesToSelect] : []);
    
    // Clean up existing transformer
    if (AppState.transformer) {
      AppState.transformer.destroy();
      AppState.transformer = null;
    }
    
    // Hide selection display for current selectedShape if it's a point
    if (AppState.selectedShape && AppState.selectedShape._type === "point" && AppState.selectedShape.showSelection) {
      AppState.selectedShape.showSelection(false);
    }
    
    // Update selection state in AppState (SSOT)
    AppState.selectedShapes = shapesArray;
    AppState.selectedShape = shapesArray.length === 1 ? shapesArray[0] : null;
    
    // Handle single-shape selection with transformer (for rectangles and circles)
    if (shapesArray.length === 1) {
      const shape = shapesArray[0];
      
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
          if (AppState.konvaLayer) AppState.konvaLayer.draw();
        });
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
          if (AppState.konvaLayer) AppState.konvaLayer.draw();
        });
      } else if (shape._type === "point") {
        shape.showSelection(true);
      }
    }
    
    // Trigger all UI updates consistently
    updateLockCheckboxUI();
    updateSelectionHighlights();
    
    // Update sidebar/list if available
    if (typeof window.updateList === "function") {
      window.updateList();
    }
    
    // Update label UI if available
    if (typeof window.updateLabelUI === "function") {
      window.updateLabelUI();
    }
    
    // Redraw the canvas
    if (AppState.konvaLayer) {
      AppState.konvaLayer.draw();
    }
  }

  // --- Attach/override selection logic to sync lock UI ---
  function attachSelectionOverrides() {
    const AppState = getAppState();
    // Only override if not already wrapped
    if (!AppState._multiSelectOverridesApplied) {
      const origSelectShape = AppState.selectShape;
      AppState.selectShape = function(shape) {
        if (typeof origSelectShape === "function") origSelectShape(shape);
        updateLockCheckboxUI();
        updateSelectionHighlights();
      };
      const origDeselectShape = AppState.deselectShape;
      AppState.deselectShape = function() {
        if (typeof origDeselectShape === "function") origDeselectShape();
        updateLockCheckboxUI();
        updateSelectionHighlights();
      };
      AppState._multiSelectOverridesApplied = true;
    }
  }

  // --- Select All logic: Uses centralized setSelectedShapes for consistent UI updates ---
  function selectAllShapes() {
    const AppState = getAppState();
    if (AppState.shapes && AppState.shapes.length > 0) {
      // Use the centralized setter to ensure all UI updates correctly
      setSelectedShapes(AppState.shapes.slice());
    } else {
      // Handle empty case by deselecting all
      setSelectedShapes([]);
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
          // Use centralized UI update calls
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
      updateSelectionHighlights,
      showLockedHighlightForShapes,
      updateLockCheckboxUI,
      onMultiDragMove,
      onMultiDragEnd,
      updateDebugMultiDragBox,
      clearDebugMultiDragBox,
      selectAllShapes, // Export for external use if needed
      setSelectedShapes // Export the centralized selection setter
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
