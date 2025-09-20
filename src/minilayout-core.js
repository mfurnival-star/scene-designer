/**
 * minilayout-core.js
 * -----------------------------------------------------------
 * Scene Designer – MiniLayout Core Engine (ESM ONLY)
 *
 * Purpose:
 * - Core layout engine that renders rows, columns, stacks (tabs), and component panels.
 * - Uses persisted splitters (localStorage) via minilayout-splitter-persist.js.
 * - Invokes registered panel factories with MiniLayout API: { element, title, componentName }.
 * - Applies per-panel scrollbar behavior and optional custom scrollbar styling.
 *
 * Public API:
 * - class MiniLayout
 *    - constructor(config, containerElement)
 *    - registerComponent(name, factoryFn)
 *    - init()
 *    - destroy()
 *
 * Dependencies:
 * - log.js (log)
 * - minilayout-splitter-persist.js (makePersistedSplitter, loadPanelSizes, panelPathKey)
 *
 * Notes:
 * - All DOM/CSS classes align with minilayout.css.
 * - This core is intentionally kept <350 lines and delegates splitter persistence to its module.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  makePersistedSplitter,
  loadPanelSizes,
  panelPathKey
} from './minilayout-splitter-persist.js';

/** Shallow-safe clone for config to avoid mutation */
function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/** Generate a unique body class for per-panel scrollbar styling */
function makePanelBodyClass(panelName) {
  return `minilayout-panel-body--${String(panelName || 'panel')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()}`;
}

/** Inject per-panel scrollbar CSS once per body class */
function injectPanelScrollbarCSS(className, styleObj) {
  if (typeof document === "undefined") return;
  const id = `scrollbar-style-${className}`;
  if (document.getElementById(id)) return;

  const s = (k, def) => (styleObj && styleObj[k] != null ? styleObj[k] : def);
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .${className} { scrollbar-width: ${s('width', 'auto')}; scrollbar-color: ${s('color', '#2176ff')} ${s('track', '#e0e4ec')}; }
    .${className}::-webkit-scrollbar {
      width: ${s('width', '12px')};
      height: ${s('height', s('width', '12px'))};
      background: ${s('track', '#e0e4ec')};
      border-radius: ${s('radius', '7px')};
    }
    .${className}::-webkit-scrollbar-thumb {
      background: ${s('color', '#2176ff')};
      border-radius: ${s('radius', '7px')};
      border: 4px solid ${s('track', '#e0e4ec')};
      min-height: 36px;
      min-width: 36px;
    }
    .${className}::-webkit-scrollbar-thumb:hover { background: ${s('hover', '#0057d8')}; }
    .${className}::-webkit-scrollbar-track {
      background: ${s('track', '#e0e4ec')};
      border-radius: ${s('radius', '7px')};
      border: 2px solid #bbb;
    }
  `;
  document.head.appendChild(style);
}

/**
 * MiniLayout – main engine
 */
export class MiniLayout {
  /**
   * @param {Object} config - { root: { type: 'row'|'column'|'stack'|'component', content: [...] } }
   * @param {HTMLElement} containerElement - Root container element
   */
  constructor(config, containerElement) {
    log("INFO", "[minilayout-core] constructor", { hasRoot: !!config?.root });
    this.config = deepClone(config || {});
    this.containerElement = containerElement;
    this._componentFactories = {};
    this._panelRefs = [];
    this._destroyed = false;
    this._persistedSizes = loadPanelSizes();
  }

  registerComponent(name, factoryFn) {
    this._componentFactories[name] = factoryFn;
    log("DEBUG", "[minilayout-core] registerComponent", { name, hasFactory: typeof factoryFn === "function" });
  }

  init() {
    log("INFO", "[minilayout-core] init");
    if (!this.containerElement) {
      log("ERROR", "[minilayout-core] No containerElement");
      return;
    }
    // Root container setup (fullscreen-safe)
    this.containerElement.innerHTML = "";
    this.containerElement.style.position = "fixed";
    this.containerElement.style.top = "0";
    this.containerElement.style.left = "0";
    this.containerElement.style.width = "100vw";
    this.containerElement.style.height = "100vh";
    this.containerElement.style.margin = "0";
    this.containerElement.style.padding = "0";
    this.containerElement.style.boxSizing = "border-box";
    this.containerElement.style.overflow = "hidden";

    this._panelRefs = [];
    this.rootItem = this._buildItem(this.config.root, this.containerElement, null, []);
    log("INFO", "[minilayout-core] init complete");
  }

  destroy() {
    log("INFO", "[minilayout-core] destroy");
    if (this._destroyed) return;
    if (this.containerElement) this.containerElement.innerHTML = "";
    this._panelRefs = [];
    this.rootItem = null;
    this._destroyed = true;
  }

  /**
   * Recursively build a node in the layout tree.
   * @param {Object} node
   * @param {HTMLElement} parentEl
   * @param {Object|null} parentItem
   * @param {Array<string>} pathArr
   * @returns {Object|null}
   */
  _buildItem(node, parentEl, parentItem, pathArr) {
    if (!node) return null;
    const item = { config: node, parent: parentItem };
    const el = document.createElement("div");

    // Derive index for path key
    const idxInParent = parentItem?.config?.content && Array.isArray(parentItem.config.content)
      ? parentItem.config.content.indexOf(node)
      : 0;
    const newPathArr = pathArr.concat([`${node.type}-${idxInParent}`]);

    if (node.type === "row" || node.type === "column") {
      // Container for children
      el.className = "minilayout-panel";
      el.style.display = "flex";
      el.style.flexDirection = node.type === "row" ? "row" : "column";
      el.style.width = node.width ? `${node.width}%` : "100%";
      el.style.height = node.height ? `${node.height}%` : "100%";
      el.style.flex = node.width ? `0 0 ${node.width}%` : "1 1 0";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxSizing = "border-box";

      // Persisted sizes for this parent
      const parentKey = panelPathKey(newPathArr);
      const saved = this._persistedSizes?.[parentKey];
      const children = Array.isArray(node.content) ? node.content : [];
      const useSizes = Array.isArray(saved) && saved.length === children.length ? saved : null;
      if (useSizes == null && Array.isArray(saved)) {
        log("DEBUG", "[minilayout-core] Ignoring persisted sizes (child count mismatch)", {
          parentKey, savedLen: saved.length, childCount: children.length
        });
      }

      // Build children interleaved with splitters: Panel0 | Splitter | Panel1 | Splitter | Panel2 ...
      children.forEach((child, idx) => {
        if (idx > 0) {
          const splitter = makePersistedSplitter(node.type, el, parentKey);
          el.appendChild(splitter);
        }
        const childItem = this._buildItem(child, el, item, newPathArr);

        // Apply persisted size immediately if available
        if (useSizes && typeof useSizes[idx] === "number") {
          const pct = useSizes[idx];
          if (node.type === "row") {
            childItem.element.style.width = `${pct}%`;
            childItem.element.style.flex = `0 0 ${pct}%`;
          } else {
            childItem.element.style.height = `${pct}%`;
            childItem.element.style.flex = `0 0 ${pct}%`;
          }
        }
      });

    } else if (node.type === "stack") {
      // Tabbed stack
      el.className = "minilayout-panel-stack";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      el.style.width = node.width ? `${node.width}%` : "100%";
      el.style.height = node.height ? `${node.height}%` : "100%";
      el.style.flex = node.width ? `0 0 ${node.width}%` : "1 1 0";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxSizing = "border-box";

      const tabbar = document.createElement("div");
      tabbar.className = "minilayout-tabbar";
      el.appendChild(tabbar);

      const panels = [];
      const activeIdx = 0;
      (node.content || []).forEach((tabNode, i) => {
        // Tab button
        const btn = document.createElement("button");
        btn.className = "minilayout-tabbtn";
        btn.textContent = tabNode.title || tabNode.componentName || `Tab ${i + 1}`;
        btn.setAttribute("aria-selected", i === activeIdx ? "true" : "false");
        btn.addEventListener("click", () => {
          panels.forEach((p, ix) => p.style.display = ix === i ? "flex" : "none");
          Array.from(tabbar.children).forEach((b, ix) => b.setAttribute("aria-selected", ix === i ? "true" : "false"));
          log("INFO", "[minilayout-core] Tab changed", { to: i });
        });
        tabbar.appendChild(btn);

        // Tab panel
        const tabPanel = document.createElement("div");
        tabPanel.style.display = i === activeIdx ? "flex" : "none";
        tabPanel.style.flex = "1 1 0";
        this._buildItem(tabNode, tabPanel, item, newPathArr);
        el.appendChild(tabPanel);
        panels.push(tabPanel);
      });

    } else if (node.type === "component") {
      // Component panel (header + body)
      el.className = "minilayout-panel minilayout-panel-component";
      el.style.flex = node.height
        ? `0 0 ${node.height}%`
        : node.width
        ? `0 0 ${node.width}%`
        : "1 1 0";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxSizing = "border-box";

      // Header
      const header = document.createElement("div");
      header.className = "minilayout-panel-header";
      header.style.setProperty("--header-height", node.headerHeight ? `${node.headerHeight}px` : "28px");
      header.style.fontSize = node.headerFontSize ?? "0.96em";
      header.style.position = "relative";
      header.style.borderRadius = "7px 7px 0 0";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.justifyContent = "flex-start";
      header.style.gap = "10px";
      header.style.height = "var(--header-height)";
      header.style.padding = "2px 10px";
      const titleTag = document.createElement("span");
      titleTag.className = "minilayout-panel-title";
      titleTag.textContent = node.title || node.componentName || "Panel";
      header.appendChild(titleTag);

      if (node.closable === true) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "minilayout-panel-close-btn";
        closeBtn.title = "Close panel";
        closeBtn.innerHTML = `<span aria-label="Close" style="font-size:1.13em; font-weight:bold;">&#x2715;</span>`;
        closeBtn.addEventListener("click", () => {
          log("INFO", "[minilayout-core] Panel close clicked", {
            title: node.title, componentName: node.componentName
          });
          el.remove();
        });
        header.appendChild(closeBtn);
      }
      el.appendChild(header);

      // Body
      const bodyDiv = document.createElement("div");
      const bodyClass = makePanelBodyClass(node.componentName || node.title || "panel");
      bodyDiv.className = `minilayout-panel-body ${bodyClass}`;
      bodyDiv.style.flex = "1 1 0";
      bodyDiv.style.height = "100%";
      bodyDiv.style.padding = "0";

      // Scrollbars behavior
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
      } else {
        bodyDiv.style.overflow = "auto";
      }

      // Optional custom scrollbar style
      if (node.scrollbarStyle && typeof node.scrollbarStyle === "object") {
        injectPanelScrollbarCSS(bodyClass, node.scrollbarStyle);
      }

      el.appendChild(bodyDiv);

      // Invoke component factory
      const factory = this._componentFactories[node.componentName];
      if (typeof factory === "function") {
        try {
          factory({
            element: bodyDiv,
            title: node.title,
            componentName: node.componentName
          });
        } catch (e) {
          log("ERROR", "[minilayout-core] Panel factory failed", { e, componentName: node.componentName });
          bodyDiv.innerHTML = `<div style="color:red;padding:8px;">Panel failed: ${e?.message || e}</div>`;
        }
      } else {
        bodyDiv.innerHTML = `<div style="color:#444;padding:1em;">No panel factory registered for "${node.componentName}"</div>`;
      }

      // Track for external queries (e.g., layout.js)
      this._panelRefs.push({ node, el, bodyDiv });
    }

    // Root attach and sizing
    if (!parentItem) {
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      el.style.width = "100vw";
      el.style.height = "100vh";
      el.style.display = "flex";
      el.style.overflow = "hidden";
    }

    parentEl.appendChild(el);
    item.element = el;
    return item;
  }
}
