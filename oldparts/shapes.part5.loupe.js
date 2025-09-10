/**
 * shapes.part5.loupe.js
 * Loupe/magnifier feature for scene-designer
 * - Displays a magnifier lens over the canvas
 * - Handles zoom logic and drawing
 */

let loupeEnabled = false;
let loupeZoom = 3;
let loupeCanvas = null;
let loupeCtx = null;

function setupLoupe(containerId = "container") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Remove any old loupe
  const existing = document.getElementById("loupeCanvas");
  if (existing) existing.remove();

  loupeCanvas = document.createElement("canvas");
  loupeCanvas.id = "loupeCanvas";
  loupeCanvas.width = 160;
  loupeCanvas.height = 160;
  loupeCanvas.style.position = "absolute";
  loupeCanvas.style.pointerEvents = "none";
  loupeCanvas.style.border = "2px solid #2176ff";
  loupeCanvas.style.borderRadius = "50%";
  loupeCanvas.style.display = "none";
  loupeCanvas.style.zIndex = 10;

  container.appendChild(loupeCanvas);
  loupeCtx = loupeCanvas.getContext("2d");

  // Mouse events for loupe
  container.addEventListener("mousemove", loupeMouseMove);
  container.addEventListener("mouseleave", loupeMouseLeave);
}

function loupeMouseMove(e) {
  if (!loupeEnabled || !loupeCanvas || !window.stage) return;
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Position loupe near the cursor
  loupeCanvas.style.left = `${mx + 18}px`;
  loupeCanvas.style.top = `${my + 18}px`;
  loupeCanvas.style.display = "block";

  // Draw magnified area from Konva stage
  const stage = window.stage;
  const pixelRatio = window.devicePixelRatio || 1;
  const size = 160;
  const zoom = loupeZoom;
  loupeCtx.clearRect(0, 0, size, size);

  // Render stage to temp canvas, draw portion into loupe
  const dataURL = stage.toDataURL({
    x: mx - size / (2 * zoom),
    y: my - size / (2 * zoom),
    width: size / zoom,
    height: size / zoom,
    pixelRatio: zoom * pixelRatio
  });

  const img = new window.Image();
  img.onload = function () {
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    loupeCtx.closePath();
    loupeCtx.clip();
    loupeCtx.drawImage(img, 0, 0, size, size);
    loupeCtx.restore();
  };
  img.src = dataURL;
}

function loupeMouseLeave() {
  if (loupeCanvas) loupeCanvas.style.display = "none";
}

function loupeZoomHandler(zoomIn) {
  loupeZoom = Math.max(1, Math.min(8, loupeZoom + (zoomIn ? 1 : -1)));
}

if (typeof window !== "undefined") {
  window.setupLoupe = setupLoupe;
  window.loupeZoomHandler = loupeZoomHandler;
  window.loupeEnabled = loupeEnabled;
}
