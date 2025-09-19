/**
 * console.re.js
 * -----------------------------------------------------------
 * Scene Designer – Console.Re Integration (ESM Only)
 * - Streams all browser console logs (log, error, warn, info, debug, trace) to Console.Re remote dashboard.
 * - For development only; not recommended for production or sensitive data.
 * - Usage: import and call initConsoleRe(token) in your main entry point (e.g., index.html or src/main.js).
 * - Exports: initConsoleRe(token)
 * - Dependencies: Console.Re ESM CDN ("https://esm.sh/console.re")
 * -----------------------------------------------------------
 */

export async function initConsoleRe(token) {
  // Dynamically import Console.Re ESM module from CDN
  const { init } = await import("https://esm.sh/console.re");
  init(token);
}
