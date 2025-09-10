/**
 * shapes.part4.toolbar.js
 * Toolbar and tool selection for scene-designer
 * - Renders toolbar
 * - Handles tool selection and tool switching logic
 * - Integrates with Konva tool logic (part2b)
 */

function setupToolbar() {
  // Shape type dropdown
  const shapeType = document.getElementById("shapeType");
  if (shapeType) {
    shapeType.onchange = function (e) {
      if (window.currentTool !== undefined) {
        window.currentTool = e.target.value;
      }
      if (window.handleToolChange) window.handleToolChange();
    };
  }

  // Toolbar buttons
  const addBtn = document.getElementById("newBtn");
  if (addBtn) {
    addBtn.onclick = function () {
      if (window.addShapeHandler) window.addShapeHandler();
    };
  }
  const duplicateBtn = document.getElementById("duplicateBtn");
  if (duplicateBtn) {
    duplicateBtn.onclick = function () {
      if (window.duplicateShapeHandler) window.duplicateShapeHandler();
    };
  }
  const deleteBtn = document.getElementById("deleteBtn");
  if (deleteBtn) {
    deleteBtn.onclick = function () {
      if (window.deleteShapeHandler) window.deleteShapeHandler();
    };
  }

  // Color pickers (stroke/fill)
  const strokePickr = document.getElementById("strokePickr");
  const fillPickr = document.getElementById("fillPickr");
  if (strokePickr) {
    strokePickr.style.background = window.getSetting ? window.getSetting("defaultStrokeColor") : "#2176ff";
    strokePickr.onclick = function () {
      // Placeholder: open color picker dialog, or integrate Pickr lib if needed
      // For now, fallback to prompt
      const color = prompt("Enter stroke color (hex)", strokePickr.style.background);
      if (color) {
        strokePickr.style.background = color;
        if (window.saveSetting) window.saveSetting("defaultStrokeColor", color);
        if (window.redrawAllPoints) window.redrawAllPoints();
      }
    };
  }
  if (fillPickr) {
    fillPickr.style.background = window.getSetting ? window.getSetting("defaultFillColor") : "#e3eeff";
    fillPickr.onclick = function () {
      const color = prompt("Enter fill color (hex)", fillPickr.style.background);
      if (color) {
        fillPickr.style.background = color;
        if (window.saveSetting) window.saveSetting("defaultFillColor", color);
        if (window.redrawAllPoints) window.redrawAllPoints();
      }
    };
  }
}

if (typeof window !== "undefined") {
  window.setupToolbar = setupToolbar;
}
