/**
 * sidebar.js
 * -----------------------------------------------------------
 * Shape Table/List Panel for Scene Designer (Golden Layout)
 * - Displays all shapes in a concise, interactive table using Tabulator (ESM).
 * - Lets user select a shape by row, see/edit label, see lock/color.
 * - Interacts with AppState for all data and selection.
 * - No globals; all state via AppState.
 * - Logging via log.js; updates via state.js.
 * - Logging policy: Use INFO for user actions, DEBUG for table updates, ERROR for UI problems.
 * - ES module only: imports Tabulator from npm, no globals, no window.*.
 * -----------------------------------------------------------
 */

import { AppState, setShapes, setSelectedShapes } from './state.js';
import { log } from './log.js';
import Tabulator from 'tabulator-tables';

// Internal reference to Tabulator instance
let tabulatorInstance = null;

// Helper: Format color swatch for Tabulator
function colorSwatchCell(color) {
  const c = color && typeof color === "function" ? color() : color;
  return `<div style="background:${c || 'transparent'};border:1px solid #bbb;width:20px;height:20px;display:inline-block;border-radius:4px;"></div>`;
}

// Helper: Get shape attributes for table
function getShapeAttrs(s) {
  try {
    if (!s || typeof s.getAttrs !== "function") return {};
    return s.getAttrs();
  } catch {
    return {};
  }
}

// Build the sidebar shape table panel using Tabulator
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
      if (tabulatorInstance) tabulatorInstance.replaceData(makeTableData());
    };

    // Helper: Build data array for Tabulator
    function makeTableData() {
      const shapes = AppState.shapes || [];
      return shapes.map((s, i) => {
        const attrs = getShapeAttrs(s);
        let x = 0, y = 0, w = 0, h = 0;
        if (s._type === 'rect') { x = attrs.x; y = attrs.y; w = attrs.width; h = attrs.height; }
        else if (s._type === 'circle') { x = attrs.x; y = attrs.y; w = attrs.radius; h = attrs.radius; }
        else if (s._type === 'point') { x = attrs.x; y = attrs.y; w = "--"; h = "--"; }
        return {
          idx: i + 1,
          label: s._label || '',
          type: s._type || '',
          locked: s.locked ? '🔒' : '',
          fillColor: s.fill ? s.fill() : '',
          strokeColor: s.stroke ? s.stroke() : '',
          x: Math.round(x), y: Math.round(y), w, h,
          _shape: s,
          selected: AppState.selectedShapes.includes(s)
        };
      });
    }

    // Tabulator columns
    const columns = [
      { title: "#", field: "idx", width: 45, hozAlign: "center" },
      { title: "Label", field: "label", editor: "input", widthGrow: 2 },
      { title: "Type", field: "type", width: 70 },
      { title: "L", field: "locked", width: 36, hozAlign: "center" },
      {
        title: "F", field: "fillColor", width: 36, hozAlign: "center",
        formatter: cell => colorSwatchCell(cell.getValue())
      },
      {
        title: "S", field: "strokeColor", width: 36, hozAlign: "center",
        formatter: cell => colorSwatchCell(cell.getValue())
      },
      { title: "X", field: "x", width: 50 },
      { title: "Y", field: "y", width: 50 },
      { title: "W/R", field: "w", width: 50 },
      { title: "H", field: "h", width: 50 }
    ];

    // Tabulator table
    const tableDiv = rootElement.querySelector("#sidebar-table-div");
    tableDiv.innerHTML = ""; // Clear if re-rendered

    // Destroy old Tabulator instance if present
    if (tabulatorInstance && typeof tabulatorInstance.destroy === "function") {
      tabulatorInstance.destroy();
      tabulatorInstance = null;
    }

    tabulatorInstance = new Tabulator(tableDiv, {
      data: makeTableData(),
      layout: "fitColumns",
      columns: columns,
      height: "100%",
      selectable: true,
      rowFormatter: function (row) {
        // Highlight selected rows
        const data = row.getData();
        if (data.selected) {
          row.getElement().style.background = "#d0e7ff";
        } else {
          row.getElement().style.background = "";
        }
      },
      rowClick: function (e, row) {
        const s = row.getData()._shape;
        setSelectedShapes([s]);
        log("INFO", "[sidebar] Shape row clicked", { idx: row.getData().idx - 1 });
        tabulatorInstance.replaceData(makeTableData());
      },
      cellEdited: function (cell) {
        // Inline label editing
        const field = cell.getField();
        const s = cell.getData()._shape;
        if (field === "label" && s) {
          s._label = cell.getValue();
          log("DEBUG", "[sidebar] Label edited", { newLabel: cell.getValue(), shape: s });
        }
      }
    });

    // Subscribe to AppState to update table on shapes or selection change
    if (!rootElement._appStateUnsub) {
      const update = () => {
        if (tabulatorInstance) tabulatorInstance.replaceData(makeTableData());
      };
      AppState._subscribers = AppState._subscribers || [];
      AppState._subscribers.push(update);
      rootElement._appStateUnsub = update;
      // Clean up when panel is destroyed
      if (container && typeof container.on === "function") {
        container.on("destroy", () => {
          const idx = AppState._subscribers.indexOf(update);
          if (idx !== -1) AppState._subscribers.splice(idx, 1);
        });
      }
    }

    log("INFO", "[sidebar] Sidebar panel fully initialized (Tabulator)");
  } catch (e) {
    log("ERROR", "[sidebar] buildSidebarPanel ERROR", e);
    alert("SidebarPanel ERROR: " + e.message);
    throw e;
  }
}
