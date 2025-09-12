/**
 * canvas.js
 * -----------------------------------------------------------
 * Konva Canvas Initialization, Image Background, and Shape Factories
 * - Sets up the Konva stage and layer for annotation.
 * - Handles image loading and background rendering.
 * - Provides shape creation helpers: point, rectangle, circle.
 * - Exports all canvas and shape creation APIs.
 * - No global state; all state via AppState from state.js.
 * - Adheres to SCENE_DESIGNER_MANIFESTO.md.
 * -----------------------------------------------------------
 */

import { AppState } from './state.js';
import { log } from './log.js';

/**
 * Initialize the Konva canvas and attach to the provided container.
 * Loads the background image if URL is set.
 * @param {HTMLElement} container - The DOM node to attach the canvas to.
 */
export async function initCanvas(container) {
  log("INFO", "[canvas] Initializing Konva canvas", { container });

  // Clean up any previous stage
  if (AppState.konvaStage) {
    AppState.konvaStage.destroy();
    AppState.konvaStage = null;
    AppState.konvaLayer = null;
    AppState.imageObj = null;
  }
  if (!container) {
    log("ERROR", "[canvas] Provided container is null/undefined.");
    return;
  }
  container.innerHTML = '';

  // Create Konva stage and layer
  const width = container.offsetWidth || 800;
  const height = container.offsetHeight || 600;
  const stage = new Konva.Stage({
    container: container,
    width,
    height
  });
  const layer = new Konva.Layer();
  stage.add(layer);

  AppState.konvaStage = stage;
  AppState.konvaLayer = layer;

  // Load image if specified
  if (AppState.imageURL) {
    try {
      const img = await loadImage(AppState.imageURL);
      AppState.imageObj = img;
      const konvaImage = new Konva.Image({
        image: img,
        x: 0, y: 0,
        width: img.width,
        height: img.height,
        listening: false
      });
      layer.add(konvaImage);
      stage.width(img.width);
      stage.height(img.height);
      container.style.width = img.width + "px";
      container.style.height = img.height + "px";
      log("INFO", "[canvas] Image loaded and rendered", { imageURL: AppState.imageURL });
    } catch (e) {
      log("ERROR", "[canvas] Failed to load image", { imageURL: AppState.imageURL, error: e });
    }
  }

  // Redraw all shapes on current image
  if (Array.isArray(AppState.shapes)) {
    AppState.shapes.forEach(shape => {
      layer.add(shape);
    });
    layer.batchDraw();
  }
}

/**
 * Load an image and return an HTMLImageElement.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.crossOrigin = "Anonymous";
    img.src = src;
  });
}

/**
 * Factory: Create a reticle point shape at (x, y).
 * @param {number} x
 * @param {number} y
 * @param {string} [color]
 * @returns {Konva.Group}
 */
export function makePointShape(x, y, color = "#2176ff") {
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
  group.add(selHalo);
  group.add(halo);
  group.add(crossH);
  group.add(crossV);
  group.showSelection = function (isSelected) { selHalo.visible(isSelected); };
  group._type = "point";
  group._label = "Point";
  group.locked = false;
  group._id = "pt_" + Math.random().toString(36).slice(2, 10);
  group.on("dragstart", () => { group.showSelection(true); });
  group.on("dragend", () => { group.showSelection(false); });
  group.on("mouseenter", () => { document.body.style.cursor = 'pointer'; });
  group.on("mouseleave", () => { document.body.style.cursor = ''; });

  log("DEBUG", "[canvas] Created point shape", { id: group._id, x, y, color });
  return group;
}

/**
 * Factory: Create a rectangle shape at (x, y).
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} [stroke]
 * @param {string} [fill]
 * @returns {Konva.Rect}
 */
export function makeRectShape(x, y, width = 80, height = 48, stroke = "#2176ff", fill = "#ffffff00") {
  const rect = new Konva.Rect({
    x: x, y: y, width: width, height: height,
    stroke: stroke, strokeWidth: 1,
    fill: fill, opacity: 0.92, draggable: true, name: "rect-shape"
  });
  rect.showSelection = function () { };
  rect._type = "rect";
  rect._label = "Rectangle";
  rect.locked = false;
  rect._id = "rect_" + Math.random().toString(36).slice(2, 10);
  rect.on("mouseenter", () => { document.body.style.cursor = 'move'; });
  rect.on("mouseleave", () => { document.body.style.cursor = ''; });

  log("DEBUG", "[canvas] Created rect shape", { id: rect._id, x, y, width, height, stroke, fill });
  return rect;
}

/**
 * Factory: Create a circle shape at (x, y).
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} [stroke]
 * @param {string} [fill]
 * @returns {Konva.Circle}
 */
export function makeCircleShape(x, y, radius = 24, stroke = "#2176ff", fill = "#ffffff00") {
  const circle = new Konva.Circle({
    x: x, y: y, radius: radius,
    stroke: stroke, strokeWidth: 1,
    fill: fill, opacity: 0.92, draggable: true, name: "circle-shape"
  });
  circle.showSelection = function () { };
  circle._type = "circle";
  circle._label = "Circle";
  circle.locked = false;
  circle._id = "circ_" + Math.random().toString(36).slice(2, 10);
  circle.on("mouseenter", () => { document.body.style.cursor = 'move'; });
  circle.on("mouseleave", () => { document.body.style.cursor = ''; });

  log("DEBUG", "[canvas] Created circle shape", { id: circle._id, x, y, radius, stroke, fill });
  return circle;
}

/**
 * Add a shape to the canvas and AppState.
 * @param {Konva.Shape|Konva.Group} shape
 */
export function addShape(shape) {
  if (!shape) return;
  if (!AppState.konvaLayer) {
    log("ERROR", "[canvas] No active Konva layer.");
    return;
  }
  AppState.shapes.push(shape);
  AppState.konvaLayer.add(shape);
  AppState.konvaLayer.batchDraw();
  log("INFO", "[canvas] Shape added to layer", { id: shape._id, type: shape._type });
}

/**
 * Remove a shape from the canvas and AppState.
 * @param {Konva.Shape|Konva.Group} shape
 */
export function removeShape(shape) {
  if (!shape) return;
  if (!AppState.konvaLayer) {
    log("ERROR", "[canvas] No active Konva layer.");
    return;
  }
  const idx = AppState.shapes.indexOf(shape);
  if (idx !== -1) AppState.shapes.splice(idx, 1);
  shape.destroy();
  AppState.konvaLayer.batchDraw();
  log("INFO", "[canvas] Shape removed from layer", { id: shape._id, type: shape._type });
}
