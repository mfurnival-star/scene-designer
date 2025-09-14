/**
 * main.js
 * -----------------------------------------------------------
 * Scene Designer – App Entry Point (for classic index.html fallback)
 * - Legacy entry for non-Golden Layout bootstrap/testing only.
 * - No global logToBox, no legacy color picker, no stray DOM mutation.
 * - No direct use of window.* except for attaching debugging helpers (if needed).
 * - No console.log except inside logger.
 * - Logs module/script load at INFO.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
// Optionally import layout.js if you want the Golden Layout bootstrap:
// import './layout.js';

// (Optional) Attach for debugging; remove for production
if (typeof window !== "undefined") {
  window.log = log;
}

// No legacy global code, no logToBox, no direct DOM mutation.
// If you want to show a single "main.js executed!" message for legacy pages:
log("INFO", "[main] main.js loaded and ready.");

// If classic index.html usage is detected, you may show a fallback message:
const glRoot = document.getElementById("gl-root");
if (glRoot) {
  glRoot.innerHTML = "<div style='color:#d22;font-size:2em'>main.js executed (ESM-only version)!</div>";
}
