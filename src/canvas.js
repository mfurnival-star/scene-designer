// DEBUG: Canvas Panel
export function buildCanvasPanel(rootElement, container) {
  try {
    window.debugLog && debugLog("buildCanvasPanel called", rootElement, container);
    alert("Canvas panel loaded");
    rootElement.innerHTML = `
      <div style="background:#ffb300;color:#000;font-size:2em;padding:24px 8px;">
        <b>CANVAS PANEL LOADED</b>
        <div>(Check console and Debug Log for details)</div>
      </div>
    `;
  } catch (e) {
    window.debugLog && debugLog("buildCanvasPanel ERROR", e);
    alert("CanvasPanel ERROR: " + e.message);
    throw e;
  }
}
