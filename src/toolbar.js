/**
 * toolbar.js
 * -----------------------------------------------------------
 * Scene Designer – Toolbar Facade (ESM ONLY)
 * Purpose:
 * - Keep the public import path stable: import { buildCanvasToolbarPanel } from './toolbar.js'.
 * - Re-export the panel builder from toolbar-panel.js after splitting the monolith.
 *
 * Public Exports:
 * - buildCanvasToolbarPanel
 *
 * Dependencies:
 * - toolbar-panel.js
 * -----------------------------------------------------------
 */

export { buildCanvasToolbarPanel } from './toolbar-panel.js';
