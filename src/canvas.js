/**
 * canvas.js
 * -----------------------------------------------------------
 * Scene Designer – Canvas Facade (ESM ONLY)
 * Purpose:
 * - Thin wrapper to preserve the public import path './canvas.js'.
 * - Delegates all Fabric.js canvas logic to dedicated modules:
 *     - canvas-core.js   → canvas creation, image/background, state sync
 *     - canvas-events.js → Fabric selection lifecycle sync
 *
 * Exports:
 * - buildCanvasPanel({ element, title, componentName })
 *
 * Dependencies:
 * - canvas-core.js
 *
 * Notes:
 * - This file intentionally contains no Fabric/event logic; it re-exports the core API.
 * - Keeps exports.index.json and external imports stable.
 */

export { buildCanvasPanel } from './canvas-core.js';
