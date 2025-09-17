/**
 * minilayout.js
 * -----------------------------------------------------------
 * Scene Designer – Minimal Layout Engine (Golden Layout v3 API Shim)
 * - Implements a minimal column/row/panel system with Golden Layout v3–compatible API.
 * - ES module only, no global/window usage.
 * - Panels are rendered as flexbox divs, with nesting for row/column.
 * - Supports: columns, rows, component panels, panel titles, expand/collapse (show/hide) per panel.
 * - Panel factories use { element, title, componentName } just like Golden Layout v3.
 * - No drag/drop, resize, or stack logic (add later).
 * - Can be replaced by real Golden Layout v3 with minimal changes.
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

/**
 * Minimal Layout Engine (Golden Layout v3 API)
 */
export class MiniLayout {
  /**
   * @param {Object} config - GL v3-style config object
   * @param {HTMLElement} containerElement - Root DOM node to render layout into
   */
  constructor(config, containerElement) {
    log("INFO", "[minilayout] MiniLayout constructor called", { config, containerElement });
    this.config = config;
    this.containerElement = containerElement;
    this._componentFactories = {};
    this._panelRefs = [];
    this.rootItem = null;
    this._destroyed = false;
  }

  /**
   * Register a panel/component factory.
   * @param {string} name
   * @param {function} factoryFn
   */
  registerComponent(name, factoryFn) {
    log("INFO", "[minilayout] registerComponent", { name, factoryFn });
    this._componentFactories[name] = factoryFn;
  }

  /**
   * Build and show the layout.
   */
  init() {
    log("INFO", "[minilayout] init called");
    if (!this.containerElement) {
      log("ERROR", "[minilayout] No containerElement provided");
      return;
    }
    this.containerElement.innerHTML = "";
    this.rootItem = this._buildItem(this.config.root, this.containerElement, null);
    log("INFO", "[minilayout] Layout initialized");
  }

  /**
   * Internal: Recursively build row/column/component nodes.
   * @param {Object} node
   * @param {HTMLElement} parentEl
   * @param {Object|null} parentItem
   * @returns {Object} panel item (with .element property)
   */
  _buildItem(node, parentEl, parentItem) {
    if (!node) return null;
    let item = { config: node, parent: parentItem };
    let el = document.createElement("div");
    el.className = "minilayout-panel";

    // Row/column logic
    if (node.type === "row") {
      el.style.display = "flex";
      el.style.flexDirection = "row";
      el.style.width = "100%";
      el.style.height = node.height ? node.height + "%" : "100%";
      el.style.flex = node.width ? `0 0 ${node.width}%` : "1 1 0";
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(child =>
          this._buildItem(child, el, item)
        );
      }
    } else if (node.type === "column") {
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.height = "100%";
      el.style.width = node.width ? node.width + "%" : "100%";
      el.style.flex = node.height ? `0 0 ${node.height}%` : "1 1 0";
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(child =>
          this._buildItem(child, el, item)
        );
      }
    } else if (node.type === "component") {
      el.className += " minilayout-panel-component";
      el.style.flex = node.height
        ? `0 0 ${node.height}%`
        : node.width
        ? `0 0 ${node.width}%`
        : "1 1 0";

      // --- Panel header with title and toggle ---
      const header = document.createElement("div");
      header.className = "minilayout-panel-header";
      header.style.background = "#e9f1ff";
      header.style.padding = "4px 8px";
      header.style.fontWeight = "bold";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "space-between";
      header.style.borderBottom = "1px solid #d3e2f9";

      const titleSpan = document.createElement("span");
      titleSpan.textContent = node.title || node.componentName || "Panel";
      header.appendChild(titleSpan);

      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = "⯈";
      toggleBtn.title = "Expand/collapse panel";
      toggleBtn.style.fontSize = "1.1em";
      toggleBtn.style.background = "none";
      toggleBtn.style.border = "none";
      toggleBtn.style.cursor = "pointer";
      toggleBtn.style.marginLeft = "8px";
      header.appendChild(toggleBtn);

      let collapsed = false;
      toggleBtn.addEventListener("click", () => {
        collapsed = !collapsed;
        bodyDiv.style.display = collapsed ? "none" : "block";
        toggleBtn.textContent = collapsed ? "⯆" : "⯈";
        log("INFO", "[minilayout] Panel toggled", { title: node.title, collapsed });
      });

      el.appendChild(header);

      // --- Panel body ---
      const bodyDiv = document.createElement("div");
      bodyDiv.className = "minilayout-panel-body";
      bodyDiv.style.flex = "1 1 0";
      bodyDiv.style.height = "100%";
      bodyDiv.style.overflow = "auto";
      bodyDiv.style.background = "#fff";
      bodyDiv.style.padding = "0";

      el.appendChild(bodyDiv);

      // Call factory function, pass bodyDiv (matches GL v3 API)
      let factory = this._componentFactories[node.componentName];
      if (typeof factory === "function") {
        try {
          factory({
            element: bodyDiv,
            title: node.title,
            componentName: node.componentName
          });
        } catch (e) {
          log("ERROR", "[minilayout] Panel factory failed", { title: node.title, error: e });
          bodyDiv.innerHTML =
            `<div style="color:red;padding:8px;">Panel failed: ${e.message}</div>`;
        }
      } else {
        bodyDiv.innerHTML =
          `<div style="color:#444;padding:1em;">No panel factory registered for "${node.componentName}"</div>`;
      }
      this._panelRefs.push({ node, el, bodyDiv });
    }

    // Sizing and flex logic for top-level panels
    if (!parentItem) {
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.background = "#f7f9fc";
      el.style.overflow = "hidden";
      el.style.display = "flex";
    }

    parentEl.appendChild(el);
    item.element = el;
    return item;
  }

  /**
   * Destroy all panels and clean up.
   */
  destroy() {
    log("INFO", "[minilayout] destroy called");
    if (this._destroyed) return;
    this.containerElement.innerHTML = "";
    this._panelRefs = [];
    this.rootItem = null;
    this._destroyed = true;
  }
}

// --- Styles: inject once per document ---
if (typeof document !== "undefined" && !document.getElementById("minilayout-styles")) {
  const style = document.createElement("style");
  style.id = "minilayout-styles";
  style.textContent = `
    .minilayout-panel { box-sizing: border-box; min-width: 80px; min-height: 40px; border: 1px solid #d3e2f9; background: #f7f9fc; margin: 1px; display: flex; flex-direction: column; }
    .minilayout-panel-header { background: #e9f1ff; font-size: 1em; padding: 4px 8px; border-bottom: 1px solid #d3e2f9; display: flex; justify-content: space-between; align-items: center; }
    .minilayout-panel-body { background: #fff; flex: 1 1 0; overflow: auto; padding: 0; }
    .minilayout-panel-component { min-width: 120px; min-height: 80px; flex: 1 1 0; }
  `;
  document.head.appendChild(style);
}
