// COPILOT_PART_logserver: 2025-09-12T07:41:00Z
/*********************************************************
 * Log Server / Streaming Integration Module
 * -----------------------------------------
 * Provides a hook for streaming log/error messages to an external server
 * or backend endpoint. Intended to be loaded FIRST in modular shapes.js.
 * - Exposes window._externalLogStream(level, ...args)
 * - Destination controlled by LOG_OUTPUT_DEST setting:
 *     "console" (default): logs to console only
 *     "server": logs to server only (if URL set)
 *     "both": logs to both
 * - To enable server logging, set window._externalLogServerURL, or
 *   use Settings panel (future).
 * - Future: Supports batching, retries, queueing, and log level config.
 *********************************************************/

// --- SAFE LOGGING DEFAULTS (always log errors to console if unset) ---
window._settings = window._settings || {};
if (!window._settings.DEBUG_LOG_LEVEL) window._settings.DEBUG_LOG_LEVEL = "ERROR";
if (!window._settings.LOG_OUTPUT_DEST) window._settings.LOG_OUTPUT_DEST = "console";

// (Optionally set this before loading shapes.js)
window._externalLogServerURL = window._externalLogServerURL || "";

// LOG_OUTPUT_DEST: "console" | "server" | "both"
window._settingsRegistry = window._settingsRegistry || [];
if (!window._settingsRegistry.some(s => s.key === "LOG_OUTPUT_DEST")) {
  window._settingsRegistry.push({
    key: "LOG_OUTPUT_DEST",
    label: "Log Output Destination",
    type: "select",
    options: [
      { value: "console", label: "Console Only" },
      { value: "server", label: "Server Only" },
      { value: "both", label: "Both" }
    ],
    default: "console"
  });
}

// Core streaming logic
window._externalLogStream = async function(level, ...args) {
  // Read current setting
  let dest = (typeof window.getSetting === "function")
    ? window.getSetting("LOG_OUTPUT_DEST")
    : (window._settings && window._settings.LOG_OUTPUT_DEST) || "console";

  // Fallback for unknown value
  if (!["console", "server", "both"].includes(dest)) dest = "console";

  // Helper: Send to server if allowed and configured
  async function sendToServer() {
    if (!window._externalLogServerURL) return;
    try {
      const payload = {
        level,
        message: args.map(a =>
          (typeof a === "object" ? JSON.stringify(a) : String(a))
        ).join(" "),
        timestamp: (new Date()).toISOString(),
        page: location.pathname,
        userAgent: navigator.userAgent
      };
      await fetch(window._externalLogServerURL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // If streaming fails, log locally as fallback
      if (dest === "server") {
        // If server-only, show error in console
        console.error("[LogStream][FAIL]", level, ...args, e);
      }
    }
  }

  // Helper: Send to console (always log errors to console if unset)
  function sendToConsole() {
    if (window.LOG_LEVELS) {
      // Show warn/error to console.warn, others to console.log
      if (window.LOG_LEVELS[level] <= window.LOG_LEVELS.WARN) {
        console.warn("[LogStream]", level, ...args);
      } else {
        console.log("[LogStream]", level, ...args);
      }
    } else {
      console.log("[LogStream]", level, ...args);
    }
  }

  // Route as per setting
  if (dest === "console") {
    sendToConsole();
  } else if (dest === "server") {
    await sendToServer();
  } else if (dest === "both") {
    sendToConsole();
    await sendToServer();
  }
};

// Optionally, provide a no-op flush (for future batching support)
window._externalLogStream.flush = function() {};

// For debugging: test hook
if (!window._logserverTested) {
  window._logserverTested = true;
  window._externalLogStream("INFO", "LogServer module loaded and ready.");
}
