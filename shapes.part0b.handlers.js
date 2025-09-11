// COPILOT_PART_0B: 2025-09-11T14:15:00Z
/*********************************************************
 * PART 0B: UI Event Handler Attachment
 * ----------------------------------------
 * Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
 * Ensures handlers are wired only after the DOM is fully constructed (including Golden Layout panels).
 * All event handler logic is centralized here for maintainability.
 * - Should be loaded/concatenated immediately after shapes.part0.layout.js.
 *********************************************************/

(function() {
  // This function will be called after Golden Layout and all panel DOMs are ready.
  function attachToolbarHandlers() {
    // --- Add Shape ---
    const addBtn = document.getElementById("newBtn");
    if (addBtn) {
      addBtn.onclick = function(e) {
        e.preventDefault();
        // Use the exported addShapeFromToolbar if available
        if (window._sceneDesigner && typeof window._sceneDesigner.addShapeFromToolbar === "function") {
          window._sceneDesigner.addShapeFromToolbar();
        } else if (window._sceneDesigner && typeof window._sceneDesigner.makeReticlePointShape === "function") {
          // fallback: always add a point if generic addShapeFromToolbar is not defined
          window._sceneDesigner.makeReticlePointShape(100, 100);
        } else {
          alert("Shape creation function not found (modular code error)");
        }
      };
    }

    // --- Duplicate ---
    const duplicateBtn = document.getElementById("duplicateBtn");
    if (duplicateBtn) {
      duplicateBtn.onclick = function(e) {
        e.preventDefault();
        // Placeholder for future logic or custom handler.
      };
    }

    // --- Delete ---
    const deleteBtn = document.getElementById("deleteBtn");
    if (deleteBtn) {
      deleteBtn.onclick = function(e) {
        e.preventDefault();
        // Placeholder for future logic or custom handler.
      };
    }

    // --- Reset Rotation ---
    const resetRotationBtn = document.getElementById("resetRotationBtn");
    if (resetRotationBtn) {
      resetRotationBtn.onclick = function(e) {
        e.preventDefault();
        // Placeholder for future logic or custom handler.
      };
    }

    // --- Select All ---
    const selectAllBtn = document.getElementById("selectAllBtn");
    if (selectAllBtn) {
      selectAllBtn.onclick = function(e) {
        e.preventDefault();
        if (
          window._sceneDesigner &&
          window._sceneDesigner._multiSelect &&
          typeof window._sceneDesigner._multiSelect.selectAllShapes === "function"
        ) {
          window._sceneDesigner._multiSelect.selectAllShapes();
        }
      };
    }

    // --- Lock Checkbox ---
    const lockCheckbox = document.getElementById("lockCheckbox");
    if (lockCheckbox) {
      lockCheckbox.addEventListener("change", function(e) {
        if (
          window._sceneDesigner &&
          window._sceneDesigner._multiSelect &&
          typeof window._sceneDesigner._multiSelect.updateLockCheckboxUI === "function"
        ) {
          window._sceneDesigner._multiSelect.updateLockCheckboxUI();
        }
      });
    }

    // --- Align Select ---
    const alignSelect = document.getElementById("alignSelect");
    if (alignSelect) {
      alignSelect.onchange = function(e) {
        // Placeholder for align logic; actual implementation may be in part2b or future part.
      };
    }

    // --- Log: Handlers attached ---
    if (window.console) {
      console.log("[HANDLERS] Toolbar event handlers attached by shapes.part0b.handlers.js");
    }
  }

  // Register a global hook so layout can call this after DOM is ready
  window.onGoldenLayoutReady = function() {
    setTimeout(attachToolbarHandlers, 0);
  };
})();
