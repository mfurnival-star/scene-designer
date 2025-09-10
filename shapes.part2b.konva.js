/*******************************************************
 * shapes.part6.utils.js
 * Part 6 of N for shapes.js modular build
 * 
 * Feature Area: Utility functions, general helpers, debug tools, and export/import logic
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
 * Utility: Export/Import Shapes as JSON
 *************************************/
function exportShapesToJSON() {
  const data = shapes.map(s => ({
    type: s._type,
    label: s._label,
    attrs: s.getAttrs(),
    locked: !!s.locked
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shapes-export.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importShapesFromJSON(jsonStr) {
  logEnter("importShapesFromJSON");
  try {
    const arr = JSON.parse(jsonStr);
    layer.destroyChildren();
    shapes.length = 0;
    arr.forEach(obj => {
      let s;
      if (obj.type === "rect") {
        s = new Konva.Rect(obj.attrs);
      } else if (obj.type === "circle") {
        s = new Konva.Circle(obj.attrs);
      } else if (obj.type === "point") {
        s = new Konva.Circle(obj.attrs);
      }
      if (s) {
        s._type = obj.type;
        s._label = obj.label;
        s.locked = !!obj.locked;
        setupShapeEvents(s);
        shapes.push(s);
        layer.add(s);
      }
    });
    layer.draw();
    updateList();
  } catch (e) {
    window.alert("Failed to import shapes: " + e);
  }
  logExit("importShapesFromJSON");
}

/*************************************
 * Utility: Download PNG of current canvas
 *************************************/
function downloadCanvasAsPNG() {
  logEnter("downloadCanvasAsPNG");
  if (!stage) return;
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "scene.png";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
  logExit("downloadCanvasAsPNG");
}

/*************************************
 * Debug: Dump all shapes to console
 *************************************/
function debugDumpShapes() {
  logEnter("debugDumpShapes");
  console.log("Current shapes:", shapes.map(s => ({
    type: s._type,
    label: s._label,
    attrs: s.getAttrs(),
    locked: !!s.locked
  })));
  logExit("debugDumpShapes");
}

/*************************************
 * General Helper: Enable edit on shape from list
 *************************************/
function enableEdit(shape) {
  if (!shape) return;
  selectedShapes = [shape];
  updateSelectionHighlights();
  updateList();
}

/*************************************
 * Redraw all points (used by settings changes)
 *************************************/
function redrawAllPoints() {
  shapes.forEach(s => {
    if (s._type === "point") {
      s.radius(getSetting("pointHitRadius"));
      s.strokeWidth(2);
      s.fill(getSetting("defaultFillColor"));
      s.stroke(getSetting("defaultStrokeColor"));
    }
  });
  layer.batchDraw();
}
window.redrawAllPoints = redrawAllPoints;

/*************************************
 * Export/Import Buttons Setup
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  const btnExport = document.getElementById("btnExportShapes");
  const btnImport = document.getElementById("btnImportShapes");
  const btnDownload = document.getElementById("btnDownloadPNG");
  if (btnExport) btnExport.onclick = exportShapesToJSON;
  if (btnImport) btnImport.onclick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.addEventListener('change', (e) => {
      if (!e.target.files.length) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        importShapesFromJSON(ev.target.result);
      };
      reader.readAsText(file);
    });
    fileInput.click();
  };
  if (btnDownload) btnDownload.onclick = downloadCanvasAsPNG;
});
