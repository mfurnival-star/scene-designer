/**
 * errorlog.js
 * -----------------------------------------------------------
 * Error Log Panel (MiniLayout) for Scene Designer
 * - Panel remains for layout, but does NOT render logs or register as a sink.
 * - Displays a static message: "Remote log streaming via Console.Re. This panel is not used currently."
 * - ES module only, no window/global code.
 * - Exports: buildErrorLogPanel, registerErrorLogSink.
 * -----------------------------------------------------------
 */

import { log } from "./log.js";

/**
 * Build the Error Log Panel
 * MiniLayout-compliant: accepts { element, title, componentName }
 */
export function buildErrorLogPanel({ element, title, componentName }) {
  log("TRACE", "[errorlog] buildErrorLogPanel entry", {
    elementType: element?.tagName,
    title,
    componentName
  });

  // Main panel container HTML – static message only
  element.innerHTML = `
    <div id="error-log-panel-container" style="width:100%;height:100%;background:#222;color:#fff;font-family:monospace;font-size:0.98em;overflow:auto;display:flex;align-items:center;justify-content:center;">
      <div style="color:#aaa;font-size:1.15em;padding:12px 18px;text-align:center;">
        Remote log streaming via <span style="color:#5bd6ff;font-weight:bold;">Console.Re</span>.<br>
        This error log panel is not being used currently.<br>
        Check your Console.Re dashboard for live logs.
      </div>
    </div>
  `;

  log("INFO", "[errorlog] Error Log panel is present but not active (Console.Re streaming only)");

  log("TRACE", "[errorlog] buildErrorLogPanel exit", {
    elementType: element?.tagName,
    title,
    componentName
  });
}

/**
 * Register the Error Log Panel as a log sink.
 * (No-op; not used when Console.Re streaming is active.)
 */
export function registerErrorLogSink() {
  log("TRACE", "[errorlog] registerErrorLogSink entry");
  // No-op: panel is passive when streaming is in use.
  log("TRACE", "[errorlog] registerErrorLogSink exit");
}

