import { log } from '../log.js';
import {
  getState,
  setImage,
  setSceneName,
  setSceneLogic,
  setSetting
} from '../state.js';
import { applyDiagnosticLabelsVisibility } from '../shapes.js';

/*
  Scene-level command executors:

  SET_IMAGE
    payload: { url: string|null, imageObj?: HTMLImageElement|null }
    - Caller supplies a preloaded HTMLImageElement when setting (so command runs synchronously & is undoable).
    - Clearing: url = null (imageObj ignored)
    - Inverse restores previous url + imageObj reference (no deep clone).

  SET_SCENE_NAME
    payload: { name: string }

  SET_SCENE_LOGIC
    payload: { logic: string }  (e.g., AND / OR / future tokens)

  SET_DIAGNOSTIC_LABEL_VISIBILITY
    payload: { visible: boolean }
    - Updates settings.showDiagnosticLabels and applies visibility to all existing shapes.
    - Inverse restores previous boolean.
*/

/* ----------------- SET_IMAGE ----------------- */
function cmdSetImage(payload) {
  const { url = null, imageObj = null } = payload || {};
  const prevURL = getState().imageURL || null;
  const prevObj = getState().imageObj || null;

  if ((prevURL || null) === (url || null)) {
    return null; // no change
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

/* ----------------- SET_SCENE_NAME ----------------- */
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

/* ----------------- SET_SCENE_LOGIC ----------------- */
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

/* ----------------- SET_DIAGNOSTIC_LABEL_VISIBILITY ----------------- */
function cmdSetDiagnosticLabelVisibility(payload) {
  const visibleRaw = payload ? payload.visible : undefined;
  const next = !!visibleRaw;
  const prev = !!getState().settings?.showDiagnosticLabels;

  if (prev === next) return null;

  try {
    // Update setting first so subsequent logic relying on settings sees new value.
    setSetting('showDiagnosticLabels', next);
    applyDiagnosticLabelsVisibility(next);
    log("INFO", "[commands-scene] Diagnostic labels visibility set", {
      from: prev,
      to: next
    });
  } catch (e) {
    log("ERROR", "[commands-scene] Failed applying SET_DIAGNOSTIC_LABEL_VISIBILITY", e);
    return null;
  }

  return {
    type: 'SET_DIAGNOSTIC_LABEL_VISIBILITY',
    payload: { visible: prev }
  };
}

/* ----------------- Dispatcher ----------------- */
export function executeSceneCommand(cmd) {
  if (!cmd || typeof cmd.type !== 'string') return null;
  const p = cmd.payload || {};
  switch (cmd.type) {
    case 'SET_IMAGE': return cmdSetImage(p);
    case 'SET_SCENE_NAME': return cmdSetSceneName(p);
    case 'SET_SCENE_LOGIC': return cmdSetSceneLogic(p);
    case 'SET_DIAGNOSTIC_LABEL_VISIBILITY': return cmdSetDiagnosticLabelVisibility(p);
    default: return null;
  }
}
