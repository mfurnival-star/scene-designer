/**
 * shape-defs.js
 * -----------------------------------------------------------
 * Centralized per-shape definition/config for Scene Designer.
 * - All shape types and their edit/transform properties in one place.
 * - Used by transformer.js, shapes.js, canvas.js, etc.
 * - Easy to extend for new shape types or features.
 * -----------------------------------------------------------
 */

export const SHAPE_DEFS = {
  rect: {
    label: "Rectangle",
    enabledAnchors: [
      'top-left','top-center','top-right',
      'middle-left','middle-right',
      'bottom-left','bottom-center','bottom-right'
    ],
    rotateEnabled: true,
    keepRatio: false,
    resizable: true,
    selectable: true,
    editable: true
    // Future: canDuplicate, supportsLabelEdit, etc.
  },
  circle: {
    label: "Circle",
    enabledAnchors: [
      'top-left','top-right','bottom-left','bottom-right'
    ],
    rotateEnabled: false,
    keepRatio: true,
    resizable: true,
    selectable: true,
    editable: true
  },
  point: {
    label: "Point",
    enabledAnchors: [],
    rotateEnabled: false,
    keepRatio: false,
    resizable: false,
    selectable: true,
    editable: false
  }
  // Add more shape types here as needed
};

/**
 * Utility: Get shape definition for a shape or type string.
 * @param {string|object} shapeOrType
 * @returns {object} shape definition config
 */
export function getShapeDef(shapeOrType) {
  const type = typeof shapeOrType === "string" ? shapeOrType
    : shapeOrType?._type;
  return SHAPE_DEFS[type] || null;
}
