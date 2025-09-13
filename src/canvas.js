/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Konva Panel
 * - Handles all canvas, image, and shape rendering, selection, multi-selection, and editing.
 * - Exports buildCanvasPanel() for Golden Layout.
 * - All state flows through AppState (from state.js).
 * - No globals except those attached to AppState.
 * - Implements: image upload (file or server), add/del/dup/align/lock shapes, lock disables all edits,
 *   group selection & bounding/clamp, aspect-ratio for circles, toolbar, select all, multi-drag clamp, and highlights.
 * - Strictly ES modules.
 * -----------------------------------------------------------
 */

import Konva from 'konva';
import { AppState, setShapes, addShape, removeShape, setImage, setSelectedShapes } from './state.js';
import { log } from './log.js';

// --- UI Controls/Toolbar state ---
let konvaInitialized = false;
let bgKonvaImage = null;
let multiDrag = { moving: false, dragOrigin: null, origPositions: null };
let groupBoundingBox = null;

function getDefaultAttrs(type) {
  // Could load from settings.js in future
  if (type === "rect") return { width: 80, height: 48, stroke: "#2176ff", fill: "#fff" };
  if (type === "circle") return { radius: 28, stroke: "#2176ff", fill: "#fff" };
  if (type === "point") return { radius: 8, stroke: "#2176ff", fill: "#fff" };
  return {};
}

export function buildCanvasPanel(rootElement, container) {
  try {
    log("INFO", "[canvas] buildCanvasPanel called", { rootElement, container });

    // UI SKELETON: Toolbar row
    rootElement.innerHTML = `
      <div id="canvas-panel-container" style="width:100%;height:100%;position:relative;">
        <div id="canvas-toolbar-main" style="display:flex;flex-wrap:wrap;align-items:center;padding:6px 8px 4px 8px;background:#f7f7fa;border-bottom:1px solid #bbb;">
          <input type="file" id="canvas-image-upload" accept="image/*" style="display:inline-block;">
          <select id="canvas-server-image-select" style="margin-left:6px;">
            <option value="">[Server image]</option>
            <option value="sample1.png">sample1.png</option>
            <option value="sample2.png">sample2.png</option>
          </select>
          <span style="margin-left:12px;">Shape:</span>
          <select id="shape-type-select" style="margin-left:4px;">
            <option value="point">Point</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <button id="add-shape-btn" style="margin-left:4px;">Add</button>
          <button id="delete-shape-btn" style="margin-left:12px;">Delete</button>
          <button id="duplicate-shape-btn" style="margin-left:4px;">Duplicate</button>
          <button id="align-left-btn" style="margin-left:12px;">Align Left</button>
          <button id="align-center-btn">Align Center</button>
          <button id="align-right-btn">Align Right</button>
          <button id="align-top-btn" style="margin-left:4px;">Align Top</button>
          <button id="align-middle-btn">Align Middle</button>
          <button id="align-bottom-btn">Align Bottom</button>
          <button id="select-all-btn" style="margin-left:12px;">Select All</button>
          <button id="lock-btn" style="margin-left:14px;">Lock</button>
          <button id="unlock-btn" style="margin-left:4px;">Unlock</button>
        </div>
        <div id="konva-stage-div" style="width:100%;height:calc(100% - 44px);background:#eee;"></div>
      </div>
    `;
    // Controls
    const imgUpload = rootElement.querySelector('#canvas-image-upload');
    const serverImgSel = rootElement.querySelector('#canvas-server-image-select');
    const shapeTypeSel = rootElement.querySelector('#shape-type-select');
    const addShapeBtn = rootElement.querySelector('#add-shape-btn');
    const delShapeBtn = rootElement.querySelector('#delete-shape-btn');
    const dupShapeBtn = rootElement.querySelector('#duplicate-shape-btn');
    const alignBtns = {
      left: rootElement.querySelector('#align-left-btn'),
      center: rootElement.querySelector('#align-center-btn'),
      right: rootElement.querySelector('#align-right-btn'),
      top: rootElement.querySelector('#align-top-btn'),
      middle: rootElement.querySelector('#align-middle-btn'),
      bottom: rootElement.querySelector('#align-bottom-btn')
    };
    const selectAllBtn = rootElement.querySelector('#select-all-btn');
    const lockBtn = rootElement.querySelector('#lock-btn');
    const unlockBtn = rootElement.querySelector('#unlock-btn');
    const stageDiv = rootElement.querySelector('#konva-stage-div');

    // --- Scene image logic ---
    function setBackgroundImage(imgSrc) {
      if (bgKonvaImage) {
        bgKonvaImage.destroy();
        bgKonvaImage = null;
        AppState.konvaLayer?.draw();
      }
      if (!imgSrc) return;
      const imageObj = new window.Image();
      imageObj.onload = function () {
        bgKonvaImage = new Konva.Image({
          image: imageObj,
          x: 0,
          y: 0,
          width: AppState.konvaStage.width(),
          height: AppState.konvaStage.height(),
          listening: false
        });
        AppState.konvaLayer.add(bgKonvaImage);
        bgKonvaImage.moveToBottom();
        AppState.konvaLayer.draw();
        AppState.imageURL = imgSrc;
      };
      imageObj.src = imgSrc;
    }
    imgUpload.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        setImage(ev.target.result);
        setBackgroundImage(ev.target.result);
      };
      reader.readAsDataURL(file);
      serverImgSel.value = "";
    });
    serverImgSel.addEventListener('change', e => {
      const filename = e.target.value;
      if (!filename) return;
      setBackgroundImage('./images/' + filename);
      setImage('./images/' + filename);
      imgUpload.value = "";
    });

    // --- Konva setup ---
    if (konvaInitialized && AppState.konvaStage && AppState.konvaLayer) {
      stageDiv.appendChild(AppState.konvaDiv);
      AppState.konvaStage.container(stageDiv);
      AppState.konvaStage.draw();
    } else {
      const stage = new Konva.Stage({
        container: stageDiv,
        width: 800,
        height: 500
      });
      const layer = new Konva.Layer();
      stage.add(layer);
      AppState.konvaStage = stage;
      AppState.konvaLayer = layer;
      AppState.konvaDiv = stageDiv;
      konvaInitialized = true;
    }
    const stage = AppState.konvaStage;
    const layer = AppState.konvaLayer;

    // --- Shape creation: Point, Rect, Circle ---
    function createShape(type) {
      let shape, attrs = getDefaultAttrs(type);
      const stageW = stage.width(), stageH = stage.height();
      if (type === "point") {
        // For simplicity, still use Konva.Circle for points but could be Group for crosshair
        shape = new Konva.Circle({
          x: stageW / 2, y: stageH / 2, radius: attrs.radius,
          stroke: attrs.stroke, strokeWidth: 2,
          fill: attrs.fill, draggable: true
        });
      } else if (type === "rect") {
        shape = new Konva.Rect({
          x: stageW / 2 - attrs.width / 2, y: stageH / 2 - attrs.height / 2,
          width: attrs.width, height: attrs.height,
          stroke: attrs.stroke, strokeWidth: 2,
          fill: attrs.fill, draggable: true
        });
      } else if (type === "circle") {
        shape = new Konva.Circle({
          x: stageW / 2, y: stageH / 2, radius: attrs.radius,
          stroke: attrs.stroke, strokeWidth: 2,
          fill: attrs.fill, draggable: true
        });
      }
      shape._type = type;
      shape._label = type.charAt(0).toUpperCase() + type.slice(1) + (AppState.shapes.filter(s => s._type === type).length + 1);
      shape.locked = false;
      attachShapeEvents(shape);
      return shape;
    }

    // --- Attach shape events (select, drag, lock, group logic) ---
    function attachShapeEvents(shape) {
      shape.off('mousedown.shape dragmove.shape transformstart.shape transformend.shape');
      shape.on('mousedown.shape', (e) => {
        if (shape.locked) return;
        if (!AppState.selectedShapes.includes(shape)) {
          setSelectedShapes([shape]);
        }
        updateSelectionHighlight();
      });
      shape.on('dragmove.shape', () => {
        if (shape.locked) {
          shape.stopDrag();
          return;
        }
        if (AppState.selectedShapes.length === 1) {
          clampShapeToStage(shape);
        }
        updateSelectionHighlight();
      });
      // For transform: lock aspect for circle
      shape.on('transformstart.shape', () => {
        if (shape._type === "circle") {
          shape.setAttr("scaleY", shape.scaleX());
        }
      });
      shape.on('transformend.shape', () => {
        if (shape._type === "circle") {
          const scale = shape.scaleX();
          shape.radius(shape.radius() * scale);
          shape.scale({ x: 1, y: 1 });
        } else if (shape._type === "rect") {
          const scaleX = shape.scaleX(), scaleY = shape.scaleY();
          shape.width(shape.width() * scaleX);
          shape.height(shape.height() * scaleY);
          shape.scale({ x: 1, y: 1 });
        }
        updateSelectionHighlight();
        layer.batchDraw();
      });
    }

    // --- Clamp logic for shape and group drag ---
    function clampShapeToStage(shape) {
      let minX, minY, maxX, maxY;
      if (shape._type === "rect") {
        minX = shape.x(); minY = shape.y();
        maxX = minX + shape.width(); maxY = minY + shape.height();
      } else if (shape._type === "circle" || shape._type === "point") {
        minX = shape.x() - shape.radius(); minY = shape.y() - shape.radius();
        maxX = shape.x() + shape.radius(); maxY = shape.y() + shape.radius();
      }
      let dx = 0, dy = 0;
      if (minX < 0) dx = -minX;
      if (maxX > stage.width()) dx = stage.width() - maxX;
      if (minY < 0) dy = -minY;
      if (maxY > stage.height()) dy = stage.height() - maxY;
      shape.x(shape.x() + dx);
      shape.y(shape.y() + dy);
    }

    function clampGroupDragDelta(dx, dy, origPositions) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      origPositions.forEach(obj => {
        const shape = obj.shape;
        let bx, by, bx2, by2;
        if (shape._type === "rect") {
          bx = obj.x + dx; by = obj.y + dy;
          bx2 = bx + shape.width(); by2 = by + shape.height();
        } else {
          bx = obj.x + dx - shape.radius(); by = obj.y + dy - shape.radius();
          bx2 = obj.x + dx + shape.radius(); by2 = obj.y + dy + shape.radius();
        }
        minX = Math.min(minX, bx); minY = Math.min(minY, by);
        maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
      });
      let adjDx = dx, adjDy = dy;
      if (minX < 0) adjDx += -minX;
      if (maxX > stage.width()) adjDx += stage.width() - maxX;
      if (minY < 0) adjDy += -minY;
      if (maxY > stage.height()) adjDy += stage.height() - maxY;
      return [adjDx, adjDy];
    }

    // --- Selection highlight logic (single: transformer, multi: bounding box, locked: red) ---
    function updateSelectionHighlight() {
      // Remove any old bounding box
      if (groupBoundingBox) { groupBoundingBox.destroy(); groupBoundingBox = null; }
      // Single selection: transformer only if not locked
      if (AppState.selectedShapes.length === 1 && !AppState.selectedShapes[0].locked) {
        if (AppState.transformer) AppState.transformer.destroy();
        const tr = new Konva.Transformer({
          nodes: [AppState.selectedShapes[0]],
          enabledAnchors: AppState.selectedShapes[0]._type === "point" ? [] :
            AppState.selectedShapes[0]._type === "circle"
              ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
              : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'],
          rotateEnabled: AppState.selectedShapes[0]._type !== "point"
        });
        AppState.transformer = tr;
        layer.add(tr);
        layer.draw();
      } else if (AppState.selectedShapes.length > 1) {
        // Remove transformer if present
        if (AppState.transformer) { AppState.transformer.destroy(); AppState.transformer = null; }
        // Draw group bounding box (red if any locked, blue otherwise)
        const sel = AppState.selectedShapes;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of sel) {
          let bx, by, bx2, by2;
          if (s._type === "rect") {
            bx = s.x(); by = s.y(); bx2 = bx + s.width(); by2 = by + s.height();
          } else {
            bx = s.x() - s.radius(); by = s.y() - s.radius();
            bx2 = s.x() + s.radius(); by2 = s.y() + s.radius();
          }
          minX = Math.min(minX, bx); minY = Math.min(minY, by);
          maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
        }
        groupBoundingBox = new Konva.Rect({
          x: minX - 4, y: minY - 4,
          width: maxX - minX + 8, height: maxY - minY + 8,
          stroke: sel.some(s => s.locked) ? "#e53935" : "#2176ff",
          strokeWidth: 3, dash: [8, 5], listening: false
        });
        layer.add(groupBoundingBox);
        layer.draw();
      } else {
        if (AppState.transformer) { AppState.transformer.destroy(); AppState.transformer = null; }
        layer.draw();
      }
    }

    // --- Toolbar handlers ---
    addShapeBtn.onclick = () => {
      const type = shapeTypeSel.value;
      const shape = createShape(type);
      layer.add(shape);
      AppState.shapes.push(shape);
      setSelectedShapes([shape]);
      updateSelectionHighlight();
      layer.draw();
    };
    delShapeBtn.onclick = () => {
      if (AppState.selectedShapes.length === 0) return;
      for (const s of AppState.selectedShapes) {
        if (!s.locked) {
          s.destroy();
          AppState.shapes = AppState.shapes.filter(sh => sh !== s);
        }
      }
      setSelectedShapes([]);
      updateSelectionHighlight();
      layer.draw();
    };
    dupShapeBtn.onclick = () => {
      if (AppState.selectedShapes.length === 0) return;
      let newShapes = [];
      AppState.selectedShapes.forEach(orig => {
        let clone;
        const type = orig._type;
        const attrs = orig.getAttrs();
        if (type === 'rect') {
          clone = new Konva.Rect({
            x: attrs.x + 20, y: attrs.y + 20,
            width: attrs.width, height: attrs.height,
            stroke: attrs.stroke, strokeWidth: 2,
            fill: attrs.fill, draggable: !orig.locked, rotation: orig.rotation()
          });
        } else if (type === 'circle' || type === 'point') {
          clone = new Konva.Circle({
            x: attrs.x + 20, y: attrs.y + 20, radius: attrs.radius,
            stroke: attrs.stroke, strokeWidth: 2,
            fill: attrs.fill, draggable: !orig.locked, rotation: orig.rotation ? orig.rotation() : 0
          });
        }
        if (!clone) return;
        clone._type = type;
        clone._label = orig._label + "-copy";
        clone.locked = orig.locked;
        attachShapeEvents(clone);
        newShapes.push(clone);
        layer.add(clone);
      });
      AppState.shapes = AppState.shapes.concat(newShapes);
      setSelectedShapes(newShapes);
      updateSelectionHighlight();
      layer.draw();
    };

    selectAllBtn.onclick = () => {
      setSelectedShapes(AppState.shapes.slice());
      updateSelectionHighlight();
      layer.draw();
    };

    // Group drag/align
    function alignSelected(axis) {
      const sel = AppState.selectedShapes.filter(s => !s.locked);
      if (sel.length < 2) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      sel.forEach(s => {
        let bx, by, bx2, by2;
        if (s._type === "rect") {
          bx = s.x(); by = s.y(); bx2 = bx + s.width(); by2 = by + s.height();
        } else {
          bx = s.x() - s.radius(); by = s.y() - s.radius();
          bx2 = s.x() + s.radius(); by2 = s.y() + s.radius();
        }
        minX = Math.min(minX, bx); minY = Math.min(minY, by);
        maxX = Math.max(maxX, bx2); maxY = Math.max(maxY, by2);
      });
      function setX(shape, x) {
        if (shape._type === "rect") shape.x(x);
        else shape.x(x + shape.radius());
      }
      function setY(shape, y) {
        if (shape._type === "rect") shape.y(y);
        else shape.y(y + shape.radius());
      }
      function setCenterX(shape, cx) {
        let bx, bx2; if (shape._type === "rect") { bx = shape.x(); bx2 = bx + shape.width(); }
        else { bx = shape.x() - shape.radius(); bx2 = shape.x() + shape.radius(); }
        const dx = cx - ((bx + bx2) / 2);
        shape.x(shape.x() + dx);
      }
      function setCenterY(shape, cy) {
        let by, by2; if (shape._type === "rect") { by = shape.y(); by2 = by + shape.height(); }
        else { by = shape.y() - shape.radius(); by2 = shape.y() + shape.radius(); }
        const dy = cy - ((by + by2) / 2);
        shape.y(shape.y() + dy);
      }
      if (axis === "left") sel.forEach(s => setX(s, minX));
      else if (axis === "right") sel.forEach(s => setX(s, maxX - (s._type === "rect" ? s.width() : s.radius() * 2)));
      else if (axis === "center") { const cx = (minX + maxX) / 2; sel.forEach(s => setCenterX(s, cx)); }
      else if (axis === "top") sel.forEach(s => setY(s, minY));
      else if (axis === "bottom") sel.forEach(s => setY(s, maxY - (s._type === "rect" ? s.height() : s.radius() * 2)));
      else if (axis === "middle") { const cy = (minY + maxY) / 2; sel.forEach(s => setCenterY(s, cy)); }
      updateSelectionHighlight();
      layer.draw();
    }
    alignBtns.left.onclick = () => alignSelected("left");
    alignBtns.center.onclick = () => alignSelected("center");
    alignBtns.right.onclick = () => alignSelected("right");
    alignBtns.top.onclick = () => alignSelected("top");
    alignBtns.middle.onclick = () => alignSelected("middle");
    alignBtns.bottom.onclick = () => alignSelected("bottom");

    lockBtn.onclick = () => {
      for (const s of AppState.selectedShapes) s.locked = true;
      updateSelectionHighlight();
      layer.draw();
    };
    unlockBtn.onclick = () => {
      for (const s of AppState.selectedShapes) s.locked = false;
      updateSelectionHighlight();
      layer.draw();
    };

    // Multi-drag logic: group drag only if no shape is locked
    stage.off('dragstart.group dragmove.group dragend.group');
    stage.on('dragstart.group', (evt) => {
      const target = evt.target;
      if (!AppState.selectedShapes.includes(target)) return;
      if (AppState.selectedShapes.length > 1) {
        if (AppState.selectedShapes.some(s => s.locked)) {
          updateSelectionHighlight();
          target.stopDrag();
        } else {
          multiDrag.moving = true;
          multiDrag.dragOrigin = stage.getPointerPosition();
          multiDrag.origPositions = AppState.selectedShapes.map(s => ({ shape: s, x: s.x(), y: s.y() }));
          stage.on('mousemove.groupdrag touchmove.groupdrag', onGroupDragMove);
          stage.on('mouseup.groupdrag touchend.groupdrag', onGroupDragEnd);
        }
      }
    });
    function onGroupDragMove(evt) {
      if (!multiDrag.moving || !multiDrag.dragOrigin) return;
      const pos = stage.getPointerPosition();
      let dx = pos.x - multiDrag.dragOrigin.x;
      let dy = pos.y - multiDrag.dragOrigin.y;
      let [clampedDx, clampedDy] = clampGroupDragDelta(dx, dy, multiDrag.origPositions);
      multiDrag.origPositions.forEach(obj => {
        obj.shape.x(obj.x + clampedDx);
        obj.shape.y(obj.y + clampedDy);
      });
      updateSelectionHighlight();
      layer.batchDraw();
    }
    function onGroupDragEnd(evt) {
      multiDrag.moving = false;
      multiDrag.dragOrigin = null;
      multiDrag.origPositions = null;
      stage.off('mousemove.groupdrag touchmove.groupdrag');
      stage.off('mouseup.groupdrag touchend.groupdrag');
      updateSelectionHighlight();
      layer.batchDraw();
    }

    // --- Responsive resize ---
    function resizeCanvas() {
      const w = stageDiv.clientWidth, h = stageDiv.clientHeight;
      stage.width(w);
      stage.height(h);
      if (bgKonvaImage) {
        bgKonvaImage.width(w);
        bgKonvaImage.height(h);
        bgKonvaImage.x(0);
        bgKonvaImage.y(0);
      }
      layer.draw();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- Init state for shapes/selection on load ---
    setShapes(AppState.shapes || []);
    setSelectedShapes([]);
    updateSelectionHighlight();

    log("INFO", "[canvas] Canvas panel fully initialized");
  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    if (window.debugLog) window.debugLog("buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
}
