/**
 * global-errors.js
 * -------------------------------------------------------------------
 * Global Error and Unhandled Promise Rejection Handler for Scene Designer (ESM).
 * - When enabled, catches all uncaught exceptions and unhandled promise rejections.
 * - Forwards them to the central logger (log.js) at ERROR level for streaming and log sinks.
 * - No global/window dependencies except the required event listeners.
 * - ES module only: imports log() from log.js.
 * - Enable by importing and calling enableGlobalErrorCapture() in your bootstrap (e.g., layout.js).
 * -------------------------------------------------------------------
 * Exports: enableGlobalErrorCapture, disableGlobalErrorCapture, isGlobalErrorCaptureEnabled
 * Dependencies: log.js
 * -------------------------------------------------------------------
 */

import { log } from './log.js';

let handlersEnabled = false;

/**
 * Enable global error and unhandledrejection forwarding to logger.
 */
export function enableGlobalErrorCapture() {
  if (handlersEnabled) return;
  // Uncaught exceptions
  window.addEventListener("error", onGlobalError);
  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", onGlobalRejection);
  handlersEnabled = true;
  log("INFO", "[global-errors] Global error and unhandledrejection capture enabled");
}

/**
 * Remove handlers (for hot reload or test teardown).
 */
export function disableGlobalErrorCapture() {
  if (!handlersEnabled) return;
  window.removeEventListener("error", onGlobalError);
  window.removeEventListener("unhandledrejection", onGlobalRejection);
  handlersEnabled = false;
  log("INFO", "[global-errors] Global error and unhandledrejection capture disabled");
}

export function isGlobalErrorCaptureEnabled() {
  return handlersEnabled;
}

/**
 * Handler for uncaught exceptions.
 */
function onGlobalError(event) {
  try {
    log("ERROR", "[global-errors] Uncaught error",
      event.message,
      event.filename + ":" + event.lineno + ":" + event.colno,
      event.error
    );
  } catch (e) {
    // Last resort fallback: dump to console
    if (typeof console !== "undefined" && console.error) {
      console.error("[global-errors]", "Failed to log uncaught error", event, e);
    }
  }
}

/**
 * Handler for unhandled promise rejections.
 */
function onGlobalRejection(event) {
  try {
    log("ERROR", "[global-errors] Unhandled promise rejection", event.reason);
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[global-errors]", "Failed to log unhandled rejection", event, e);
    }
  }
}

