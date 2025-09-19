/**
 * fabric-wrapper.js
 * -----------------------------------------------------------
 * ES Module Wrapper for Fabric.js to normalize exports for Scene Designer.
 * - Imports 'fabric' (UMD package) and re-exports Canvas, Rect, Circle, etc.
 * - Allows named ESM imports everywhere else in your app.
 * - No window/global access.
 * -----------------------------------------------------------
 */
import fabricImport from 'fabric';
// Find the actual Fabric.js namespace (may be fabricImport.fabric or fabricImport)
const fabric = fabricImport.fabric || fabricImport;
// Export named constructors as proper ES module exports:
export const Canvas = fabric.Canvas;
export const Rect = fabric.Rect;
export const Circle = fabric.Circle;
export const Line = fabric.Line;
export const Group = fabric.Group;
export const Image = fabric.Image;
// Optionally export any other needed symbols
export default fabric;
