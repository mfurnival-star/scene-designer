/**
 * settings-ui.js
 * -------------------------------------------------------------------
 * Scene Designer – Settings UI (Tweakpane) – ESM ONLY
 * Purpose:
 * - Render the Settings panel using Tweakpane.
 * - Bind settingsRegistry-defined controls to the centralized store.
 * - Persist changes via settings-core mutators.
 * - Avoid reloading persisted settings while already initialized in-memory.
 *
 * Exports:
 * - buildSettingsPanel({ element, title, componentName })
 *
 * Dependencies:
 * - state.js (getState)
 * - log.js (log)
 * - tweakpane (Pane)
 * - settings-core.js (settingsRegistry, loadSettings, setSettingAndSave)
 *
 * Notes:
 * - Panel visibility toggles (showErrorLogPanel, showScenarioRunner) are applied by layout.js
 *   via store subscription; UI simply sets the setting via setSettingAndSave().
 * - As agreed: any TRACE logs are standardized to DEBUG in modified files.
 * -------------------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';
import { Pane } from 'tweakpane';
import {
  settingsRegistry,
  loadSettings,
  setSettingAndSave
} from './settings-core.js';

/**
 * Build the settings panel (MiniLayout-compliant).
 * Accepts: { element, title, componentName }
 */
export function buildSettingsPanel({ element, title, componentName }) {
  log("DEBUG", "[settings-ui] buildSettingsPanel ENTRY", {
    PaneType: typeof Pane,
    elementType: element?.tagName,
    title,
    componentName
  });

  try {
    log("INFO", "[settings-ui] buildSettingsPanel called", { elementType: element?.tagName, title, componentName });

    if (!element) {
      log("ERROR", "[settings-ui] buildSettingsPanel: element is null/undefined");
      alert("Settings panel root element not found! (No content will be shown)");
      return;
    }
    if (element.offsetParent === null) {
      log("DEBUG", "[settings-ui] buildSettingsPanel: element is not visible (may be hidden)");
    }
    if (typeof Pane !== "function") {
      element.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane (Pane) not loaded as ES module.<br>
      Check your npm dependencies: tweakpane@4.x must be imported as <code>import { Pane } from 'tweakpane'</code>.</div>`;
      log("ERROR", "[settings-ui] Pane (Tweakpane) is not a constructor/function! Check import.");
      return;
    }

    const buildPanel = () => {
      const settingsPOJO = {};
      for (const reg of settingsRegistry) {
        settingsPOJO[reg.key] = getState().settings[reg.key];
      }

      element.innerHTML = `
        <div id="settings-panel-container" style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;overflow:auto;">
          <div id="tweakpane-fields-div" style="flex:1 1 0;overflow:auto;padding:0 8px 8px 8px;"></div>
        </div>
      `;

      const fieldsDiv = element.querySelector("#tweakpane-fields-div");
      if (!fieldsDiv) {
        log("ERROR", "[settings-ui] tweakpane-fields-div not found in DOM");
        element.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed to render (missing tweakpane-fields-div)</div>`;
        return;
      }

      let pane;
      try {
        pane = new Pane({ container: fieldsDiv, expanded: true });
      } catch (e) {
        log("ERROR", "[settings-ui] Tweakpane instantiation failed", e);
        fieldsDiv.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane error (${e.message})</div>`;
        return;
      }

      settingsRegistry.forEach(reg => {
        const key = reg.key;
        try {
          const optionsObj = reg.options
            ? reg.options.reduce((acc, cur) => { acc[cur.value] = cur.label; return acc; }, {})
            : undefined;

          if (reg.type === "select") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
              options: optionsObj
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "boolean") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "number") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
              min: reg.min,
              max: reg.max,
              step: reg.step
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "color") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label,
              view: 'color'
            }).on('change', ev => setSettingAndSave(key, ev.value));
          } else if (reg.type === "text") {
            pane.addBinding(settingsPOJO, key, {
              label: reg.label
            }).on('change', ev => setSettingAndSave(key, ev.value));
          }
        } catch (e) {
          log("ERROR", "[settings-ui] Error rendering registry field", { key, reg, error: e });
          alert("Tweakpane error for setting: " + key + "\n\n" + (e && e.message ? e.message : e));
        }
      });

      log("INFO", "[settings-ui] Settings panel rendered (Tweakpane, no inner header)");
    };

    // Avoid reloading persisted settings during layout rebuilds.
    // If settings exist in store, build immediately; otherwise load then build.
    const hasSettingsInStore = !!(getState().settings && Object.keys(getState().settings).length > 0);
    if (hasSettingsInStore) {
      buildPanel();
    } else {
      loadSettings()
        .then(buildPanel)
        .catch((e) => {
          log("ERROR", "[settings-ui] Error in loadSettings().then for buildSettingsPanel", e);
          element.innerHTML = `<div style="color:red;padding:2em;">Settings failed to load: ${e.message}</div>`;
        });
    }
  } catch (e) {
    log("ERROR", "[settings-ui] buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message + (e && e.stack ? "\n\n" + e.stack : ""));
    throw e;
  }

  log("DEBUG", "[settings-ui] buildSettingsPanel EXIT", {
    elementType: element?.tagName,
    title,
    componentName
  });
}

