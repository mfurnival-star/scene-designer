/*******************************************************
 * shapes.part4.toolbar.js
 * Part 4 of N for shapes.js modular build
 * 
 * Feature Area: Toolbar actions, shape creation, deletion, and general shape utilities
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
 * Toolbar and shape creation logic
 *************************************/
function createRectangle(x = 50, y = 50, w = getSetting("defaultRectWidth"), h = getSetting("defaultRectHeight")) {
  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: w,
    height: h,
    fill: getSetting("defaultFillColor"),
    stroke: getSetting("defaultStrokeColor"),
    strokeWidth: 2,
    draggable: true,
    name: 'rect'
  });
  rect._type = 'rect';
  rect._label = `Rect ${shapes.length + 1}`;
  rect.locked = false;
  setupShapeEvents(rect);
  shapes.push(rect);
  layer.add(rect);
  layer.draw();
  updateList();
  return rect;
}

function createCircle(x = 120, y = 90, r = getSetting("defaultCircleRadius")) {
  const circ = new Konva.Circle({
    x: x,
    y: y,
    radius: r,
    fill: getSetting("defaultFillColor"),
    stroke: getSetting("defaultStrokeColor"),
    strokeWidth: 2,
    draggable: true,
    name: 'circle'
  });
  circ._type = 'circle';
  circ._label = `Circle ${shapes.length + 1}`;
  circ.locked = false;
  setupShapeEvents(circ);
  shapes.push(circ);
  layer.add(circ);
  layer.draw();
  updateList();
  return circ;
}

function createPoint(x = 80, y = 80) {
  const pt = new Konva.Circle({
    x: x,
    y: y,
    radius: getSetting("pointHitRadius"),
    fill: getSetting("defaultFillColor"),
    stroke: getSetting("defaultStrokeColor"),
    strokeWidth: 2,
    draggable: true,
    name: 'point'
  });
  pt._type = 'point';
  pt._label = `Point ${shapes.length + 1}`;
  pt.locked = false;
  setupShapeEvents(pt);
  shapes.push(pt);
  layer.add(pt);
  layer.draw();
  updateList();
  return pt;
}

function deleteSelectedShapes() {
  logEnter("deleteSelectedShapes");
  if (!selectedShapes.length) return;
  selectedShapes.forEach(s => {
    shapes = shapes.filter(obj => obj !== s);
    s.destroy();
  });
  selectedShapes = [];
  updateList();
  layer.draw();
  highlightLayer.draw();
  logExit("deleteSelectedShapes");
}

function setupToolbar() {
  logEnter("setupToolbar");
  const btnRect = document.getElementById("btnAddRect");
  const btnCircle = document.getElementById("btnAddCircle");
  const btnPoint = document.getElementById("btnAddPoint");
  const btnDelete = document.getElementById("btnDeleteShape");

  if (btnRect) btnRect.onclick = () => createRectangle();
  if (btnCircle) btnCircle.onclick = () => createCircle();
  if (btnPoint) btnPoint.onclick = () => createPoint();
  if (btnDelete) btnDelete.onclick = () => deleteSelectedShapes();

  logExit("setupToolbar");
}
document.addEventListener("DOMContentLoaded", setupToolbar);

/*************************************
 * Shape Events and Utility
 *************************************/
function setupShapeEvents(shape) {
  shape.on('mousedown touchstart', (e) => {
    if (e.evt && (e.evt.shiftKey || e.evt.ctrlKey)) {
      if (selectedShapes.includes(shape)) {
        selectedShapes = selectedShapes.filter(s => s !== shape);
      } else {
        selectedShapes.push(shape);
      }
    } else {
      selectedShapes = [shape];
    }
    updateSelectionHighlights();
    updateList();
  });
  shape.on('dragmove', (e) => {
    updateSelectionHighlights();
    updateList();
  });
  shape.on('mouseenter', () => {
    document.body.style.cursor = 'pointer';
  });
  shape.on('mouseleave', () => {
    document.body.style.cursor = '';
  });
  // Lock logic (for completeness; can be extended)
  shape.on('dragstart', (e) => {
    if (shape.locked) {
      shape.stopDrag();
      showLockedHighlightForShapes([shape]);
    }
  });
}

/*************************************
 * Lock Shape Utility
 *************************************/
function setShapeLocked(shape, locked) {
  shape.locked = locked;
  shape.draggable(!locked);
  updateList();
}

