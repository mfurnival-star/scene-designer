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
