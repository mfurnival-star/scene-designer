/**
 * sidebar.js
 * -----------------------------------------------------------
 * Shape Table/List Panel for Scene Designer (Golden Layout)
 * - Tabulator-based shape table (ESM only, no globals).
 * - Displays a live-updating table of all shapes in AppState.shapes.
 * - Columns: Label, Type, X, Y, W, H, Lock status.
 * - Clicking a row selects the corresponding shape (single selection for now).
 * - All state via AppState.
 * - Logging via log.js.
 * - Logging policy: Use INFO for user actions, DEBUG for updates, ERROR for UI problems.
 * - ES module only: no globals, no window.*.
 * - TRACE-level logging for all function entry/exit (diagnostic).
 * -----------------------------------------------------------
 */

import { AppState, subscribe } from './state.js';
import { setSelectedShape } from './selection.js';
import { log } from './log.js';
import { Tabulator } from 'tabulator-tables';

/**
 * Build the sidebar panel (Tabulator shape table).
 */
export function buildSidebarPanel(rootElement, container) {
  log("TRACE", "[sidebar] buildSidebarPanel entry", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });

  try {
    log("INFO", "[sidebar] buildSidebarPanel called (Tabulator shape table)", {
      rootElementType: rootElement?.tagName,
      containerTitle: container?.title,
      containerComponentName: container?.componentName
    });

    // Render container for Tabulator
    rootElement.innerHTML = `
      <div id="sidebar-panel-container" style="width:100%;height:100%;background:#f4f8ff;display:flex;flex-direction:column;overflow:auto;">
        <div style="padding:10px 8px 4px 8px;font-weight:bold;font-size:1.2em;color:#0057d8;">
          Shape List
        </div>
        <div id="tabulator-table-div" style="flex:1 1 0;overflow:auto;"></div>
      </div>
    `;

    const tableDiv = rootElement.querySelector('#tabulator-table-div');
    if (!tableDiv) {
      log("ERROR", "[sidebar] tabulator-table-div not found in DOM");
      return;
    }

    // Helper: Convert shape to row object
    function shapeToRow(shape, idx) {
      let { _label, _type, locked } = shape;
      let x = 0, y = 0, w = "", h = "";
      if (_type === "rect") {
        x = Math.round(shape.x());
        y = Math.round(shape.y());
        w = Math.round(shape.width());
        h = Math.round(shape.height());
      } else if (_type === "circle") {
        x = Math.round(shape.x());
        y = Math.round(shape.y());
        w = Math.round(shape.radius());
        h = Math.round(shape.radius());
      } else if (_type === "point") {
        x = Math.round(shape.x());
        y = Math.round(shape.y());
        w = "";
        h = "";
      }
      return {
        idx,
        label: _label || "",
        type: _type,
        x,
        y,
        w,
        h,
        locked: locked ? "🔒" : ""
      };
    }

    // Initial data
    let tableData = (AppState.shapes || []).map((s, i) => shapeToRow(s, i));

    // Tabulator setup
    let tabulator = new Tabulator(tableDiv, {
      data: tableData,
      layout: "fitColumns",
      movableColumns: false,
      height: "100%",
      columns: [
        { title: "Label", field: "label", widthGrow: 2 },
        { title: "Type", field: "type", widthGrow: 1 },
        { title: "X", field: "x", width: 54, hozAlign: "right" },
        { title: "Y", field: "y", width: 54, hozAlign: "right" },
        { title: "W", field: "w", width: 54, hozAlign: "right" },
        { title: "H", field: "h", width: 54, hozAlign: "right" },
        { title: "Lock", field: "locked", width: 48, hozAlign: "center" }
      ],
      selectable: 1,
      rowClick: function (e, row) {
        const idx = row.getData().idx;
        log("INFO", "[sidebar] Row clicked", { idx, shape: AppState.shapes[idx] });
        if (AppState.shapes[idx]) {
          setSelectedShape(AppState.shapes[idx]);
        }
      }
    });

    // Subscribe to AppState for live updates
    const updateTable = () => {
      log("TRACE", "[sidebar] AppState update triggered (Tabulator)");
      const data = (AppState.shapes || []).map((s, i) => shapeToRow(s, i));
      tabulator.replaceData(data);
      // Reselect row if one is selected in AppState
      if (AppState.selectedShape) {
        const selIdx = AppState.shapes.indexOf(AppState.selectedShape);
        if (selIdx >= 0) tabulator.selectRow(selIdx);
      } else {
        tabulator.deselectRow();
      }
    };
    const unsub = subscribe(updateTable);

    // Clean up on destroy
    if (container && typeof container.on === "function") {
      container.on("destroy", () => {
        log("TRACE", "[sidebar] panel destroy event (Tabulator)");
        unsub && unsub();
        tabulator.destroy();
      });
    }

    // Initial update
    updateTable();

    log("INFO", "[sidebar] Sidebar panel fully initialized (Tabulator shape table)");
  } catch (e) {
    log("ERROR", "[sidebar] buildSidebarPanel ERROR (Tabulator)", e);
    alert("SidebarPanel ERROR: " + e.message);
    log("TRACE", "[sidebar] buildSidebarPanel exit (error, Tabulator)");
    throw e;
  }

  log("TRACE", "[sidebar] buildSidebarPanel exit (Tabulator)", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    containerComponentName: container?.componentName
  });
}
