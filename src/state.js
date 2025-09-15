/**
 * state.js
 * -----------------------------------------------------------
 * Centralized AppState and data model for Scene Designer.
 * - Exports AppState singleton and state management API.
 * - All shape, selection, scene, and settings data live here.
 * - Provides subscribe() for data change listeners.
 * - Mutations only via exported setters and methods.
 * - No global state except the exported AppState.
 * - Adheres to SCENE_DESIGNER_MANIFESTO.md.
 * - Logging: Uses log.js; logs at DEBUG for state changes, TRACE for setter entry/exit if deep tracing is enabled.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import Konva from 'konva'; // For instanceof checks

// Canonical state singleton
export const AppState = {
  // Scene/Canvas
  imageObj: null,        // Loaded image object
  imageURL: null,        // Current image URL (local or server)
  sceneName: '',         // Scene name (for export)
  sceneLogic: 'AND',     // 'AND' or 'OR'

  // Shape Data
  shapes: [],            // Array of shape objects (point, rect, circle, etc.)
  selectedShape: null,   // The currently selected shape (single select)
  selectedShapes: [],    // Array of selected shapes (multiselect)
  transformer: null,     // Konva.Transformer for single select
  konvaStage: null,      // Konva.Stage instance
  konvaLayer: null,      // Konva.Layer instance
  konvaDiv: null,        // Canvas container div

  // Drag/Group/Multi-Select
  multiDrag: { moving: false, dragOrigin: null, origPositions: null },

  // UI/Settings
  settings: {},          // User/configurable settings (populated at load)
  settingsRegistry: [],  // List of settings keys/metadata
  logLevel: 'ERROR',     // Current log level (redundant—see settings)
  logDest: 'console',    // Log destination (console/server/both)

  // Subscribers for state changes
  _subscribers: [],
};

/**
 * Utility: Dump shape diagnostic info for debugging.
 */
function dumpShapeDebug(shape, tag = "") {
  log("TRACE", `[state] ${tag} shape diagnostic`, {
    typeofShape: typeof shape,
    constructorName: shape?.constructor?.name,
    isKonva: shape instanceof Konva.Shape,
    isGroup: shape instanceof Konva.Group,
    isRect: shape instanceof Konva.Rect,
    isCircle: shape instanceof Konva.Circle,
    isObject: shape && typeof shape === "object" && !(shape instanceof Konva.Shape),
    attrs: shape?.attrs,
    className: shape?.className,
    _type: shape?._type,
    _label: shape?._label,
    keys: shape ? Object.keys(shape) : []
  });
}

/**
 * Subscribe to AppState changes.
 * @param {Function} fn - Function to call on state changes.
 * @returns {Function} Unsubscribe function.
 */
export function subscribe(fn) {
  log("TRACE", "[state] subscribe() entry", fn);
  if (typeof fn !== "function") {
    log("TRACE", "[state] subscribe() exit (not a function)");
    return () => {};
  }
  AppState._subscribers.push(fn);
  log("TRACE", "[state] subscribe() exit (subscribed)");
  return () => {
    const idx = AppState._subscribers.indexOf(fn);
    if (idx !== -1) AppState._subscribers.splice(idx, 1);
    log("TRACE", "[state] unsubscribe() called", fn);
  };
}

/**
 * Notify all subscribers of a change.
 * @param {*} details - Optional change metadata.
 */
function notifySubscribers(details = {}) {
  log("TRACE", "[state] notifySubscribers entry", details);
  for (const fn of AppState._subscribers) {
    try { fn(AppState, details); }
    catch (e) { log("ERROR", "[state] Subscriber error", e); }
  }
  log("TRACE", "[state] notifySubscribers exit");
}

/**
 * Set and notify for shapes array.
 * @param {Array} newShapes
 */
export function setShapes(newShapes) {
  log("TRACE", "[state] setShapes() entry", newShapes);
  AppState.shapes = Array.isArray(newShapes) ? newShapes : [];
  notifySubscribers({ type: "shapes", shapes: AppState.shapes });
  log("DEBUG", "[state] setShapes: shapes updated", AppState.shapes);
  log("TRACE", "[state] setShapes() exit");
}

/**
 * Set selected shapes (multi-select).
 * @param {Array} arr
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[state] setSelectedShapes() entry", arr);
  AppState.selectedShapes = Array.isArray(arr) ? arr : [];
  AppState.selectedShape = AppState.selectedShapes.length === 1 ? AppState.selectedShapes[0] : null;
  notifySubscribers({ type: "selection", selectedShapes: AppState.selectedShapes });
  log("DEBUG", "[state] setSelectedShapes: selection updated", AppState.selectedShapes);
  log("TRACE", "[state] setSelectedShapes() exit");
}

/**
 * Add a new shape to shapes array.
 * @param {Object} shape
 */
export function addShape(shape) {
  log("TRACE", "[state] addShape() entry", shape);
  dumpShapeDebug(shape, "addShape entry");
  if (!shape) {
    log("TRACE", "[state] addShape() exit (no shape)");
    return;
  }
  AppState.shapes.push(shape);
  notifySubscribers({ type: "addShape", shape });
  dumpShapeDebug(shape, "addShape after notify");
  log("DEBUG", "[state] addShape: shape added", shape);
  log("TRACE", "[state] addShape() exit");
}

/**
 * Remove a shape from shapes array.
 * @param {Object} shape
 */
export function removeShape(shape) {
  log("TRACE", "[state] removeShape() entry", shape);
  dumpShapeDebug(shape, "removeShape entry");
  if (!shape) {
    log("TRACE", "[state] removeShape() exit (no shape)");
    return;
  }
  AppState.shapes = AppState.shapes.filter(s => s !== shape);
  notifySubscribers({ type: "removeShape", shape });
  dumpShapeDebug(shape, "removeShape after notify");
  log("DEBUG", "[state] removeShape: shape removed", shape);
  log("TRACE", "[state] removeShape() exit");
}

/**
 * Set the scene name.
 * @param {String} name
 */
export function setSceneName(name) {
  log("TRACE", "[state] setSceneName() entry", name);
  AppState.sceneName = name || '';
  notifySubscribers({ type: "sceneName", sceneName: AppState.sceneName });
  log("DEBUG", "[state] setSceneName: sceneName updated", AppState.sceneName);
  log("TRACE", "[state] setSceneName() exit");
}

/**
 * Set scene logic ('AND' or 'OR').
 * @param {String} logic
 */
export function setSceneLogic(logic) {
  log("TRACE", "[state] setSceneLogic() entry", logic);
  AppState.sceneLogic = ['AND', 'OR'].includes(logic) ? logic : 'AND';
  notifySubscribers({ type: "sceneLogic", sceneLogic: AppState.sceneLogic });
  log("DEBUG", "[state] setSceneLogic: sceneLogic updated", AppState.sceneLogic);
  log("TRACE", "[state] setSceneLogic() exit");
}

/**
 * Set the current image URL and object.
 * @param {String} url
 * @param {HTMLImageElement} [imgObj]
 */
export function setImage(url, imgObj = null) {
  log("TRACE", "[state] setImage() entry", { url, imgObj });
  AppState.imageURL = url || null;
  AppState.imageObj = imgObj || null;
  notifySubscribers({ type: "image", imageURL: AppState.imageURL, imageObj: AppState.imageObj });
  log("DEBUG", "[state] setImage: image updated", { url: AppState.imageURL, imgObj: !!AppState.imageObj });
  log("TRACE", "[state] setImage() exit");
}

/**
 * Set settings (copy or merge).
 * @param {Object} settingsObj
 */
export function setSettings(settingsObj) {
  log("TRACE", "[state] setSettings() entry", settingsObj);
  AppState.settings = { ...AppState.settings, ...settingsObj };
  notifySubscribers({ type: "settings", settings: AppState.settings });
  log("DEBUG", "[state] setSettings: settings updated", AppState.settings);
  log("TRACE", "[state] setSettings() exit");
}

/**
 * Set individual setting key/value.
 * @param {String} key
 * @param {*} value
 */
export function setSetting(key, value) {
  log("TRACE", "[state] setSetting() entry", { key, value });
  AppState.settings[key] = value;
  notifySubscribers({ type: "setting", key, value });
  log("DEBUG", "[state] setSetting: setting updated", { key, value });
  log("TRACE", "[state] setSetting() exit");
}

/**
 * Get setting by key.
 * @param {String} key
 * @returns {*}
 */
export function getSetting(key) {
  log("TRACE", "[state] getSetting() entry", { key });
  const value = AppState.settings[key];
  log("TRACE", "[state] getSetting() exit", { value });
  return value;
}

// --- Self-test log ---
// (Removed top-level INFO log to avoid logging before settings and log level are loaded.)
// log("INFO", "[state] state.js module loaded and ready.");

// Optionally attach to window for debugging (remove in production!)
if (typeof window !== "undefined") {
  window.AppState = AppState;
  window.setShapes = setShapes;
  window.setSelectedShapes = setSelectedShapes;
  window.addShape = addShape;
  window.removeShape = removeShape;
  window.setSceneName = setSceneName;
  window.setSceneLogic = setSceneLogic;
  window.setImage = setImage;
  window.setSettings = setSettings;
  window.setSetting = setSetting;
  window.getSetting = getSetting;
  window.subscribeAppState = subscribe;
}

