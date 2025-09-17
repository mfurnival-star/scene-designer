/**
 * errorlog.js
 * -----------------------------------------------------------
 * Error Log Panel (MiniLayout) for Scene Designer
 * - Displays all log messages routed via log.js at all levels.
 * - ES module only, no window/global code.
 * - Supports click/tap-to-copy: clicking anywhere in the panel copies all visible log text to clipboard.
 * - Works on iPhone/iOS, Android, desktop browsers (Clipboard API and fallback).
 * - Logs copy events at INFO, errors at ERROR.
 * - Exports: buildErrorLogPanel, registerErrorLogSink.
 * -----------------------------------------------------------
 */

import { log, LOG_LEVELS, safeStringify, registerLogSink } from "./log.js";

/**
 * Build the Error Log Panel
 * MiniLayout-compliant: accepts { element, title, componentName }
 */
export function buildErrorLogPanel({ element, title, componentName }) {
  log("TRACE", "[errorlog] buildErrorLogPanel entry", {
    elementType: element?.tagName,
    title,
    componentName
  });

  // Main panel container HTML
  element.innerHTML = `
    <div id="error-log-panel-container" style="width:100%;height:100%;background:#222;color:#fff;font-family:monospace;font-size:0.98em;overflow:auto;position:relative;">
      <div id="error-log-content" style="width:100%;height:100%;overflow:auto;padding:8px 8px 32px 8px;user-select:text;-webkit-user-select:text;cursor:pointer;">
        <div style="color:#aaa;font-size:1em;padding-bottom:4px;">Error log – click or tap to copy all logs</div>
        <div id="error-log-lines"></div>
        <div id="error-log-copied-msg" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:4px 12px;border-radius:8px;opacity:0;transition:opacity 0.18s;font-size:1em;pointer-events:none;z-index:99;"></div>
      </div>
    </div>
  `;
  const contentDiv = element.querySelector("#error-log-content");
  const linesDiv = element.querySelector("#error-log-lines");
  const copiedMsgDiv = element.querySelector("#error-log-copied-msg");

  // --- Click/tap-to-copy logic, cross-platform (iPhone/Android/desktop) ---
  function copyErrorLogToClipboard() {
    if (!linesDiv) return;
    let text = "";
    // Collect all visible log lines (strip HTML tags)
    linesDiv.querySelectorAll(".error-log-line").forEach(line => {
      text += line.textContent + "\n";
    });
    if (!text.trim()) return;

    // Clipboard API (navigator.clipboard) if available
    function showCopiedMsg(msg) {
      if (!copiedMsgDiv) return;
      copiedMsgDiv.textContent = msg;
      copiedMsgDiv.style.opacity = "1";
      setTimeout(() => { copiedMsgDiv.style.opacity = "0"; }, 1200);
    }

    // Modern clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(() => {
        log("INFO", "[errorlog] Log panel copied to clipboard (Clipboard API)");
        showCopiedMsg("Copied to clipboard!");
      }).catch(err => {
        log("ERROR", "[errorlog] Clipboard API copy failed", err);
        showCopiedMsg("Copy failed.");
      });
    } else {
      // Fallback for iOS/Safari: temporary textarea, select, copy
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);

        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        let success = false;
        try {
          success = document.execCommand("copy");
        } catch (err) {
          log("ERROR", "[errorlog] execCommand copy exception", err);
        }
        document.body.removeChild(textarea);
        if (success) {
          log("INFO", "[errorlog] Log panel copied to clipboard (textarea fallback)");
          showCopiedMsg("Copied to clipboard!");
        } else {
          log("ERROR", "[errorlog] Log panel copy failed (textarea fallback)");
          showCopiedMsg("Copy failed.");
        }
      } catch (err) {
        log("ERROR", "[errorlog] Log panel copy failed (textarea fallback exception)", err);
        showCopiedMsg("Copy failed.");
      }
    }
  }

  // Attach click/touch event (user gesture required for clipboard)
  if (contentDiv) {
    contentDiv.addEventListener("click", copyErrorLogToClipboard);
    contentDiv.addEventListener("touchend", function (e) {
      // Prevent both click and touchend from firing on iOS
      e.preventDefault();
      copyErrorLogToClipboard();
    });
  }

  // --- Panel log sink: render lines ---
  let maxLines = 120;
  let logLines = [];

  function renderLines() {
    if (!linesDiv) return;
    linesDiv.innerHTML = "";
    logLines.slice(-maxLines).forEach(({ level, text }) => {
      const div = document.createElement("div");
      div.className = "error-log-line";
      div.textContent = text;
      if (level === LOG_LEVELS.ERROR) div.style.color = "#ff6c6c";
      else if (level === LOG_LEVELS.WARN) div.style.color = "#ffd273";
      else if (level === LOG_LEVELS.INFO) div.style.color = "#5bd6ff";
      else if (level === LOG_LEVELS.DEBUG) div.style.color = "#b9ffb6";
      else if (level === LOG_LEVELS.TRACE) div.style.color = "#aaa";
      else div.style.color = "#fff";
      linesDiv.appendChild(div);
    });
    // Scroll to bottom after new log
    linesDiv.scrollTop = linesDiv.scrollHeight;
  }

  // Log sink function for log.js
  function errorLogSink(levelNum, ...args) {
    // Format timestamp and log level
    const ts = (new Date()).toLocaleTimeString();
    const levelName = ["SILENT", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"][levelNum] || "INFO";
    const msg = args.map(a => safeStringify(a)).join(" ");
    logLines.push({ level: levelNum, text: `[${ts}] [${levelName}] ${msg}` });
    if (logLines.length > maxLines) logLines = logLines.slice(-maxLines);
    renderLines();
  }

  // Register as a log sink with log.js
  registerLogSink(errorLogSink);

  log("INFO", "[errorlog] Error Log panel initialized (click/tap to copy enabled)");

  log("TRACE", "[errorlog] buildErrorLogPanel exit", {
    elementType: element?.tagName,
    title,
    componentName
  });
}

/**
 * Register the Error Log Panel as a log sink.
 * (Called by layout.js after panel creation. Can be called multiple times safely.)
 */
export function registerErrorLogSink() {
  log("TRACE", "[errorlog] registerErrorLogSink entry");
  // No-op: errorLogSink already registered in buildErrorLogPanel
  log("TRACE", "[errorlog] registerErrorLogSink exit");
}
