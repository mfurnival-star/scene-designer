/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar UI Element Factory (ESM only)
 * - Exports helpers to create modular, styled toolbar/button elements for use in panels.
 * - Supports: button, dropdown (select), Pickr color swatch, text input.
 * - All elements use consistent class names for easy styling.
 * - NO global variables, no window.*, fully ES module per Manifesto.
 * - All event handlers/logging must use scene-designer log.js.
 * - Dependencies: log.js, (optionally) Pickr (must be imported as ESM for color swatch).
 * -----------------------------------------------------------
 */

import { log } from './log.js';

// Helper: Create a toolbar button (icon is optional SVG/text HTML)
export function createToolbarButton({ id, label, icon = "", tooltip = "", onClick }) {
  log("TRACE", "[toolbar] createToolbarButton entry", { id, label });
  const btn = document.createElement('button');
  if (id) btn.id = id;
  btn.type = 'button';
  btn.className = 'sd-toolbar-btn';
  btn.innerHTML = icon ? `${icon} ${label}` : label;
  if (tooltip) btn.title = tooltip;
  if (typeof onClick === "function") {
    btn.addEventListener('click', onClick);
  }
  log("TRACE", "[toolbar] createToolbarButton exit", { id, label });
  return btn;
}

// Helper: Create a dropdown/select
export function createToolbarDropdown({ id, options = [], value = "", tooltip = "", onChange }) {
  log("TRACE", "[toolbar] createToolbarDropdown entry", { id, options });
  const select = document.createElement('select');
  if (id) select.id = id;
  select.className = 'sd-toolbar-dropdown';
  if (tooltip) select.title = tooltip;
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });
  if (value) select.value = value;
  if (typeof onChange === "function") {
    select.addEventListener('change', e => onChange(e.target.value, e));
  }
  log("TRACE", "[toolbar] createToolbarDropdown exit", { id, options });
  return select;
}

// Helper: Create a Pickr color swatch
export function createToolbarColorSwatch({ id, defaultColor = "#000000", tooltip = "", onChange, Pickr }) {
  log("TRACE", "[toolbar] createToolbarColorSwatch entry", { id, defaultColor });
  if (!Pickr) {
    log("ERROR", "[toolbar] Pickr not provided for color swatch");
    throw new Error("Pickr not provided for color swatch");
  }
  const swatchDiv = document.createElement('div');
  if (id) swatchDiv.id = id;
  swatchDiv.className = 'sd-toolbar-color-swatch';
  if (tooltip) swatchDiv.title = tooltip;

  // Instantiate Pickr (must be imported as ESM and passed in)
  const pickr = Pickr.create({
    el: swatchDiv,
    theme: 'monolith',
    default: defaultColor,
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: { hex: true, rgba: true, input: true }
    }
  });
  if (typeof onChange === "function") {
    pickr.on('change', color => {
      onChange(color.toHEXA().toString(), color);
    });
  }
  log("TRACE", "[toolbar] createToolbarColorSwatch exit", { id, defaultColor });
  return swatchDiv;
}

// Helper: Create a text input box
export function createToolbarTextInput({ id, value = "", placeholder = "", tooltip = "", onInput }) {
  log("TRACE", "[toolbar] createToolbarTextInput entry", { id, value });
  const input = document.createElement('input');
  if (id) input.id = id;
  input.type = 'text';
  input.className = 'sd-toolbar-text-input';
  input.value = value;
  if (placeholder) input.placeholder = placeholder;
  if (tooltip) input.title = tooltip;
  if (typeof onInput === "function") {
    input.addEventListener('input', e => onInput(e.target.value, e));
  }
  log("TRACE", "[toolbar] createToolbarTextInput exit", { id, value });
  return input;
}

// --- Toolbar CSS (inject a <style> block if not already present) ---
if (typeof document !== "undefined" && !document.getElementById('sd-toolbar-style')) {
  const style = document.createElement('style');
  style.id = 'sd-toolbar-style';
  style.textContent = `
    .sd-toolbar-btn {
      margin: 0 4px;
      padding: 4px 10px;
      border: 1px solid #bbb;
      background: #f3f6fb;
      color: #133070;
      font-size: 1em;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .sd-toolbar-btn:hover, .sd-toolbar-btn:focus {
      background: #e3e8f2;
      border-color: #2176ff;
      color: #2176ff;
      outline: none;
    }
    .sd-toolbar-dropdown {
      margin: 0 4px;
      padding: 3px 7px;
      font-size: 1em;
      border-radius: 3px;
      border: 1px solid #bbb;
      background: #fcfcff;
    }
    .sd-toolbar-color-swatch {
      display: inline-block;
      width: 28px;
      height: 28px;
      border-radius: 3px;
      border: 1px solid #bbb;
      vertical-align: middle;
      margin: 0 4px;
      background: #fff;
      cursor: pointer;
    }
    .sd-toolbar-text-input {
      margin: 0 4px;
      padding: 3px 7px;
      font-size: 1em;
      border-radius: 3px;
      border: 1px solid #bbb;
      background: #fcfcff;
      width: 120px;
    }
  `;
  document.head.appendChild(style);
}
