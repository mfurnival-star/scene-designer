/**
 * canvas-constraints.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric Canvas Constraints and Move Guards (ESM ONLY)
 * Purpose:
 * - Enforce movement clamping to the background image bounds for any moving target
 *   (single object or ActiveSelection).
 * - Prevent multi-select (ActiveSelection) drag when any selected object is locked.
 * - Keep logic centralized and stateless beyond minimal per-target previous position.
 *
 * Public Exports:
 * - installCanvasConstraints(canvas) -> detachFn
 *
 * Behavior:
 * - On 'object:moving':
 *   - If target is an ActiveSelection and any member is locked -> revert to previous position (block move).
 *   - Otherwise, clamp the target's bounding rect within bg image bounds.
 *   - Stores target._prevLeft/_prevTop each tick for revert logic.
 *
 * Dependencies:
 * - state.js (getState)
 * - log.js (log)
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';

/**
 * True if the Fabric object is an ActiveSelection (multi-select drag hull).
 */
function isActiveSelection(obj) {
  return !!obj && obj.type === 'activeSelection';
}

/**
 * Returns true if any object inside the ActiveSelection is locked.
 */
function anyLockedInSelection(activeSel) {
  if (!activeSel || !Array.isArray(activeSel._objects)) return false;
  return activeSel._objects.some(o => o && o.locked);
}

/**
 * Clamp a target's bounding rect to the background image bounds.
 */
function clampTargetWithinImage(target, img) {
  if (!target || !img) return false;

  try {
    const rect = target.getBoundingRect(true, true);
    let dx = 0;
    let dy = 0;

    if (rect.left < 0) dx = -rect.left;
    if (rect.top < 0) dy = -rect.top;
    if (rect.left + rect.width > img.width) dx = img.width - (rect.left + rect.width);
    if (rect.top + rect.height > img.height) dy = img.height - (rect.top + rect.height);

    if (dx !== 0 || dy !== 0) {
      target.set({
        left: (target.left ?? 0) + dx,
        top: (target.top ?? 0) + dy
      });
      if (typeof target.setCoords === 'function') target.setCoords();
      return true; // clamped
    }
  } catch (e) {
    log("WARN", "[canvas-constraints] clampTargetWithinImage: getBoundingRect failed", e);
  }
  return false;
}

/**
 * Install movement constraints and guards on the Fabric canvas.
 * Returns a detach function to remove handlers.
 */
export function installCanvasConstraints(canvas) {
  if (!canvas) {
    log("ERROR", "[canvas-constraints] installCanvasConstraints: canvas is null/undefined");
    return () => {};
  }

  // Detach prior handlers (in case of hot reload or panel rebuild)
  canvas.off('object:moving');

  const onObjectMoving = (opt) => {
    try {
      const target = opt?.target;
      if (!target) return;

      const img = getState().bgFabricImage;
      if (!img) {
        // No background image → allow movement (no clamping)
        return;
      }

      // Guard multi-drag if any selected member is locked
      if (isActiveSelection(target)) {
        if (anyLockedInSelection(target)) {
          // Revert to last valid position
          if (typeof target.set === "function") {
            const prevL = target._prevLeft ?? target.left;
            const prevT = target._prevTop ?? target.top;
            target.set({ left: prevL, top: prevT });
            if (typeof target.setCoords === 'function') target.setCoords();
          }
          if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
          else canvas.renderAll();
          log("INFO", "[canvas-constraints] Blocked ActiveSelection move (locked member present)");
          return;
        }
      }

      // Clamp within background image bounds for both ActiveSelection and single objects
      const didClamp = clampTargetWithinImage(target, img);

      // Persist previous position for revert logic
      target._prevLeft = target.left;
      target._prevTop = target.top;

      if (didClamp) {
        if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
        else canvas.renderAll();
        log("DEBUG", "[canvas-constraints] Movement clamped within image bounds", {
          left: target.left, top: target.top
        });
      }
    } catch (e) {
      log("ERROR", "[canvas-constraints] onObjectMoving error", e);
    }
  };

  canvas.on('object:moving', onObjectMoving);

  log("INFO", "[canvas-constraints] Installed object:moving handler (clamp + lock guard)");

  return function detach() {
    try {
      canvas.off('object:moving', onObjectMoving);
      log("INFO", "[canvas-constraints] Detached constraints handlers");
    } catch (e) {
      log("ERROR", "[canvas-constraints] Detach error", e);
    }
  };
}
