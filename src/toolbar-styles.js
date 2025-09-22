/**
 * toolbar-styles.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Styles Injector (ESM ONLY)
 * Purpose:
 * - Inject the toolbar CSS once per document.
 * - Two-row toolbar layout:
 *    - Row 1: Image controls + shape add + primary actions
 *    - Row 2: Edit actions + color pickers
 * - Buttons auto-size to content; scaling via font-size so widths reflow with scale.
 * - Includes styling for Pickr host buttons (stroke/fill color pickers).
 *
 * Public Exports:
 * - ensureToolbarStylesInjected()
 *
 * Dependencies:
 * - log.js (logging)
 * -----------------------------------------------------------
 */

import { log } from './log.js';

/**
 * Inject toolbar CSS if not already present.
 */
export function ensureToolbarStylesInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("scene-designer-toolbar-style")) {
    log("DEBUG", "[toolbar-styles] Styles already injected");
    return;
  }

  const style = document.createElement("style");
  style.id = "scene-designer-toolbar-style";
  style.textContent = `
    /* Root container: now a column with two rows to reduce horizontal scrolling */
    #canvas-toolbar-container {
      width: 100%;
      background: linear-gradient(90deg, #f7faff 0%, #e6eaf9 100%);
      border-bottom: 1.5px solid #b8c6e6;
      display: flex;
      flex-direction: column;      /* two rows stacked */
      align-items: stretch;
      justify-content: flex-start;
      gap: 10px;                   /* space between rows */
      padding: 8px 12px;           /* slightly taller for two rows */
      box-shadow: 0 1.5px 6px -2px #b8c6e6;
      border-radius: 0 0 13px 13px;
      box-sizing: border-box;

      /* Font and scale (no transform so widths reflow with content) */
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: calc(14px * var(--toolbar-ui-scale, 1));
      line-height: 1.2;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Each toolbar row is a horizontal flex lane of groups */
    .toolbar-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 14px;
      flex-wrap: nowrap;           /* preserve intended grouping per row */
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;            /* allow scroll when extremely narrow */
      overflow-y: visible;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 8px;
      background: #f3f6fe;
      padding: 4px 6px;
      box-shadow: 0 1px 6px -4px #2176ff;
      margin: 0;
      box-sizing: border-box;
      flex: 0 0 auto;
    }

    .toolbar-label {
      color: #345;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      padding: 0 4px;
      white-space: nowrap;
    }

    /* Base button-like control */
    .toolbar-btn {
      font: inherit;
      color: #234;
      border: 1.2px solid #8ca6c6;
      background: #fff;
      border-radius: 7px;

      /* Auto-size to content */
      padding: 0.35em 0.75em;
      width: auto;
      min-width: 0;

      /* No fixed height/line-height: let content and padding define it */
      line-height: 1.2;

      outline: none;
      box-shadow: 0 1px 3px -1px #e3f0fa;
      transition: background 0.12s, box-shadow 0.11s, border-color 0.10s;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      box-sizing: border-box;
      white-space: nowrap; /* prevent "Upload" and "Image" from wrapping */
    }

    .toolbar-btn > svg,
    .toolbar-btn > span {
      vertical-align: middle;
    }

    .toolbar-btn:hover,
    label[for="toolbar-image-upload"]:hover {
      background: #eaf2fc;
      border-color: #2176ff;
      box-shadow: 0 2px 7px -2px #b8c6e6;
    }

    .toolbar-btn.disabled,
    .toolbar-btn[aria-disabled="true"] {
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* File input is hidden; label acts as the button */
    input[type="file"] {
      display: none;
    }

    /* Selects: auto width to fit content, inline-block to respect intrinsic size */
    #canvas-toolbar-container select {
      font: inherit;
      color: #234;
      border: 1.2px solid #8ca6c6;
      background: #fff;
      border-radius: 7px;

      padding: 0.3em 0.6em;
      width: auto;
      min-width: 0;

      line-height: 1.2;
      display: inline-block;
      box-sizing: border-box;
      white-space: nowrap;
      cursor: pointer;
      outline: none;
      box-shadow: 0 1px 3px -1px #e3f0fa;
      transition: background 0.12s, box-shadow 0.11s, border-color 0.10s;
    }
    #canvas-toolbar-container select:hover {
      background: #eaf2fc;
      border-color: #2176ff;
      box-shadow: 0 2px 7px -2px #b8c6e6;
    }

    /* Upload label styled as button */
    label[for="toolbar-image-upload"] {
      font: inherit;
      color: #234;
      border: 1.2px solid #8ca6c6;
      background: #fff;
      border-radius: 7px;

      padding: 0.35em 0.75em;
      width: auto;
      min-width: 0;

      line-height: 1.2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: 0 1px 3px -1px #e3f0fa;
      transition: background 0.12s, box-shadow 0.11s, border-color 0.10s;
    }

    /* --- Pickr integration (host buttons) --- */

    /* Host button base (acts like a normal toolbar button) */
    .pickr-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0.35em 0.6em;
      min-width: 44px; /* comfortable hit area */
      position: relative;
    }

    /* When Pickr applies .pcr-button to the host element itself */
    .pickr-btn.pcr-button {
      border: 1.2px solid #8ca6c6;
      border-radius: 7px;
      box-shadow: 0 1px 3px -1px #e3f0fa;
    }

    /* If Pickr injects its own inner button element, style it */
    .pickr-btn .pcr-button {
      width: 26px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid rgba(0,0,0,0.18);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
      padding: 0;
    }

    /* Provide a subtle focus ring when Pickr host is focused */
    .pickr-btn:focus-visible,
    .pickr-btn.pcr-button:focus-visible {
      outline: 2px solid #2176ff;
      outline-offset: 2px;
    }

    /* Keep hover consistent with other buttons */
    .pickr-btn:hover {
      background: #eaf2fc;
      border-color: #2176ff;
      box-shadow: 0 2px 7px -2px #b8c6e6;
    }

    /* Label + pickr alignment in the color group */
    #toolbar-color-group .toolbar-label {
      margin-left: 2px;
      margin-right: 2px;
    }

    /* Responsive polish: allow rows to wrap under tight widths */
    @media (max-width: 1100px) {
      .toolbar-row {
        flex-wrap: wrap;           /* permit group wrap within each row on smaller screens */
        gap: 10px;
      }
    }

    @media (max-width: 900px) {
      #canvas-toolbar-container {
        padding: 6px 8px;
        gap: 8px;
        font-size: calc(13px * var(--toolbar-ui-scale, 1));
      }
      .toolbar-group {
        padding: 3px 4px;
        gap: 6px;
      }
      .toolbar-label {
        font-weight: 600;
      }
      .pickr-btn {
        min-width: 38px;
      }
      .pickr-btn .pcr-button {
        width: 22px;
        height: 16px;
      }
    }
  `;
  document.head.appendChild(style);
  log("INFO", "[toolbar-styles] Styles injected");
}

