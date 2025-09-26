import { getState } from './state.js';
import { log } from './log.js';
import 'tweakpane/dist/tweakpane.css'; // Ensure Tweakpane styles are bundled (critical for mobile Safari rendering)
import { Pane } from 'tweakpane';
import {
  settingsRegistry,
  loadSettings,
  setSettingAndSave
} from './settings-core.js';

/**
 * Settings panel builder.
 * Key mobile/iOS Safari fixes:
 *  - CSS import above so .tp-* classes have intrinsic height.
 *  - Panel/container/body elements get explicit flex + min-height:0 so they can expand inside nested flex parents.
 *  - Structure HTML injected BEFORE Pane instantiation, so even if Pane creation fails we still see a fallback region.
 */
export function buildSettingsPanel({ element, title, componentName }) {
  log("DEBUG", "[settings-ui] buildSettingsPanel ENTRY", {
    PaneType: typeof Pane,
    elementType: element?.tagName,
    title,
    componentName
  });

  try {
    if (!element) {
      log("ERROR", "[settings-ui] buildSettingsPanel: element is null/undefined");
      return;
    }

    // Inject base structure early (fallback-friendly)
    element.innerHTML = `
      <div id="settings-panel-container"
           style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;overflow:hidden;min-height:0;">
        <div id="tweakpane-fields-div" style="
          flex:1 1 auto;
          min-height:0;
          overflow:auto;
          -webkit-overflow-scrolling:touch;
          padding:0 8px 56px 8px;
          padding-bottom: calc(56px + env(safe-area-inset-bottom));
          overscroll-behavior: contain;
          scroll-behavior: smooth;
          background:#fff;
        "></div>
      </div>
    `;

    // Defensive flex propagation (in case outer panel styles are restrictive)
    try {
      element.style.display = 'flex';
      element.style.flex = '1 1 0%';
      element.style.minHeight = '0';
      const panel = element.closest('.minilayout-panel');
      if (panel) {
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        if (!panel.style.flex || panel.style.flex === '0 0 auto') {
          panel.style.flex = '1 1 0%';
        }
        panel.style.minHeight = '0';
        panel.style.overflow = 'hidden';
      }
      const body = panel?.querySelector('.minilayout-panel-body');
      if (body) {
        body.style.flex = '1 1 auto';
        body.style.minHeight = '0';
        if (!body.style.display) body.style.display = 'flex';
        if (!body.style.flexDirection) body.style.flexDirection = 'column';
        // The scroll area is inside (#tweakpane-fields-div); body stays overflow hidden or auto without harming layout.
      }
    } catch (flexErr) {
      log("WARN", "[settings-ui] Flex propagation failed (non-fatal)", flexErr);
    }

    if (typeof Pane !== "function") {
      const fields = element.querySelector('#tweakpane-fields-div');
      if (fields) {
        fields.innerHTML = `
          <div style="color:#b00020;padding:1em;font:14px/1.4 system-ui,Arial;">
            Settings panel failed: Tweakpane (Pane) not loaded.
          </div>`;
      }
      log("ERROR", "[settings-ui] Pane (Tweakpane) is not a constructor/function! Check import.");
      return;
    }

    const buildPanel = () => {
      const settingsPOJO = {};
      for (const reg of settingsRegistry) {
        settingsPOJO[reg.key] = getState().settings[reg.key];
      }

      const fieldsDiv = element.querySelector("#tweakpane-fields-div");
      if (!fieldsDiv) {
        log("ERROR", "[settings-ui] tweakpane-fields-div not found in DOM after injection");
        element.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed (missing tweakpane-fields-div)</div>`;
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
        }
      });

      // Log after controls created (mobile Safari debugging)
      try {
        const root = fieldsDiv.querySelector('.tp-dfw');
        log("INFO", "[settings-ui] Settings panel rendered", {
          tweakpaneRootPresent: !!root,
          childCount: root ? root.children.length : 0
        });
      } catch {}

    }; // end buildPanel

    const hasSettingsInStore = !!(getState().settings && Object.keys(getState().settings).length > 0);
    if (hasSettingsInStore) {
      buildPanel();
    } else {
      loadSettings()
        .then(buildPanel)
        .catch((e) => {
          log("ERROR", "[settings-ui] Error loading settings before building panel", e);
          const fields = element.querySelector("#tweakpane-fields-div");
          if (fields) {
            fields.innerHTML = `<div style="color:red;padding:1em;">Settings failed to load: ${e.message}</div>`;
          }
        });
    }
  } catch (e) {
    log("ERROR", "[settings-ui] buildSettingsPanel ERROR", e);
    try {
      if (element && !element.innerHTML.includes('Settings panel failed')) {
        element.innerHTML = `<div style="color:red;padding:1em;">SettingsPanel ERROR: ${e.message}</div>`;
      }
    } catch {}
    throw e;
  }

  log("DEBUG", "[settings-ui] buildSettingsPanel EXIT", {
    elementType: element?.tagName,
    title,
    componentName
  });
}
