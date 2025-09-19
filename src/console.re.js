/**
 * console.re.js
 * -----------------------------------------------------------
 * Scene Designer – Console.Remote.Client Integration (ESM Only, npm package version)
 * - Streams all browser console logs (log, error, warn, info, debug, trace) to Console.Re remote dashboard.
 * - For development only; not recommended for production or sensitive data.
 * - Usage: import and call initConsoleRe(channel) in your main entry point (e.g., index.html or src/main.js).
 * - Exports: initConsoleRe(channel)
 * - Dependencies: console-remote-client (installed from npm)
 * -----------------------------------------------------------
 */

import { ConsoleRemoteClient } from 'console-remote-client';

/**
 * Initialize Console.Re log streaming with the given channel name.
 * @param {string} channel - Your Console.Re channel name.
 */
export function initConsoleRe(channel) {
  // Diagnostic log: confirm channel passed
  import('./log.js').then(({ log }) => {
    log("TRACE", "[console.re] initConsoleRe called", { channel });
  }).catch(() => {});

  const client = new ConsoleRemoteClient({
    channel,
    interceptConsole: true // Ensures all native console logs are streamed
    // You can add options here if needed, e.g.: url, debug, etc.
  });
  client.open();
}

