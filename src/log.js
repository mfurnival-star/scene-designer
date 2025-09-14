/**
 * log.js
 * -----------------------------------------------------------
 * Centralized logging system for Scene Designer.
 * - Uses loglevel as the core logger for robust levels and output.
 * - Adds safe serialization (handles Error/cyclic objects).
 * - Log level and destination (console/server/both) are dynamic and
 *   can be changed at runtime (see settings.js).
 * - Supports registration of error log panel sinks for in-app UI logging.
 * - Adheres to COPILOT_MANIFESTO.md and SCENE_DESIGNER_MANIFESTO.md.
 * -----------------------------------------------------------
 */

import loglevel from 'loglevel';

export const LOG_LEVELS = {
  OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

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

const errorLogPanelSinks = [];
export function registerLogSink(sink) {
  if (typeof sink === "function" || (sink && typeof sink.sinkLog === "function")) {
    errorLogPanelSinks.push(sink);
  }
}
export function registerErrorLogPanelSink(sink) {
  registerLogSink(sink);
}

// --- Safe serialization for log arguments ---
function safeStringify(arg) {
  if (arg instanceof Error) {
    return `[Error: ${arg.message}]${arg.stack ? "\n" + arg.stack : ""}`;
  }
  try {
    // Handle cyclic references gracefully
    const seen = new WeakSet();
    return JSON.stringify(arg, function(key, value) {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Cyclic]";
        seen.add(value);
      }
      return value;
    });
  } catch (e) {
    // Fallback
    if (typeof arg === "object" && arg !== null) {
      return "[Unserializable Object: " + (arg.constructor?.name || "Object") + "]";
    }
    return String(arg);
  }
}

// --- Set up loglevel ---
loglevel.setLevel(curLogLevel.toLowerCase ? curLogLevel.toLowerCase() : curLogLevel); // e.g. 'debug', 'info', etc.

// Central log function
export function log(level, ...args) {
  const curLevelNum = LOG_LEVELS[curLogLevel] ?? LOG_LEVELS.ERROR;
  const msgLevelNum = LOG_LEVELS[level] ?? 99;
  if (msgLevelNum > curLevelNum) return;

  // Console output via loglevel
  if (logDest === "console" || logDest === "both") {
    // Map our levels to loglevel's methods
    const lvl = level.toLowerCase();
    if (lvl === "error") loglevel.error("[log]", level, ...args);
    else if (lvl === "warn") loglevel.warn("[log]", level, ...args);
    else if (lvl === "info") loglevel.info("[log]", level, ...args);
    else if (lvl === "debug") loglevel.debug("[log]", level, ...args);
    else if (lvl === "trace") loglevel.trace("[log]", level, ...args);
    else loglevel.log("[log]", level, ...args);
  }
  // Server streaming
  if ((logDest === "server" || logDest === "both") && externalLogServerURL) {
    logStream(level, ...args);
  }
  // Panel sinks
  for (const sink of errorLogPanelSinks) {
    if (typeof sink === "function") sink(level, ...args);
    else if (sink && typeof sink.sinkLog === "function") sink.sinkLog(level, ...args);
  }
}

// Async log streaming to external server (safe serialization)
export async function logStream(level, ...args) {
  if (!externalLogServerURL) return;
  try {
    const payload = {
      level,
      message: args.map(safeStringify).join(" "),
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
    loglevel.error("[log]", level, "Failed to stream log", ...args, e);
  }
}

// Allow runtime reconfiguration
export function setLogLevel(level) {
  if (level && level in LOG_LEVELS) {
    curLogLevel = level;
    loglevel.setLevel(level.toLowerCase ? level.toLowerCase() : level);
  }
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
