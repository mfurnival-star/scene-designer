// COPILOT_PART_logserver: 2025-09-11T18:24:32Z
/*********************************************************
 * Log Server / Streaming Integration Module
 * -----------------------------------------
 * Provides a hook for streaming log/error messages to an external server
 * or backend endpoint. Intended to be loaded FIRST in modular shapes.js.
 * - Exposes window._externalLogStream(level, ...args)
 * - By default, it logs to console. To enable real streaming, set
 *   window._externalLogServerURL = "https://your-server/endpoint"
 * - Future: Supports batching, retries, queueing, and log level config.
 *********************************************************/

// (Optionally set this before loading shapes.js)
window._externalLogServerURL = window._externalLogServerURL || ""; // e.g. "https://your-backend.example.com/log"

window._externalLogStream = async function(level, ...args) {
  // If not configured, just echo to console
  if (!window._externalLogServerURL) {
    if (window.LOG_LEVELS) {
      if (window.LOG_LEVELS[level] <= window.LOG_LEVELS.WARN) {
        // Only warn/error by default if not configured
        console.warn("[LogStream]", level, ...args);
      }
    } else {
      console.log("[LogStream]", level, ...args);
    }
    return;
  }
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
    console.error("[LogStream][FAIL]", level, ...args, e);
  }
};

// Optionally, provide a no-op flush (for future batching support)
window._externalLogStream.flush = function() {};

// For debugging: test hook
if (!window._logserverTested) {
  window._logserverTested = true;
  window._externalLogStream("INFO", "LogServer module loaded and ready.");
}
