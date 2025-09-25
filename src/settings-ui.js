import { getState } from './state.js';
import { log } from './log.js';
import { Pane } from 'tweakpane';
import {
  settingsRegistry,
  loadSettings,
  setSettingAndSave
} from './settings-core.js';

function isLikelyIOS() {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    const touchMac = /mac/i.test(platform) && navigator.maxTouchPoints > 1;
    return /iphone|ipad|ipod/.test(ua) || touchMac;
  } catch {
    return false;
  }
}

function applyScrollableAncestorFixes(rootEl) {
  try {
    let el = rootEl;
    let hops = 0;
    while (el && hops < 5) {
      if (el.classList && el.classList.contains('minilayout-panel-body')) {
        el.style.minHeight = '0';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.overflow = 'visible';
        el.style.contain = 'content';
      }
      if (el.classList && el.classList.contains('minilayout-panel')) {
        el.style.minHeight = '0';
        el.style.flex = el.style.flex || '1 1 auto';
      }
      el = el.parentElement;
      hops++;
    }
  } catch (e) {
    log("WARN", "[settings-ui] applyScrollableAncestorFixes failed", e);
  }
}

function ensureBottomSpacer(container, opts = {}) {
  try {
    const { iosExtraPx = 120 } = opts;
    let spacer = container.querySelector('#settings-ios-bottom-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'settings-ios-bottom-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.width = '100%';
      spacer.style.flex = '0 0 auto';
      spacer.style.pointerEvents = 'none';
      container.appendChild(spacer);
    }
    const onIOS = isLikelyIOS();
    if (onIOS) {
      spacer.style.height = `calc(${iosExtraPx}px + env(safe-area-inset-bottom))`;
    } else {
      spacer.style.height = '0px';
    }
  } catch (e) {
    log("WARN", "[settings-ui] ensureBottomSpacer failed", e);
  }
}

function enableTouchScroll(el) {
  if (!el || !el.style) return;
  try {
    el.style.webkitOverflowScrolling = 'touch';
    el.style.overscrollBehavior = 'contain';
    el.style.touchAction = 'pan-x pan-y';
  } catch {}
}

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
      alert("Settings panel root element not found! (No content will be shown)");
      return;
    }
    if (typeof Pane !== "function") {
      element.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed: Tweakpane (Pane) not loaded as ES module.<br>Check your npm dependencies.</div>`;
      log("ERROR", "[settings-ui] Pane (Tweakpane) is not a constructor/function! Check import.");
      return;
    }

    const buildPanel = () => {
      const settingsPOJO = {};
      for (const reg of settingsRegistry) {
        settingsPOJO[reg.key] = getState().settings[reg.key];
      }

      element.innerHTML = `
        <div id="settings-panel-container" style="
          width:100%;
          height:100%;
          background:#fff;
          display:flex;
          flex-direction:column;
          overflow:hidden;
          min-height:0;
          position:relative;
        ">
          <div id="tweakpane-fields-div" style="
            flex:1 1 auto;
            min-height:0;
            min-width:0;
            overflow-x:auto;
            overflow-y:auto;
            -webkit-overflow-scrolling:touch;
            overscroll-behavior: contain;
            scroll-behavior: smooth;
            padding: 0 8px 56px 8px;
            padding-bottom: calc(56px + env(safe-area-inset-bottom));
            display:flex;
            flex-direction:column;
            touch-action: pan-x pan-y;
          "></div>
        </div>
      `;

      const container = element.querySelector("#settings-panel-container");
      const fieldsDiv = element.querySelector("#tweakpane-fields-div");
      if (!fieldsDiv || !container) {
        log("ERROR", "[settings-ui] settings container nodes missing");
        element.innerHTML = `<div style="color:red;padding:2em;">Settings panel failed to render (missing container)</div>`;
        return;
      }

      applyScrollableAncestorFixes(element);
      enableTouchScroll(fieldsDiv);
      enableTouchScroll(container);

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

      ensureBottomSpacer(fieldsDiv, { iosExtraPx: 120 });

      const onResize = () => {
        applyScrollableAncestorFixes(element);
        ensureBottomSpacer(fieldsDiv, { iosExtraPx: 120 });
        enableTouchScroll(fieldsDiv);
        enableTouchScroll(container);
      };
      window.addEventListener('orientationchange', onResize);
      window.addEventListener('resize', onResize);

      const cleanup = () => {
        try {
          window.removeEventListener('orientationchange', onResize);
          window.removeEventListener('resize', onResize);
        } catch {}
        log("INFO", "[settings-ui] Settings panel cleaned up");
      };
      if (typeof element.on === "function") {
        try { element.on("destroy", cleanup); } catch {}
      }
      window.addEventListener('beforeunload', cleanup, { once: true });

      log("INFO", "[settings-ui] Settings panel rendered with mobile scroll fixes");
    };

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
