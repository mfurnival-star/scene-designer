import { log } from './log.js';
import './layout.js';
import { init as consoleReInit } from './console-re-wrapper.js';

if (typeof consoleReInit === "function") {
  consoleReInit({
    channel: "scene-designer",
    redirectDefaultConsoleToRemote: true,
    disableDefaultConsoleOutput: false
  });
  log("INFO", "[main.js] Console.Re remote logging initialized via ESM wrapper");
} else {
  log("WARN", "[main.js] Console.Re init not found – remote logging not active");
}
