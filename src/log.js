/**
 * log.js
 * -------------------------------------------------------------------
 * Centralized, pluggable logging system for Scene Designer (ESM only, numeric log levels).
 * - All logs routed through log() at appropriate level/tag.
 * - Supports runtime config of level, destination, server, and sinks.
 * - Log level is an integer (0=SILENT, 1=ERROR, ... 5=TRACE), no string compat.
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
export const LOG_LEVEL_NUMS = [0,1,2,3,4,5];
export const LOG_LEVEL_NUM_TO_NAME = ["SILENT", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"];
export const LOG_LEVEL_NAME_TO_NUM = {
  "SILENT": 0, "ERROR": 1, "WARN": 2, "INFO": 3, "DEBUG": 4, "TRACE": 5
};

const LOGGER_INSTANCE_ID = Math.random().toString(36).slice(2) + "-" + Date.now();
let curLogLevelNum = 3; // Default: INFO
let logDest = "console"; // "console", "server", or "both"
let externalLogServerURL = "";
let externalLogServerToken = "";

// Pluggable sinks: each receives (levelNum, ...args)
const logSinks = [];

/**
 * Register a log sink (fn(levelNum, ...args) or {sinkLog(levelNum, ...args)})
 */
export function registerLogSink(sink) {
  if (typeof sink === "function" || (sink && typeof sink.sinkLog === "function")) {
    logSinks.push(sink);
  }
}

/**
 * Set the log level at runtime using a number (0–5).
 * @param {number} num
 */
export function setLogLevel(num) {
  curLogLevelNum = normalizeLevelNum(num);
}
/**
 * Get current log level as number (0–5).
 */
export function getLogLevel() {
  return curLogLevelNum;
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
 * Accepts log level as number (0–5).
 */
export function configureLogging({ level, dest, serverURL, token }) {
  if (typeof level === "number") setLogLevel(level);
  if (dest) setLogDestination(dest);
  if (serverURL) setLogServerURL(serverURL);
  if (token) setLogServerToken(token);
}

/**
 * Normalize log level to valid number (0–5).
 */
function normalizeLevelNum(n) {
  if (typeof n === "number" && LOG_LEVEL_NUMS.includes(n)) return n;
  if (typeof n === "string" && n in LOG_LEVEL_NAME_TO_NUM) return LOG_LEVEL_NAME_TO_NUM[n];
  return 3; // INFO as default
}

/**
 * Map log level number to string name.
 */
function levelName(num) {
  return LOG_LEVEL_NUM_TO_NAME[num] ?? "INFO";
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
 * @param {number|string} levelNum - Numeric log level (0–5) or string name
 * @param  {...any} args
 */
export function log(levelNum, ...args) {
  const msgLevelNum = normalizeLevelNum(levelNum);
  const curLevelNum = curLogLevelNum;

  // Always show errors even in SILENT mode
  if (msgLevelNum === LOG_LEVELS.ERROR) {
    if (logDest === "console" || logDest === "both") {
      if (typeof console !== "undefined" && console.error) {
        console.error(`[log][${LOGGER_INSTANCE_ID}]`, levelName(msgLevelNum), ...args.map(safeLogArg));
      }
    }
    // Server streaming for errors
    if ((logDest === "server" || logDest === "both") && externalLogServerURL) {
      logStream(msgLevelNum, ...args);
    }
    for (const sink of logSinks) {
      try {
        if (typeof sink === "function") sink(msgLevelNum, ...args);
        else if (sink && typeof sink.sinkLog === "function") sink.sinkLog(msgLevelNum, ...args);
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(`[log][${LOGGER_INSTANCE_ID}]`, "Log sink error", e);
        }
      }
    }
    return;
  }

  // For all other levels, respect current log level
  if (msgLevelNum > curLevelNum || curLevelNum === LOG_LEVELS.SILENT) return;

  // Console output
  if (logDest === "console" || logDest === "both") {
    const lvlName = levelName(msgLevelNum);
    const safeArgs = args.map(safeLogArg);
    // Map to console methods
    if (typeof console !== "undefined") {
      if (msgLevelNum === 1 && console.error) console.error(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (msgLevelNum === 2 && console.warn) console.warn(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (msgLevelNum === 3 && console.info) console.info(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if ((msgLevelNum === 4 || msgLevelNum === 5) && console.debug) console.debug(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (console.log) console.log(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
    }
  }
  // Server streaming
  if ((logDest === "server" || logDest === "both") && externalLogServerURL) {
    logStream(msgLevelNum, ...args);
  }
  // Panel sinks
  for (const sink of logSinks) {
    try {
      if (typeof sink === "function") sink(msgLevelNum, ...args);
      else if (sink && typeof sink.sinkLog === "function") sink.sinkLog(msgLevelNum, ...args);
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(`[log][${LOGGER_INSTANCE_ID}]`, "Log sink error", e);
      }
    }
  }
}

/**
 * Async log streaming to external server (safe serialization).
 * Now with extra TRACE-level logs before and after streaming for diagnostics.
 */
export async function logStream(levelNum, ...args) {
  if (!externalLogServerURL) return;
  try {
    // --- Added: TRACE log before streaming ---
    log(LOG_LEVELS.TRACE, "[logStream] Preparing to stream log", {
      levelNum,
      levelName: levelName(levelNum),
      args,
      serverURL: externalLogServerURL,
      token: externalLogServerToken
    });

    const payload = {
      level: levelNum,
      levelName: levelName(levelNum),
      message: args.map(safeStringify).join(" "),
      timestamp: (new Date()).toISOString(),
      page: typeof location === "object" && location.pathname,
      userAgent: typeof navigator === "object" && navigator.userAgent,
      token: externalLogServerToken,
      loggerInstance: LOGGER_INSTANCE_ID
    };

    // --- Added: TRACE log with payload ---
    log(LOG_LEVELS.TRACE, "[logStream] Streaming payload", payload);

    const resp = await fetch(externalLogServerURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // --- Added: INFO log after successful streaming ---
    if (resp.ok) {
      log(LOG_LEVELS.INFO, "[logStream] Log streamed successfully", {
        status: resp.status,
        statusText: resp.statusText,
        payload
      });
    } else {
      log(LOG_LEVELS.ERROR, "[logStream] Log streaming failed", {
        status: resp.status,
        statusText: resp.statusText,
        payload
      });
    }
  } catch (e) {
    // --- Added: ERROR log with full fetch error ---
    log(LOG_LEVELS.ERROR, "[logStream] Failed to stream log", ...args, e);
    if (typeof console !== "undefined" && console.error) {
      console.error(`[log][${LOGGER_INSTANCE_ID}]`, levelName(levelNum), "Failed to stream log", ...args, e);
    }
  }
}

/**
 * For settings.js to fully re-sync config (optional).
 */
export function reconfigureLoggingFromSettings({ level, dest, serverURL, token }) {
  configureLogging({ level, dest, serverURL, token });
}

// Optionally attach to window for debugging (dev only, not for prod use)
if (typeof window !== "undefined") {
  window.log = log;
  window.setLogLevel = setLogLevel;
  window.getLogLevel = getLogLevel;
  window.setLogDestination = setLogDestination;
  window.setLogServerURL = setLogServerURL;
  window.setLogServerToken = setLogServerToken;
  window.LOG_LEVELS = LOG_LEVELS;
  window.__loggerInstanceId = LOGGER_INSTANCE_ID;
}

