// COPILOT_PART_logserver: 2025-09-12T10:20:00Z
/*********************************************************
 * [logserver] Log Streaming and External Log Server Integration
 * ------------------------------------------------------------
 * - Exposes window._externalLogStream(level, ...args) for log streaming.
 * - Destination controlled by LOG_OUTPUT_DEST setting:
 *     "console" (default): logs to console only
 *     "server": logs to server only (if URL set)
 *     "both": logs to both
 * - Filters messages by the current log level (see COPILOT_MANIFESTO.md).
 * - To enable server logging, set window._externalLogServerURL, or
 *   use the Settings panel.
 * - Adheres to project logging schema and manifesto (see COPILOT_MANIFESTO.md).
 *********************************************************/

// --- LOG LEVEL DEFINITIONS (used across all modules) ---
window.LOG_LEVELS = window.LOG_LEVELS || {
  OFF: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5
};

// --- LOGGING SETTINGS DEFAULTS (safe fallback) ---
window._settings = window._settings || {};
if (!window._settings.DEBUG_LOG_LEVEL) window._settings.DEBUG_LOG_LEVEL = "ERROR";
if (!window._settings.LOG_OUTPUT_DEST) window._settings.LOG_OUTPUT_DEST = "console";
window._externalLogServerURL = window._externalLogServerURL || "";

// --- REGISTER LOGGING SETTINGS (if not already present) ---
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

// --- LOG STREAMING CORE (with log-level filtering) ---
window._externalLogStream = async function(level, ...args) {
  // Project-wide: always tag logs with [logserver]
  const tag = "[logserver]";

  // Determine current log level (fallback to "ERROR" if unset)
  let curLevel = "ERROR";
  if (typeof window.getSetting === "function") {
    curLevel = window.getSetting("DEBUG_LOG_LEVEL") || "ERROR";
  } else if (window._settings && window._settings.DEBUG_LOG_LEVEL) {
    curLevel = window._settings.DEBUG_LOG_LEVEL;
  }
  const curLevelNum = window.LOG_LEVELS[curLevel] ?? window.LOG_LEVELS.ERROR;
  const msgLevelNum = window.LOG_LEVELS[level] ?? 99; // Unknown levels excluded

  // Only log if message level is at or above current level (lower number = higher priority)
  if (msgLevelNum > curLevelNum) return;

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
        console.error(`${tag} [FAIL]`, level, ...args, e);
      }
    }
  }

  // Helper: Send to console (always log errors to console if unset)
  function sendToConsole() {
    // Level-specific console output
    if (window.LOG_LEVELS) {
      if (window.LOG_LEVELS[level] <= window.LOG_LEVELS.WARN) {
        console.warn(`${tag}`, level, ...args);
      } else {
        console.log(`${tag}`, level, ...args);
      }
    } else {
      console.log(`${tag}`, level, ...args);
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

// No-op flush for future batching support
window._externalLogStream.flush = function() {};

// --- DEBUG: Self-test ---
if (!window._logserverTested) {
  window._logserverTested = true;
  window._externalLogStream("INFO", "[logserver] LogServer module loaded and ready.");
}
