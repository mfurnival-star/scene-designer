/**
 * main.js
 * -----------------------------------------------------------
 * Scene Designer – App Entry Point (ESM-only, MiniLayout Migration)
 * - Entry point for index.html (classic or Vite).
 * - Loads MiniLayout-based layout manager (no Golden Layout).
 * - No global logToBox, no legacy color picker, no stray DOM mutation.
 * - No direct use of window.* except for attaching debugging helpers (if needed).
 * - No console.log except inside logger.
 * - Logs module/script load at INFO.
 * - Fabric.js migration: all canvas and shape logic are now Fabric.js-based.
 * - MiniLayout: Panels, splitters, tabs, error log, etc.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
// Import MiniLayout bootstrapper:
import './layout.js';

// --- DEBUG-level logs at startup for diagnostics ---
log("DEBUG", "[main.js] Scene Designer app entry point loaded");
log("DEBUG", "[main.js] If you see this, logger and error panel are working");
log("DEBUG", "[main.js] Settings and FORCE mode values:", window?.SCENE_DESIGNER_FORCE_SETTINGS ?? null);

// (Optional) Attach for debugging; remove for production
if (typeof window !== "undefined") {
  window.log = log;
}

// --- Console.Re remote logging integration for dev mode (ESM wrapper only) ---
import { init as consoleReInit } from './console-re-wrapper.js';

if (typeof consoleReInit === "function") {
  // Use channel "scene-designer", redirect console to remote, keep local output
  consoleReInit({
    channel: "scene-designer",
    redirectDefaultConsoleToRemote: true,
    disableDefaultConsoleOutput: false
  });
  log("INFO", "[main.js] Console.Re remote logging initialized via ESM wrapper");
} else {
  log("WARN", "[main.js] Console.Re init not found – remote logging not active");
}

// No legacy global code, no logToBox, no direct DOM mutation.
// If you need a fallback message for classic index.html usage, re-add as a separate module.


