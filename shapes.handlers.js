// COPILOT_PART_handlers: 2025-09-12T10:07:00Z
/*********************************************************
 * [handlers] UI Event Handler Attachment
 * ------------------------------------------------------
 * Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
 * Centralizes event handler logic for maintainability.
 * Ensures handlers are attached only after the DOM is fully constructed
 * (including dynamically generated panels).
 * Adheres to project logging schema and manifesto (see COPILOT_MANIFESTO.md).
 *********************************************************/

// Logging helpers (module tag: [handlers])
function handlers_log(level, ...args) {
  if (typeof window._externalLogStream === "function") {
    window._externalLogStream(level, "[handlers]", ...args);
  } else if (window.console && window.console.log) {
    window.console.log("[handlers]", level, ...args);
  }
}
function handlers_logEnter(fn, ...a) { handlers_log("TRACE", `>> Enter ${fn}`, ...a); }
function handlers_logExit(fn, ...r) { handlers_log("TRACE", `<< Exit ${fn}`, ...r); }

(function attachToolbarHandlers() {
  handlers_logEnter("attachToolbarHandlers");
  // Only attach after DOM and Golden Layout panels are ready
  function safeAttach() {
    handlers_logEnter("safeAttach");

    // Wait for window._sceneDesigner (created by CanvasPanel)
    if (!window._sceneDesigner || typeof window._sceneDesigner.addShapeFromToolbar !== "function") {
      handlers_log("DEBUG", "Waiting for _sceneDesigner.addShapeFromToolbar...");
      setTimeout(safeAttach, 120);
      handlers_logExit("safeAttach (not ready)");
      return;
    }

    // Reference to shared AppState
    const AppState = window._sceneDesigner;

    // Toolbar controls
    const newBtn = document.getElementById("newBtn");
    const duplicateBtn = document.getElementById("duplicateBtn");
    const deleteBtn = document.getElementById("deleteBtn");
    const resetRotationBtn = document.getElementById("resetRotationBtn");
    const selectAllBtn = document.getElementById("selectAllBtn");
    const shapeTypeSelect = document.getElementById("shapeType");

    // Defensive: Ensure all exist
    if (!newBtn || !shapeTypeSelect) {
      handlers_log("ERROR", "Toolbar controls not found");
      handlers_logExit("safeAttach (missing controls)");
      return;
    }

    // ADD button
    newBtn.onclick = function (e) {
      handlers_logEnter("newBtn.onclick", e);
      if (typeof AppState.addShapeFromToolbar === "function") {
        handlers_log("TRACE", "Add button clicked. Shape type:", shapeTypeSelect.value);
        AppState.addShapeFromToolbar();
      } else {
        handlers_log("ERROR", "AppState.addShapeFromToolbar not defined");
      }
      handlers_logExit("newBtn.onclick");
    };

    // DUPLICATE button (placeholder, to be implemented)
    if (duplicateBtn) {
      duplicateBtn.onclick = function (e) {
        handlers_log("TRACE", "Duplicate button clicked. TODO: implement shape duplication.");
        // TODO: implement duplication as a function in AppState and call here
      };
    }

    // DELETE button (placeholder, to be implemented)
    if (deleteBtn) {
      deleteBtn.onclick = function (e) {
        handlers_log("TRACE", "Delete button clicked. TODO: implement shape deletion.");
        // TODO: implement deletion as a function in AppState and call here
      };
    }

    // RESET ROTATION button (placeholder, to be implemented)
    if (resetRotationBtn) {
      resetRotationBtn.onclick = function (e) {
        handlers_log("TRACE", "Reset Rotation button clicked. TODO: implement reset rotation.");
        // TODO: implement rotation reset as a function in AppState and call here
      };
    }

    // SELECT ALL button (optional: implemented in shapes.multiselect.js)
    if (selectAllBtn) {
      selectAllBtn.onclick = function (e) {
        handlers_log("TRACE", "Select All button clicked.");
        if (AppState._multiSelect && typeof AppState._multiSelect.selectAllShapes === "function") {
          AppState._multiSelect.selectAllShapes();
        } else if (Array.isArray(AppState.shapes)) {
          AppState.selectedShapes = AppState.shapes.slice();
          handlers_log("DEBUG", "Selected all shapes (fallback)");
        }
      };
    }

    // For debugging: mark handlers as attached
    window._toolbarHandlersAttached = true;
    handlers_log("INFO", "Toolbar event handlers attached.");
    handlers_logExit("safeAttach");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeAttach);
  } else {
    setTimeout(safeAttach, 0);
  }
  handlers_logExit("attachToolbarHandlers");
})();
