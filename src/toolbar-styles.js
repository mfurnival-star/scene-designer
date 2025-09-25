import { log } from './log.js';

export function ensureToolbarStylesInjected() {
  if (typeof document === "undefined") return;
  if (document.getElementById("scene-designer-toolbar-style")) {
    log("DEBUG", "[toolbar-styles] Styles already injected");
    return;
  }

  const style = document.createElement("style");
  style.id = "scene-designer-toolbar-style";
  style.textContent = `
    #canvas-toolbar-container {
      width: 100%;
      background: linear-gradient(90deg, #f7faff 0%, #e6eaf9 100%);
      border-bottom: 1.5px solid #b8c6e6;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      gap: 10px;
      padding: 8px 12px;
      padding-right: 96px;
      box-shadow: 0 1.5px 6px -2px #b8c6e6;
      border-radius: 0 0 13px 13px;
      box-sizing: border-box;
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: calc(14px * var(--toolbar-ui-scale, 1));
      line-height: 1.2;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      position: relative;
    }

    .toolbar-settings-toggle {
      position: absolute;
      top: 8px;
      right: 12px;
      z-index: 5;
      white-space: nowrap;
    }

    .toolbar-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 14px;
      flex-wrap: nowrap;
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
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

    .toolbar-btn {
      font: inherit;
      color: #234;
      border: 1.2px solid #8ca6c6;
      background: #fff;
      border-radius: 7px;
      padding: 0.35em 0.75em;
      width: auto;
      min-width: 0;
      line-height: 1.2;
      outline: none;
      box-shadow: 0 1px 3px -1px #e3f0fa;
      transition: background 0.12s, box-shadow 0.11s, border-color 0.10s;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      white-space: nowrap;
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

    input[type="file"] {
      display: none;
    }

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

    .toolbar-input-number {
      font: inherit;
      color: #234;
      background: #fff;
      border: 1.2px solid #8ca6c6;
      border-radius: 7px;
      padding: 0.3em 0.55em;
      line-height: 1.2;
      min-width: 4.6em;
      width: 5.2em;
      box-sizing: border-box;
      outline: none;
      box-shadow: 0 1px 3px -1px #e3f0fa;
      transition: background 0.12s, box-shadow 0.11s, border-color 0.10s;
      text-align: right;
    }
    .toolbar-input-number:hover {
      background: #f8fbff;
      border-color: #2176ff;
      box-shadow: 0 2px 7px -2px #b8c6e6;
    }
    .toolbar-input-number:focus-visible {
      border-color: #2176ff;
      outline: 2px solid rgba(33,118,255,0.25);
      outline-offset: 2px;
    }
    .toolbar-input-number:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #f6f7fb;
    }
    .toolbar-input-number::-webkit-outer-spin-button,
    .toolbar-input-number::-webkit-inner-spin-button {
      height: auto;
    }
    .toolbar-input-number {
      -moz-appearance: textfield;
    }
    .toolbar-input-number::-webkit-outer-spin-button,
    .toolbar-input-number::-webkit-inner-spin-button {
      -webkit-appearance: inner-spin-button;
      margin: 0;
    }

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

    .pickr-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0.35em 0.6em;
      min-width: 44px;
      position: relative;
    }

    .pickr-btn.pcr-button {
      border: 1.2px solid #8ca6c6;
      border-radius: 7px;
      box-shadow: 0 1px 3px -1px #e3f0fa;
    }

    .pickr-btn .pcr-button {
      width: 26px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid rgba(0,0,0,0.18);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
      padding: 0;
    }

    .pickr-btn:focus-visible,
    .pickr-btn.pcr-button:focus-visible {
      outline: 2px solid #2176ff;
      outline-offset: 2px;
    }

    .pickr-btn:hover {
      background: #eaf2fc;
      border-color: #2176ff;
      box-shadow: 0 2px 7px -2px #b8c6e6;
    }

    #toolbar-color-group .toolbar-label {
      margin-left: 2px;
      margin-right: 2px;
    }

    #toolbar-color-group {
      gap: 6px;
    }

    @media (max-width: 1100px) {
      .toolbar-row {
        flex-wrap: wrap;
        gap: 10px;
      }
    }

    @media (max-width: 900px) {
      #canvas-toolbar-container {
        padding: 6px 8px;
        padding-right: 88px;
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
      .toolbar-input-number {
        min-width: 4.2em;
        width: 4.8em;
        padding: 0.28em 0.5em;
      }
      .toolbar-settings-toggle {
        top: 6px;
        right: 8px;
      }
    }
  `;
  document.head.appendChild(style);
  log("INFO", "[toolbar-styles] Styles injected");
}
