/**
 * fabric-wrapper.js
 * -----------------------------------------------------------
 * ES Module Wrapper for Fabric.js to normalize exports for Scene Designer.
 * - Imports 'fabric' (UMD package) and re-exports constructors used across the app.
 * - Keeps all consumers on ESM named imports (no window/global access).
 *
 * Exports:
 * - Named: Canvas, Rect, Circle, Ellipse, Line, Group, Image, Path, Text
 * - Default: fabric namespace (for access to ActiveSelection, etc.)
 *
 * Notes:
 * - Added Ellipse export (2025-09-24) for new 'ellipse' shape type.
 * - This wrapper allows files like shapes-core.js to import { Ellipse, Text } from './fabric-wrapper.js'
 *   instead of using window.fabric.* thereby maintaining manifesto compliance.
 * -----------------------------------------------------------
 */

import fabricImport from 'fabric';

// Resolve the Fabric namespace across different bundlers
const fabric = fabricImport.fabric || fabricImport;

// Named constructors used by the app
export const Canvas = fabric.Canvas;
export const Rect = fabric.Rect;
export const Circle = fabric.Circle;
export const Ellipse = fabric.Ellipse;
export const Line = fabric.Line;
export const Group = fabric.Group;
export const Image = fabric.Image;
export const Path = fabric.Path;
export const Text = fabric.Text;

// Default export for access to other Fabric types (e.g., ActiveSelection)
export default fabric;

