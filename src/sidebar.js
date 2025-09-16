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
 * - TRACE-level logging for function entry/exit and row selection diagnostics.
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
  log("TRACE", "[sidebar] buildSidebarPanel ENTRY", {
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

    log("TRACE", "[sidebar] Instantiating Tabulator table", { tableDiv });
    let tabulator = new Tabulator(tableDiv, {
      data: [],
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
        log("DEBUG", "[sidebar] rowClick", {
          idx,
          shape: AppState.shapes[idx],
          rowData: row.getData()
        });
        if (AppState.shapes[idx]) {
          setSelectedShape(AppState.shapes[idx]);
          log("INFO", "[sidebar] Shape selected via rowClick", {
            selectedShapeId: AppState.shapes[idx]._id,
            selectedShapeType: AppState.shapes[idx]._type
          });
        } else {
          log("WARN", "[sidebar] rowClick: No shape found at idx", { idx, shape: AppState.shapes[idx] });
        }
      }
    });

    // --- Robust updateTable: syncs selection and shape rows ---
    const updateTable = () => {
      log("DEBUG", "[sidebar] updateTable ENTRY");
      const data = (AppState.shapes || []).map((s, i) => shapeToRow(s, i));
      tabulator.replaceData(data);
      // --- Selection sync: ensure selected row is highlighted ---
      if (AppState.selectedShape) {
        const selIdx = AppState.shapes.indexOf(AppState.selectedShape);
        let rows = tabulator.getRows ? tabulator.getRows() : [];
        if (selIdx >= 0 && rows[selIdx] && typeof rows[selIdx].select === "function") {
          rows[selIdx].select();
          log("DEBUG", "[sidebar] updateTable: Row selected", { selIdx });
        } else {
          log("WARN", "[sidebar] updateTable: Cannot select row", { selIdx });
        }
      } else {
        // Robustly clear all selection (Tabulator v5+)
        let rows = tabulator.getRows ? tabulator.getRows() : [];
        rows.forEach(r => {
          if (typeof r.deselect === "function") r.deselect();
        });
        log("DEBUG", "[sidebar] updateTable: All rows deselected");
      }
      log("DEBUG", "[sidebar] updateTable EXIT");
    };

    tabulator.on("tableBuilt", () => {
      log("TRACE", "[sidebar] tableBuilt event");
      updateTable();
      // Subscribe after built to avoid early calls
      var unsub = subscribe(updateTable);
      // Clean up on destroy
      if (container && typeof container.on === "function") {
        container.on("destroy", () => {
          log("TRACE", "[sidebar] panel destroy event (Tabulator)");
          unsub && unsub();
          tabulator.destroy();
        });
      }
    });

    log("INFO", "[sidebar] Sidebar panel fully initialized (Tabulator shape table)");
  } catch (e) {
    log("ERROR", "[sidebar] buildSidebarPanel ERROR (Tabulator)", e);
    alert("SidebarPanel ERROR: " + e.message);
    throw e;
  }

  log("TRACE", "[sidebar] buildSidebarPanel EXIT", {
    rootElementType: rootElement?.tagName,
    containerTitle: container?.title,
    componentName: container?.componentName
  });
}

