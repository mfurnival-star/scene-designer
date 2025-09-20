/**
 * minilayout.js
 * -----------------------------------------------------------
 * Scene Designer – MiniLayout Facade (ESM ONLY)
 * Purpose:
 * - Keep the public import path stable: import { MiniLayout } from './minilayout.js'.
 * - Re-export the MiniLayout class from minilayout-core.js.
 * - Ensures external modules (e.g., layout.js) do not need to change imports.
 *
 * Public Exports (unchanged):
 * - MiniLayout
 *
 * Dependencies:
 * - minilayout-core.js
 * -----------------------------------------------------------
 */

export { MiniLayout } from './minilayout-core.js';
