/*******************************************************
 * shapes.part5.loupe.js
 * Part 5 of N for shapes.js modular build
 * 
 * Feature Area: Loupe (magnifier) logic, loupe UI management, loupe rendering
 * Line Limit: ~350 lines max per part for copy-paste reliability.
 * 
 * Naming/Build Scheme:
 *   - Parts are grouped by feature (not arbitrary line count).
 *   - Features exceeding 350 lines split as partNa, partNb, etc.
 *   - To build: concatenate all part files in order: cat shapes.part*.js > shapes.js
 *   - To update: copy-paste the full part file.
 * 
 * This file is intended to be used as a modular chunk.
 * DO NOT remove or modify this header unless updating the schema.
 *******************************************************/

/*************************************
 * Loupe (Magnifier) Feature
 *************************************/

// Loupe state and settings
let loupeCanvas = null;
let loupeCtx = null;
let loupeVisible = false;
let loupeLastX = 0, loupeLastY = 0;
let loupeRAF = null;

// Loupe DOM creation and setup
function setupLoupe() {
  logEnter("setupLoupe");
  loupeCanvas = document.getElementById("loupeCanvas");
  if (!loupeCanvas) {
    loupeCanvas = document.createElement("canvas");
    loupeCanvas.id = "loupeCanvas";
    loupeCanvas.style.position = "absolute";
    loupeCanvas.style.display = "none";
    loupeCanvas.style.zIndex = 1000;
    document.body.appendChild(loupeCanvas);
  }
  loupeCtx = loupeCanvas.getContext("2d");
  loupeVisible = false;
  logExit("setupLoupe");
}

// Loupe show/hide logic
function showLoupe(x, y) {
  logEnter("showLoupe", { x, y });
  loupeVisible = true;
  loupeLastX = x;
  loupeLastY = y;
  loupeCanvas.style.display = "block";
  updateLoupePosition(x, y);
  if (!loupeRAF) loupeRAF = requestAnimationFrame(drawLoupe);
  logExit("showLoupe");
}
function hideLoupe() {
  loupeVisible = false;
  loupeCanvas.style.display = "none";
  if (loupeRAF) cancelAnimationFrame(loupeRAF);
  loupeRAF = null;
}

// Update loupe position (so it doesn't cover the cursor)
function updateLoupePosition(x, y) {
  const size = getSetting("loupeSize");
  const offsetX = getSetting("loupeOffsetX");
  const offsetY = getSetting("loupeOffsetY");
  loupeCanvas.width = size;
  loupeCanvas.height = size;
  loupeCanvas.style.width = size + "px";
  loupeCanvas.style.height = size + "px";
  loupeCanvas.style.left = (x + 30 + offsetX) + "px";
  loupeCanvas.style.top = (y - size / 2 + offsetY) + "px";
}

// Loupe drawing logic (copies a region of the stage canvas, scales it up)
function drawLoupe() {
  if (!loupeVisible || !stage) return;
  const size = getSetting("loupeSize");
  const zoom = getSetting("loupeZoom");
  const fps = getSetting("loupeFPS");
  const showCrosshair = getSetting("loupeCrosshair");
  loupeCanvas.width = size;
  loupeCanvas.height = size;
  const stageCanvas = stage.content.getElementsByTagName('canvas')[0];
  const scale = zoom;
  const sx = Math.max(0, loupeLastX - size / (2 * scale));
  const sy = Math.max(0, loupeLastY - size / (2 * scale));
  const sw = size / scale;
  const sh = size / scale;

  loupeCtx.clearRect(0, 0, size, size);
  loupeCtx.save();
  loupeCtx.beginPath();
  loupeCtx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
  loupeCtx.closePath();
  loupeCtx.clip();

  // Draw zoomed region from stage canvas into loupe
  loupeCtx.drawImage(stageCanvas, sx, sy, sw, sh, 0, 0, size, size);

  if (showCrosshair) {
    loupeCtx.strokeStyle = "#2176ff";
    loupeCtx.lineWidth = 1.2;
    loupeCtx.beginPath();
    loupeCtx.moveTo(size / 2, 0);
    loupeCtx.lineTo(size / 2, size);
    loupeCtx.moveTo(0, size / 2);
    loupeCtx.lineTo(size, size / 2);
    loupeCtx.stroke();
  }
  loupeCtx.restore();

  if (loupeVisible) {
    loupeRAF = setTimeout(() => requestAnimationFrame(drawLoupe), 1000 / fps);
  }
}

// Loupe event handlers
function handleLoupeMouseMove(e) {
  if (!getSetting("loupeEnabled")) return;
  const rect = stage.content.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  showLoupe(x, y);
}
function handleLoupeMouseOut() {
  hideLoupe();
}

// Loupe panel setup (to be called after stage exists)
function setupLoupeEvents() {
  if (!stage) return;
  stage.content.addEventListener("mousemove", handleLoupeMouseMove);
  stage.content.addEventListener("mouseout", handleLoupeMouseOut);
}

// Initialize on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  setupLoupe();
  if (typeof stage !== "undefined") setupLoupeEvents();
});

