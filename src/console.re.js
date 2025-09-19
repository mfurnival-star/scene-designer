/**
 * console.re.js
 * -----------------------------------------------------------
 * Scene Designer – Console.Remote.Client Integration (ESM Only, npm package version)
 * - Streams all browser console logs (log, error, warn, info, debug, trace) to Console.Re remote dashboard.
 * - For development only; not recommended for production or sensitive data.
 * - Usage: import and call initConsoleRe(token) in your main entry point (e.g., index.html or src/main.js).
 * - Exports: initConsoleRe(token)
 * - Dependencies: console-remote-client (installed from npm)
 * -----------------------------------------------------------
 */

import { ConsoleRemoteClient } from 'console-remote-client';

/**
 * Initialize Console.Re log streaming with the given channel name.
 * @param {string} token - Your Console.Re channel name.
 */
export function initConsoleRe(token) {
  const client = new ConsoleRemoteClient({
    channel: token
    // You can add options here if needed, e.g.: url, debug, etc.
  });
  client.open();
}
