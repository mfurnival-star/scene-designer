/**
 * errorlog.js
 * -----------------------------------------------------------
 * Error Log Panel & Log Sink for Scene Designer (Golden Layout)
 * - Implements Error Log panel for live log viewing in-app.
 * - Can be dynamically shown/hidden via settings.
 * - Provides a pluggable log sink that streams logs to the panel at any level.
 * - Exports:
 *    - buildErrorLogPanel(rootElement, container)
 *    - registerErrorLogSink()
 * - Dependencies: Only ES modules, never window/global.
 * - Logging: Uses log.js, but **NO** top-level logs at module load (see engineering policy).
 * -----------------------------------------------------------
 */

import { log, registerLogSink } from './log.js';

/** Internal log message buffer (capped for perf) */
const PANEL_MAX_LOGS = 300;
let panelLogBuffer = [];

/** Reference to the current DOM panel, if any */
let panelElement = null;

/**
 * Build the Error Log panel (GL component factory).
 * @param {HTMLElement} rootElement
 * @param {Object} container (Golden Layout container)
 */
export function buildErrorLogPanel(rootElement, container) {
  log("TRACE", "[errorlog] buildErrorLogPanel entry", { rootElement, container });
  panelElement = rootElement;
  panelElement.innerHTML = `
    <div id="error-log-panel" style="width:100%;height:100%;overflow:auto;font-family:monospace;padding:6px;background:#18181a;color:#fff;font-size:1em;">
      <div id="error-log-panel-messages"></div>
    </div>
  `;
  const messagesDiv = panelElement.querySelector("#error-log-panel-messages");
  if (!messagesDiv) {
    log("ERROR", "[errorlog] Could not find messages container in Error Log panel!");
    return;
  }
  // Render buffer
  renderLogBuffer(messagesDiv);

  // Optionally attach clear button or controls here in future
  log("INFO", "[errorlog] Error Log panel initialized");
  log("TRACE", "[errorlog] buildErrorLogPanel exit");
}

/**
 * Register this panel as a log sink.
 * After registration, all log messages will be streamed here in addition to other sinks.
 */
export function registerErrorLogSink() {
  registerLogSink(errorLogSink);
}

// Log sink function (levelNum, ...args)
function errorLogSink(levelNum, ...args) {
  // Format message for display
  const now = new Date();
  const msg = {
    ts: now.toLocaleTimeString(),
    level: levelNum,
    levelName: logLevelName(levelNum),
    html: formatLogMessage(levelNum, args)
  };
  panelLogBuffer.push(msg);
  if (panelLogBuffer.length > PANEL_MAX_LOGS) panelLogBuffer.shift();

  if (panelElement) {
    const messagesDiv = panelElement.querySelector("#error-log-panel-messages");
    if (messagesDiv) {
      renderLogBuffer(messagesDiv);
    }
  }
}

// Format log message as HTML
function formatLogMessage(levelNum, args) {
  const level = logLevelName(levelNum);
  let color = "#fff";
  if (levelNum === 1) color = "#ff4b4b";
  else if (levelNum === 2) color = "#ffc83d";
  else if (levelNum === 3) color = "#87e0ff";
  else if (levelNum === 4) color = "#aaffab";
  else if (levelNum === 5) color = "#aaa";
  return `<span style="color:${color};font-weight:bold;">[${level}]</span> `
    + args.map(a => escapeHtml(typeof a === "string" ? a : JSON.stringify(a, null, 1))).join(" ");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderLogBuffer(messagesDiv) {
  messagesDiv.innerHTML = panelLogBuffer.map(msg =>
    `<div style="margin-bottom:2px;"><span style="color:#666;">${msg.ts}</span> ${msg.html}</div>`
  ).join("");
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function logLevelName(num) {
  switch (num) {
    case 0: return "SILENT";
    case 1: return "ERROR";
    case 2: return "WARN";
    case 3: return "INFO";
    case 4: return "DEBUG";
    case 5: return "TRACE";
  }
  return "INFO";
}
