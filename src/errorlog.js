/**
 * errorlog.js
 * -----------------------------------------------------------
 * Error Log Panel for Scene Designer (Golden Layout)
 * - Provides a scrollable log of all error, warning, and info messages in-app.
 * - Automatically registered as a log sink via log.js.
 * - Exports buildErrorLogPanel() for use by layout.js.
 * - No window/global usage; all logging is ES module based.
 * -----------------------------------------------------------
 */

import { log, registerLogSink } from './log.js';

// Internal log buffer (keeps last 250 messages)
const logBuffer = [];
const MAX_LOG_LINES = 250;

// Panel root element and reference
let errorLogRoot = null;

// Render the log panel UI
function renderLogPanel() {
  if (!errorLogRoot) return;
  let html = '<div id="error-log-scroll" style="overflow-y:auto;width:100%;height:100%;font-family:monospace;font-size:1em;background:#1a1a1a;color:#e6e6e6;padding:8px 6px;">';
  for (const line of logBuffer) {
    html += `<div>${line}</div>`;
  }
  html += '</div>';
  errorLogRoot.innerHTML = html;
  // Auto-scroll to bottom
  setTimeout(() => {
    const scrollDiv = errorLogRoot.querySelector("#error-log-scroll");
    if (scrollDiv) scrollDiv.scrollTop = scrollDiv.scrollHeight;
  }, 1);
}

// Sink for log.js to push log messages to this panel
function sinkLog(level, ...args) {
  const time = (new Date()).toLocaleTimeString();
  let color = "#e6e6e6";
  if (level === "ERROR") color = "#ff5b6c";
  else if (level === "WARN") color = "#ffe26b";
  else if (level === "INFO") color = "#8be9fd";
  else if (level === "DEBUG") color = "#b8e994";
  else if (level === "TRACE") color = "#aaa";
  const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
  const line = `<span style="color:#666;">[${time}]</span> <span style="color:${color};">${level}</span> <span style="color:#e6e6e6;">${msg}</span>`;
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
  renderLogPanel();
}

// Exported for log.js registration
export function registerErrorLogSink() {
  registerLogSink(sinkLog);
}

// Build the error log panel (Golden Layout factory)
export function buildErrorLogPanel(rootElement, container) {
  errorLogRoot = rootElement;
  rootElement.innerHTML = '<div style="color:#888;font-family:monospace;">Error Log initializing...</div>';
  renderLogPanel();
}

log("INFO", "[errorlog] errorlog.js module loaded and ready.");

// Export sinkLog only for test/debug (not needed for normal use)
export { sinkLog };
