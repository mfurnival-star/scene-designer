import { log } from './log.js';

let interceptionEnabled = false;
let origConsole = null;

export function enableConsoleInterception({ preserveOriginal = true } = {}) {
  if (interceptionEnabled) return;
  interceptionEnabled = true;
  origConsole = origConsole || { ...console };

  const levels = ["log", "info", "warn", "error", "debug"];
  const levelMap = {
    log: "INFO",
    info: "INFO",
    warn: "WARN",
    error: "ERROR",
    debug: "DEBUG"
  };

  levels.forEach(method => {
    console[method] = function (...args) {
      if (!args.length || args.every(arg =>
        arg === undefined || arg === null || arg === "" ||
        (typeof arg === "object" && Object.keys(arg).length === 0 && !(arg instanceof Error))
      )) {
        if (preserveOriginal && origConsole && origConsole[method]) {
          origConsole[method].apply(console, args);
        }
        return;
      }
      try {
        log(levelMap[method], ...args);
        if (typeof console !== "undefined" && console.re) {
          try {
            if (method === "error" && typeof console.re.error === "function") {
              console.re.error(...args);
            } else if (method === "warn" && typeof console.re.warn === "function") {
              console.re.warn(...args);
            } else if (method === "info" && typeof console.re.info === "function") {
              console.re.info(...args);
            } else if (method === "debug" && typeof console.re.debug === "function") {
              console.re.debug(...args);
            } else if (typeof console.re.log === "function") {
              console.re.log(...args);
            }
          } catch {}
        }
      } catch (e) {
        if (preserveOriginal && origConsole && origConsole[method]) {
          origConsole[method].apply(console, args);
        }
      }
      if (preserveOriginal && origConsole && origConsole[method]) {
        origConsole[method].apply(console, args);
      }
    };
  });
}

export function disableConsoleInterception() {
  if (!interceptionEnabled || !origConsole) return;
  ["log", "info", "warn", "error", "debug"].forEach(method => {
    if (origConsole[method]) console[method] = origConsole[method];
  });
  interceptionEnabled = false;
}

export function isConsoleInterceptionEnabled() {
  return interceptionEnabled;
}
