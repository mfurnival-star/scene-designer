/**
 * console-stream.js
 * -------------------------------------------------------------------
 * Console Interception and Streaming Module for Scene Designer (ESM).
 * - When enabled, intercepts all console methods (log, error, warn, info, debug, trace).
 * - Forwards all intercepted logs to the central logger (log.js), preserving log levels.
 * - Optionally preserves original console output for devtools visibility.
 * - Controlled by an explicit enableConsoleInterception() function (import and call in bootstrap).
 * - No global/window usage except for patching the console object.
 * - ES module only: imports log() from log.js.
 * - Logging policy: No direct use of console.log outside the logger implementation.
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
 */
export function enableConsoleInterception({ preserveOriginal = true } = {}) {
  if (interceptionEnabled) return;
  interceptionEnabled = true;
  origConsole = origConsole || { ...console };

  const levels = ["log", "info", "warn", "error", "debug", "trace"];
  // Map console methods to log() levels
  const levelMap = {
    log: "INFO",
    info: "INFO",
    warn: "WARN",
    error: "ERROR",
    debug: "DEBUG",
    trace: "TRACE"
  };

  levels.forEach(method => {
    console[method] = function (...args) {
      try {
        // Forward to the logger for streaming and sinks
        log(levelMap[method], ...args);
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
  ["log", "info", "warn", "error", "debug", "trace"].forEach(method => {
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

