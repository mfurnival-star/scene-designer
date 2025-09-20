/**
 * minilayout-splitter-persist.js
 * -----------------------------------------------------------
 * Scene Designer – MiniLayout Splitter + Panel Size Persistence (ESM ONLY)
 *
 * Purpose:
 * - Provide a reusable splitter element factory for row/column containers.
 * - Handle drag-to-resize of adjacent panels using flex-basis (%).
 * - Persist per-parent panel size arrays in localStorage.
 * - Restore sizes by key (computed path string) – used by minilayout-core.js.
 *
 * Exports:
 * - PANEL_SIZE_STORAGE_KEY
 * - loadPanelSizes() : object
 * - savePanelSizes(sizesObj) : void
 * - panelPathKey(pathArr:string[]) : string
 * - makePersistedSplitter(type:"row"|"column", parentEl:HTMLElement, parentKey:string) : HTMLElement
 *
 * Dependencies:
 * - log.js (log)
 *
 * Notes:
 * - Percent-based sizing is used to be resilient to container resizes.
 * - We clamp adjacent panels to a minimum of 7% each to avoid collapse.
 * - This module is UI/DOM-only; no knowledge of MiniLayout config structures.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

export const PANEL_SIZE_STORAGE_KEY = "sceneDesignerPanelSizes";

/**
 * Load the persisted sizes object from localStorage.
 * @returns {Record<string, number[]>}
 */
export function loadPanelSizes() {
  try {
    const raw = localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return {};
    const sizes = JSON.parse(raw);
    log("INFO", "[minilayout-splitter] Panel sizes loaded", sizes);
    return sizes;
  } catch (e) {
    log("ERROR", "[minilayout-splitter] Failed to load panel sizes", e);
    return {};
  }
}

/**
 * Save the entire sizes object to localStorage.
 * @param {Record<string, number[]>} sizes
 */
export function savePanelSizes(sizes) {
  try {
    localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(sizes));
    log("INFO", "[minilayout-splitter] Panel sizes saved", sizes);
  } catch (e) {
    log("ERROR", "[minilayout-splitter] Failed to save panel sizes", e);
  }
}

/**
 * Convert a path array (e.g., ["row-0","column-1"]) to a storage key string.
 * @param {string[]} pathArr
 */
export function panelPathKey(pathArr) {
  return Array.isArray(pathArr) ? pathArr.join(":") : String(pathArr || "");
}

/**
 * Build a vertical/horizontal splitter that resizes adjacent panels and persists sizes.
 * - Uses previousElementSibling/nextElementSibling as the panels to resize.
 * - Persists sizes for all (panel) children under the given parentEl key.
 * @param {"row"|"column"} type
 * @param {HTMLElement} parentEl
 * @param {string} parentKey
 * @returns {HTMLElement} splitter element
 */
export function makePersistedSplitter(type, parentEl, parentKey) {
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

  function installDragHandlers(startClientX, startClientY, prev, next, totalSize, prevSize, nextSize) {
    function onMove(ev) {
      const clientX = ev.type === "touchmove" ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.type === "touchmove" ? ev.touches[0].clientY : ev.clientY;
      const dx = clientX - startClientX;
      const dy = clientY - startClientY;

      let newPrev = type === "row" ? ((prevSize + dx) / totalSize) * 100 : ((prevSize + dy) / totalSize) * 100;
      let newNext = type === "row" ? ((nextSize - dx) / totalSize) * 100 : ((nextSize - dy) / totalSize) * 100;

      // Clamp min size to avoid collapse
      if (newPrev < 7) {
        newNext -= (7 - newPrev);
        newPrev = 7;
      }
      if (newNext < 7) {
        newPrev -= (7 - newNext);
        newNext = 7;
      }

      if (type === "row") {
        prev.style.width = `${newPrev}%`;
        prev.style.flex = `0 0 ${newPrev}%`;
        next.style.width = `${newNext}%`;
        next.style.flex = `0 0 ${newNext}%`;
      } else {
        prev.style.height = `${newPrev}%`;
        prev.style.flex = `0 0 ${newPrev}%`;
        next.style.height = `${newNext}%`;
        next.style.flex = `0 0 ${newNext}%`;
      }

      // Persist sizes for ALL panel children under this parent
      const children = Array.from(parentEl.children).filter(el =>
        el.classList.contains("minilayout-panel") || el.classList.contains("minilayout-panel-stack")
      );
      const sizes = [];
      for (let i = 0; i < children.length; i++) {
        if (type === "row") {
          const w = children[i].getBoundingClientRect().width;
          sizes[i] = (w / totalSize) * 100;
        } else {
          const h = children[i].getBoundingClientRect().height;
          sizes[i] = (h / totalSize) * 100;
        }
      }
      const allSizes = loadPanelSizes();
      allSizes[parentKey] = sizes;
      savePanelSizes(allSizes);

      log("DEBUG", "[minilayout-splitter] Drag move", {
        parentKey, type, newPrev, newNext, childCount: children.length
      });

      // Prevent scrolling on touch devices during resize
      if (ev.cancelable) ev.preventDefault();
    }

    function onUp() {
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
  }

  splitter.addEventListener("mousedown", (e) => {
    const prev = splitter.previousElementSibling;
    const next = splitter.nextElementSibling;
    if (!prev || !next) return;
    const parentRect = parentEl.getBoundingClientRect();
    const prevRect = prev.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    const totalSize = type === "row" ? parentRect.width : parentRect.height;
    const prevSize = type === "row" ? prevRect.width : prevRect.height;
    const nextSize = type === "row" ? nextRect.width : nextRect.height;

    document.body.style.cursor = splitter.style.cursor;
    installDragHandlers(e.clientX, e.clientY, prev, next, totalSize, prevSize, nextSize);
    e.preventDefault();
  });

  splitter.addEventListener("touchstart", (e) => {
    const prev = splitter.previousElementSibling;
    const next = splitter.nextElementSibling;
    if (!prev || !next) return;
    const parentRect = parentEl.getBoundingClientRect();
    const prevRect = prev.getBoundingClientRect();
    const nextRect = next.getBoundingClientRect();
    const totalSize = type === "row" ? parentRect.width : parentRect.height;
    const prevSize = type === "row" ? prevRect.width : prevRect.height;
    const nextSize = type === "row" ? nextRect.width : nextRect.height;

    document.body.style.cursor = splitter.style.cursor;
    const t = e.touches[0];
    installDragHandlers(t.clientX, t.clientY, prev, next, totalSize, prevSize, nextSize);
    if (e.cancelable) e.preventDefault();
  });

  return splitter;
}
