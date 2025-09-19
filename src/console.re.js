/**
 * console.re.js
 * -----------------------------------------------------------
 * Scene Designer – Console.Re Remote Logging Integration (ESM, Robust Compatibility Edition)
 * - Initializes Console.Re remote logging with all recommended connector options.
 * - Handles import style for console-remote-client@2.x (default/class export vs named).
 * - Redirects default console methods (log, warn, error, debug) to remote if possible.
 * - Always logs diagnostics about connector initialization and type.
 * - Streams all logs to the remote console dashboard for the given channel if possible.
 * - No global or window usage. ES module only.
 * - Usage: import and call initConsoleRe('scene-designer') in your entry point.
 * - Exports: initConsoleRe(channel)
 * - Dependencies: console-remote-client (npm, ESM)
 * -----------------------------------------------------------
 */

let consoleReInitFn = null;
let consoleReType = null;

try {
  // Try named import (may fail in some builds)
  // eslint-disable-next-line import/no-unresolved
  // @ts-ignore
  // Remove type error for dynamic import
  // Dynamic import for robust detection
  import('console-remote-client').then(mod => {
    if (typeof mod.init === "function") {
      consoleReInitFn = mod.init;
      consoleReType = "named";
    } else if (typeof mod.default === "function") {
      consoleReInitFn = mod.default;
      consoleReType = "default-class";
    } else if (mod.default && typeof mod.default.init === "function") {
      consoleReInitFn = mod.default.init;
      consoleReType = "default-init";
    } else {
      consoleReType = "unknown";
    }
  }).catch(e => {
    consoleReType = "error";
    import('./log.js').then(({ log }) => {
      log("ERROR", "[console.re] Failed dynamic import of console-remote-client", e);
    }).catch(()=>{});
  });
} catch (e) {
  consoleReType = "exception";
}

function _initConsoleReNative(channel = "default") {
  import('./log.js').then(({ log }) => {
    log("TRACE", "[console.re] _initConsoleReNative called", { channel, consoleReType, consoleReInitFn });
  }).catch(()=>{});

  if (consoleReInitFn && typeof consoleReInitFn === "function") {
    try {
      consoleReInitFn({
        channel,
        redirectDefaultConsoleToRemote: true,
        disableDefaultConsoleOutput: false,
        // server: 'http://console.re'
      });
      import('./log.js').then(({ log }) => {
        log("INFO", "[console.re] Console.Re remote logging initialized via " + consoleReType, { channel });
      }).catch(()=>{});
    } catch (e) {
      import('./log.js').then(({ log }) => {
        log("ERROR", "[console.re] initConsoleRe failed", e);
      }).catch(()=>{});
    }
  } else {
    import('./log.js').then(({ log }) => {
      log("ERROR", "[console.re] Could not initialize Console.Re: init function not found", { consoleReType, consoleReInitFn });
    }).catch(()=>{});
  }
}

/**
 * Initialize Console.Re log streaming with given channel.
 * All console methods are redirected to remote when possible.
 * @param {string} channel - Your Console.Re channel name.
 */
export function initConsoleRe(channel = "default") {
  import('./log.js').then(({ log }) => {
    log("TRACE", "[console.re] initConsoleRe ENTRY", { channel, consoleReType, consoleReInitFn });
  }).catch(()=>{});
  // Wait for dynamic import to resolve, then call the native initializer
  let tries = 0;
  function tryInit() {
    tries++;
    if (consoleReInitFn && typeof consoleReInitFn === "function") {
      _initConsoleReNative(channel);
    } else if (tries < 20) {
      setTimeout(tryInit, 150);
    } else {
      import('./log.js').then(({ log }) => {
        log("ERROR", "[console.re] initConsoleRe: Unable to initialize Console.Re connector after retries", { channel, consoleReType, consoleReInitFn });
      }).catch(()=>{});
    }
  }
  tryInit();
}
