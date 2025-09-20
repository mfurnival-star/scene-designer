/**
 * console-stream.js
 * -------------------------------------------------------------------
 * Console Interception and Streaming Module for Scene Designer (ESM).
 * - When enabled, intercepts all console methods (log, error, warn, info, debug).
 * - Forwards all intercepted logs to the central logger (log.js), preserving log levels.
 * - Optionally preserves original console output for devtools visibility.
 * - Controlled by an explicit enableConsoleInterception() function (import and call in bootstrap).
 * - No global/window usage except for patching the console object.
 * - ES module only: imports log() from log.js.
 * - Logging policy: No direct use of console.log outside the logger implementation.
 * - **Streams all intercepted logs to remote via Console.Re if available (console.re.log, etc).**
 * -------------------------------------------------------------------
 * Exports: enableConsoleInterception, disableConsoleInterception
 * Dependencies: log.js
 * -------------------------------------------------------------------
 */

import { log } from './log.js';

let interceptionEnabled = false;
let origConsole = null;

/**
 * Patch all console methods to forward to logger, preserving level.
 * Optionally, preserve original output as well.
 * Also forwards to Console.Re remote logging if available.
 */
export function enableConsoleInterception({ preserveOriginal = true } = {}) {
  if (interceptionEnabled) return;
  interceptionEnabled = true;
  origConsole = origConsole || { ...console };

  const levels = ["log", "info", "warn", "error", "debug"];
  // Map console methods to log() levels
  const levelMap = {
    log: "INFO",
    info: "INFO",
    warn: "WARN",
    error: "ERROR",
    debug: "DEBUG"
  };

  levels.forEach(method => {
    console[method] = function (...args) {
      // Skip interception for blank logs (no message or only empty/undefined/null)
      if (!args.length || args.every(arg =>
        arg === undefined || arg === null || arg === "" ||
        (typeof arg === "object" && Object.keys(arg).length === 0 && !(arg instanceof Error))
      )) {
        if (preserveOriginal && origConsole && origConsole[method]) {
          origConsole[method].apply(console, args);
        }
        return;
      }
      try {
        // Forward to the logger for streaming and sinks
        log(levelMap[method], ...args);

        // Forward to Console.Re remote logger if available
        if (typeof console !== "undefined" && console.re) {
          try {
            if (method === "error" && typeof console.re.error === "function") {
              console.re.error(...args);
            } else if (method === "warn" && typeof console.re.warn === "function") {
              console.re.warn(...args);
            } else if (method === "info" && typeof console.re.info === "function") {
              console.re.info(...args);
            } else if (method === "debug" && typeof console.re.debug === "function") {
              console.re.debug(...args);
            } else if (typeof console.re.log === "function") {
              console.re.log(...args);
            }
          } catch (e) {
            // fail silently for remote logging errors
          }
        }
      } catch (e) {
        // If log() throws, do not break console
        if (preserveOriginal && origConsole && origConsole[method]) {
          origConsole[method].apply(console, args);
        }
      }
      // Optionally call original method for devtools visibility
      if (preserveOriginal && origConsole && origConsole[method]) {
        origConsole[method].apply(console, args);
      }
    };
  });
}

/**
 * Restore original console methods.
 */
export function disableConsoleInterception() {
  if (!interceptionEnabled || !origConsole) return;
  ["log", "info", "warn", "error", "debug"].forEach(method => {
    if (origConsole[method]) console[method] = origConsole[method];
  });
  interceptionEnabled = false;
}

/**
 * Whether console interception is currently enabled.
 */
export function isConsoleInterceptionEnabled() {
  return interceptionEnabled;
}

