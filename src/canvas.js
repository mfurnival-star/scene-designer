/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas/Konva Panel
 * - Handles all canvas, image, and shape rendering.
 * - Exports buildCanvasPanel() for Golden Layout.
 * - All state flows through AppState (from state.js).
 * - No globals except those attached to AppState.
 * -----------------------------------------------------------
 */

import { AppState, setShapes, addShape, removeShape, setImage } from './state.js';
import { log } from './log.js';

let konvaInitialized = false;

export function buildCanvasPanel(rootElement, container) {
  try {
    log("INFO", "[canvas] buildCanvasPanel called", { rootElement, container });

    // Clear and set up root element
    rootElement.innerHTML = `<div id="canvas-panel-container" style="width:100%;height:100%;position:relative;">
      <div id="canvas-toolbar" style="padding:4px;background:#f7f7fa;">
        <input type="file" id="canvas-image-upload" accept="image/*" style="display:inline-block;">
        <span style="margin-left:8px;">Scene Name:</span>
        <input id="scene-name-input" style="width:120px;" placeholder="Scene name">
        <span style="margin-left:8px;">Logic:</span>
        <select id="scene-logic-select">
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
      </div>
      <div id="konva-stage-div" style="width:100%;height:calc(100% - 38px);background:#eee;"></div>
    </div>`;

    // Set up toolbar and event handlers
    const imgUpload = rootElement.querySelector('#canvas-image-upload');
    const sceneNameInput = rootElement.querySelector('#scene-name-input');
    const sceneLogicSelect = rootElement.querySelector('#scene-logic-select');
    const stageDiv = rootElement.querySelector('#konva-stage-div');

    // Restore state to inputs
    sceneNameInput.value = AppState.sceneName || '';
    sceneLogicSelect.value = AppState.sceneLogic || 'AND';

    sceneNameInput.addEventListener('input', e => {
      AppState.sceneName = sceneNameInput.value;
      log("INFO", "[canvas] Scene name changed", AppState.sceneName);
    });
    sceneLogicSelect.addEventListener('change', e => {
      AppState.sceneLogic = sceneLogicSelect.value;
      log("INFO", "[canvas] Scene logic changed", AppState.sceneLogic);
    });

    imgUpload.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        setImage(ev.target.result);
        setBackgroundImage(ev.target.result);
      };
      reader.readAsDataURL(file);
    });

    // Initialize Konva if not already
    if (konvaInitialized && AppState.konvaStage && AppState.konvaLayer) {
      // Reparent stage to this new div
      stageDiv.appendChild(AppState.konvaDiv);
      AppState.konvaStage.container(stageDiv);
      AppState.konvaStage.draw();
      log("DEBUG", "[canvas] Reparented Konva stage");
      return;
    }

    // Set up Konva
    // eslint-disable-next-line no-undef
    const stage = new window.Konva.Stage({
      container: stageDiv,
      width: 640,
      height: 400
    });
    // eslint-disable-next-line no-undef
    const layer = new window.Konva.Layer();
    stage.add(layer);

    // Save to AppState
    AppState.konvaStage = stage;
    AppState.konvaLayer = layer;
    AppState.konvaDiv = stageDiv;
    konvaInitialized = true;

    // Image support
    function setBackgroundImage(imgSrc) {
      if (!imgSrc) return;
      const imageObj = new window.Image();
      imageObj.onload = function() {
        // Remove previous Konva image if any
        if (AppState.konvaBgImage) {
          AppState.konvaBgImage.destroy();
        }
        // eslint-disable-next-line no-undef
        const bgKonvaImage = new window.Konva.Image({
          image: imageObj,
          x: 0,
          y: 0,
          width: stage.width(),
          height: stage.height(),
          listening: false
        });
        layer.add(bgKonvaImage);
        bgKonvaImage.moveToBottom();
        AppState.konvaBgImage = bgKonvaImage;
        layer.draw();
        log("INFO", "[canvas] Background image loaded");
      };
      imageObj.onerror = function() {
        log("ERROR", "[canvas] Failed to load image", imgSrc);
        window.alert("Failed to load image: " + imgSrc);
      };
      imageObj.src = imgSrc;
    }
    // If AppState has image
    if (AppState.imageURL) setBackgroundImage(AppState.imageURL);

    // Shape creation: Point, Rect, Circle
    function makeShape(type) {
      let shape;
      const stageW = stage.width(), stageH = stage.height();
      if (type === "point") {
        // eslint-disable-next-line no-undef
        shape = new window.Konva.Circle({
          x: stageW / 2, y: stageH / 2, radius: 8,
          stroke: "#2176ff", strokeWidth: 2,
          fill: "#fff", draggable: true
        });
      } else if (type === "rect") {
        // eslint-disable-next-line no-undef
        shape = new window.Konva.Rect({
          x: stageW / 2 - 40, y: stageH / 2 - 24,
          width: 80, height: 48,
          stroke: "#2176ff", strokeWidth: 2,
          fill: "#fff", draggable: true
        });
      } else if (type === "circle") {
        // eslint-disable-next-line no-undef
        shape = new window.Konva.Circle({
          x: stageW / 2, y: stageH / 2, radius: 28,
          stroke: "#2176ff", strokeWidth: 2,
          fill: "#fff", draggable: true
        });
      }
      shape._type = type;
      shape._label = type.charAt(0).toUpperCase() + type.slice(1);
      shape.locked = false;
      attachShapeEvents(shape);
      return shape;
    }

    // Attach selection logic (very basic for now)
    function attachShapeEvents(shape) {
      shape.on('mousedown', e => {
        if (AppState.selectedShape === shape) return;
        AppState.selectedShape = shape;
        AppState.selectedShapes = [shape];
        log("DEBUG", "[canvas] Shape selected", { id: shape._id, type: shape._type });
      });
      // Drag logic: simple bounds clamp
      shape.on('dragmove', () => {
        const s = shape;
        const x = Math.max(0, Math.min(stage.width(), s.x()));
        const y = Math.max(0, Math.min(stage.height(), s.y()));
        s.x(x);
        s.y(y);
        layer.batchDraw();
      });
    }

    // Add shape toolbar (quick for now)
    const shapeToolbar = document.createElement('div');
    shapeToolbar.style = "padding:4px;background:#e9e9fa;border-bottom:1px solid #ccc;";
    shapeToolbar.innerHTML = `
      <button id="add-point-btn">Add Point</button>
      <button id="add-rect-btn">Add Rectangle</button>
      <button id="add-circle-btn">Add Circle</button>
      <button id="delete-shape-btn" style="margin-left:16px;">Delete Selected</button>
    `;
    rootElement.querySelector('#canvas-panel-container').insertBefore(shapeToolbar, stageDiv);

    shapeToolbar.querySelector('#add-point-btn').onclick = () => {
      const shape = makeShape("point");
      layer.add(shape);
      AppState.shapes.push(shape);
      layer.draw();
    };
    shapeToolbar.querySelector('#add-rect-btn').onclick = () => {
      const shape = makeShape("rect");
      layer.add(shape);
      AppState.shapes.push(shape);
      layer.draw();
    };
    shapeToolbar.querySelector('#add-circle-btn').onclick = () => {
      const shape = makeShape("circle");
      layer.add(shape);
      AppState.shapes.push(shape);
      layer.draw();
    };
    shapeToolbar.querySelector('#delete-shape-btn').onclick = () => {
      if (!AppState.selectedShape) return;
      AppState.selectedShape.destroy();
      AppState.shapes = AppState.shapes.filter(s => s !== AppState.selectedShape);
      AppState.selectedShape = null;
      AppState.selectedShapes = [];
      layer.draw();
    };

    // Select shape on click (basic version)
    // (Advanced selection logic will be re-added in selection.js)

    // Responsive resize
    function resizeCanvas() {
      const w = stageDiv.clientWidth, h = stageDiv.clientHeight;
      stage.width(w);
      stage.height(h);
      if (AppState.konvaBgImage) {
        AppState.konvaBgImage.width(w);
        AppState.konvaBgImage.height(h);
        AppState.konvaBgImage.x(0);
        AppState.konvaBgImage.y(0);
      }
      layer.draw();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    log("INFO", "[canvas] Canvas panel fully initialized");
  } catch (e) {
    log("ERROR", "[canvas] buildCanvasPanel ERROR", e);
    if (window.debugLog) window.debugLog("buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
}
