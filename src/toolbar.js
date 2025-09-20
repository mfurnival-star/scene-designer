/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Modular Toolbar UI Factory (Delete/Duplicate/Lock/Unlock/Select All wired)
 * - Ensures Delete button and other action buttons sync with selection/state.
 * - Attaches click handlers directly to buttons after every render.
 * - Always queries fresh DOM reference for button state updates.
 * - Emits actions to actions.js and selection.js only (no business logic here).
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import { getState, setImage, sceneDesignerStore } from './state.js';
import {
  addShapeOfType,
  deleteSelectedShapes,
  duplicateSelectedShapes,
  lockSelectedShapes,
  unlockSelectedShapes
} from './actions.js';
import { selectAllShapes } from './selection.js';

/**
 * Utility: Enable or disable a toolbar button by id.
 * Always re-query the button to avoid stale references.
 * @param {string} btnId - DOM id for the button
 * @param {boolean} enabled
 * @param {string} [disabledTitle] - Optional tooltip when disabled
 * @param {string} [enabledTitle] - Optional tooltip when enabled
 */
function setButtonEnabledById(btnId, enabled, disabledTitle, enabledTitle) {
  const btn = document.querySelector(`#${btnId}`);
  if (!btn) return;
  btn.disabled = !enabled;
  btn.setAttribute("aria-disabled", !enabled ? "true" : "false");
  if (!enabled) {
    btn.classList.add("disabled");
    if (disabledTitle) btn.title = disabledTitle;
  } else {
    btn.classList.remove("disabled");
    if (enabledTitle) btn.title = enabledTitle;
  }
  log("DEBUG", "[toolbar] setButtonEnabledById", {
    btnId,
    enabled,
    btnDisabled: btn.disabled,
    classList: btn.className,
    ariaDisabled: btn.getAttribute("aria-disabled"),
    title: btn.title
  });
}

/**
 * Build the canvas toolbar panel.
 * - All UI events are handled here.
 * - Enhanced styling: grouped controls, strict alignment, uniform height, padding, flexbox balance.
 * - Toolbar UI Scale slider live-controls size.
 * - MiniLayout compliance: accepts { element, title, componentName }.
 */
export function buildCanvasToolbarPanel({ element, title, componentName }) {
  log("TRACE", "[toolbar] buildCanvasToolbarPanel entry", {
    elementType: element?.tagName,
    title,
    componentName
  });

  // Inject compact, single-row, scalable toolbar styles (once per document)
  if (typeof document !== "undefined" && !document.getElementById("scene-designer-toolbar-style")) {
    const style = document.createElement("style");
    style.id = "scene-designer-toolbar-style";
    style.textContent = `
      #canvas-toolbar-container {
        width: 100%;
        min-height: 44px;
        background: linear-gradient(90deg, #f7faff 0%, #e6eaf9 100%);
        border-bottom: 1.5px solid #b8c6e6;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: flex-start;
        gap: 14px;
        padding: 6px 12px 6px 12px;
        box-shadow: 0 1.5px 6px -2px #b8c6e6;
        border-radius: 0 0 13px 13px;
        box-sizing: border-box;
        overflow-x: auto;
        font-size: calc(1em * var(--toolbar-ui-scale, 1));
        transform: scale(var(--toolbar-ui-scale, 1));
        transform-origin: top left;
      }
      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 7px;
        border-radius: 8px;
        background: #f3f6fe;
        padding: 3px 6px;
        box-shadow: 0 1px 6px -4px #2176ff;
        margin: 0;
        height: 38px;
        box-sizing: border-box;
      }
      .toolbar-label {
        font-size: 1em;
        color: #345;
        font-weight: 600;
        margin-right: 6px;
        margin-left: 6px;
        height: 34px;
        display: flex;
        align-items: center;
      }
      .toolbar-btn,
      #canvas-toolbar-container select,
      label[for="toolbar-image-upload"] {
        font-size: 1em;
        font-family: inherit;
        border: 1.2px solid #8ca6c6;
        background: #fff;
        color: #234;
        border-radius: 7px;
        padding: 0 11px;
        min-width: 62px;
        height: 32px;
        line-height: 32px;
        outline: none;
        box-shadow: 0 1px 3px -1px #e3f0fa;
        transition: background 0.12s, box-shadow 0.11s, border-color 0.10s;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .toolbar-btn > svg,
      .toolbar-btn > span,
      #canvas-toolbar-container select > option {
        vertical-align: middle;
      }
      .toolbar-btn:hover,
      label[for="toolbar-image-upload"]:hover,
      #canvas-toolbar-container select:hover {
        background: #eaf2fc;
        border-color: #2176ff;
        box-shadow: 0 2px 7px -2px #b8c6e6;
      }
      .toolbar-btn.disabled,
      .toolbar-btn[aria-disabled="true"] {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
      }
      input[type="file"] {
        display: none;
      }
      @media (max-width: 900px) {
        #canvas-toolbar-container {
          padding: 3px 4px 3px 4px;
          gap: 6px;
          min-height: 28px;
          font-size: calc(0.85em * var(--toolbar-ui-scale, 1));
        }
        .toolbar-group {
          padding: 2px 3px;
          gap: 4px;
          height: 26px;
        }
        .toolbar-btn,
        #canvas-toolbar-container select,
        label[for="toolbar-image-upload"] {
          font-size: 0.93em;
          height: 20px;
          line-height: 20px;
          min-width: 41px;
          padding: 0 5px;
        }
        .toolbar-label {
          font-size: 0.89em;
          height: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  try {
    log("INFO", "[toolbar] buildCanvasToolbarPanel called", {
      elementType: element?.tagName,
      title,
      componentName
    });

    // Strictly aligned, compact, single-row toolbar HTML
    element.innerHTML = `
      <div id="canvas-toolbar-container">
        <div class="toolbar-group">
          <label for="toolbar-image-upload" class="toolbar-btn" title="Upload image">Upload Image</label>
          <input type="file" id="toolbar-image-upload" accept="image/*">
          <select id="toolbar-server-image-select" class="toolbar-btn" title="Choose server image">
            <option value="">[Server image]</option>
            <option value="sample1.png">sample1.png</option>
            <option value="sample2.png">sample2.png</option>
          </select>
        </div>
        <div class="toolbar-group">
          <span class="toolbar-label">Shape:</span>
          <select id="toolbar-shape-type-select" class="toolbar-btn">
            <option value="point">Point</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
          </select>
          <button id="toolbar-add-shape-btn" class="toolbar-btn" title="Add shape">
            <span style="font-size:1em;margin-right:3px;">&#x2795;</span> Add
          </button>
          <button id="toolbar-delete-shape-btn" class="toolbar-btn" title="Delete selected shape(s)">
            <span style="font-size:1em;margin-right:3px;">&#x1F5D1;</span> Delete
          </button>
          <button id="toolbar-duplicate-shape-btn" class="toolbar-btn" title="Duplicate selected shape(s)">Duplicate</button>
          <button id="toolbar-select-all-btn" class="toolbar-btn" title="Select all shapes">Select All</button>
          <button id="toolbar-lock-btn" class="toolbar-btn" title="Lock selected shape(s)">Lock</button>
          <button id="toolbar-unlock-btn" class="toolbar-btn" title="Unlock selected shape(s)">Unlock</button>
        </div>
      </div>
    ";

    // Query toolbar elements
    const container = element.querySelector('#canvas-toolbar-container');
    const imageUploadInput = element.querySelector('#toolbar-image-upload');
    const imageUploadLabel = element.querySelector('label[for="toolbar-image-upload"]');
    const serverImageSelect = element.querySelector('#toolbar-server-image-select');
    const shapeTypeSelect = element.querySelector('#toolbar-shape-type-select');
    const addShapeBtn = element.querySelector('#toolbar-add-shape-btn');
    const deleteBtn = element.querySelector('#toolbar-delete-shape-btn');
    const duplicateBtn = element.querySelector('#toolbar-duplicate-shape-btn');
    const selectAllBtn = element.querySelector('#toolbar-select-all-btn');
    const lockBtn = element.querySelector('#toolbar-lock-btn');
    const unlockBtn = element.querySelector('#toolbar-unlock-btn');

    // --- Toolbar UI Scale live update support ---
    const updateToolbarScale = () => {
      const scale = getState().settings?.toolbarUIScale ?? 1;
      container.style.setProperty('--toolbar-ui-scale', scale);
    };
    updateToolbarScale();

    // Subscribe to settings changes for live toolbar scaling
    sceneDesignerStore.subscribe((state, details) => {
      if (
        details &&
        (details.type === "setSetting" || details.type === "setSettings") &&
        (
          details.key === "toolbarUIScale" ||
          (details.settings && "toolbarUIScale" in details.settings)
        )
      ) {
        updateToolbarScale();
      }
    });

    // --- IMAGE UPLOAD ---
    imageUploadLabel.addEventListener('click', (e) => {
      imageUploadInput.value = ""; // Clear previous file, so no filename shows
      imageUploadInput.click();
    });
    imageUploadInput.addEventListener('change', function (e) {
      log("INFO", "[toolbar] Image upload changed", e);
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new window.FileReader();
      reader.onload = function (ev) {
        const imgObj = new window.Image();
        imgObj.onload = function () {
          setImage(ev.target.result, imgObj);
          log("INFO", "[toolbar] Image loaded and set via setImage (upload)", { url: ev.target.result });
        };
        imgObj.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      // Clear server select
      if (serverImageSelect) serverImageSelect.value = "";
    });

    // --- SERVER IMAGE SELECT ---
    serverImageSelect.addEventListener('change', function (e) {
      log("INFO", "[toolbar] Server image select changed", e);
      const filename = e.target.value;
      if (!filename) {
        setImage(null, null);
        return;
      }
      const imgObj = new window.Image();
      imgObj.onload = function () {
        setImage('./images/' + filename, imgObj);
        log("INFO", "[toolbar] Server image loaded and set via setImage", { url: './images/' + filename });
      };
      imgObj.src = './images/' + filename;
      // Clear file upload
      if (imageUploadInput) imageUploadInput.value = "";
    });

    // --- ADD SHAPE BUTTON ---
    addShapeBtn.addEventListener('click', () => {
      const type = shapeTypeSelect.value;
      addShapeOfType(type);
      log("INFO", `[toolbar] Add shape intent emitted`, { type });
    });

    // --- DELETE SHAPE BUTTON ---
    function handleDeleteClick(ev) {
      if (!deleteBtn || deleteBtn.disabled) {
        log("WARN", "[toolbar] Delete button clicked while disabled – ignoring");
        ev && ev.preventDefault && ev.preventDefault();
        return;
      }
      log("INFO", "[toolbar] Delete button clicked");
      deleteSelectedShapes();
    }
    function attachDeleteButtonHandler() {
      if (deleteBtn) {
        deleteBtn.removeEventListener('click', handleDeleteClick);
        deleteBtn.addEventListener('click', handleDeleteClick);
      }
    }

    // --- DUPLICATE BUTTON ---
    function handleDuplicateClick(ev) {
      if (!duplicateBtn || duplicateBtn.disabled) {
        log("WARN", "[toolbar] Duplicate button clicked while disabled – ignoring");
        ev && ev.preventDefault && ev.preventDefault();
        return;
      }
      log("INFO", "[toolbar] Duplicate button clicked");
      duplicateSelectedShapes();
    }
    function attachDuplicateButtonHandler() {
      if (duplicateBtn) {
        duplicateBtn.removeEventListener('click', handleDuplicateClick);
        duplicateBtn.addEventListener('click', handleDuplicateClick);
      }
    }

    // --- SELECT ALL BUTTON ---
    function handleSelectAllClick(ev) {
      if (!selectAllBtn || selectAllBtn.disabled) {
        log("WARN", "[toolbar] Select All clicked while disabled – ignoring");
        ev && ev.preventDefault && ev.preventDefault();
        return;
      }
      log("INFO", "[toolbar] Select All clicked");
      selectAllShapes();
    }
    function attachSelectAllHandler() {
      if (selectAllBtn) {
        selectAllBtn.removeEventListener('click', handleSelectAllClick);
        selectAllBtn.addEventListener('click', handleSelectAllClick);
      }
    }

    // --- LOCK/UNLOCK BUTTONS ---
    function handleLockClick(ev) {
      if (!lockBtn || lockBtn.disabled) {
        log("WARN", "[toolbar] Lock clicked while disabled – ignoring");
        ev && ev.preventDefault && ev.preventDefault();
        return;
      }
      log("INFO", "[toolbar] Lock clicked");
      lockSelectedShapes();
    }
    function handleUnlockClick(ev) {
      if (!unlockBtn || unlockBtn.disabled) {
        log("WARN", "[toolbar] Unlock clicked while disabled – ignoring");
        ev && ev.preventDefault && ev.preventDefault();
        return;
      }
      log("INFO", "[toolbar] Unlock clicked");
      unlockSelectedShapes(); // Handles: unlock selected OR all locked if none selected
    }
    function attachLockUnlockHandlers() {
      if (lockBtn) {
        lockBtn.removeEventListener('click', handleLockClick);
        lockBtn.addEventListener('click', handleLockClick);
      }
      if (unlockBtn) {
        unlockBtn.removeEventListener('click', handleUnlockClick);
        unlockBtn.addEventListener('click', handleUnlockClick);
      }
    }

    // --- Enable/disable buttons based on selection and shapes in store ---
    function updateButtonsState() {
      const selected = getState().selectedShapes || [];
      const selectedCount = selected.length;
      const shapes = (getState().shapes || []);
      const shapesCount = shapes.length;

      // Derive lock states
      const anyUnlockedSelected = selected.some(s => !s.locked);
      const anyLockedSelected = selected.some(s => s.locked);
      const anyLockedInStore = shapes.some(s => s.locked);

      // Delete
      setButtonEnabledById('toolbar-delete-shape-btn', selectedCount > 0, "Select a shape to delete", "Delete selected shape(s)");
      attachDeleteButtonHandler();

      // Duplicate
      setButtonEnabledById('toolbar-duplicate-shape-btn', selectedCount > 0, "Select shape(s) to duplicate", "Duplicate selected shape(s)");
      attachDuplicateButtonHandler();

      // Select All (enabled if there is at least one shape)
      setButtonEnabledById('toolbar-select-all-btn', shapesCount > 0, "No shapes to select", "Select all shapes");
      attachSelectAllHandler();

      // Lock
      setButtonEnabledById(
        'toolbar-lock-btn',
        selectedCount > 0 && anyUnlockedSelected,
        "Select unlocked shape(s) to lock",
        "Lock selected shape(s)"
      );

      // Unlock:
      // - Enabled if there are selected locked shapes
      // - OR if nothing is selected but there is at least one locked shape in the scene
      const unlockEnabled = (selectedCount > 0 && anyLockedSelected) || (selectedCount === 0 && anyLockedInStore);
      const unlockEnabledTitle = (selectedCount > 0 && anyLockedSelected)
        ? "Unlock selected shape(s)"
        : "Unlock all locked shapes";
      const unlockDisabledTitle = "No locked shapes";
      setButtonEnabledById('toolbar-unlock-btn', unlockEnabled, unlockDisabledTitle, unlockEnabledTitle);
      attachLockUnlockHandlers();

      log("DEBUG", "[toolbar] updateButtonsState", {
        selectedCount,
        shapesCount,
        anyUnlockedSelected,
        anyLockedSelected,
        anyLockedInStore,
        unlockEnabled,
        unlockEnabledTitle
      });
    }

    // Initial state
    updateButtonsState();

    // Subscribe to ALL state changes (no filter!) for selection/lock/shapes changes
    sceneDesignerStore.subscribe(() => {
      updateButtonsState();
    });

    log("INFO", "[toolbar] Toolbar panel initialized (Add/Delete/Duplicate/Select All/Lock/Unlock wired)");

  } catch (e) {
    log("ERROR", "[toolbar] buildCanvasToolbarPanel ERROR", e);
    alert("ToolbarPanel ERROR: " + e.message);
    throw e;
  }

  log("TRACE", "[toolbar] buildCanvasToolbarPanel exit", {
    elementType: element?.tagName,
    title,
    componentName
  });
}
