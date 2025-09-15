/**
 * log.js
 * -------------------------------------------------------------------
 * Centralized, pluggable logging system for Scene Designer (ESM only).
 * - All logs routed through log() at appropriate level/tag.
 * - Supports runtime config of level, destination, server, and sinks.
 * - Pluggable log sinks (console, server, in-app panels, etc).
 * - Safe serialization (handles cyclic/Error objects).
 * - Zero use of window.*, no globals except optional debug attach.
 * - Compatible with console interception and global error handlers.
 * - Exports: log, setLogLevel/getLogLevel, setLogDestination, setLogServerURL,
 *            setLogServerToken, configureLogging, registerLogSink.
 * -------------------------------------------------------------------
 * Dependencies: None (uses built-in fetch, Date, etc).
 * -------------------------------------------------------------------
 */

export const LOG_LEVELS = {
  SILENT: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

let curLogLevel = "INFO";
let logDest = "console"; // "console", "server", or "both"
let externalLogServerURL = "";
let externalLogServerToken = "";

// Pluggable sinks: each receives (level, ...args)
const logSinks = [];

/**
 * Register a log sink (fn(level, ...args) or {sinkLog(level, ...args)})
 */
export function registerLogSink(sink) {
  if (typeof sink === "function" || (sink && typeof sink.sinkLog === "function")) {
    logSinks.push(sink);
  }
}

/**
 * Set the log level at runtime.
 * @param {"SILENT"|"ERROR"|"WARN"|"INFO"|"DEBUG"|"TRACE"} level
 */
export function setLogLevel(level) {
  curLogLevel = normalizeLevel(level);
}
export function getLogLevel() {
  return curLogLevel;
}

/**
 * Set log destination at runtime.
 * @param {"console"|"server"|"both"} dest
 */
export function setLogDestination(dest) {
  if (["console", "server", "both"].includes(dest)) logDest = dest;
}
export function getLogDestination() {
  return logDest;
}

/**
 * Set external log server URL/token.
 */
export function setLogServerURL(url) {
  externalLogServerURL = url || "";
}
export function setLogServerToken(token) {
  externalLogServerToken = token || "";
}

/**
 * Configure all logging params at once (used by settings.js).
 */
export function configureLogging({ level, dest, serverURL, token }) {
  if (level) setLogLevel(level);
  if (dest) setLogDestination(dest);
  if (serverURL) setLogServerURL(serverURL);
  if (token) setLogServerToken(token);
}

/**
 * Normalize log level string to UPPERCASE and only allow valid levels.
 * Only "SILENT" disables logging. "OFF" is mapped to "SILENT".
 */
function normalizeLevel(level) {
  if (!level) return "INFO";
  const l = String(level).toUpperCase();
  if (l === "OFF") return "SILENT";
  if (l in LOG_LEVELS) return l;
  // Default fallback
  return "INFO";
}

/**
 * Map log level string to numeric value.
 */
function levelNum(level) {
  const l = normalizeLevel(level);
  return LOG_LEVELS[l] ?? 99;
}

/**
 * Safe serialization for log arguments.
 */
export function safeStringify(arg) {
  if (arg instanceof Error) {
    return `[Error: ${arg.message}]${arg.stack ? "\n" + arg.stack : ""}`;
  }
  try {
    // Handle cyclic references gracefully
    const seen = new WeakSet();
    return JSON.stringify(arg, function (key, value) {
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

/**
 * Harden log arg for console output.
 */
function safeLogArg(arg) {
  try {
    if (typeof Element !== "undefined" && arg instanceof Element) {
      return `<${arg.tagName.toLowerCase()} id="${arg.id}" class="${arg.className}">`;
    }
    if (arg && arg.constructor && arg.constructor.name &&
      /Container|Layout|Panel|Manager/.test(arg.constructor.name)) {
      return `[${arg.constructor.name}]`;
    }
    if (arg && arg._id && arg._type) {
      return `{type:"${arg._type}", id:"${arg._id}"}`;
    }
    if (typeof arg === "object") {
      if (arg !== null) {
        const shallow = {};
        for (const k in arg) {
          if (typeof arg[k] !== "object" && typeof arg[k] !== "function") {
            shallow[k] = arg[k];
          }
        }
        if (Object.keys(shallow).length > 0) return shallow;
      }
    }
    return arg;
  } catch (e) {
    return `[Unserializable: ${arg && arg.constructor && arg.constructor.name}]`;
  }
}

/**
 * Central log function (all modules must use this!).
 * @param {"ERROR"|"WARN"|"INFO"|"DEBUG"|"TRACE"} level
 * @param  {...any} args
 */
export function log(level, ...args) {
  const msgLevelNum = levelNum(level);
  const curLevelNum = levelNum(curLogLevel);
  if (msgLevelNum > curLevelNum) return;

  // Console output
  if (logDest === "console" || logDest === "both") {
    const lvl = String(level).toUpperCase();
    const safeArgs = args.map(safeLogArg);
    // Map to console methods
    if (typeof console !== "undefined") {
      if (lvl === "ERROR" && console.error) console.error("[log]", level, ...safeArgs);
      else if (lvl === "WARN" && console.warn) console.warn("[log]", level, ...safeArgs);
      else if (lvl === "INFO" && console.info) console.info("[log]", level, ...safeArgs);
      else if (lvl === "DEBUG" && console.debug) console.debug("[log]", level, ...safeArgs);
      else if (lvl === "TRACE" && console.debug) console.debug("[log]", level, ...safeArgs);
      else if (console.log) console.log("[log]", level, ...safeArgs);
    }
  }
  // Server streaming
  if ((logDest === "server" || logDest === "both") && externalLogServerURL) {
    logStream(level, ...args);
  }
  // Panel sinks
  for (const sink of logSinks) {
    try {
      if (typeof sink === "function") sink(level, ...args);
      else if (sink && typeof sink.sinkLog === "function") sink.sinkLog(level, ...args);
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[log]", "Log sink error", e);
      }
    }
  }
}

/**
 * Async log streaming to external server (safe serialization).
 */
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[log]", level, "Failed to stream log", ...args, e);
    }
  }
}

/**
 * For settings.js to fully re-sync config (optional).
 */
export function reconfigureLoggingFromSettings({ level, dest, serverURL, token }) {
  configureLogging({ level, dest, serverURL, token });
}

// Optional: Attach to global for debug only (remove for production)
if (typeof window !== "undefined") {
  window.log = log;
  window.setLogLevel = setLogLevel;
  window.setLogDestination = setLogDestination;
  window.setLogServerURL = setLogServerURL;
  window.setLogServerToken = setLogServerToken;
  window.LOG_LEVELS = LOG_LEVELS;
}

