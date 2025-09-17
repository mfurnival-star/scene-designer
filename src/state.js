/**
 * state.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized App State Store (ESM ONLY)
 * - Single source of truth for app state: shapes, selection, image, canvas, settings.
 * - Zustand-style store pattern (no window/global usage).
 * - Exports: getState, setShapes, setSelectedShapes, addShape, removeShape,
 *            setImage, setFabricCanvas, setBgFabricImage, setSettings, setSetting,
 *            getSetting, setSceneName, setSceneLogic, sceneDesignerStore, subscribe
 * - Used by all major modules (canvas.js, shapes.js, selection.js, settings.js, transformer.js, sidebar.js, layout.js, etc).
 * - All logging via log.js.
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
  return _state;
}
export function setShapes(arr) {
  log("DEBUG", "[state] setShapes", { arr });
  _state.shapes = Array.isArray(arr) ? arr : [];
  notify();
}
export function setSelectedShapes(arr) {
  log("DEBUG", "[state] setSelectedShapes", { arr });
  _state.selectedShapes = Array.isArray(arr) ? arr : [];
  _state.selectedShape = arr && arr.length === 1 ? arr[0] : null;
  notify();
}
export function addShape(shape) {
  log("DEBUG", "[state] addShape", { shape });
  if (shape) _state.shapes.push(shape);
  notify();
}
export function removeShape(shape) {
  log("DEBUG", "[state] removeShape", { shape });
  _state.shapes = _state.shapes.filter(s => s !== shape);
  notify();
}
export function setImage(url, obj) {
  log("DEBUG", "[state] setImage", { url, obj });
  _state.imageURL = url;
  _state.imageObj = obj;
  notify();
}
export function setFabricCanvas(canvas) {
  log("DEBUG", "[state] setFabricCanvas", { canvas });
  _state.fabricCanvas = canvas;
  notify();
}
export function setBgFabricImage(img) {
  log("DEBUG", "[state] setBgFabricImage", { img });
  _state.bgFabricImage = img;
  notify();
}

// --- Settings API ---
export function setSettings(obj) {
  log("DEBUG", "[state] setSettings", { obj });
  _state.settings = { ...obj };
  notify();
}
export function setSetting(key, value) {
  log("DEBUG", "[state] setSetting", { key, value });
  _state.settings[key] = value;
  notify();
}
export function getSetting(key) {
  return _state.settings[key];
}

// --- Scene Name & Logic ---
export function setSceneName(name) {
  log("DEBUG", "[state] setSceneName", { name });
  _state.sceneName = name;
  notify();
}
export function setSceneLogic(logic) {
  log("DEBUG", "[state] setSceneLogic", { logic });
  _state.sceneLogic = logic;
  notify();
}

// --- Subscribe API ---
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(details = null) {
  for (const fn of listeners) {
    try {
      fn(_state, details);
    } catch (e) {
      log("ERROR", "[state] notify listener error", e);
    }
  }
}

// --- Export store for direct access (Zustand-like) ---
export const sceneDesignerStore = {
  getState,
  setState: function (obj) {
    Object.assign(_state, obj);
    notify();
  },
  subscribe
};

