/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Facade (ESM ONLY)
 * Purpose:
 * - Keep the public import path stable for all modules that import './shapes.js'.
 * - Re-export the public API from the split modules:
 *    - shapes-core.js → core helpers + non-point shapes (rect, circle),
 *      stroke-width helpers, diagnostic label visibility.
 *    - shapes-point.js → point-only logic (reticle styles and factory).
 *
 * Public Exports (unchanged):
 * - setStrokeWidthForSelectedShapes
 * - fixStrokeWidthAfterTransform
 * - makePointShape
 * - makeRectShape
 * - makeCircleShape
 * - applyDiagnosticLabelsVisibility
 *
 * Notes:
 * - Splitting helps keep files < ~350 lines and separates point-specific logic.
 * - All imports in the app should continue to use './shapes.js'.
 * -----------------------------------------------------------
 */

export {
  // Core helpers and non-point shapes
  setStrokeWidthForSelectedShapes,
  fixStrokeWidthAfterTransform,
  makeRectShape,
  makeCircleShape,
  applyDiagnosticLabelsVisibility
} from './shapes-core.js';

export {
  // Point-only factory
  makePointShape
} from './shapes-point.js';

