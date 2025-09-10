/**
 * shapes.part2b.konva.js
 * Konva shapes/tools/extensions for scene-designer
 * - Sets up shape tools (point, rect, circle)
 * - Handles drawing, selection, and tool logic
 * - Depends on part2a (stage/layer creation)
 */

let currentTool = "point";
let shapes = [];
let selectedShape = null;

// Tool setup: called after stage/layer is created
function setupShapeTools() {
  // Tool dropdown
  const toolSelect = document.getElementById("shapeType");
  if (toolSelect) {
    toolSelect.value = currentTool;
    toolSelect.onchange = e => {
      currentTool = e.target.value;
      handleToolChange();
    };
  }

  // Add shape button
  const addBtn = document.getElementById("newBtn");
  if (addBtn) addBtn.onclick = addShapeHandler;

  // Delete shape button
  const delBtn = document.getElementById("deleteBtn");
  if (delBtn) delBtn.onclick = deleteShapeHandler;

  // Duplicate shape button
  const dupBtn = document.getElementById("duplicateBtn");
  if (dupBtn) dupBtn.onclick = duplicateShapeHandler;

  // Init layer events for drawing
  if (window.layer) {
    window.layer.on("mousedown touchstart", onCanvasDown);
  }
}

function handleToolChange() {
  clearSelection();
  // Future: update UI for tool-specific options
}

function addShapeHandler() {
  if (!window.layer) return;
  const stage = window.stage;
  const pointer = stage.getPointerPosition() || { x: 100, y: 100 };
  let shape;
  if (currentTool === "point") {
    shape = new Konva.Circle({
      x: pointer.x,
      y: pointer.y,
      radius: window.getSetting ? window.getSetting("pointHitRadius") : 12,
      stroke: window.getSetting ? window.getSetting("defaultStrokeColor") : "#2176ff",
      fill: window.getSetting ? window.getSetting("defaultFillColor") : "#e3eeff",
      strokeWidth: 2,
      draggable: true,
      _type: "point"
    });
  } else if (currentTool === "rect") {
    shape = new Konva.Rect({
      x: pointer.x - 30,
      y: pointer.y - 20,
      width: 60,
      height: 40,
      stroke: "#2176ff",
      fill: "#e3eeff",
      strokeWidth: 2,
      draggable: true,
      _type: "rect"
    });
  } else if (currentTool === "circle") {
    shape = new Konva.Circle({
      x: pointer.x,
      y: pointer.y,
      radius: 32,
      stroke: "#2176ff",
      fill: "#e3eeff",
      strokeWidth: 2,
      draggable: true,
      _type: "circle"
    });
  }
  if (shape) {
    shapes.push(shape);
    window.layer.add(shape);
    window.layer.draw();
    selectShape(shape);
  }
}

function deleteShapeHandler() {
  if (!selectedShape) return;
  shapes = shapes.filter(s => s !== selectedShape);
  selectedShape.destroy();
  selectedShape = null;
  window.layer.draw();
}

function duplicateShapeHandler() {
  if (!selectedShape) return;
  let clone;
  if (selectedShape._type === "point" || selectedShape._type === "circle") {
    clone = selectedShape.clone({ x: selectedShape.x() + 16, y: selectedShape.y() + 16 });
  } else if (selectedShape._type === "rect") {
    clone = selectedShape.clone({ x: selectedShape.x() + 20, y: selectedShape.y() + 20 });
  }
  if (clone) {
    shapes.push(clone);
    window.layer.add(clone);
    window.layer.draw();
    selectShape(clone);
  }
}

function clearSelection() {
  if (selectedShape) {
    selectedShape.strokeEnabled(true);
    selectedShape = null;
    window.layer.draw();
  }
}

function selectShape(shape) {
  clearSelection();
  selectedShape = shape;
  if (shape) {
    shape.strokeEnabled(true);
    window.layer.draw();
  }
}

function onCanvasDown(e) {
  if (e.target === window.layer) {
    clearSelection();
  } else {
    selectShape(e.target);
  }
}

function addShapeHandlers() {
  // For extension: add event handlers to shapes (e.g. drag, transform)
}

if (typeof window !== "undefined") {
  window.setupShapeTools = setupShapeTools;
  window.addShapeHandlers = addShapeHandlers;
  window.shapes = shapes;
}

