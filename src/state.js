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
 * Subscribe to AppState changes.
 * @param {Function} fn - Function to call on state changes.
 * @returns {Function} Unsubscribe function.
 */
export function subscribe(fn) {
  log("TRACE", "[state] subscribe() called", fn);
  if (typeof fn !== "function") return () => {};
  AppState._subscribers.push(fn);
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
  log("DEBUG", "[state] notifySubscribers", details);
  for (const fn of AppState._subscribers) {
    try { fn(AppState, details); }
    catch (e) { log("ERROR", "[state] Subscriber error", e); }
  }
}

/**
 * Set and notify for shapes array.
 * @param {Array} newShapes
 */
export function setShapes(newShapes) {
  log("TRACE", "[state] setShapes() called", newShapes);
  AppState.shapes = Array.isArray(newShapes) ? newShapes : [];
  notifySubscribers({ type: "shapes", shapes: AppState.shapes });
  log("DEBUG", "[state] setShapes: shapes updated", AppState.shapes);
}

/**
 * Set selected shapes (multi-select).
 * @param {Array} arr
 */
export function setSelectedShapes(arr) {
  log("TRACE", "[state] setSelectedShapes() called", arr);
  AppState.selectedShapes = Array.isArray(arr) ? arr : [];
  AppState.selectedShape = AppState.selectedShapes.length === 1 ? AppState.selectedShapes[0] : null;
  notifySubscribers({ type: "selection", selectedShapes: AppState.selectedShapes });
  log("DEBUG", "[state] setSelectedShapes: selection updated", AppState.selectedShapes);
}

/**
 * Add a new shape to shapes array.
 * @param {Object} shape
 */
export function addShape(shape) {
  log("TRACE", "[state] addShape() called", shape);
  if (!shape) return;
  AppState.shapes.push(shape);
  notifySubscribers({ type: "addShape", shape });
  log("DEBUG", "[state] addShape: shape added", shape);
}

/**
 * Remove a shape from shapes array.
 * @param {Object} shape
 */
export function removeShape(shape) {
  log("TRACE", "[state] removeShape() called", shape);
  if (!shape) return;
  AppState.shapes = AppState.shapes.filter(s => s !== shape);
  notifySubscribers({ type: "removeShape", shape });
  log("DEBUG", "[state] removeShape: shape removed", shape);
}

/**
 * Set the scene name.
 * @param {String} name
 */
export function setSceneName(name) {
  log("TRACE", "[state] setSceneName() called", name);
  AppState.sceneName = name || '';
  notifySubscribers({ type: "sceneName", sceneName: AppState.sceneName });
  log("DEBUG", "[state] setSceneName: sceneName updated", AppState.sceneName);
}

/**
 * Set scene logic ('AND' or 'OR').
 * @param {String} logic
 */
export function setSceneLogic(logic) {
  log("TRACE", "[state] setSceneLogic() called", logic);
  AppState.sceneLogic = ['AND', 'OR'].includes(logic) ? logic : 'AND';
  notifySubscribers({ type: "sceneLogic", sceneLogic: AppState.sceneLogic });
  log("DEBUG", "[state] setSceneLogic: sceneLogic updated", AppState.sceneLogic);
}

/**
 * Set the current image URL and object.
 * @param {String} url
 * @param {HTMLImageElement} [imgObj]
 */
export function setImage(url, imgObj = null) {
  log("TRACE", "[state] setImage() called", { url, imgObj });
  AppState.imageURL = url || null;
  AppState.imageObj = imgObj || null;
  notifySubscribers({ type: "image", imageURL: AppState.imageURL, imageObj: AppState.imageObj });
  log("DEBUG", "[state] setImage: image updated", { url: AppState.imageURL, imgObj: !!AppState.imageObj });
}

/**
 * Set settings (copy or merge).
 * @param {Object} settingsObj
 */
export function setSettings(settingsObj) {
  log("TRACE", "[state] setSettings() called", settingsObj);
  AppState.settings = { ...AppState.settings, ...settingsObj };
  notifySubscribers({ type: "settings", settings: AppState.settings });
  log("DEBUG", "[state] setSettings: settings updated", AppState.settings);
}

/**
 * Set individual setting key/value.
 * @param {String} key
 * @param {*} value
 */
export function setSetting(key, value) {
  log("TRACE", "[state] setSetting() called", { key, value });
  AppState.settings[key] = value;
  notifySubscribers({ type: "setting", key, value });
  log("DEBUG", "[state] setSetting: setting updated", { key, value });
}

/**
 * Get setting by key.
 * @param {String} key
 * @returns {*}
 */
export function getSetting(key) {
  log("TRACE", "[state] getSetting() called", { key });
  return AppState.settings[key];
}

// --- Self-test log ---
log("INFO", "[state] state.js module loaded and ready.");

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


