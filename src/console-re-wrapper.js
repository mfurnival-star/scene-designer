/**
 * console-re-wrapper.js
 * -------------------------------------------------------------------
 * Temporary ES Module Wrapper for Console.Re Remote Logging (UMD/Global Edition)
 * - Imports 'console-remote-client' (UMD package) to attach global window.ConsoleRe.
 * - Exports window.ConsoleRe as default, and window.ConsoleRe.init as named export.
 * - EXCEPTION: Uses window.* as a temporary workaround (per project allowance).
 * - Usage: import { init } from './console-re-wrapper.js'; init({ ... });
 * -------------------------------------------------------------------
 */

import consoleRemoteClientImport from 'console-remote-client';

// The import above loads the UMD module, which attaches to window.ConsoleRe in browser.
const consoleReGlobal = typeof window !== "undefined"
  ? (window.ConsoleRe || window.re || null)
  : null;

// Export main object and .init if present
const consoleReInit = consoleReGlobal && typeof consoleReGlobal.init === "function"
  ? consoleReGlobal.init
  : null;

export default consoleReGlobal;
export const init = consoleReInit;
