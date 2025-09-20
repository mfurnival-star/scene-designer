/**
 * state.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized App State Store (ESM ONLY, DEBUG Logging Sweep)
 * - Single source of truth for app state: shapes, selection, image, canvas, settings.
 * - Zustand-style store pattern (no window/global usage).
 * - Exports: getState, setShapes, setSelectedShapes, addShape, removeShape,
 *            setImage, setFabricCanvas, setBgFabricImage, setSettings, setSetting,
 *            getSetting, setSceneName, setSceneLogic, sceneDesignerStore, subscribe
 * - Used by all major modules (canvas.js, shapes.js, selection.js, settings.js, transformer.js, sidebar.js, layout.js, etc).
 * - DEBUG logging for all state mutation, selection, notification, and error cases.
 * -----------------------------------------------------------
 */

import { log } from './log.js';

// --- Core Store Object ---
let _state = {
  shapes: [],
  selectedShape: null,
  selectedShapes: [],
  imageObj: null,
  imageURL: null,
  fabricCanvas: null,
  bgFabricImage: null,
  settings: {},
  sceneName: "",
  sceneLogic: "AND"
};

const listeners = [];

// --- Store API ---
export function getState() {
  log("DEBUG", "[state] getState called", { _state });
  return _state;
}
export function setShapes(arr) {
  log("DEBUG", "[state] setShapes ENTRY", { arr, prevShapes: _state.shapes });
  _state.shapes = Array.isArray(arr) ? arr : [];
  notify({ type: "setShapes", arr });
  log("DEBUG", "[state] setShapes EXIT", { shapes: _state.shapes });
}
export function setSelectedShapes(arr) {
  log("DEBUG", "[state] setSelectedShapes ENTRY", { arr, prevSelectedShapes: _state.selectedShapes });
  _state.selectedShapes = Array.isArray(arr) ? arr : [];
  _state.selectedShape = arr && arr.length === 1 ? arr[0] : null;
  notify({ type: "setSelectedShapes", arr });
  log("DEBUG", "[state] setSelectedShapes EXIT", { selectedShapes: _state.selectedShapes, selectedShape: _state.selectedShape });
}
export function addShape(shape) {
  log("DEBUG", "[state] addShape ENTRY", { shape, prevShapes: _state.shapes });
  if (shape) _state.shapes.push(shape);
  notify({ type: "addShape", shape });
  log("DEBUG", "[state] addShape EXIT", { shapes: _state.shapes });
}
export function removeShape(shape) {
  log("DEBUG", "[state] removeShape ENTRY", { shape, prevShapes: _state.shapes });
  // Use _id-based deletion for robustness (fixes reselect/delete bug)
  if (!shape || !shape._id) {
    log("WARN", "[state] removeShape: shape or _id missing", { shape });
    return;
  }
  _state.shapes = _state.shapes.filter(s => s._id !== shape._id);
  notify({ type: "removeShape", shape });
  log("DEBUG", "[state] removeShape EXIT", { shapes: _state.shapes });
}
export function setImage(url, obj) {
  log("DEBUG", "[state] setImage ENTRY", { url, obj, prevImageObj: _state.imageObj, prevImageURL: _state.imageURL });
  _state.imageURL = url;
  _state.imageObj = obj;
  notify({ type: "setImage", url, obj });
  log("DEBUG", "[state] setImage EXIT", { imageURL: _state.imageURL, imageObj: _state.imageObj });
}
export function setFabricCanvas(canvas) {
  log("DEBUG", "[state] setFabricCanvas ENTRY", { canvas, prevFabricCanvas: _state.fabricCanvas });
  _state.fabricCanvas = canvas;
  notify({ type: "setFabricCanvas", canvas });
  log("DEBUG", "[state] setFabricCanvas EXIT", { fabricCanvas: _state.fabricCanvas });
}
export function setBgFabricImage(img) {
  log("DEBUG", "[state] setBgFabricImage ENTRY", { img, prevBgFabricImage: _state.bgFabricImage });
  _state.bgFabricImage = img;
  notify({ type: "setBgFabricImage", img });
  log("DEBUG", "[state] setBgFabricImage EXIT", { bgFabricImage: _state.bgFabricImage });
}

// --- Settings API ---
export function setSettings(obj) {
  log("DEBUG", "[state] setSettings ENTRY", { obj, prevSettings: _state.settings });
  _state.settings = { ...obj };
  notify({ type: "setSettings", settings: _state.settings });
  log("DEBUG", "[state] setSettings EXIT", { settings: _state.settings });
}
export function setSetting(key, value) {
  log("DEBUG", "[state] setSetting ENTRY", { key, value, prevValue: _state.settings[key] });
  _state.settings[key] = value;
  notify({ type: "setSetting", key, value });
  log("DEBUG", "[state] setSetting EXIT", { settings: _state.settings });
}
export function getSetting(key) {
  log("DEBUG", "[state] getSetting called", { key, value: _state.settings[key] });
  return _state.settings[key];
}

// --- Scene Name & Logic ---
export function setSceneName(name) {
  log("DEBUG", "[state] setSceneName ENTRY", { name, prevSceneName: _state.sceneName });
  _state.sceneName = name;
  notify({ type: "setSceneName", name });
  log("DEBUG", "[state] setSceneName EXIT", { sceneName: _state.sceneName });
}
export function setSceneLogic(logic) {
  log("DEBUG", "[state] setSceneLogic ENTRY", { logic, prevSceneLogic: _state.sceneLogic });
  _state.sceneLogic = logic;
  notify({ type: "setSceneLogic", logic });
  log("DEBUG", "[state] setSceneLogic EXIT", { sceneLogic: _state.sceneLogic });
}

// --- Subscribe API ---
export function subscribe(fn) {
  log("DEBUG", "[state] subscribe ENTRY", { fn });
  listeners.push(fn);
  log("DEBUG", "[state] subscribe EXIT", { listenersCount: listeners.length });
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
    log("DEBUG", "[state] unsubscribe called", { idx, listenersCount: listeners.length });
  };
}

function notify(details = null) {
  log("DEBUG", "[state] notify ENTRY", { details, state: _state });
  for (const fn of listeners) {
    try {
      fn(_state, details);
      log("DEBUG", "[state] notify: listener called", { fn });
    } catch (e) {
      log("ERROR", "[state] notify listener error", e);
    }
  }
  log("DEBUG", "[state] notify EXIT");
}

// --- Export store for direct access (Zustand-like) ---
export const sceneDesignerStore = {
  getState,
  setState: function (obj) {
    log("DEBUG", "[state] sceneDesignerStore.setState ENTRY", { obj, prevState: _state });
    Object.assign(_state, obj);
    notify({ type: "setState", obj });
    log("DEBUG", "[state] sceneDesignerStore.setState EXIT", { newState: _state });
  },
  subscribe
};
