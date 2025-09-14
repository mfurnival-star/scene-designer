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
 * - TRACE-level logging for all functions.
 * -----------------------------------------------------------
 */

import loglevel from 'loglevel';

export const LOG_LEVELS = {
  OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

// Map "OFF" (our config/UI) to "silent" (loglevel's string)
function mapLogLevel(level) {
  if (!level) return "error";
  if (level === "OFF" || level === "off") return "silent";
  return level.toLowerCase ? level.toLowerCase() : level;
}

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
  log("TRACE", "[log] registerLogSink entry", { sink });
  if (typeof sink === "function" || (sink && typeof sink.sinkLog === "function")) {
    errorLogPanelSinks.push(sink);
  }
  log("TRACE", "[log] registerLogSink exit", { errorLogPanelSinksCount: errorLogPanelSinks.length });
}
export function registerErrorLogPanelSink(sink) {
  log("TRACE", "[log] registerErrorLogPanelSink entry", { sink });
  registerLogSink(sink);
  log("TRACE", "[log] registerErrorLogPanelSink exit");
}

// --- Safe serialization for log arguments ---
function safeStringify(arg) {
  loglevel.trace("[log] safeStringify entry", arg);
  if (arg instanceof Error) {
    loglevel.trace("[log] safeStringify exit (Error instance)");
    return `[Error: ${arg.message}]${arg.stack ? "\n" + arg.stack : ""}`;
  }
  try {
    // Handle cyclic references gracefully
    const seen = new WeakSet();
    const result = JSON.stringify(arg, function(key, value) {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Cyclic]";
        seen.add(value);
      }
      return value;
    });
    loglevel.trace("[log] safeStringify exit (success)");
    return result;
  } catch (e) {
    // Fallback
    if (typeof arg === "object" && arg !== null) {
      loglevel.trace("[log] safeStringify exit (unserializable object fallback)");
      return "[Unserializable Object: " + (arg.constructor?.name || "Object") + "]";
    }
    loglevel.trace("[log] safeStringify exit (fallback to String)");
    return String(arg);
  }
}

// --- Extra: Harden log argument for console output ---
function safeLogArg(arg) {
  loglevel.trace("[log] safeLogArg entry", arg);
  try {
    // If it's a DOM element
    if (typeof Element !== "undefined" && arg instanceof Element) {
      loglevel.trace("[log] safeLogArg exit (Element)");
      return `<${arg.tagName.toLowerCase()} id="${arg.id}" class="${arg.className}">`;
    }
    // Golden Layout container or suspiciously complex object
    if (arg && arg.constructor && arg.constructor.name &&
        /Container|Layout|Panel|Manager/.test(arg.constructor.name)) {
      loglevel.trace("[log] safeLogArg exit (GL container)");
      return `[${arg.constructor.name}]`;
    }
    // If it's a Konva shape, just return its type and id
    if (arg && arg._id && arg._type) {
      loglevel.trace("[log] safeLogArg exit (Konva shape)");
      return `{type:"${arg._type}", id:"${arg._id}"}`;
    }
    // Try to JSON.stringify (will invoke safeStringify)
    // If it's a plain object or array
    if (typeof arg === "object") {
      // Try a shallow copy if it's not null
      if (arg !== null) {
        const shallow = {};
        for (const k in arg) {
          if (typeof arg[k] !== "object" && typeof arg[k] !== "function") {
            shallow[k] = arg[k];
          }
        }
        // Only display shallow if not empty
        if (Object.keys(shallow).length > 0) {
          loglevel.trace("[log] safeLogArg exit (shallow obj)");
          return shallow;
        }
      }
    }
    // Otherwise, return arg as-is (primitive)
    loglevel.trace("[log] safeLogArg exit (primitive)");
    return arg;
  } catch (e) {
    // Fallback for anything else
    loglevel.trace("[log] safeLogArg exit (unserializable fallback)", e);
    return `[Unserializable: ${arg && arg.constructor && arg.constructor.name}]`;
  }
}

// --- Set up loglevel ---
loglevel.setLevel(mapLogLevel(curLogLevel)); // e.g. 'debug', 'info', etc.

/**
 * Central log function (hardened: never throws on cyclic/non-serializable objects)
 */
export function log(level, ...args) {
  // Entry log for diagnostics
  // NOTE: Do NOT log() from here or you'll infinite loop! Use loglevel.* instead.
  const curLevelNum = LOG_LEVELS[curLogLevel] ?? LOG_LEVELS.ERROR;
  const msgLevelNum = LOG_LEVELS[level] ?? 99;
  if (msgLevelNum > curLevelNum) return;

  // Console output via loglevel
  if (logDest === "console" || logDest === "both") {
    // Map our levels to loglevel's methods
    const lvl = level.toLowerCase();
    const safeArgs = args.map(safeLogArg);
    if (lvl === "error") loglevel.error("[log]", level, ...safeArgs);
    else if (lvl === "warn") loglevel.warn("[log]", level, ...safeArgs);
    else if (lvl === "info") loglevel.info("[log]", level, ...safeArgs);
    else if (lvl === "debug") loglevel.debug("[log]", level, ...safeArgs);
    else if (lvl === "trace") loglevel.trace("[log]", level, ...safeArgs);
    else loglevel.log("[log]", level, ...safeArgs);
  }
  // Server streaming
  if ((logDest === "server" || logDest === "both") && externalLogServerURL) {
    logStream(level, ...args);
  }
  // Panel sinks
  for (const sink of errorLogPanelSinks) {
    try {
      if (typeof sink === "function") sink(level, ...args);
      else if (sink && typeof sink.sinkLog === "function") sink.sinkLog(level, ...args);
    } catch (e) {
      // Never allow a log sink to throw
      loglevel.warn("[log]", "Log sink error", e);
    }
  }
  // Exit log for diagnostics (do not call log() itself!)
}

/**
 * Async log streaming to external server (safe serialization)
 */
export async function logStream(level, ...args) {
  loglevel.trace("[log] logStream entry", { level, args });
  if (!externalLogServerURL) {
    loglevel.trace("[log] logStream exit (no server url)");
    return;
  }
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
    loglevel.trace("[log] logStream exit (success)");
  } catch (e) {
    loglevel.error("[log]", level, "Failed to stream log", ...args, e);
    loglevel.trace("[log] logStream exit (error)", e);
  }
}

/**
 * Allow runtime reconfiguration
 */
export function setLogLevel(level) {
  loglevel.trace("[log] setLogLevel entry", { level });
  if (level && level in LOG_LEVELS) {
    curLogLevel = level;
    const mappedLevel = mapLogLevel(level);
    loglevel.setLevel(mappedLevel);
  }
  loglevel.trace("[log] setLogLevel exit", { curLogLevel });
}
export function getLogLevel() {
  loglevel.trace("[log] getLogLevel entry");
  loglevel.trace("[log] getLogLevel exit", { curLogLevel });
  return curLogLevel;
}
export function setLogDestination(dest) {
  loglevel.trace("[log] setLogDestination entry", { dest });
  if (['console', 'server', 'both'].includes(dest)) logDest = dest;
  loglevel.trace("[log] setLogDestination exit", { logDest });
}
export function getLogDestination() {
  loglevel.trace("[log] getLogDestination entry");
  loglevel.trace("[log] getLogDestination exit", { logDest });
  return logDest;
}
export function setLogServerURL(url) {
  loglevel.trace("[log] setLogServerURL entry", { url });
  externalLogServerURL = url || '';
  loglevel.trace("[log] setLogServerURL exit", { externalLogServerURL });
}
export function setLogServerToken(token) {
  loglevel.trace("[log] setLogServerToken entry", { token });
  externalLogServerToken = token || '';
  loglevel.trace("[log] setLogServerToken exit", { externalLogServerToken });
}

/**
 * For settings.js to fully re-sync config (optional)
 */
export function configureLogging({level, dest, serverURL, token}) {
  loglevel.trace("[log] configureLogging entry", {level, dest, serverURL, token});
  if (level) setLogLevel(level);
  if (dest) setLogDestination(dest);
  if (serverURL) setLogServerURL(serverURL);
  if (token) setLogServerToken(token);
  loglevel.trace("[log] configureLogging exit");
}

// Self-test on import
loglevel.info("[log]", "INFO", "[log] log.js module loaded and ready.");

// Optionally (for backwards compatibility), attach to window for debugging
if (typeof window !== "undefined") {
  window.log = log;
  window.setLogLevel = setLogLevel;
  window.setLogDestination = setLogDestination;
  window.setLogServerURL = setLogServerURL;
  window.setLogServerToken = setLogServerToken;
  window.LOG_LEVELS = LOG_LEVELS;
}


