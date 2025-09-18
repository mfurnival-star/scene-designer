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

// --- ADDED: Explicit TRACE-level logs at startup for debugging/diagnostics ---
log("TRACE", "[main.js] Scene Designer app entry point loaded");
log("TRACE", "[main.js] If you see this, logger and error panel are working");
log("TRACE", "[main.js] Settings and FORCE mode values:", window?.SCENE_DESIGNER_FORCE_SETTINGS ?? null);

// (Optional) Attach for debugging; remove for production
if (typeof window !== "undefined") {
  window.log = log;
}

// No legacy global code, no logToBox, no direct DOM mutation.
// The previous code that injected "main.js executed..." to #gl-root has been removed
// to comply with SCENE_DESIGNER_MANIFESTO.md and Engineering Instructions.
// If you need a fallback message for classic index.html usage, re-add as a separate module.

