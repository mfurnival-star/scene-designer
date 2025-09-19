/**
 * console.re.js
 * -----------------------------------------------------------
 * Scene Designer – Console.Re Remote Logging Integration (ESM/UMD Wrapper Edition)
 * - Uses src/console-re-wrapper.js to access window.ConsoleRe and .init.
 * - Initializes Console.Re remote logging with all recommended connector options.
 * - Logs diagnostics about connector initialization and type.
 * - Streams all logs to the remote console dashboard for the given channel if possible.
 * - Usage: import and call initConsoleRe('scene-designer') in your entry point.
 * - Exports: initConsoleRe(channel)
 * - Dependencies: ./console-re-wrapper.js
 * -----------------------------------------------------------
 */

import { init as consoleReInit, default as consoleReGlobal } from './console-re-wrapper.js';

import { log } from './log.js';

/**
 * Initialize Console.Re log streaming with given channel.
 * All console methods are redirected to remote when possible.
 * @param {string} channel - Your Console.Re channel name.
 */
export function initConsoleRe(channel = "default") {
  log("TRACE", "[console.re] initConsoleRe ENTRY", {
    channel,
    hasInit: typeof consoleReInit === "function",
    hasGlobal: !!consoleReGlobal,
    consoleReGlobalType: typeof consoleReGlobal
  });

  if (typeof consoleReInit === "function") {
    try {
      consoleReInit({
        channel,
        redirectDefaultConsoleToRemote: true,
        disableDefaultConsoleOutput: false
        // server: 'http://console.re' // Only needed for custom server
      });
      log("INFO", "[console.re] Console.Re remote logging initialized", { channel });
    } catch (e) {
      log("ERROR", "[console.re] Console.Re initialization failed", e);
    }
  } else {
    log("ERROR", "[console.re] Console.Re init function not found – connector not initialized", {
      channel,
      consoleReGlobal,
      consoleReInit
    });
  }
}
