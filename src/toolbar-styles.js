/**
 * toolbar-styles.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Styles Injector (ESM ONLY)
 * Purpose:
 * - Inject the toolbar CSS once per document.
 * - Styles are designed so button widths auto-fit their text content and
 *   reflow naturally when the scale changes (no transform scaling).
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
    /* Container scales font-size with --toolbar-ui-scale and uses a clean font stack */
    #canvas-toolbar-container {
      width: 100%;
      background: linear-gradient(90deg, #f7faff 0%, #e6eaf9 100%);
      border-bottom: 1.5px solid #b8c6e6;
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-start;
      gap: 14px;
      padding: 6px 12px;
      box-shadow: 0 1.5px 6px -2px #b8c6e6;
      border-radius: 0 0 13px 13px;
      box-sizing: border-box;
      overflow-x: auto;

      /* Font and scale (no transform so widths reflow with content) */
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: calc(14px * var(--toolbar-ui-scale, 1));
      line-height: 1.2;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
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

    @media (max-width: 900px) {
      #canvas-toolbar-container {
        padding: 4px 6px;
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
    }
  `;
  document.head.appendChild(style);
  log("INFO", "[toolbar-styles] Styles injected");
}
