/*******************************************************
 * shapes.part3.sidebar.js
 * Part 3 of N for shapes.js modular build
 * 
 * Feature Area: Sidebar, label UI, label editing, and shape list/table
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
 * Sidebar/Label UI Setup
 *************************************/
let elSidebar = null;
function setupSidebarPanel(root) {
  elSidebar = root.querySelector('#sidebar');
  window.labelEditBox = elSidebar.querySelector('#labelEditBox');
  window.labelInput = elSidebar.querySelector('#labelInput');
  window.saveLabelBtn = elSidebar.querySelector('#saveLabelBtn');
  window.labelsList = elSidebar.querySelector('#labels-list');

  // Label save logic
  if (window.saveLabelBtn && window.labelInput) {
    saveLabelBtn.addEventListener("click", () => {
      if (selectedShapes.length === 1) {
        selectedShapes[0]._label = labelInput.value;
        updateList();
      }
    });
  }
}

/*************************************
 * Label UI, List UI, Label locking
 *************************************/
function updateLabelUI() {
  logEnter("updateLabelUI");
  if (selectedShapes.length === 1) {
    labelEditBox.style.display = 'flex';
    labelInput.disabled = false;
    saveLabelBtn.disabled = false;
    labelInput.value = selectedShapes[0]._label;
  } else {
    labelEditBox.style.display = 'none';
  }
  if (selectedShapes.length > 0) {
    const allLocked = selectedShapes.every(s => s.locked);
    const noneLocked = selectedShapes.every(s => !s.locked);
    lockCheckbox.indeterminate = !(allLocked || noneLocked);
    lockCheckbox.checked = allLocked;
  } else {
    lockCheckbox.indeterminate = false;
    lockCheckbox.checked = false;
  }
  logExit("updateLabelUI");
}

function updateList() {
  logEnter("updateList");
  let html = '<table class="coords-table"><tr><th>Label</th><th>Type</th><th>Fill</th><th>Line</th><th>x</th><th>y</th><th>w/r</th><th>h</th><th>Lock</th></tr>';
  shapes.forEach((s, i) => {
    const t = s._type;
    const lbl = s._label;
    const attrs = s.getAttrs();
    let x = 0, y = 0, w = 0, h = 0;
    if (t === 'rect') { x = attrs.x; y = attrs.y; w = attrs.width; h = attrs.height; }
    else if (t === 'circle') { x = attrs.x; y = attrs.y; w = h = attrs.radius; }
    else if (t === 'point') { x = attrs.x; y = attrs.y; w = h = "--"; }
    const isSelected = selectedShapes.includes(s);
    html += `<tr${isSelected ? ' class="selected"' : ''}>
      <td><span class="select-label" data-idx="${i}" style="color:#2176ff;cursor:pointer;text-decoration:underline;">${lbl}</span></td>
      <td>${t}</td>
      <td><span class="swatch fill-swatch" data-idx="${i}" title="Change fill color" style="background:${s.fill ? (s.fill() || 'transparent') : 'transparent'}"></span></td>
      <td><span class="swatch stroke-swatch" data-idx="${i}" title="Change line color" style="background:${s.stroke ? s.stroke() : ''}"></span></td>
      <td>${Math.round(x)}</td><td>${Math.round(y)}</td><td>${w}</td><td>${h}</td>
      <td>${s.locked ? '🔒' : ''}</td>
    </tr>`;
  });
  html += '</table>';
  labelsList.innerHTML = html;

  // Events for label/table interactions
  document.querySelectorAll('.select-label').forEach(el => {
    el.onclick = function () {
      const idx = parseInt(this.dataset.idx, 10);
      enableEdit(shapes[idx]);
    }
  });
  document.querySelectorAll('.fill-swatch').forEach(el => {
    el.onclick = function (e) {
      const idx = parseInt(this.dataset.idx, 10);
      enableEdit(shapes[idx]);
      setTimeout(() => fillPickr.show(), 50);
      e.stopPropagation();
    };
  });
  document.querySelectorAll('.stroke-swatch').forEach(el => {
    el.onclick = function (e) {
      const idx = parseInt(this.dataset.idx, 10);
      enableEdit(shapes[idx]);
      setTimeout(() => strokePickr.show(), 50);
      e.stopPropagation();
    };
  });
  updateLabelUI();
  logExit("updateList");
}

/*************************************
 * Lock checkbox handling: for single or multi selection
 *************************************/
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lockCheckbox !== "undefined" && lockCheckbox) {
    lockCheckbox.addEventListener('change', () => {
      if (selectedShapes.length === 0) return;
      // If indeterminate, apply to all as per new state
      const newLocked = lockCheckbox.checked;
      selectedShapes.forEach(s => setShapeLocked(s, newLocked));
      updateList();
      updateLabelUI();
    });
  }
});
