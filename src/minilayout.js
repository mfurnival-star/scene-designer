/**
 * minilayout.js
 * -----------------------------------------------------------
 * Scene Designer – MiniLayout Engine (GL-inspired, splitters/draggable resize, compact neutral greys, fullscreen-safe)
 * - Minimal ES module layout engine for Scene Designer prototypes.
 * - Supports: rows, columns, stacks (tabs), component panels, flexible header config.
 * - Per-panel scrollbars: style/size/color fully configurable via layout config scrollbarStyle property.
 * - All code is ES module only; no global/window usage except localStorage for panel size persistence.
 * - Logging via log.js.
 * - NEW: Panel size persistence (splitter changes saved/restored).
 * -----------------------------------------------------------
 * Exports: MiniLayout
 * Dependencies: log.js
 */

import { log } from './log.js';

// --- Panel size persistence: localStorage key ---
const PANEL_SIZE_STORAGE_KEY = "sceneDesignerPanelSizes";

// Helper: Deep clone config object (to avoid mutation)
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Helper: Generate a unique CSS class name for a panel body
function makePanelBodyClass(panelName) {
  return `minilayout-panel-body--${panelName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
}

// Helper: Inject per-panel scrollbar CSS
function injectPanelScrollbarCSS(className, styleObj) {
  if (typeof document === "undefined" || document.getElementById(`scrollbar-style-${className}`)) return;
  const style = document.createElement("style");
  style.id = `scrollbar-style-${className}`;
  let css = `.${className} { scrollbar-width: ${styleObj.width || "auto"}; scrollbar-color: ${styleObj.color || "#2176ff"} ${styleObj.track || "#e0e4ec"}; }`;
  css += `
    .${className}::-webkit-scrollbar {
      width: ${styleObj.width || "12px"};
      height: ${styleObj.height || styleObj.width || "12px"};
      background: ${styleObj.track || "#e0e4ec"};
      border-radius: ${styleObj.radius || "7px"};
    }
    .${className}::-webkit-scrollbar-thumb {
      background: ${styleObj.color || "#2176ff"};
      border-radius: ${styleObj.radius || "7px"};
      border: 4px solid ${styleObj.track || "#e0e4ec"};
      min-height: 36px;
      min-width: 36px;
    }
    .${className}::-webkit-scrollbar-thumb:hover {
      background: ${styleObj.hover || "#0057d8"};
    }
    .${className}::-webkit-scrollbar-track {
      background: ${styleObj.track || "#e0e4ec"};
      border-radius: ${styleObj.radius || "7px"};
      border: 2px solid #bbb;
    }
  `;
  style.textContent = css;
  document.head.appendChild(style);
}

// --- Panel size persistence helpers ---
function savePanelSizes(sizes) {
  try {
    localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(sizes));
    log("INFO", "[minilayout] Panel sizes saved", sizes);
  } catch (e) {
    log("ERROR", "[minilayout] Failed to save panel sizes", e);
  }
}
function loadPanelSizes() {
  try {
    const raw = localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return {};
    const sizes = JSON.parse(raw);
    log("INFO", "[minilayout] Panel sizes loaded", sizes);
    return sizes;
  } catch (e) {
    log("ERROR", "[minilayout] Failed to load panel sizes", e);
    return {};
  }
}
function panelPathKey(pathArr) {
  // Path as string, e.g. "row-0:column-1:component-2"
  return pathArr.join(":");
}

/**
 * MiniLayout – GL-inspired layout engine with neutral grey UI & configurable panel headers
 */
export class MiniLayout {
  /**
   * @param {Object} config - Layout config (rows/columns/components/stacks)
   * @param {HTMLElement} containerElement - Root DOM node to render layout into
   */
  constructor(config, containerElement) {
    log("INFO", "[minilayout] MiniLayout constructor called", { config, containerElement });
    this.config = deepClone(config);
    this.containerElement = containerElement;
    this._componentFactories = {};
    this._panelRefs = [];
    this._destroyed = false;
    this._panelSizes = loadPanelSizes();
    this._pendingPanelSizeUpdates = {};
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
    this._panelRefs = [];
    // Ensure the root container is fullscreen and overflow-hidden
    this.containerElement.style.position = "fixed";
    this.containerElement.style.top = "0";
    this.containerElement.style.left = "0";
    this.containerElement.style.width = "100vw";
    this.containerElement.style.height = "100vh";
    this.containerElement.style.overflow = "hidden";
    this.containerElement.style.margin = "0";
    this.containerElement.style.padding = "0";
    this.containerElement.style.boxSizing = "border-box";
    this.rootItem = this._buildItem(this.config.root, this.containerElement, null, []);
    log("INFO", "[minilayout] Layout initialized");
  }

  /**
   * Internal: Recursively build row/column/stack/component nodes.
   * @param {Object} node
   * @param {HTMLElement} parentEl
   * @param {Object|null} parentItem
   * @param {Array} pathArr - Path to this node (for panel size persistence)
   * @returns {Object} panel item (with .element property)
   */
  _buildItem(node, parentEl, parentItem, pathArr) {
    if (!node) return null;
    let item = { config: node, parent: parentItem };
    let el = document.createElement("div");

    // Add node type and index to pathArr for persistence
    let idxInParent = parentItem && parentItem.config && Array.isArray(parentItem.config.content)
      ? parentItem.config.content.indexOf(node)
      : 0;
    let newPathArr = pathArr.concat([`${node.type}-${idxInParent}`]);

    // Row/column logic
    if (node.type === "row" || node.type === "column") {
      el.className = "minilayout-panel";
      el.style.display = "flex";
      el.style.flexDirection = node.type === "row" ? "row" : "column";
      // --- Panel size persistence: apply saved sizes ---
      let parentKey = panelPathKey(newPathArr);
      let sizes = (this._panelSizes && this._panelSizes[parentKey]) || [];
      let childEls = [];
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach((child, idx) => {
          if (idx > 0) {
            const splitter = this._makeSplitter(node.type, el, parentKey, idx - 1, childEls, newPathArr);
            el.appendChild(splitter);
            childEls.push(splitter);
          }
          const childItem = this._buildItem(child, el, item, newPathArr);
          // --- Panel size persistence: apply child size ---
          const sizeVal = sizes[idx];
          if (sizeVal !== undefined) {
            if (node.type === "row") {
              childItem.element.style.width = `${sizeVal}%`;
              childItem.element.style.flex = `0 0 ${sizeVal}%`;
            } else {
              childItem.element.style.height = `${sizeVal}%`;
              childItem.element.style.flex = `0 0 ${sizeVal}%`;
            }
          }
          childEls.push(childItem.element);
        });
      }
      // If top-level, set to 100%
      el.style.width = node.width ? node.width + "%" : "100%";
      el.style.height = node.height ? node.height + "%" : "100%";
      el.style.flex = node.width ? `0 0 ${node.width}%` : "1 1 0";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxSizing = "border-box";
    } else if (node.type === "stack") {
      // Stack: tabbed panels
      el.className = "minilayout-panel-stack";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.width = node.width ? node.width + "%" : "100%";
      el.style.height = node.height ? node.height + "%" : "100%";
      el.style.flex = node.width ? `0 0 ${node.width}%` : "1 1 0";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxSizing = "border-box";
      // Tab bar
      const tabbar = document.createElement("div");
      tabbar.className = "minilayout-tabbar";
      let activeIdx = 0;
      const panels = [];
      node.content.forEach((tabNode, idx) => {
        const tabBtn = document.createElement("button");
        tabBtn.className = "minilayout-tabbtn";
        tabBtn.textContent = tabNode.title || tabNode.componentName || `Tab ${idx+1}`;
        tabBtn.setAttribute("aria-selected", idx === activeIdx ? "true" : "false");
        tabBtn.addEventListener("click", () => {
          panels.forEach((p, i) => p.style.display = i === idx ? "flex" : "none");
          Array.from(tabbar.children).forEach((btn, i) => btn.setAttribute("aria-selected", i === idx ? "true" : "false"));
        });
        tabbar.appendChild(tabBtn);
      });
      el.appendChild(tabbar);
      // Tab panels
      node.content.forEach((tabNode, idx) => {
        const tabPanel = document.createElement("div");
        tabPanel.style.display = idx === activeIdx ? "flex" : "none";
        tabPanel.style.flex = "1 1 0";
        this._buildItem(tabNode, tabPanel, item, newPathArr);
        el.appendChild(tabPanel);
        panels.push(tabPanel);
      });
    } else if (node.type === "component") {
      el.className = "minilayout-panel minilayout-panel-component";
      el.style.flex = node.height
        ? `0 0 ${node.height}%`
        : node.width
        ? `0 0 ${node.width}%`
        : "1 1 0";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxSizing = "border-box";

      // Panel header
      const header = document.createElement("div");
      header.className = "minilayout-panel-header";
      header.style.setProperty("--header-height", node.headerHeight ? node.headerHeight + "px" : "28px");
      header.style.fontSize = node.headerFontSize ?? "0.96em";
      header.style.position = "relative";
      header.style.top = "-2px";
      header.style.left = "-2px";
      header.style.marginRight = "-2px";
      header.style.marginLeft = "-2px";
      header.style.borderRadius = "7px 7px 0 0";
      header.style.borderBottom = "1.5px solid #bbb";
      header.style.boxShadow = "0 1.5px 4px -2px #aaa";
      header.style.background = node.headerBg ?? "linear-gradient(180deg, #e0e0e0 0%, #d2d2d2 100%)";
      header.style.fontWeight = "bold";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "flex-start";
      header.style.gap = "10px";
      header.style.height = "var(--header-height)";
      header.style.padding = "2px 10px 2px 10px";

      const titleTag = document.createElement("span");
      titleTag.className = "minilayout-panel-title";
      titleTag.textContent = node.title || node.componentName || "Panel";
      titleTag.style.fontWeight = "bold";
      titleTag.style.fontSize = "inherit";
      titleTag.style.color = "#444";
      titleTag.style.flex = "1 1 auto";
      titleTag.style.overflow = "hidden";
      titleTag.style.whiteSpace = "nowrap";
      titleTag.style.textOverflow = "ellipsis";
      titleTag.style.userSelect = "none";
      header.appendChild(titleTag);

      let showClose = node.closable === true;
      if (showClose) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "minilayout-panel-close-btn";
        closeBtn.title = "Close panel";
        closeBtn.style.border = "none";
        closeBtn.style.background = "none";
        closeBtn.style.color = "#888";
        closeBtn.style.fontSize = "1em";
        closeBtn.style.marginLeft = "6px";
        closeBtn.style.padding = "0 6px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.borderRadius = "4px";
        closeBtn.innerHTML = `<span aria-label="Close" style="font-size:1.13em; font-weight:bold;">&#x2715;</span>`;
        closeBtn.addEventListener("click", () => {
          log("INFO", "[minilayout] Panel close button clicked", { title: node.title, componentName: node.componentName });
          el.remove();
        });
        header.appendChild(closeBtn);
      }

      el.appendChild(header);

      // --- Panel body ---
      const bodyDiv = document.createElement("div");
      // Generate unique class for panel body
      const panelBodyClass = makePanelBodyClass(node.componentName || node.title || "panel");
      bodyDiv.className = `minilayout-panel-body ${panelBodyClass}`;
      bodyDiv.style.flex = "1 1 0";
      bodyDiv.style.height = "100%";
      bodyDiv.style.background = node.bodyBg ?? "#f3f3f3";
      bodyDiv.style.padding = "0";

      // --- Per-panel scrollbars/overflow config ---
      if (node.scrollbars !== undefined) {
        switch (node.scrollbars) {
          case 'auto': bodyDiv.style.overflow = "auto"; break;
          case 'both': bodyDiv.style.overflowX = "auto"; bodyDiv.style.overflowY = "auto"; break;
          case 'x': bodyDiv.style.overflowX = "auto"; bodyDiv.style.overflowY = "hidden"; break;
          case 'y': bodyDiv.style.overflowX = "hidden"; bodyDiv.style.overflowY = "auto"; break;
          case 'always': bodyDiv.style.overflow = "scroll"; break;
          case 'hidden': bodyDiv.style.overflow = "hidden"; break;
          case 'visible': bodyDiv.style.overflow = "visible"; break;
          default: bodyDiv.style.overflow = "auto";
        }
        log("INFO", "[minilayout] Panel scrollbars config applied", {
          componentName: node.componentName,
          scrollbars: node.scrollbars
        });
      } else {
        bodyDiv.style.overflow = "auto";
      }

      // --- NEW: Per-panel scrollbar style config ---
      if (node.scrollbarStyle && typeof node.scrollbarStyle === "object") {
        injectPanelScrollbarCSS(panelBodyClass, node.scrollbarStyle);
        log("INFO", "[minilayout] Panel scrollbarStyle config applied", {
          componentName: node.componentName,
          scrollbarStyle: node.scrollbarStyle
        });
      }

      el.appendChild(bodyDiv);

      // Call factory function, pass bodyDiv + panel info
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

    if (!parentItem) {
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      el.style.width = "100vw";
      el.style.height = "100vh";
      el.style.background = "#ededed";
      el.style.overflow = "hidden";
      el.style.display = "flex";
    }

    parentEl.appendChild(el);
    item.element = el;
    return item;
  }

  /** Splitter code: extended for panel size persistence **/
  _makeSplitter(type, parentEl, parentKey, leftIdx, childEls, pathArr) {
    const splitter = document.createElement("div");
    splitter.className = "minilayout-splitter";
    splitter.style.background = "#d2d2d2";
    splitter.style.position = "relative";
    splitter.style.zIndex = "10";
    splitter.style.userSelect = "none";
    splitter.style.flex = "0 0 auto";
    splitter.style.margin = "0";
    splitter.style.padding = "0";
    splitter.style.boxSizing = "border-box";
    if (type === "row") {
      splitter.style.width = "7px";
      splitter.style.height = "100%";
      splitter.style.cursor = "col-resize";
      splitter.style.borderLeft = "1.5px solid #bbb";
      splitter.style.borderRight = "1.5px solid #bbb";
    } else {
      splitter.style.height = "7px";
      splitter.style.width = "100%";
      splitter.style.cursor = "row-resize";
      splitter.style.borderTop = "1.5px solid #bbb";
      splitter.style.borderBottom = "1.5px solid #bbb";
    }
    // Drag-to-resize code, with panel size persistence
    splitter.addEventListener("mousedown", (e) => {
      e.preventDefault();
      document.body.style.cursor = splitter.style.cursor;
      let startX = e.clientX, startY = e.clientY;
      let prev = splitter.previousElementSibling;
      let next = splitter.nextElementSibling;
      if (!prev || !next) return;
      let prevRect = prev.getBoundingClientRect();
      let nextRect = next.getBoundingClientRect();
      let parentRect = parentEl.getBoundingClientRect();
      let totalSize = type === "row" ? parentRect.width : parentRect.height;
      let prevSize = type === "row" ? prevRect.width : prevRect.height;
      let nextSize = type === "row" ? nextRect.width : nextRect.height;
      function onMove(ev) {
        let clientX = ev.type === "touchmove" ? ev.touches[0].clientX : ev.clientX;
        let clientY = ev.type === "touchmove" ? ev.touches[0].clientY : ev.clientY;
        let dx = clientX - startX;
        let dy = clientY - startY;
        let newPrev = type === "row"
          ? ((prevSize + dx) / totalSize) * 100
          : ((prevSize + dy) / totalSize) * 100;
        let newNext = type === "row"
          ? ((nextSize - dx) / totalSize) * 100
          : ((nextSize - dy) / totalSize) * 100;
        // Clamp min size
        if (newPrev < 7) newPrev = 7;
        if (newNext < 7) newNext = 7;
        prev.style.width = type === "row" ? `${newPrev}%` : "";
        prev.style.height = type === "column" ? `${newPrev}%` : "";
        prev.style.flex = `0 0 ${newPrev}%`;
        next.style.width = type === "row" ? `${newNext}%` : "";
        next.style.height = type === "column" ? `${newNext}%` : "";
        next.style.flex = `0 0 ${newNext}%`;

        // Save panel sizes for this parent node
        let sizes = [];
        let children = Array.from(parentEl.children).filter(el => el.classList.contains("minilayout-panel") || el.classList.contains("minilayout-panel-stack"));
        for (let i = 0; i < children.length; i++) {
          if (type === "row") {
            let w = children[i].getBoundingClientRect().width;
            sizes[i] = ((w / totalSize) * 100);
          } else {
            let h = children[i].getBoundingClientRect().height;
            sizes[i] = ((h / totalSize) * 100);
          }
        }
        // --- Panel size persistence: save sizes ---
        let key = parentKey;
        let allSizes = loadPanelSizes();
        allSizes[key] = sizes;
        savePanelSizes(allSizes);
      }
      function onUp(ev) {
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp, { passive: false });
    });
    splitter.addEventListener("touchstart", (e) => {
      e.preventDefault();
      document.body.style.cursor = splitter.style.cursor;
      let startX = e.touches[0].clientX, startY = e.touches[0].clientY;
      let prev = splitter.previousElementSibling;
      let next = splitter.nextElementSibling;
      if (!prev || !next) return;
      let prevRect = prev.getBoundingClientRect();
      let nextRect = next.getBoundingClientRect();
      let parentRect = parentEl.getBoundingClientRect();
      let totalSize = type === "row" ? parentRect.width : parentRect.height;
      let prevSize = type === "row" ? prevRect.width : prevRect.height;
      let nextSize = type === "row" ? nextRect.width : nextRect.height;
      function onMove(ev) {
        let clientX = ev.type === "touchmove" ? ev.touches[0].clientX : ev.clientX;
        let clientY = ev.type === "touchmove" ? ev.touches[0].clientY : ev.clientY;
        let dx = clientX - startX;
        let dy = clientY - startY;
        let newPrev = type === "row"
          ? ((prevSize + dx) / totalSize) * 100
          : ((prevSize + dy) / totalSize) * 100;
        let newNext = type === "row"
          ? ((nextSize - dx) / totalSize) * 100
          : ((nextSize - dy) / totalSize) * 100;
        // Clamp min size
        if (newPrev < 7) newPrev = 7;
        if (newNext < 7) newNext = 7;
        prev.style.width = type === "row" ? `${newPrev}%` : "";
        prev.style.height = type === "column" ? `${newPrev}%` : "";
        prev.style.flex = `0 0 ${newPrev}%`;
        next.style.width = type === "row" ? `${newNext}%` : "";
        next.style.height = type === "column" ? `${newNext}%` : "";
        next.style.flex = `0 0 ${newNext}%`;

        // Save panel sizes for this parent node
        let sizes = [];
        let children = Array.from(parentEl.children).filter(el => el.classList.contains("minilayout-panel") || el.classList.contains("minilayout-panel-stack"));
        for (let i = 0; i < children.length; i++) {
          if (type === "row") {
            let w = children[i].getBoundingClientRect().width;
            sizes[i] = ((w / totalSize) * 100);
          } else {
            let h = children[i].getBoundingClientRect().height;
            sizes[i] = ((h / totalSize) * 100);
          }
        }
        // --- Panel size persistence: save sizes ---
        let key = parentKey;
        let allSizes = loadPanelSizes();
        allSizes[key] = sizes;
        savePanelSizes(allSizes);
      }
      function onUp(ev) {
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp, { passive: false });
    });
    return splitter;
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

// --- Styles: inject once per document (unchanged from previous) ---
if (typeof document !== "undefined" && !document.getElementById("minilayout-styles")) {
  const style = document.createElement("style");
  style.id = "minilayout-styles";
  style.textContent = `
    html, body, #ml-root {
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .minilayout-panel {
      box-sizing: border-box;
      min-width: 80px;
      min-height: 36px;
      border: 1.5px solid #bbb;
      background: #f3f3f3;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      box-shadow: 0 2px 9px -6px #aaa;
      transition: border 0.16s, box-shadow 0.14s;
    }
    .minilayout-panel-header {
      background: linear-gradient(180deg, #e0e0e0 0%, #d2d2d2 100%);
      font-size: 0.96em;
      padding: 2px 10px 2px 10px;
      border-bottom: 1.5px solid #bbb;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      position: relative;
      border-radius: 7px 7px 0 0;
      box-shadow: 0 1.5px 4px -2px #aaa;
      height: var(--header-height, 28px);
      min-height: 22px;
      max-height: 32px;
      gap: 10px;
      font-weight: bold;
      user-select: none;
    }
    .minilayout-panel-title {
      flex: 1 1 auto;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: #444;
      font-weight: bold;
      font-size: inherit;
      padding-left: 2px;
    }
    .minilayout-panel-close-btn {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 1em;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 4px;
      transition: background 0.13s;
    }
    .minilayout-panel-close-btn:hover {
      background: #e0e0e0;
      color: #c00;
    }
    .minilayout-panel-body {
      background: #f3f3f3;
      flex: 1 1 0;
      overflow: auto;
      padding: 0;
      border-radius: 0 0 8px 8px;
      transition: background 0.12s;
    }
    .minilayout-panel-component {
      min-width: 120px;
      min-height: 80px;
      flex: 1 1 0;
    }
    .minilayout-panel-stack {
      box-shadow: 0 3px 10px -6px #aaa;
      border-radius: 6px;
      background: #ededed;
      min-width: 120px;
      min-height: 80px;
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .minilayout-tabbar {
      box-sizing: border-box;
      border-radius: 6px 6px 0 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      background: linear-gradient(90deg, #dde8fc 0%, #d2d2d2 100%);
      border-bottom: 1px solid #bbb;
      padding: 4px 8px;
    }
    .minilayout-tabbtn {
      font-size: 1em;
      padding: 4px 18px;
      margin-right: 8px;
      border-radius: 6px 6px 0 0;
      border: none;
      background: none;
      cursor: pointer;
      transition: background 0.11s, font-weight 0.12s;
    }
    .minilayout-tabbtn:focus {
      outline: 2px solid #888;
    }
    .minilayout-tabbtn[aria-selected="true"] {
      background: #fff;
      font-weight: bold;
    }
    .minilayout-splitter {
      background: #d2d2d2;
      z-index: 10;
      user-select: none;
      transition: background 0.13s;
    }
    .minilayout-splitter:hover {
      background: #b3b3b3;
    }
    @media (max-width: 900px) {
      .minilayout-panel-header {
        font-size: 0.98em;
        min-height: 19px;
      }
      .minilayout-panel-title {
        font-size: 1em;
        padding-left: 1px;
      }
      .minilayout-tabbtn {
        font-size: 0.93em;
        padding: 2px 9px;
      }
    }
  `;
  document.head.appendChild(style);
}

