/**
 * selection.js
 * -----------------------------------------------------------
 * Scene Designer – Selection Facade (ESM ONLY)
 * Purpose:
 * - Keep the public import path stable: import from './selection.js'.
 * - Re-export the public API from selection-core.js.
 * - Optionally attach debug helpers to window for dev convenience.
 *
 * Public Exports (unchanged):
 * - setSelectedShape
 * - setSelectedShapes
 * - selectAllShapes
 * - deselectAll
 * - attachSelectionHandlers
 * - isShapeSelected
 * - getSelectedShapes
 * - getSelectedShape
 *
 * Dependencies:
 * - selection-core.js
 * -----------------------------------------------------------
 */

import {
  setSelectedShape,
  setSelectedShapes,
  selectAllShapes,
  deselectAll,
  attachSelectionHandlers,
  isShapeSelected,
  getSelectedShapes,
  getSelectedShape
} from './selection-core.js';

// Re-export the public API
export {
  setSelectedShape,
  setSelectedShapes,
  selectAllShapes,
  deselectAll,
  attachSelectionHandlers,
  isShapeSelected,
  getSelectedShapes,
  getSelectedShape
};

// Optional: expose debug helpers (dev only)
if (typeof window !== "undefined") {
  window.setSelectedShape = setSelectedShape;
  window.setSelectedShapes = setSelectedShapes;
  window.selectAllShapes = selectAllShapes;
  window.deselectAll = deselectAll;
  window.isShapeSelected = isShapeSelected;
  window.getSelectedShape = getSelectedShape;
  window.getSelectedShapes = getSelectedShapes;
  window.attachSelectionHandlers = attachSelectionHandlers;
}
