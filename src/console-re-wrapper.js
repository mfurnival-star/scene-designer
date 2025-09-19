/**
 * Temporary ES Module Wrapper for Console.Re Remote Logging (UMD/Global Edition)
 * - Imports 'console-remote-client' (UMD) as a pure side effect to ensure global attachment.
 * - Exports window.ConsoleRe as default, and window.ConsoleRe.init as named export.
 * - EXCEPTION: Uses window.* as a temporary workaround (per project allowance).
 */

import 'console-remote-client'; // <-- Side-effect only import; do NOT assign to a variable.

const consoleReGlobal = typeof window !== "undefined"
  ? (window.ConsoleRe || window.re || null)
  : null;

export default consoleReGlobal;
export const init = consoleReGlobal?.init ?? null;
