/*******************************************************
 * shapes.part2a.konva.js
 * Part 2a of N for shapes.js modular build
 * 
 * Feature Area: Konva stage, layers, background image, and canvas resizing (A)
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Konva Stage & Layers Setup
 *************************************/
let stage = null;
let layer = null;
let highlightLayer = null;
let bgLayer = null;
let debugLayer = null;
let bgKonvaImage = null;
let bgImageObj = null;
let stageWidth = 1400;
let stageHeight = 1000;

/**
 * Sets up the main canvas panel with Konva and layers.
 * 
 * @param {Element} root - The root DOM element (or null for default)
 * @param {Function} onReady - Optional callback after canvas/layers are fully initialized
 */
function setupCanvasPanel(root, onReady) {
  // Find container element
  const el = root && root.querySelector ? root.querySelector("#canvas-panel") : document.getElementById("canvas-panel");
  if (!el) {
    log("ERROR", "No #canvas-panel found");
    return;
  }
  // Clear if exists
  el.innerHTML = "";

  // Stage and layers
  stage = new Konva.Stage({
    container: el,
    width: stageWidth,
    height: stageHeight
  });

  bgLayer = new Konva.Layer({ listening: false });
  layer = new Konva.Layer();
  highlightLayer = new Konva.Layer({ listening: false });
  debugLayer = new Konva.Layer({ listening: false });

  stage.add(bgLayer);
  stage.add(layer);
  stage.add(highlightLayer);
  stage.add(debugLayer);

  // For other modules
  window.stage = stage;
  window.layer = layer;
  window.bgLayer = bgLayer;
  window.highlightLayer = highlightLayer;
  window.debugLayer = debugLayer;

  // Callbacks for other systems (loupe, drag feedback)
  if (window.setupLoupeEvents) window.setupLoupeEvents();
  if (window.setupLockedDragFeedback) window.setupLockedDragFeedback();

  // If a callback is provided, call it after setup
  if (typeof onReady === "function") {
    onReady();
  }
}

/*************************************
 * Canvas/Image Size Management
 *************************************/
function updateCanvasToImage(imgW, imgH) {
  stageWidth = imgW;
  stageHeight = imgH;
  if (stage) stage.size({ width: stageWidth, height: stageHeight });
  // Resize all layers
  [bgLayer, layer, highlightLayer, debugLayer].forEach(l => {
    if (l) l.size({ width: stageWidth, height: stageHeight });
  });
}

/*************************************
 * Background Image Logic
 *************************************/
function setBackgroundImage(imgSrc) {
  logEnter("setBackgroundImage", { imgSrc });
  if (!bgLayer) {
    log("ERROR", "setBackgroundImage called before bgLayer is initialized");
    window.alert("Canvas not ready: please reload the page.");
    logExit("setBackgroundImage (no bgLayer)");
    return;
  }
  if (bgKonvaImage) {
    bgKonvaImage.destroy();
    bgKonvaImage = null;
    bgLayer.draw();
  }
  if (!imgSrc) {
    bgLayer.draw();
    logExit("setBackgroundImage (no imgSrc)");
    return;
  }
  const imageObj = new window.Image();
  imageObj.onload = function () {
    bgImageObj = imageObj;
    window.bgImageObj = bgImageObj;
    updateCanvasToImage(imageObj.naturalWidth, imageObj.naturalHeight);
    if (stage) stage.setSize({ width: stageWidth, height: stageHeight });
    bgKonvaImage = new Konva.Image({
      image: imageObj,
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight,
      listening: false
    });
    if (!bgLayer) {
      log("ERROR", "bgLayer missing at imageObj.onload");
      window.alert("Canvas not ready: please reload the page.");
      return;
    }
    bgLayer.add(bgKonvaImage);
    bgKonvaImage.moveToBottom();
    bgLayer.draw();
    logExit("setBackgroundImage (loaded)");
  };
  imageObj.onerror = function () {
    window.alert("Failed to load image: " + imgSrc);
    log("ERROR", "Failed to load image:", imgSrc);
  };
  imageObj.src = imgSrc;
}
window.setBackgroundImage = setBackgroundImage;

/*************************************
 * Exported for global access
 *************************************/
window.setupCanvasPanel = setupCanvasPanel;
window.updateCanvasToImage = updateCanvasToImage;

/*************************************
 * Logging Utility (minimal stub)
 *************************************/
function log(...args) {
  if (window.DEBUG) console.log("[shapes.js]", ...args);
}
function logEnter(fn, obj) {
  if (window.DEBUG) console.log("→", fn, obj || "");
}
function logExit(fn) {
  if (window.DEBUG) console.log("←", fn);
}
