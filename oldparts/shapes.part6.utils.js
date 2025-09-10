/**
 * shapes.part6.utils.js
 * Utility functions/helpers for scene-designer
 * - Common helpers for exporting/importing shapes, etc.
 * - Export: exportShapes, importShapes, helpers
 */

// Export shapes to JSON
function exportShapes() {
  if (!window.shapes) return "[]";
  return JSON.stringify(window.shapes.map(shape => {
    // Only basic shape properties (extend as needed)
    return {
      type: shape._type,
      x: shape.x(),
      y: shape.y(),
      ...(shape._type === "point" || shape._type === "circle"
        ? { radius: shape.radius() }
        : {}),
      ...(shape._type === "rect"
        ? { width: shape.width(), height: shape.height() }
        : {}),
      stroke: shape.stroke(),
      fill: shape.fill(),
      strokeWidth: shape.strokeWidth(),
      label: shape._label || ""
    };
  }), null, 2);
}

// Import shapes from JSON
function importShapes(json) {
  let arr = [];
  try {
    arr = JSON.parse(json);
  } catch (e) {
    alert("Import failed: Invalid JSON");
    return;
  }
  if (!Array.isArray(arr)) {
    alert("Import failed: Not a shape array");
    return;
  }
  if (!window.layer) return;
  window.layer.removeChildren();
  window.shapes.length = 0;
  arr.forEach(obj => {
    let shape;
    if (obj.type === "point" || obj.type === "circle") {
      shape = new Konva.Circle({
        x: obj.x,
        y: obj.y,
        radius: obj.radius || 12,
        stroke: obj.stroke || "#2176ff",
        fill: obj.fill || "#e3eeff",
        strokeWidth: obj.strokeWidth || 2,
        draggable: true,
        _type: obj.type
      });
    } else if (obj.type === "rect") {
      shape = new Konva.Rect({
        x: obj.x,
        y: obj.y,
        width: obj.width || 60,
        height: obj.height || 40,
        stroke: obj.stroke || "#2176ff",
        fill: obj.fill || "#e3eeff",
        strokeWidth: obj.strokeWidth || 2,
        draggable: true,
        _type: obj.type
      });
    }
    if (shape) {
      shape._label = obj.label || "";
      window.shapes.push(shape);
      window.layer.add(shape);
    }
  });
  window.layer.draw();
  if (window.updateLabelsList) window.updateLabelsList();
}

// Helpers
function exportShapesToJSON() {
  const data = exportShapes();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shapes.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}

function importShapesFromJSON(json) {
  importShapes(json);
}

function downloadCanvasAsPNG() {
  if (!window.stage) return;
  const dataURL = window.stage.toDataURL();
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "canvas.png";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 200);
}

if (typeof window !== "undefined") {
  window.exportShapes = exportShapes;
  window.importShapes = importShapes;
  window.exportShapesToJSON = exportShapesToJSON;
  window.importShapesFromJSON = importShapesFromJSON;
  window.downloadCanvasAsPNG = downloadCanvasAsPNG;
}
