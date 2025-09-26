import { log } from '../log.js';
import {
  getState,
  setImage,
  setSceneName,
  setSceneLogic
} from '../state.js';

/*
  Scene-level command executors:
  SET_IMAGE
    payload: { url: string|null, imageObj?: HTMLImageElement|null }
    - Expects caller to supply a preloaded HTMLImageElement when setting (so command runs synchronously & is undoable).
    - Clearing: url = null (imageObj ignored)
    - Inverse restores previous url + imageObj reference (no deep clone; large image data is not duplicated).
  SET_SCENE_NAME
    payload: { name: string }
  SET_SCENE_LOGIC
    payload: { logic: string }  (e.g., AND / OR / custom future tokens)
*/

function cmdSetImage(payload) {
  const { url = null, imageObj = null } = payload || {};
  const prevURL = getState().imageURL || null;
  const prevObj = getState().imageObj || null;

  // No-op if nothing changes.
  if ((prevURL || null) === (url || null)) {
    // If URL unchanged but caller passes a different object we still skip to avoid history noise.
    return null;
  }

  try {
    setImage(url, url ? imageObj : null);
    log("INFO", "[commands-scene] Image " + (url ? "set" : "cleared"), {
      newURL: url,
      hadPrev: !!prevURL
    });
  } catch (e) {
    log("ERROR", "[commands-scene] Failed applying SET_IMAGE", e);
    return null;
  }

  return {
    type: 'SET_IMAGE',
    payload: { url: prevURL, imageObj: prevObj }
  };
}

function cmdSetSceneName(payload) {
  const { name } = payload || {};
  const next = typeof name === 'string' ? name : '';
  const prev = getState().sceneName || '';
  if (prev === next) return null;
  try {
    setSceneName(next);
    log("INFO", "[commands-scene] Scene name set", { from: prev, to: next });
  } catch (e) {
    log("ERROR", "[commands-scene] Failed applying SET_SCENE_NAME", e);
    return null;
  }
  return {
    type: 'SET_SCENE_NAME',
    payload: { name: prev }
  };
}

function cmdSetSceneLogic(payload) {
  const { logic } = payload || {};
  const next = typeof logic === 'string' && logic ? logic : 'AND';
  const prev = getState().sceneLogic || 'AND';
  if (prev === next) return null;
  try {
    setSceneLogic(next);
    log("INFO", "[commands-scene] Scene logic set", { from: prev, to: next });
  } catch (e) {
    log("ERROR", "[commands-scene] Failed applying SET_SCENE_LOGIC", e);
    return null;
  }
  return {
    type: 'SET_SCENE_LOGIC',
    payload: { logic: prev }
  };
}

export function executeSceneCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') return null;
  const p = cmd.payload || {};
  switch (cmd.type) {
    case 'SET_IMAGE': return cmdSetImage(p);
    case 'SET_SCENE_NAME': return cmdSetSceneName(p);
    case 'SET_SCENE_LOGIC': return cmdSetSceneLogic(p);
    default: return null;
  }
}
