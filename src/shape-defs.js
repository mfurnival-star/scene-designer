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
  circle: {
    label: "Circle",
    enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'],
    rotateEnabled: false,
    keepRatio: true,
    resizable: true,
    selectable: true,
    editable: true
  },
  ellipse: {
    label: "Ellipse",
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
  point: {
    label: "Point",
    enabledAnchors: [],
    rotateEnabled: false,
    keepRatio: false,
    resizable: false,
    selectable: true,
    editable: false
  }
};

export function getShapeDef(shapeOrType) {
  const type = typeof shapeOrType === "string" ? shapeOrType : shapeOrType?._type;
  return SHAPE_DEFS[type] || null;
}
