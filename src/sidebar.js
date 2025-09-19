/**
 * sidebar.js
 * -----------------------------------------------------------
 * Shape Table/List Panel for Scene Designer (Fabric.js, Zustand Migration, Tabulator v6.x)
 * - Tabulator-based shape table (ESM only, no globals).
 * - Displays a live-updating table of all shapes in store.shapes (Fabric.js objects).
 * - Columns: Label, Type, X, Y, W, H, Lock status.
 * - Clicking a row selects the corresponding shape (single selection for now).
 * - All state via Zustand store.
 * - Logging via log.js.
 * - TRACE-level logging for all key entry/exit, table update, selection, and row events.
 * - Refactored for Tabulator v6.x (Full build), with proper row selection API.
 * - MiniLayout API: panel factory accepts single object argument ({ element, title, componentName }).
 * -----------------------------------------------------------
 */

import {
  getState,
  setSelectedShape,
  sceneDesignerStore,
} from './state.js';
import { log } from './log.js';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

/**
 * Utility: Dump store.shapes array for diagnostics.
 */
function dumpShapeStore(tag = "") {
  const shapes = getState().shapes;
  log("TRACE", `[sidebar][${tag}] store.shapes:`,
    Array.isArray(shapes)
      ? shapes.map((s, i) => ({
          idx: i,
          type: s?._type,
          label: s?._label,
          id: s?._id,
          locked: s?.locked
        }))
      : shapes
  );
}

/**
 * Build the sidebar panel (Tabulator shape table).
 * MiniLayout-compliant: accepts { element, title, componentName }.
 */
export function buildSidebarPanel({ element, title, componentName }) {
  log("TRACE", "[sidebar] buildSidebarPanel ENTRY", {
    elementType: element?.tagName,
    title,
    componentName
  });

  try {
    log("INFO", "[sidebar] buildSidebarPanel called (Tabulator shape table)", {
      elementType: element?.tagName,
      title,
      componentName
    });

    // Render container for Tabulator
    element.innerHTML = `
      <div id="sidebar-panel-container" style="width:100%;height:100%;background:#f4f8ff;display:flex;flex-direction:column;overflow:auto;">
        <div style="padding:10px 8px 4px 8px;font-weight:bold;font-size:1.2em;color:#0057d8;">
          Shape List
        </div>
        <div id="tabulator-table-div" style="flex:1 1 0;overflow:auto;"></div>
      </div>
    `;

    const tableDiv = element.querySelector('#tabulator-table-div');
    if (!tableDiv) {
      log("ERROR", "[sidebar] tabulator-table-div not found in DOM");
      return;
    }

    function shapeToRow(shape, idx) {
      let { _label, _type, locked, _id } = shape;
      let x = 0, y = 0, w = "", h = "";
      if (_type === "rect") {
        x = Math.round(shape.left ?? shape.x ?? 0);
        y = Math.round(shape.top ?? shape.y ?? 0);
        w = Math.round(shape.width ?? shape.width ?? 0);
        h = Math.round(shape.height ?? shape.height ?? 0);
      } else if (_type === "circle") {
        x = Math.round(shape.left ?? shape.x ?? 0);
        y = Math.round(shape.top ?? shape.y ?? 0);
        w = Math.round(shape.radius ?? shape.radius ?? 0);
        h = Math.round(shape.radius ?? shape.radius ?? 0);
      } else if (_type === "point") {
        x = Math.round(shape.left ?? shape.x ?? 0);
        y = Math.round(shape.top ?? shape.y ?? 0);
        w = "";
        h = "";
      }
      return {
        idx,
        id: _id || `shape_${idx}`,
        label: _label || "",
        type: _type,
        x,
        y,
        w,
        h,
        locked: locked ? "🔒" : ""
      };
    }

    log("DEBUG", "[sidebar] Instantiating Tabulator table", { tableDiv });

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
      // Use rowClick to select shape
      rowClick: function (e, row) {
        log("TRACE", "[sidebar] rowClick handler FIRED", {
          eventType: e.type,
          idx: row.getData().idx,
          id: row.getData().id,
          shape: getState().shapes[row.getData().idx],
          rowData: row.getData()
        });
        dumpShapeStore("rowClick");
        const idx = row.getData().idx;
        if (getState().shapes[idx]) {
          setSelectedShape(getState().shapes[idx]);
          log("INFO", "[sidebar] Shape selected via rowClick", {
            selectedShapeLabel: getState().shapes[idx]._label,
            selectedShapeType: getState().shapes[idx]._type,
            id: getState().shapes[idx]._id
          });
        } else {
          log("WARN", "[sidebar] rowClick: No shape found at idx", { idx, shape: getState().shapes[idx] });
        }
      }
    });

    // --- Robust updateTable: syncs selection and shape rows ---
    const updateTable = () => {
      log("TRACE", "[sidebar] updateTable ENTRY");
      dumpShapeStore("updateTable-top");
      const data = (getState().shapes || []).map((s, i) => shapeToRow(s, i));
      log("DEBUG", "[sidebar] updateTable: computed table data", { data });
      tabulator.replaceData(data);

      // Selection sync: ensure selected row is highlighted
      if (getState().selectedShape) {
        const selectedShape = getState().selectedShape;
        let foundRow = null;
        // Try to find row by unique id
        if (selectedShape._id) {
          foundRow = tabulator.getRow(selectedShape._id);
        }
        // Fallback: try by idx
        if (!foundRow) {
          const selIdx = getState().shapes.indexOf(selectedShape);
          let rows = tabulator.getRows ? tabulator.getRows() : [];
          foundRow = rows[selIdx];
        }
        if (foundRow && typeof foundRow.select === "function") {
          foundRow.select();
          log("DEBUG", "[sidebar] updateTable: Row selected", {
            selectedShapeLabel: selectedShape._label,
            id: selectedShape._id
          });
        } else {
          log("WARN", "[sidebar] updateTable: Cannot select row by id or idx", {
            selectedShapeLabel: selectedShape._label,
            id: selectedShape._id
          });
        }
      } else {
        // Clear all selection
        let rows = tabulator.getRows ? tabulator.getRows() : [];
        rows.forEach(r => {
          if (typeof r.deselect === "function") r.deselect();
        });
        log("DEBUG", "[sidebar] updateTable: All rows deselected");
      }
      dumpShapeStore("updateTable-bottom");
      log("TRACE", "[sidebar] updateTable EXIT");
    };

    tabulator.on("tableBuilt", () => {
      log("TRACE", "[sidebar] Tabulator tableBuilt event");
      dumpShapeStore("tableBuilt");
      updateTable();
      // Subscribe after built to avoid early calls
      var unsub = sceneDesignerStore.subscribe(updateTable);
      log("TRACE", "[sidebar] subscribe() after tableBuilt", { unsub });
      // Clean up on destroy
      // MiniLayout: container may provide an on("destroy") API for panel cleanup.
      if (typeof element.on === "function") {
        element.on("destroy", () => {
          unsub && unsub();
          tabulator.destroy();
          log("INFO", "[sidebar] Sidebar panel destroyed");
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
    elementType: element?.tagName,
    title,
    componentName
  });
}
