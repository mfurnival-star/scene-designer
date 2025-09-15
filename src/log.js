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
 * - DIAGNOSTIC NOISE: Extra logs, instance IDs, and window-global hooks for debugging.
 * -------------------------------------------------------------------
 * Dependencies: None (uses built-in fetch, Date, etc).
 * -------------------------------------------------------------------
 */

export const LOG_LEVELS = {
  SILENT: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

const LOGGER_INSTANCE_ID = Math.random().toString(36).slice(2) + "-" + Date.now();
let curLogLevel = "INFO";
let logDest = "console"; // "console", "server", or "both"
let externalLogServerURL = "";
let externalLogServerToken = "";

// Pluggable sinks: each receives (level, ...args)
const logSinks = [];

function printDiagnosticNoise(msg, ...args) {
  // Only print to console, always, even if log level is low.
  if (typeof console !== "undefined" && console.log) {
    console.log(`[LOGGER DIAG][${LOGGER_INSTANCE_ID}] ${msg}`, ...args);
  }
}

// DIAGNOSTIC: Attach instance info to window for verification
if (typeof window !== "undefined") {
  window.__loggerInstanceIds = window.__loggerInstanceIds || [];
  window.__loggerInstanceIds.push(LOGGER_INSTANCE_ID);
  window.__lastSetLogLevel = curLogLevel;
  window.__setLogLevelCalls = window.__setLogLevelCalls || [];
  window.__getLogLevelCalls = window.__getLogLevelCalls || [];
  window.__lastLogCalls = window.__lastLogCalls || [];
  window.__logDestHistory = window.__logDestHistory || [];
  window.__logLevelHistory = window.__logLevelHistory || [];
  printDiagnosticNoise("Logger module loaded", { curLogLevel, logDest });
}

/**
 * Register a log sink (fn(level, ...args) or {sinkLog(level, ...args)})
 */
export function registerLogSink(sink) {
  printDiagnosticNoise("registerLogSink called", sink);
  if (typeof sink === "function" || (sink && typeof sink.sinkLog === "function")) {
    logSinks.push(sink);
    printDiagnosticNoise("registerLogSink SUCCESS", logSinks.length, logSinks);
  }
}

/**
 * Set the log level at runtime.
 * @param {"SILENT"|"ERROR"|"WARN"|"INFO"|"DEBUG"|"TRACE"} level
 */
export function setLogLevel(level) {
  const prev = curLogLevel;
  curLogLevel = normalizeLevel(level);
  if (typeof window !== "undefined") {
    window.__lastSetLogLevel = curLogLevel;
    window.__setLogLevelCalls.push({ new: curLogLevel, prev, at: Date.now(), instance: LOGGER_INSTANCE_ID });
    window.__logLevelHistory.push(curLogLevel);
    printDiagnosticNoise("setLogLevel called", { prev, new: curLogLevel, instance: LOGGER_INSTANCE_ID });
  }
}
export function getLogLevel() {
  if (typeof window !== "undefined") {
    window.__getLogLevelCalls.push({ at: Date.now(), level: curLogLevel, instance: LOGGER_INSTANCE_ID });
    printDiagnosticNoise("getLogLevel returned", curLogLevel);
  }
  return curLogLevel;
}

/**
 * Set log destination at runtime.
 * @param {"console"|"server"|"both"} dest
 */
export function setLogDestination(dest) {
  const prev = logDest;
  if (["console", "server", "both"].includes(dest)) logDest = dest;
  if (typeof window !== "undefined") {
    window.__logDestHistory.push(logDest);
    printDiagnosticNoise("setLogDestination", { prev, new: logDest, instance: LOGGER_INSTANCE_ID });
  }
}
export function getLogDestination() {
  return logDest;
}

/**
 * Set external log server URL/token.
 */
export function setLogServerURL(url) {
  externalLogServerURL = url || "";
  printDiagnosticNoise("setLogServerURL", externalLogServerURL);
}
export function setLogServerToken(token) {
  externalLogServerToken = token || "";
  printDiagnosticNoise("setLogServerToken", externalLogServerToken);
}

/**
 * Configure all logging params at once (used by settings.js).
 */
export function configureLogging({ level, dest, serverURL, token }) {
  printDiagnosticNoise("configureLogging called", { level, dest, serverURL, token });
  if (level) setLogLevel(level);
  if (dest) setLogDestination(dest);
  if (serverURL) setLogServerURL(serverURL);
  if (token) setLogServerToken(token);
}

/**
 * Normalize log level string to UPPERCASE and only allow valid levels.
 * Only "SILENT" disables logging. "OFF" is not recognized at all.
 */
function normalizeLevel(level) {
  if (!level) return "INFO";
  const l = String(level).toUpperCase();
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
  // DIAGNOSTIC: record every log call and state at time of log
  if (typeof window !== "undefined") {
    window.__lastLogCalls.push({
      at: Date.now(), level, args, curLogLevel, logDest, instance: LOGGER_INSTANCE_ID
    });
    if (window.__lastLogCalls.length > 200) window.__lastLogCalls.shift();
  }

  const msgLevelNum = levelNum(level);
  const curLevelNum = levelNum(curLogLevel);

  // DIAGNOSTIC: always print log attempt
  printDiagnosticNoise(`log() called`, { level, args, curLogLevel, msgLevelNum, curLevelNum, logDest, instance: LOGGER_INSTANCE_ID });

  if (msgLevelNum > curLevelNum) return;

  // Console output
  if (logDest === "console" || logDest === "both") {
    const lvl = String(level).toUpperCase();
    const safeArgs = args.map(safeLogArg);
    // Map to console methods
    if (typeof console !== "undefined") {
      if (lvl === "ERROR" && console.error) console.error(`[log][${LOGGER_INSTANCE_ID}]`, level, ...safeArgs);
      else if (lvl === "WARN" && console.warn) console.warn(`[log][${LOGGER_INSTANCE_ID}]`, level, ...safeArgs);
      else if (lvl === "INFO" && console.info) console.info(`[log][${LOGGER_INSTANCE_ID}]`, level, ...safeArgs);
      else if (lvl === "DEBUG" && console.debug) console.debug(`[log][${LOGGER_INSTANCE_ID}]`, level, ...safeArgs);
      else if (lvl === "TRACE" && console.debug) console.debug(`[log][${LOGGER_INSTANCE_ID}]`, level, ...safeArgs);
      else if (console.log) console.log(`[log][${LOGGER_INSTANCE_ID}]`, level, ...safeArgs);
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
        console.warn(`[log][${LOGGER_INSTANCE_ID}]`, "Log sink error", e);
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
      token: externalLogServerToken,
      loggerInstance: LOGGER_INSTANCE_ID
    };
    await fetch(externalLogServerURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    printDiagnosticNoise("logStream sent to server", payload);
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error(`[log][${LOGGER_INSTANCE_ID}]`, level, "Failed to stream log", ...args, e);
    }
  }
}

/**
 * For settings.js to fully re-sync config (optional).
 */
export function reconfigureLoggingFromSettings({ level, dest, serverURL, token }) {
  printDiagnosticNoise("reconfigureLoggingFromSettings called", { level, dest, serverURL, token });
  configureLogging({ level, dest, serverURL, token });
}

// Attach to window for diagnostics and debugging
if (typeof window !== "undefined") {
  window.log = log;
  window.setLogLevel = setLogLevel;
  window.getLogLevel = getLogLevel;
  window.setLogDestination = setLogDestination;
  window.setLogServerURL = setLogServerURL;
  window.setLogServerToken = setLogServerToken;
  window.LOG_LEVELS = LOG_LEVELS;
  window.__loggerInstanceId = LOGGER_INSTANCE_ID;
  printDiagnosticNoise("Logger globals attached", {
    log, setLogLevel, getLogLevel, setLogDestination, setLogServerURL, setLogServerToken, LOGGER_INSTANCE_ID
  });
}
