/**
 * sidebar.js
 * -----------------------------------------------------------
 * Shape Table/List Panel for Scene Designer (Golden Layout)
 * - Displays all shapes in a concise table.
 * - Lets user select a shape by row, see/edit label, see lock/color.
 * - Interacts with AppState for all data and selection.
 * - No globals; all state via AppState.
 * - Logging via log.js; updates via state.js.
 * - Logging policy: Use INFO for user actions, DEBUG for table updates, ERROR for UI problems.
 * -----------------------------------------------------------
 */

import { AppState, setShapes, setSelectedShapes } from './state.js';
import { log } from './log.js';

// Build the sidebar shape table panel
export function buildSidebarPanel(rootElement, container) {
  try {
    log("INFO", "[sidebar] buildSidebarPanel called", { rootElement, container });

    // Panel skeleton
    rootElement.innerHTML = `
      <div id="sidebar-panel-container" style="width:100%;height:100%;background:#f4f8ff;display:flex;flex-direction:column;overflow:auto;">
        <div style="padding:10px 8px 4px 8px;font-weight:bold;font-size:1.2em;color:#0057d8;">
          Shape List
          <button id="sidebar-select-all" style="float:right;font-size:0.9em;">Select All</button>
        </div>
        <div id="sidebar-table-div" style="flex:1 1 0;overflow:auto;"></div>
      </div>
    `;

    // Hook up select all
    rootElement.querySelector("#sidebar-select-all").onclick = () => {
      setSelectedShapes(AppState.shapes.slice());
      log("INFO", "[sidebar] Select All clicked");
      renderTable();
    };

    // Render table of shapes
    function renderTable() {
      log("DEBUG", "[sidebar] renderTable called");
      const shapes = AppState.shapes || [];
      const selArr = AppState.selectedShapes || [];
      const tableDiv = rootElement.querySelector("#sidebar-table-div");
      if (!tableDiv) return;
      let html = `<table class="sidebar-shape-table" style="width:100%;border-collapse:collapse;font-size:1em;">
        <thead><tr>
          <th style="width:2em;">#</th>
          <th>Label</th>
          <th>Type</th>
          <th style="width:2em;">L</th>
          <th style="width:2em;">F</th>
          <th style="width:2em;">S</th>
          <th style="width:3em;">X</th>
          <th style="width:3em;">Y</th>
          <th style="width:3em;">W/R</th>
          <th style="width:3em;">H</th>
        </tr></thead><tbody>`;

      shapes.forEach((s, i) => {
        const t = s._type || '';
        const lbl = s._label || '';
        let x = 0, y = 0, w = 0, h = 0;
        try {
          const attrs = s.getAttrs ? s.getAttrs() : {};
          if (t === 'rect') { x = attrs.x; y = attrs.y; w = attrs.width; h = attrs.height; }
          else if (t === 'circle') { x = attrs.x; y = attrs.y; w = attrs.radius; h = attrs.radius; }
          else if (t === 'point') { x = attrs.x; y = attrs.y; w = "--"; h = "--"; }
        } catch { /* fallback to 0 */ }
        const isSelected = selArr.includes(s);
        html += `<tr data-idx="${i}"${isSelected ? ' style="background:#d0e7ff;"' : ''}>
          <td>${i + 1}</td>
          <td><span class="sidebar-label" style="cursor:pointer;color:#2176ff;text-decoration:underline;">${lbl}</span></td>
          <td>${t}</td>
          <td style="text-align:center;">${s.locked ? '🔒' : ''}</td>
          <td style="background:${s.fill ? (s.fill() || 'transparent') : 'transparent'};border:1px solid #ccc;"></td>
          <td style="background:${s.stroke ? s.stroke() : 'transparent'};border:1px solid #ccc;"></td>
          <td>${Math.round(x)}</td>
          <td>${Math.round(y)}</td>
          <td>${w}</td>
          <td>${h}</td>
        </tr>`;
      });
      html += "</tbody></table>";
      tableDiv.innerHTML = html;

      // Label click selects shape
      tableDiv.querySelectorAll(".sidebar-label").forEach((el, idx) => {
        el.onclick = function (e) {
          setSelectedShapes([AppState.shapes[idx]]);
          log("INFO", "[sidebar] Shape row clicked", { idx });
          renderTable();
        };
      });
    }

    // Initial render
    renderTable();

    // Subscribe to AppState
    if (!rootElement._appStateUnsub) {
      rootElement._appStateUnsub = AppState._subscribers = AppState._subscribers || [];
      const update = () => renderTable();
      AppState._subscribers.push(update);
      // Clean up when panel is destroyed
      if (container && typeof container.on === "function") {
        container.on("destroy", () => {
          const idx = AppState._subscribers.indexOf(update);
          if (idx !== -1) AppState._subscribers.splice(idx, 1);
        });
      }
    }

    log("INFO", "[sidebar] Sidebar panel fully initialized");
  } catch (e) {
    log("ERROR", "[sidebar] buildSidebarPanel ERROR", e);
    alert("SidebarPanel ERROR: " + e.message);
    throw e;
  }
}

