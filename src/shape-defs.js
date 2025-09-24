/**
 * shape-defs.js
 * -----------------------------------------------------------
 * Centralized per-shape definition/config for Scene Designer.
 * - All shape types and their edit/transform properties in one place.
 * - Consumed by: transformer.js (controls), selection-core.js, actions.js (for intent logic).
 * - Easy to extend for new shape types or features.
 *
 * 2025-09-24 Update:
 * - Added new 'ellipse' shape type (free aspect ratio, rotatable, 8 anchors).
 * - Clarified 'circle' shape: non-rotatable, aspect ratio locked (uniform scaling),
 *   only 4 corner anchors to enforce uniform resize (no edge-only distortion).
 *
 * Notes:
 * - enabledAnchors values correspond to the control positions our transformer logic
 *   understands. Unsupported anchors are simply ignored.
 * - keepRatio=true is enforced in transformer.js via lockUniScaling for circle only.
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
  },

  // Circle: perfect circle – cannot rotate, cannot be non-uniformly scaled.
  // Only 4 corner anchors shown to reinforce uniform scaling UX.
  circle: {
    label: "Circle",
    enabledAnchors: [
      'top-left','top-right','bottom-left','bottom-right'
    ],
    rotateEnabled: false,
    keepRatio: true,         // enforce uniform (radius) scaling
    resizable: true,
    selectable: true,
    editable: true
  },

  // Ellipse: new shape – rotatable and freely resizable (non-uniform),
  // all 8 anchors (corners + edges) enabled.
  ellipse: {
    label: "Ellipse",
    enabledAnchors: [
      'top-left','top-center','top-right',
      'middle-left','middle-right',
      'bottom-left','bottom-center','bottom-right'
    ],
    rotateEnabled: true,
    keepRatio: false,        // allow user to stretch into any ellipse
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
 * Utility: Get shape definition for a shape instance or a type string.
 * @param {string|object} shapeOrType
 * @returns {object|null} shape definition config
 */
export function getShapeDef(shapeOrType) {
  const type = typeof shapeOrType === "string"
    ? shapeOrType
    : shapeOrType?._type;
  return SHAPE_DEFS[type] || null;
}

