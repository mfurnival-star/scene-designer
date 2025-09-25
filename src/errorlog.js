import { log } from "./log.js";

export function buildErrorLogPanel({ element }) {
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
}

export function registerErrorLogSink() {}
