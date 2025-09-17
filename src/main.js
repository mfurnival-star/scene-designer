/**
 * main.js
 * -----------------------------------------------------------
 * Scene Designer – App Entry Point (ESM-only, Fabric.js migration ready)
 * - Entry point for classic index.html fallback or non-Golden Layout boot.
 * - No global logToBox, no legacy color picker, no stray DOM mutation.
 * - No direct use of window.* except for attaching debugging helpers (if needed).
 * - No console.log except inside logger.
 * - Logs module/script load at INFO.
 * - Fabric.js migration: all canvas and shape logic are now Fabric.js-based.
 * -----------------------------------------------------------
 */

import { log } from './log.js';
// Optionally import layout.js if you want the Golden Layout bootstrap:
import './layout.js';

// (Optional) Attach for debugging; remove for production
if (typeof window !== "undefined") {
  window.log = log;
}

// No legacy global code, no logToBox, no direct DOM mutation.
// The previous code that injected "main.js executed..." to #gl-root has been removed
// to comply with SCENE_DESIGNER_MANIFESTO.md and Engineering Instructions.
// If you need a fallback message for classic index.html usage, re-add as a separate module.

