/**
 * shapes.part2a.konva.js
 * Konva stage and layer setup for scene-designer
 * - Exports konvaStageInit and createKonvaStage
 * - Responsible for initializing the main drawing surface
 * - Integrates with shape tools/logic (see part2b)
 */

// Holds the global Konva stage and layer
let stage = null;
let layer = null;

function createKonvaStage(containerId = "container", width = 960, height = 600) {
  // Remove any previous children
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element not found: ${containerId}`);
  }
  container.innerHTML = "";

  stage = new Konva.Stage({
    container: containerId,
    width,
    height
  });

  layer = new Konva.Layer();
  stage.add(layer);

  window.stage = stage;
  window.layer = layer;
  return { stage, layer };
}

/**
 * Initializes the Konva stage and layer, sets up resizing
 * Called from CanvasPanel (GoldenLayout)
 */
function konvaStageInit(containerId = "container") {
  // Default size: fill parent
  const parent = document.getElementById(containerId);
  let width = 960, height = 600;
  if (parent) {
    width = parent.clientWidth || width;
    height = parent.clientHeight || height;
  }
  createKonvaStage(containerId, width, height);

  // Responsive resizing
  window.addEventListener("resize", () => {
    if (!stage) return;
    const parent = document.getElementById(containerId);
    if (parent) {
      stage.width(parent.clientWidth);
      stage.height(parent.clientHeight);
    }
  });
}

if (typeof window !== "undefined") {
  window.konvaStageInit = konvaStageInit;
  window.createKonvaStage = createKonvaStage;
  window.stage = stage;
  window.layer = layer;
}

