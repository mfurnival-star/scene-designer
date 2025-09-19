/**
 * console.re.js
 * -----------------------------------------------------------
 * Scene Designer – Console.Re Remote Logging Integration (ESM, New API)
 * - Initializes Console.Re remote logging with all recommended connector options.
 * - Redirects default console methods (log, warn, error, debug) to remote.
 * - Streams all logs to the remote console dashboard for the given channel.
 * - No global or window usage. ES module only.
 * - Usage: import and call initConsoleRe('scene-designer') in your entry point.
 * - Exports: initConsoleRe(channel)
 * - Dependencies: console-remote-client (npm, ESM)
 * -----------------------------------------------------------
 */

import consoleRe from 'console-remote-client';

/**
 * Initialize Console.Re log streaming with given channel.
 * All console methods are redirected to remote.
 * @param {string} channel - Your Console.Re channel name.
 */
export function initConsoleRe(channel = "default") {
  // TRACE log for diagnostics (optional)
  import('./log.js').then(({ log }) => {
    log("TRACE", "[console.re] initConsoleRe called", { channel });
  }).catch(() => {});

  // Initialize Console.Re connector with recommended options
  consoleRe.init({
    channel,
    redirectDefaultConsoleToRemote: true,
    disableDefaultConsoleOutput: false,
    // server: 'http://console.re' // Only needed for custom server
  });
}
