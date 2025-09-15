/**
 * shapes.js
 * -----------------------------------------------------------
 * Scene Designer – Shape Factory Module (ESM only)
 * - Exports factory functions to construct Point, Rect, and Circle shapes as Konva nodes/groups.
 * - All shape creation, selection, locking, and event logic centralized here.
 * - No window/global code or legacy dependencies.
 * - Logging: Uses log.js.
 * - Dependencies: Konva, log.js, state.js, selection.js
 * -----------------------------------------------------------
 */

import Konva from "konva";
import { log } from "./log.js";
import { AppState, getSetting } from "./state.js";
import { attachSelectionHandlers } from "./selection.js";

/**
 * Factory: Create a fully featured point shape (crosshair, halo, hit area, selection logic).
 * @param {number} x
 * @param {number} y
 * @returns {Konva.Group}
 */
export function makePointShape(x, y) {
  log("TRACE", "[shapes] makePointShape entry", { x, y });

  // Use settings or defaults
  const crossLen = Number(getSetting("pointCrossLen")) || 14;
  const haloR = Number(getSetting("pointHaloRadius")) || 12;
  const hitR = Number(getSetting("pointHitRadius")) || 16;

  const group = new Konva.Group({ x, y, draggable: true });

  // Invisible hit area (for easy tap/drag)
  const hitCircle = new Konva.Circle({
    x: 0,
    y: 0,
    radius: hitR,
    fill: "#fff",
    opacity: 0,
    listening: true
  });

  // Halo (faint circle for visibility/selection)
  const halo = new Konva.Circle({
    x: 0,
    y: 0,
    radius: haloR,
    stroke: '#2176ff',
    strokeWidth: 1.5,
    opacity: 0.4,
    listening: false
  });

  // Horizontal crosshair line
  const crossH = new Konva.Line({
    points: [-crossLen / 2, 0, crossLen / 2, 0],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Vertical crosshair line
  const crossV = new Konva.Line({
    points: [0, -crossLen / 2, 0, crossLen / 2],
    stroke: '#2176ff',
    strokeWidth: 2.5,
    lineCap: 'round',
    listening: false
  });

  // Selection halo (visible when selected)
  const selHalo = new Konva.Circle({
    x: 0, y: 0,
    radius: haloR + 3,
    stroke: "#0057d8",
    strokeWidth: 2,
    opacity: 0.8,
    visible: false,
    listening: false
  });

  // Add in correct order
  group.add(hitCircle);
  group.add(selHalo);
  group.add(halo);
  group.add(crossH);
  group.add(crossV);

  // Data properties
  group._type = 'point';
  group._label = 'Point' + (AppState.shapes.filter(s => s._type === 'point').length + 1);
  group.locked = false;

  // Selection/highlight logic for future
  group.showSelection = function (isSelected) {
    selHalo.visible(isSelected);
  };

  // Color sampling hook (for future color sample logic)
  group.getSampleCoords = function () {
    log("TRACE", "[shapes] getSampleCoords called", { group });
    return { x: group.x(), y: group.y() };
  };

  // Cursor feedback
  group.on('mouseenter', () => {
    if (AppState.konvaStage && AppState.konvaStage.container())
      AppState.konvaStage.container().style.cursor = 'pointer';
  });
  group.on('mouseleave', () => {
    if (AppState.konvaStage && AppState.konvaStage.container())
      AppState.konvaStage.container().style.cursor = '';
  });

  // Attach selection logic from selection.js
  attachSelectionHandlers(group);

  log("TRACE", "[shapes] makePointShape exit", group);
  return group;
}

/**
 * Factory: Create a rectangle shape (Konva.Rect) with selection, locking, and default size/stroke/fill.
 * @param {number} x - X position (top-left)
 * @param {number} y - Y position (top-left)
 * @param {number} [w] - Width (from settings if not provided)
 * @param {number} [h] - Height (from settings if not provided)
 * @returns {Konva.Rect}
 */
export function makeRectShape(x, y, w, h) {
  log("TRACE", "[shapes] makeRectShape entry", { x, y, w, h });

  const width = Number(w) || Number(getSetting("defaultRectWidth")) || 50;
  const height = Number(h) || Number(getSetting("defaultRectHeight")) || 30;
  const stroke = getSetting("defaultStrokeColor") || "#000";
  const fill = getSetting("defaultFillColor") || "#0000";

  const rect = new Konva.Rect({
    x: x,
    y: y,
    width: width,
    height: height,
    stroke,
    strokeWidth: 1,
    fill,
    draggable: true
  });

  rect._type = "rect";
  rect._label = "Rect" + (AppState.shapes.filter(s => s._type === 'rect').length + 1);
  rect.locked = false;

  // Selection/highlight logic for transformer
  rect.showSelection = function (isSelected) {
    // No custom highlight, use transformer anchors
  };

  // Color sampling hook (center pixel for now)
  rect.getSampleCoords = function () {
    return {
      x: Math.round(rect.x() + rect.width() / 2),
      y: Math.round(rect.y() + rect.height() / 2)
    };
  };

  // Cursor feedback
  rect.on('mouseenter', () => {
    if (AppState.konvaStage && AppState.konvaStage.container())
      AppState.konvaStage.container().style.cursor = 'move';
  });
  rect.on('mouseleave', () => {
    if (AppState.konvaStage && AppState.konvaStage.container())
      AppState.konvaStage.container().style.cursor = '';
  });

  attachSelectionHandlers(rect);

  log("TRACE", "[shapes] makeRectShape exit", rect);
  return rect;
}

// Future: makeCircleShape(x, y, r) to be added here.
