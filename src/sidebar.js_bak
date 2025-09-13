/**
 * sidebar.js
 * -----------------------------------------------------------
 * Golden Layout Sidebar Panel for Scene Designer
 * - Dynamic shape list/table: selection, inline label editing, lock/unlock, color chips
 * - Integrates with AppState (from state.js) and logging (log.js)
 * - Selection syncs with canvas and main AppState
 * - Label, color, lock state, and delete actions all supported
 * - Responsive to state changes via AppState.subscribe
 * - Modular, no globals except AppState
 * -----------------------------------------------------------
 */

import { AppState, addShape, removeShape } from './state.js';
import { setSelectedShape, setSelectedShapes } from './selection.js';
import { log } from './log.js';

// Helper — returns a shape's current fill/stroke color (supports Konva.js or plain objects)
function getShapeStroke(shape) {
  return (typeof shape.stroke === "function") ? shape.stroke() : (shape.stroke || "#2176ff");
}
function getShapeFill(shape) {
  return (typeof shape.fill === "function") ? shape.fill() : (shape.fill || "#fff0");
}
function getShapeLabel(shape) {
  return shape._label || "";
}
function getShapeType(shape) {
  return shape._type || "unknown";
}
function getShapeCoords(shape) {
  // Returns array of [x, y, w/r, h] (if applicable)
  if (shape._type === "rect") {
    return [
      Math.round(shape.x()), Math.round(shape.y()),
      Math.round(shape.width()), Math.round(shape.height())
    ];
  }
  if (shape._type === "circle") {
    return [
      Math.round(shape.x()), Math.round(shape.y()),
      Math.round(shape.radius()), ""
    ];
  }
  if (shape._type === "point") {
    return [
      Math.round(shape.x()), Math.round(shape.y()),
      "", ""
    ];
  }
  return ["", "", "", ""];
}

// Helper — render lock icon
function lockIcon(locked) {
  return locked ? "🔒" : "";
}

/**
 * Build the Sidebar Panel UI for Golden Layout.
 * @param {HTMLElement} rootElement - The panel root DOM node.
 * @param {GoldenLayout.Container} container - The GL container (unused here).
 */
export function buildSidebarPanel(rootElement, container) {
  log("INFO", "[sidebar] Building sidebar panel UI");
  rootElement.innerHTML = "<h3 style='margin-top:0'>Shapes</h3><div id='shapelist'></div>";

  const listDiv = rootElement.querySelector("#shapelist");

  // Setup: table columns (matches README.md/UX plan)
  function renderTable() {
    const shapes = AppState.shapes || [];
    const selected = AppState.selectedShapes || [];
    let html = `<table class="coords-table" style="width:100%;font-size:13px;">
      <thead>
        <tr>
          <th>Label</th>
          <th>Type</th>
          <th>Fill</th>
          <th>Line</th>
          <th>x</th>
          <th>y</th>
          <th>w/r</th>
          <th>h</th>
          <th>Lock</th>
          <th>Del</th>
        </tr>
      </thead>
      <tbody>
    `;
    shapes.forEach((s, i) => {
      const [x, y, w, h] = getShapeCoords(s);
      const isSelected = selected.includes(s);
      // Main row
      html += `<tr data-idx="${i}"${isSelected ? ' class="selected"' : ''}>
        <td>
          <input type="text" class="sidebar-label-input" data-idx="${i}" value="${getShapeLabel(s)}" style="width:80px;font-size:12px;background:${isSelected ? "#e9f1ff" : "#fff"};border:1px solid #ccc;">
        </td>
        <td>${getShapeType(s)}</td>
        <td>
          <span class="swatch fill-swatch" data-idx="${i}" title="Fill" style="display:inline-block;width:18px;height:18px;border-radius:3px;background:${getShapeFill(s)};border:1.5px solid #bbb;vertical-align:middle;cursor:pointer;"></span>
        </td>
        <td>
          <span class="swatch stroke-swatch" data-idx="${i}" title="Stroke" style="display:inline-block;width:18px;height:18px;border-radius:3px;background:${getShapeStroke(s)};border:1.5px solid #444;vertical-align:middle;cursor:pointer;"></span>
        </td>
        <td>${x}</td>
        <td>${y}</td>
        <td>${w}</td>
        <td>${h}</td>
        <td>
          <button class="lock-btn" data-idx="${i}" title="Toggle lock" style="background:none;border:none;font-size:16px;">${lockIcon(s.locked)}</button>
        </td>
        <td>
          <button class="delete-btn" data-idx="${i}" title="Delete" style="background:none;border:none;font-size:14px;color:#e53935;">✖</button>
        </td>
      </tr>`;
    });
    html += "</tbody></table>";
    listDiv.innerHTML = html;

    // --- Event wiring for table ---

    // 1. Row selection (click anywhere except input/buttons)
    listDiv.querySelectorAll("tr[data-idx]").forEach(row => {
      row.addEventListener("click", (e) => {
        // Only trigger if not clicking an input or button
        if (["INPUT", "BUTTON", "SPAN"].includes(e.target.tagName)) return;
        const idx = Number(row.dataset.idx);
        setSelectedShape(AppState.shapes[idx]);
        log("INFO", "[sidebar] Shape row selected", { idx, id: AppState.shapes[idx]._id });
      });
    });

    // 2. Inline label editing
    listDiv.querySelectorAll(".sidebar-label-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const idx = Number(input.dataset.idx);
        const val = input.value.trim();
        if (val.length > 0) {
          AppState.shapes[idx]._label = val;
          log("INFO", "[sidebar] Shape label changed", { idx, label: val });
        }
      });
      input.addEventListener("focus", (e) => {
        setSelectedShape(AppState.shapes[Number(input.dataset.idx)]);
      });
    });

    // 3. Fill swatch (future: open color picker)
    listDiv.querySelectorAll(".fill-swatch").forEach(span => {
      span.addEventListener("click", (e) => {
        const idx = Number(span.dataset.idx);
        setSelectedShape(AppState.shapes[idx]);
        log("INFO", "[sidebar] Fill swatch clicked", { idx });
        // TODO: Show Pickr color picker for fill here in future.
      });
    });

    // 4. Stroke swatch (future: open color picker)
    listDiv.querySelectorAll(".stroke-swatch").forEach(span => {
      span.addEventListener("click", (e) => {
        const idx = Number(span.dataset.idx);
        setSelectedShape(AppState.shapes[idx]);
        log("INFO", "[sidebar] Stroke swatch clicked", { idx });
        // TODO: Show Pickr color picker for stroke here in future.
      });
    });

    // 5. Lock button
    listDiv.querySelectorAll(".lock-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const s = AppState.shapes[idx];
        s.locked = !s.locked;
        log("INFO", "[sidebar] Shape lock toggled", { idx, locked: s.locked });
        renderTable();
      });
    });

    // 6. Delete button
    listDiv.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const s = AppState.shapes[idx];
        removeShape(s);
        log("INFO", "[sidebar] Shape deleted", { idx, id: s._id });
      });
    });
  }

  // -- Subscription: update sidebar when AppState changes (shapes, selection, etc) --
  function stateListener() {
    renderTable();
  }
  const unsub = AppState._subscribers && typeof AppState._subscribers.push === "function"
    ? AppState._subscribers.push(stateListener)
    : null;
  renderTable();

  // Cleanup (unsubscribe) when panel is destroyed
  if (container && typeof container.on === "function") {
    container.on("destroy", () => {
      if (typeof unsub === "function") unsub();
      log("INFO", "[sidebar] Sidebar panel destroyed");
    });
  }
}

// Optionally: Attach for debugging
if (typeof window !== "undefined") {
  window.buildSidebarPanel = buildSidebarPanel;
}
