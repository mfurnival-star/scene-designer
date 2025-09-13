// DEBUG: Sidebar Panel
export function buildSidebarPanel(rootElement, container) {
  try {
    window.debugLog && debugLog("buildSidebarPanel called", rootElement, container);
    alert("Sidebar panel loaded");
    rootElement.innerHTML = `
      <div style="background:#0057d8;color:#fff;font-size:2em;padding:24px 8px;">
        <b>SIDEBAR PANEL LOADED</b>
        <div>(Check console and Debug Log for details)</div>
      </div>
    `;
  } catch (e) {
    window.debugLog && debugLog("buildSidebarPanel ERROR", e);
    alert("SidebarPanel ERROR: " + e.message);
    throw e;
  }
}
