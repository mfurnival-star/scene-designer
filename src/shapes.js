/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Facade (ESM ONLY)
 * Purpose:
 * - Keep the public import path stable for all modules that import './shapes.js'.
 * - Re-export the public API from the split modules:
 *    - shapes-core.js  → core helpers + non-point shapes (rect, circle, ellipse),
 *                        stroke/fill/stroke-width helpers, diagnostic label visibility.
 *    - shapes-point.js → point-only logic (reticle styles and factory).
 *
 * Public Exports (updated 2025-09-24):
 * - setStrokeWidthForSelectedShapes
 * - fixStrokeWidthAfterTransform
 * - setStrokeColorForSelectedShapes
 * - setFillColorForSelectedShapes
 * - makePointShape
 * - makeRectShape
 * - makeCircleShape
 * - makeEllipseShape
 * - applyDiagnosticLabelsVisibility
 *
 * Notes:
 * - Added makeEllipseShape export (new ellipse shape: rotatable, free aspect).
 * - Circle remains aspect-locked & non-rotatable (see shape-defs.js and transformer.js).
 * - All imports in the app should continue to use './shapes.js' and not import core files directly.
 * -----------------------------------------------------------
 */

export {
  // Core helpers and non-point shapes
  setStrokeWidthForSelectedShapes,
  fixStrokeWidthAfterTransform,
  setStrokeColorForSelectedShapes,
  setFillColorForSelectedShapes,
  makeRectShape,
  makeCircleShape,
  makeEllipseShape,
  applyDiagnosticLabelsVisibility
} from './shapes-core.js';

export {
  // Point-only factory
  makePointShape
} from './shapes-point.js';

