/**
 * shapes.part3.sidebar.js
 * Sidebar UI: component layout & events for scene-designer
 * - Renders sidebar panel (label editor, labels list)
 * - Handles sidebar-specific events and interactions
 * - Depends on Konva shapes/tools (part2b)
 */

function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  // Elements
  const labelInput = sidebar.querySelector("#labelInput");
  const saveLabelBtn = sidebar.querySelector("#saveLabelBtn");
  const labelsList = sidebar.querySelector("#labels-list");

  // Save label handler
  if (saveLabelBtn && labelInput) {
    saveLabelBtn.onclick = function() {
      if (window.shapes && window.shapes.length && window.shapes.selectedShape) {
        window.shapes.selectedShape._label = labelInput.value.trim();
        updateLabelsList();
      }
    };
  }

  // Populate labels list
  function updateLabelsList() {
    if (!labelsList) return;
    labelsList.innerHTML = "";
    if (window.shapes && window.shapes.length) {
      window.shapes.forEach((shape, idx) => {
        const label = shape._label || "";
        const type = shape._type || "shape";
        const div = document.createElement("div");
        div.className = "shape-label-row";
        div.innerHTML = `
          <span class="shape-type">${type}</span>
          <input type="text" value="${label}" data-idx="${idx}" maxlength="40" class="label-input-row">
          <button type="button" class="label-save-btn" data-idx="${idx}">Save</button>
        `;
        labelsList.appendChild(div);
      });

      // Attach save handlers for each row
      const saveBtns = labelsList.querySelectorAll(".label-save-btn");
      saveBtns.forEach(btn => {
        btn.onclick = function(e) {
          const idx = Number(btn.getAttribute("data-idx"));
          const input = labelsList.querySelector(`.label-input-row[data-idx="${idx}"]`);
          if (window.shapes[idx] && input) {
            window.shapes[idx]._label = input.value.trim();
          }
        };
      });
    }
  }

  // Export for use elsewhere
  window.updateLabelsList = updateLabelsList;
  updateLabelsList();
}

if (typeof window !== "undefined") {
  window.setupSidebar = setupSidebar;
}

