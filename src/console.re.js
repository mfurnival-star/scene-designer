import { init as consoleReInit, default as consoleReGlobal } from './console-re-wrapper.js';
import { log } from './log.js';

export function initConsoleRe(channel = "default") {
  if (typeof consoleReInit === "function") {
    try {
      consoleReInit({
        channel,
        redirectDefaultConsoleToRemote: true,
        disableDefaultConsoleOutput: false
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
