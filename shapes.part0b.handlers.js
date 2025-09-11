// COPILOT_PART_0B: 2025-09-11T15:05:00Z
/*********************************************************
 * PART 0B: UI Event Handler Attachment
 * ------------------------------------------------------
 * Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
 * Centralizes event handler logic for maintainability.
 * Ensures handlers are attached only after the DOM is fully constructed
 * (including dynamically generated panels).
 * Should be loaded/concatenated immediately after shapes.part0a.layout.js.
 *********************************************************/

// Logging helpers from part0a (assumed loaded before this part)
function part0b_log(level, ...args) { if (typeof log === "function") log(level, ...args); }
function part0b_logEnter(fn, ...a) { part0b_log("TRACE", `>> Enter ${fn}`, ...a); }
function part0b_logExit(fn, ...r) { part0b_log("TRACE", `<< Exit ${fn}`, ...r); }

(function attachToolbarHandlers() {
  part0b_logEnter("attachToolbarHandlers");
  // Only attach after DOM and Golden Layout panels are ready
  function safeAttach() {
    part0b_logEnter("safeAttach");

    // Wait for window._sceneDesigner (created by CanvasPanel)
    if (!window._sceneDesigner || typeof window._sceneDesigner.addShapeFromToolbar !== "function") {
      part0b_log("DEBUG", "Waiting for _sceneDesigner.addShapeFromToolbar...");
      setTimeout(safeAttach, 120);
      part0b_logExit("safeAttach (not ready)");
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
      part0b_log("ERROR", "Toolbar controls not found");
      part0b_logExit("safeAttach (missing controls)");
      return;
    }

    // ADD button
    newBtn.onclick = function (e) {
      part0b_logEnter("newBtn.onclick", e);
      if (typeof AppState.addShapeFromToolbar === "function") {
        part0b_log("TRACE", "Add button clicked. Shape type:", shapeTypeSelect.value);
        AppState.addShapeFromToolbar();
      } else {
        part0b_log("ERROR", "AppState.addShapeFromToolbar not defined");
      }
      part0b_logExit("newBtn.onclick");
    };

    // DUPLICATE button (placeholder, to be implemented)
    if (duplicateBtn) {
      duplicateBtn.onclick = function (e) {
        part0b_log("TRACE", "Duplicate button clicked. TODO: implement shape duplication.");
        // TODO: implement duplication as a function in AppState and call here
      };
    }

    // DELETE button (placeholder, to be implemented)
    if (deleteBtn) {
      deleteBtn.onclick = function (e) {
        part0b_log("TRACE", "Delete button clicked. TODO: implement shape deletion.");
        // TODO: implement deletion as a function in AppState and call here
      };
    }

    // RESET ROTATION button (placeholder, to be implemented)
    if (resetRotationBtn) {
      resetRotationBtn.onclick = function (e) {
        part0b_log("TRACE", "Reset Rotation button clicked. TODO: implement reset rotation.");
        // TODO: implement rotation reset as a function in AppState and call here
      };
    }

    // SELECT ALL button (optional: implemented in part2b.multiselect.js)
    if (selectAllBtn) {
      selectAllBtn.onclick = function (e) {
        part0b_log("TRACE", "Select All button clicked.");
        if (AppState._multiSelect && typeof AppState._multiSelect.selectAllShapes === "function") {
          AppState._multiSelect.selectAllShapes();
        } else if (Array.isArray(AppState.shapes)) {
          AppState.selectedShapes = AppState.shapes.slice();
          part0b_log("DEBUG", "Selected all shapes (fallback)");
        }
      };
    }

    // For debugging: mark handlers as attached
    window._toolbarHandlersAttached = true;
    part0b_log("INFO", "Toolbar event handlers attached.");
    part0b_logExit("safeAttach");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeAttach);
  } else {
    setTimeout(safeAttach, 0);
  }
  part0b_logExit("attachToolbarHandlers");
})();
