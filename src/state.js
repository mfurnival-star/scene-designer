/**
 * state.js
 * -----------------------------------------------------------
 * Scene Designer – Centralized App State Store (ESM ONLY)
 * Purpose:
 * - Single source of truth for app state: shapes, selection, image, canvas, settings.
 * - Zustand-style store pattern (no window/global usage).
 * - Exports: getState, setShapes, setSelectedShapes, addShape, removeShape,
 *            setImage, setFabricCanvas, setBgFabricImage, setSettings, setSetting,
 *            getSetting, setSceneName, setSceneLogic, sceneDesignerStore, subscribe
 *
 * Logging Policy (reduced noise):
 * - WARN/ERROR: unchanged (always log).
 * - INFO: Only for high-level changes (e.g., shapes count, image set/cleared, settings saved).
 * - DEBUG: Removed for hot-path getters and redundant ENTRY/EXIT pairs.
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
  // No debug noise here; this is called very frequently.
  return _state;
}

export function setShapes(arr) {
  const next = Array.isArray(arr) ? arr : [];
  _state.shapes = next;
  notify({ type: "setShapes", arr: next });
  log("INFO", "[state] shapes set", { count: next.length });
}

export function setSelectedShapes(arr) {
  const next = Array.isArray(arr) ? arr : [];
  _state.selectedShapes = next;
  _state.selectedShape = next.length === 1 ? next[0] : null;
  notify({ type: "setSelectedShapes", arr: next });
  log("INFO", "[state] selection set", { selectedCount: next.length, singleId: _state.selectedShape?._id || null });
}

export function addShape(shape) {
  if (!shape) return;
  _state.shapes.push(shape);
  notify({ type: "addShape", shape });
  log("INFO", "[state] shape added", { id: shape._id, type: shape._type });
}

export function removeShape(shape) {
  // Use _id-based deletion for robustness (fixes reselect/delete bug)
  if (!shape || !shape._id) {
    log("WARN", "[state] removeShape: shape or _id missing", { shape });
    return;
  }
  _state.shapes = _state.shapes.filter(s => s._id !== shape._id);
  notify({ type: "removeShape", shape });
  log("INFO", "[state] shape removed", { id: shape._id });
}

export function setImage(url, obj) {
  const prevHad = !!_state.imageObj;
  _state.imageURL = url || null;
  _state.imageObj = obj || null;
  notify({ type: "setImage", url: _state.imageURL, obj: _state.imageObj });
  log("INFO", "[state] image " + (obj ? "set" : (prevHad ? "cleared" : "unchanged")), {
    url: _state.imageURL,
    hasImg: !!_state.imageObj
  });
}

export function setFabricCanvas(canvas) {
  _state.fabricCanvas = canvas || null;
  notify({ type: "setFabricCanvas", canvas: _state.fabricCanvas });
  log("INFO", "[state] fabricCanvas set", { present: !!_state.fabricCanvas });
}

export function setBgFabricImage(img) {
  _state.bgFabricImage = img || null;
  notify({ type: "setBgFabricImage", img: _state.bgFabricImage });
  // No INFO log to avoid noise during image (re)apply cycles.
}

// --- Settings API ---
export function setSettings(obj) {
  const next = { ...(obj || {}) };
  _state.settings = next;
  notify({ type: "setSettings", settings: next });
  log("INFO", "[state] settings replaced", { keys: Object.keys(next).length });
}

export function setSetting(key, value) {
  _state.settings[key] = value;
  notify({ type: "setSetting", key, value });
  log("INFO", "[state] setting updated", { key });
}

export function getSetting(key) {
  // No logging here (hot path from UI/layout).
  return _state.settings[key];
}

// --- Scene Name & Logic ---
export function setSceneName(name) {
  _state.sceneName = name || "";
  notify({ type: "setSceneName", name: _state.sceneName });
  log("INFO", "[state] scene name set", { sceneName: _state.sceneName });
}

export function setSceneLogic(logic) {
  _state.sceneLogic = logic || "AND";
  notify({ type: "setSceneLogic", logic: _state.sceneLogic });
  log("INFO", "[state] scene logic set", { sceneLogic: _state.sceneLogic });
}

// --- Subscribe API ---
export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  listeners.push(fn);
  // Keep subscribe/unsubscribe quiet to avoid noise during panel rebuilds.
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(details = null) {
  // No DEBUG spam; only call listeners and guard errors.
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
    if (!obj || typeof obj !== "object") return;
    Object.assign(_state, obj);
    notify({ type: "setState", obj });
    // Keep this at DEBUG since it's uncommon but can be verbose.
    log("DEBUG", "[state] setState applied", { keys: Object.keys(obj) });
  },
  subscribe
};
