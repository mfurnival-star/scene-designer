/**
 * log.js
 * -------------------------------------------------------------------
 * Centralized, pluggable logging system for Scene Designer (ESM only, numeric log levels).
 * - All logs routed through log() at appropriate level/tag.
 * - Supports runtime config of level, destination, and sinks.
 * - Log level is an integer (0=SILENT, 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG).
 * - TRACE is NOT a separate level; any "TRACE" string passed to log() is aliased to DEBUG.
 * - Pluggable log sinks (console, remote, etc).
 * - Safe serialization (handles cyclic/Error objects).
 * - Zero use of window.*, no globals except optional debug attach.
 * - Compatible with console interception and global error handlers.
 * - Forwards logs to Console.Re remote logger if available (injects connector.js as global).
 * - Exports: log, setLogLevel/getLogLevel, setLogDestination, configureLogging, registerLogSink, reconfigureLoggingFromSettings
 * -------------------------------------------------------------------
 * Dependencies: None (uses built-in fetch, Date, etc).
 * -------------------------------------------------------------------
 */

export const LOG_LEVELS = {
  SILENT: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4
};
export const LOG_LEVEL_NUMS = [0, 1, 2, 3, 4];
export const LOG_LEVEL_NUM_TO_NAME = ["SILENT", "ERROR", "WARN", "INFO", "DEBUG"];
export const LOG_LEVEL_NAME_TO_NUM = {
  SILENT: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4
  // Note: Do not add TRACE here. We alias it explicitly in normalizeLevelNum().
};

const LOGGER_INSTANCE_ID = Math.random().toString(36).slice(2) + "-" + Date.now();
let curLogLevelNum = 3; // Default: INFO
let logDest = "console"; // "console" or "both"

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
 * Set the log level at runtime using a number (0–4) or a level name.
 * @param {number|string} num
 */
export function setLogLevel(num) {
  curLogLevelNum = normalizeLevelNum(num);
}
/**
 * Get current log level as number (0–4).
 */
export function getLogLevel() {
  return curLogLevelNum;
}

/**
 * Set log destination at runtime.
 * @param {"console"|"both"} dest
 */
export function setLogDestination(dest) {
  if (["console", "both"].includes(dest)) logDest = dest;
}
export function getLogDestination() {
  return logDest;
}

export function configureLogging({ level, dest }) {
  if (level !== undefined) setLogLevel(level);
  if (dest) setLogDestination(dest);
}

/**
 * Normalize log level to valid number (0–4).
 * - Accepts numbers directly (0–4).
 * - Accepts string names (case-insensitive for TRACE alias, otherwise exact keys).
 * - Aliases:
 *    "TRACE" -> DEBUG (4)
 *    "WARNING" -> WARN (2)  [friendly alias, if ever used]
 */
function normalizeLevelNum(n) {
  if (typeof n === "number" && LOG_LEVEL_NUMS.includes(n)) return n;
  if (typeof n === "string") {
    const u = n.toUpperCase();
    if (u === "TRACE") return LOG_LEVELS.DEBUG; // Alias TRACE → DEBUG
    if (u === "WARNING") return LOG_LEVELS.WARN;
    if (u in LOG_LEVEL_NAME_TO_NUM) return LOG_LEVEL_NAME_TO_NUM[u];
  }
  return LOG_LEVELS.INFO; // default
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
    const seen = new WeakSet();
    return JSON.stringify(arg, function (key, value) {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Cyclic]";
        seen.add(value);
      }
      return value;
    });
  } catch (e) {
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
 * @param {number|string} levelNum - Numeric log level (0–4) or string name
 * @param  {...any} args
 */
export function log(levelNum, ...args) {
  const msgLevelNum = normalizeLevelNum(levelNum);
  const curLevelNum = curLogLevelNum;

  // Guard: Skip logs with no meaningful message/payload
  if (!args.length || args.every(arg =>
    arg === undefined || arg === null || arg === "" ||
    (typeof arg === "object" && Object.keys(arg).length === 0 && !(arg instanceof Error))
  )) {
    return;
  }

  // Always show errors even in SILENT mode
  if (msgLevelNum === LOG_LEVELS.ERROR) {
    if (logDest === "console" || logDest === "both") {
      if (typeof console !== "undefined" && console.error) {
        console.error(`[log][${LOGGER_INSTANCE_ID}]`, levelName(msgLevelNum), ...args.map(safeLogArg));
      }
    }
    // Output to sinks
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
    // Forward to Console.Re remote logger if available
    if (typeof console !== "undefined" && console.re && typeof console.re.error === "function") {
      try {
        console.re.error(...args);
      } catch {
        // fail silently for remote logging errors
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
    if (typeof console !== "undefined") {
      if (msgLevelNum === LOG_LEVELS.ERROR && console.error) console.error(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (msgLevelNum === LOG_LEVELS.WARN && console.warn) console.warn(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (msgLevelNum === LOG_LEVELS.INFO && console.info) console.info(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (msgLevelNum === LOG_LEVELS.DEBUG && console.debug) console.debug(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
      else if (console.log) console.log(`[log][${LOGGER_INSTANCE_ID}]`, lvlName, ...safeArgs);
    }
  }
  // Panel/other sinks
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
  // Forward to Console.Re remote logger if available
  if (typeof console !== "undefined" && console.re) {
    try {
      if (msgLevelNum === LOG_LEVELS.ERROR && typeof console.re.error === "function") {
        console.re.error(...args);
      } else if (msgLevelNum === LOG_LEVELS.WARN && typeof console.re.warn === "function") {
        console.re.warn(...args);
      } else if (msgLevelNum === LOG_LEVELS.INFO && typeof console.re.info === "function") {
        console.re.info(...args);
      } else if (msgLevelNum === LOG_LEVELS.DEBUG && typeof console.re.debug === "function") {
        console.re.debug(...args);
      } else if (typeof console.re.log === "function") {
        console.re.log(...args);
      }
    } catch {
      // fail silently for remote logging errors
    }
  }
}

/**
 * For settings.js to fully re-sync config (optional).
 */
export function reconfigureLoggingFromSettings({ level, dest }) {
  configureLogging({ level, dest });
}

// Optionally attach to window for debugging (dev only, not for prod use)
if (typeof window !== "undefined") {
  window.log = log;
  window.setLogLevel = setLogLevel;
  window.getLogLevel = getLogLevel;
  window.setLogDestination = setLogDestination;
  window.LOG_LEVELS = LOG_LEVELS;
  window.__loggerInstanceId = LOGGER_INSTANCE_ID;
}
