/**
 * minilayout-ui.js
 * -----------------------------------------------------------
 * Scene Designer – Native Layout Manager UI Helpers (ESM Only)
 * - UI logic for MiniLayout: splitter bars, tab styling, animated transitions, accessibility.
 * - Helper functions for building and updating UI features of panels, tabs, splitters.
 * - No layout tree logic; all DOM/UI only.
 * - Exports: buildSplitter, buildTabBar, applyPanelAnimation, focusPanelHeader, and more.
 * - Depends on log.js for logging.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

/**
 * Build a splitter bar (vertical or horizontal) for panel resizing.
 * @param {"row"|"column"} direction
 * @param {HTMLElement} parentEl
 * @param {number} idx
 * @param {Array} path
 * @param {function} onResize - Callback for resize events: (leftSize, rightSize)
 * @returns {HTMLElement} splitter bar element
 */
export function buildSplitter(direction, parentEl, idx, path, onResize) {
  const splitter = document.createElement("div");
  splitter.className = "minilayout-splitter-ui";
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-orientation", direction === "row" ? "vertical" : "horizontal");
  splitter.style.background = "#b3caff";
  splitter.style.cursor = direction === "row" ? "col-resize" : "row-resize";
  splitter.style.flex = "0 0 8px";
  splitter.style.zIndex = 6;
  splitter.style[direction === "row" ? "width" : "height"] = "8px";
  splitter.style[direction === "row" ? "height" : "width"] = "100%";
  splitter.style.position = "relative";
  let dragging = false;
  let startPos = 0;
  let startSizes = [];
  splitter.addEventListener("mousedown", (e) => {
    dragging = true;
    startPos = direction === "row" ? e.clientX : e.clientY;
    let childEls = Array.from(parentEl.children).filter(el => el.classList.contains("minilayout-panel"));
    startSizes = childEls.map(el => direction === "row"
      ? el.offsetWidth
      : el.offsetHeight
    );
    document.body.style.cursor = splitter.style.cursor;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    let delta = (direction === "row" ? e.clientX : e.clientY) - startPos;
    let childEls = Array.from(parentEl.children).filter(el => el.classList.contains("minilayout-panel"));
    if (childEls.length < 2) return;
    let leftEl = childEls[idx];
    let rightEl = childEls[idx + 1];
    let leftSize = startSizes[idx] + delta;
    let rightSize = startSizes[idx + 1] - delta;
    if (leftSize < 60 || rightSize < 60) return; // min size
    leftEl.style.flex = `0 0 ${leftSize}px`;
    rightEl.style.flex = `0 0 ${rightSize}px`;
    if (typeof onResize === "function") onResize(leftSize, rightSize);
    log("DEBUG", "[minilayout-ui] Splitter resize", { direction, idx, leftSize, rightSize });
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
  });
  return splitter;
}

/**
 * Build a tab bar for stacks.
 * @param {Array} panels - Array of panel configs
 * @param {number} activeTab
 * @param {function} onTabChange - Callback (idx)
 * @returns {HTMLElement} tab bar element
 */
export function buildTabBar(panels, activeTab, onTabChange) {
  const tabBar = document.createElement("div");
  tabBar.className = "minilayout-tabbar-ui";
  tabBar.style.display = "flex";
  tabBar.style.flexDirection = "row";
  tabBar.style.alignItems = "center";
  tabBar.style.background = "linear-gradient(90deg, #dde8fc 0%, #c7daf7 100%)";
  tabBar.style.borderBottom = "1px solid #d3e2f9";
  tabBar.style.padding = "4px 8px";
  panels.forEach((panel, idx) => {
    const tabBtn = document.createElement("button");
    tabBtn.className = "minilayout-tabbtn-ui";
    tabBtn.textContent = panel.title || panel.componentName || "Panel";
    tabBtn.style.fontWeight = idx === activeTab ? "bold" : "normal";
    tabBtn.style.background = idx === activeTab ? "#fff" : "transparent";
    tabBtn.style.border = "none";
    tabBtn.style.marginRight = "8px";
    tabBtn.style.cursor = "pointer";
    tabBtn.setAttribute("role", "tab");
    tabBtn.setAttribute("aria-selected", idx === activeTab ? "true" : "false");
    tabBtn.setAttribute("tabindex", idx === activeTab ? "0" : "-1");
    tabBtn.addEventListener("click", () => {
      if (typeof onTabChange === "function") onTabChange(idx);
      log("INFO", "[minilayout-ui] Tab changed", { idx });
    });
    tabBar.appendChild(tabBtn);
  });
  return tabBar;
}

/**
 * Apply animation to a panel (e.g. fade in/out, expand/collapse).
 * @param {HTMLElement} el
 * @param {string} type - "fade", "expand", etc.
 */
export function applyPanelAnimation(el, type = "fade") {
  if (!el) return;
  if (type === "fade") {
    el.style.transition = "opacity 0.18s";
    el.style.opacity = "0";
    setTimeout(() => { el.style.opacity = "1"; }, 40);
  } else if (type === "expand") {
    el.style.transition = "max-height 0.24s cubic-bezier(.57,.02,.37,.99)";
    el.style.maxHeight = "0";
    setTimeout(() => { el.style.maxHeight = "1000px"; }, 30);
  }
  // Other animation types can be added here
}

/**
 * Focus the panel header for accessibility (after tab change, close, etc).
 * @param {HTMLElement} headerEl
 */
export function focusPanelHeader(headerEl) {
  if (headerEl && typeof headerEl.focus === "function") {
    headerEl.focus();
    log("DEBUG", "[minilayout-ui] Focused panel header", { headerEl });
  }
}

/**
 * Helper: Add ARIA roles and attributes for accessibility.
 * @param {HTMLElement} el
 * @param {string} role
 * @param {Object} attrs
 */
export function applyAria(el, role, attrs = {}) {
  if (!el) return;
  el.setAttribute("role", role);
  for (const key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
}

// --- Inject UI styles once per document ---
if (typeof document !== "undefined" && !document.getElementById("minilayout-ui-styles")) {
  const style = document.createElement("style");
  style.id = "minilayout-ui-styles";
  style.textContent = `
    .minilayout-splitter-ui { background: #b3caff; opacity: 0.7; border-radius: 4px; }
    .minilayout-panel-stack-ui { box-shadow: 0 3px 10px -6px #0057d8; border-radius: 6px; }
    .minilayout-tabbar-ui { box-sizing: border-box; border-radius: 6px 6px 0 0; }
    .minilayout-tabbtn-ui { font-size: 1em; padding: 4px 18px; margin-right: 8px; border-radius: 6px 6px 0 0; border: none; background: none; cursor: pointer; }
    .minilayout-tabbtn-ui:focus { outline: 2px solid #0057d8; }
    @media (max-width: 900px) {
      .minilayout-tabbtn-ui { font-size: 0.93em; padding: 2px 9px; }
    }
  `;
  document.head.appendChild(style);
}

