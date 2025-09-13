// DEBUG: Settings Panel
export function buildSettingsPanel(rootElement, container) {
  try {
    window.debugLog && debugLog("buildSettingsPanel called", rootElement, container);
    alert("Settings panel loaded");
    rootElement.innerHTML = `
      <div style="background:#0a6e2c;color:#fff;font-size:2em;padding:24px 8px;">
        <b>SETTINGS PANEL LOADED</b>
        <div>(Check console and Debug Log for details)</div>
      </div>
    `;
  } catch (e) {
    window.debugLog && debugLog("buildSettingsPanel ERROR", e);
    alert("SettingsPanel ERROR: " + e.message);
    throw e;
  }
}
