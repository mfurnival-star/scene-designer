import { log } from './log.js';

let handlersEnabled = false;

export function enableGlobalErrorCapture() {
  if (handlersEnabled) return;
  window.addEventListener("error", onGlobalError);
  window.addEventListener("unhandledrejection", onGlobalRejection);
  handlersEnabled = true;
  log("INFO", "[global-errors] Global error and unhandledrejection capture enabled");
}

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

function onGlobalError(event) {
  try {
    log("ERROR", "[global-errors] Uncaught error",
      event.message,
      event.filename + ":" + event.lineno + ":" + event.colno,
      event.error
    );
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[global-errors]", "Failed to log uncaught error", event, e);
    }
  }
}

function onGlobalRejection(event) {
  try {
    log("ERROR", "[global-errors] Unhandled promise rejection", event.reason);
  } catch (e) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[global-errors]", "Failed to log unhandled rejection", event, e);
    }
  }
}
