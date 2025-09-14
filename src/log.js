/**
 * log.js
 * -----------------------------------------------------------
 * Centralized logging system for Scene Designer.
 * - Exports log(), log levels, and logStream for external server.
 * - Log level and destination (console/server/both) are dynamic and
 *   can be changed at runtime (see settings.js).
 * - Supports registration of error log panel sinks for in-app UI logging.
 * - Adheres to COPILOT_MANIFESTO.md and SCENE_DESIGNER_MANIFESTO.md.
 * -----------------------------------------------------------
 */

export const LOG_LEVELS = {
  OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

// --- Initial config is set from window._settings if present (see deploy.sh injection) ---
let curLogLevel = typeof window !== "undefined" && window._settings?.DEBUG_LOG_LEVEL
  ? window._settings.DEBUG_LOG_LEVEL
  : 'ERROR';
let logDest = typeof window !== "undefined" && window._settings?.LOG_OUTPUT_DEST
  ? window._settings.LOG_OUTPUT_DEST
  : 'console';
let externalLogServerURL = typeof window !== "undefined" && window._externalLogServerURL
  ? window._externalLogServerURL
  : '';
let externalLogServerToken = typeof window !== "undefined" && window._externalLogServerToken
  ? window._externalLogServerToken
  : '';

// --- Error log panel sinks ---
const errorLogPanelSinks = [];
/**
 * Register a log sink (panel) that receives log messages.
 * The sink must implement sinkLog(level, ...args).
 */
export function registerLogSink(sink) {
  if (typeof sink === "function" || (sink && typeof sink.sinkLog === "function")) {
    errorLogPanelSinks.push(sink);
  }
}
/**
 * Used by errorlog.js to auto-register panel log sink.
 */
export function registerErrorLogPanelSink(sink) {
  registerLogSink(sink);
}

// Allow runtime reconfiguration
export function setLogLevel(level) {
  if (level && level in LOG_LEVELS) curLogLevel = level;
}
export function getLogLevel() {
  return curLogLevel;
}
export function setLogDestination(dest) {
  if (['console', 'server', 'both'].includes(dest)) logDest = dest;
}
export function getLogDestination() {
  return logDest;
}
export function setLogServerURL(url) {
  externalLogServerURL = url || '';
}
export function setLogServerToken(token) {
  externalLogServerToken = token || '';
}

// Main log function. TRACE is extremely verbose and rarely used (for entry/exit).
export function log(level, ...args) {
  const curLevelNum = LOG_LEVELS[curLogLevel] ?? LOG_LEVELS.ERROR;
  const msgLevelNum = LOG_LEVELS[level] ?? 99;

  if (msgLevelNum > curLevelNum) return;

  const tag = "[log]";
  if (logDest === "console" || logDest === "both") {
    if (level === "ERROR") {
      // eslint-disable-next-line no-console
      console.error(tag, level, ...args);
    } else if (level === "WARN") {
      // eslint-disable-next-line no-console
      console.warn(tag, level, ...args);
    } else {
      // eslint-disable-next-line no-console
      console.log(tag, level, ...args);
    }
  }
  if ((logDest === "server" || logDest === "both") && externalLogServerURL) {
    logStream(level, ...args);
  }
  // Forward logs to all registered log panel sinks
  for (const sink of errorLogPanelSinks) {
    if (typeof sink === "function") sink(level, ...args);
    else if (sink && typeof sink.sinkLog === "function") sink.sinkLog(level, ...args);
  }
}

// Async log streaming to external server
export async function logStream(level, ...args) {
  if (!externalLogServerURL) return;
  try {
    const payload = {
      level,
      message: args.map(a =>
        (typeof a === "object" ? JSON.stringify(a) : String(a))
      ).join(" "),
      timestamp: (new Date()).toISOString(),
      page: typeof location === "object" && location.pathname,
      userAgent: typeof navigator === "object" && navigator.userAgent,
      token: externalLogServerToken
    };
    await fetch(externalLogServerURL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[log]", level, "Failed to stream log", ...args, e);
  }
}

// For settings.js to fully re-sync config (optional)
export function configureLogging({level, dest, serverURL, token}) {
  if (level) setLogLevel(level);
  if (dest) setLogDestination(dest);
  if (serverURL) setLogServerURL(serverURL);
  if (token) setLogServerToken(token);
}

// Self-test on import
log("INFO", "[log] log.js module loaded and ready.");

// Optionally (for backwards compatibility), attach to window for debugging
if (typeof window !== "undefined") {
  window.log = log;
  window.setLogLevel = setLogLevel;
  window.setLogDestination = setLogDestination;
  window.setLogServerURL = setLogServerURL;
  window.setLogServerToken = setLogServerToken;
  window.LOG_LEVELS = LOG_LEVELS;
}

