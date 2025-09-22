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
 * - On 'selection:created' / 'selection:updated':
 *   - If the active object is an ActiveSelection and any member is locked, set
 *     lockMovementX/Y=true on the group and use 'not-allowed' cursor.
 *   - Record the group's origin so we can snap back if a move sneaks through.
 * - On 'object:moving':
 *   - If target is an ActiveSelection and any member is locked -> reset position to origin
 *     and render (secondary guard).
 *   - Otherwise, clamp the moving target’s bounding rect to the background image bounds.
 *   - Tracks target._prevLeft/_prevTop and _moveStartLeft/_moveStartTop for stability.
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
 * Cache the current position of the active object as a "move start" origin.
 */
function recordMoveStartPosition(target) {
  if (!target) return;
  // Only record once per drag gesture; if missing, set now
  if (target._moveStartLeft === undefined || target._moveStartTop === undefined) {
    target._moveStartLeft = target.left ?? 0;
    target._moveStartTop = target.top ?? 0;
  }
  // Always keep a rolling previous for incremental deltas if needed
  target._prevLeft = target.left ?? 0;
  target._prevTop = target.top ?? 0;
}

/**
 * Reset group move lock state and cursor according to lock membership.
 */
function applyGroupMoveLockState(activeSel) {
  if (!isActiveSelection(activeSel)) return;
  const locked = anyLockedInSelection(activeSel);
  activeSel.lockMovementX = locked;
  activeSel.lockMovementY = locked;
  activeSel.hoverCursor = locked ? 'not-allowed' : 'move';
  // Record origin whenever we set the state so we can snap back if needed
  try {
    // Use absolute bbox to derive a stable origin, but 'left/top' is fine for snapping
    recordMoveStartPosition(activeSel);
  } catch {}
  log("DEBUG", "[canvas-constraints] Group move lock state", {
    locked, left: activeSel.left, top: activeSel.top
  });
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
  canvas.off('selection:created');
  canvas.off('selection:updated');
  canvas.off('selection:cleared');
  canvas.off('mouse:down');

  const onSelectionCreatedOrUpdated = () => {
    try {
      const active = typeof canvas.getActiveObject === "function" ? canvas.getActiveObject() : null;
      if (!isActiveSelection(active)) return;

      // Ensure coords are up-to-date and then apply lock state
      if (typeof active.setCoords === "function") {
        try { active.setCoords(); } catch {}
      }
      applyGroupMoveLockState(active);
      if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
      else canvas.renderAll();
    } catch (e) {
      log("ERROR", "[canvas-constraints] selection created/updated handler error", e);
    }
  };

  const onSelectionCleared = () => {
    try {
      const active = typeof canvas.getActiveObject === "function" ? canvas.getActiveObject() : null;
      if (active) {
        // Clear any cached move-start state
        active._moveStartLeft = undefined;
        active._moveStartTop = undefined;
        active._prevLeft = undefined;
        active._prevTop = undefined;
      }
    } catch {}
  };

  const onMouseDown = () => {
    try {
      const active = typeof canvas.getActiveObject === "function" ? canvas.getActiveObject() : null;
      if (!active) return;
      // Record origin at the start of a drag gesture
      recordMoveStartPosition(active);
    } catch {}
  };

  const onObjectMoving = (opt) => {
    try {
      const target = opt?.target;
      if (!target) return;

      const img = getState().bgFabricImage;
      // If no background image → allow movement (no clamping)
      // We still enforce group lock below even without an image.
      const isGroup = isActiveSelection(target);
      const anyLocked = isGroup && anyLockedInSelection(target);

      // Secondary guard: if any selected is locked, block movement immediately.
      if (isGroup && anyLocked) {
        // Snap back to the recorded origin (if available), else keep current but do not progress
        const backLeft = (target._moveStartLeft !== undefined) ? target._moveStartLeft : (target._prevLeft ?? target.left);
        const backTop = (target._moveStartTop !== undefined) ? target._moveStartTop : (target._prevTop ?? target.top);

        if (typeof target.set === "function") {
          target.set({ left: backLeft, top: backTop });
          if (typeof target.setCoords === 'function') target.setCoords();
        }

        // Re-assert lock on the group so Fabric stops processing further drags
        target.lockMovementX = true;
        target.lockMovementY = true;
        target.hoverCursor = 'not-allowed';

        if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
        else canvas.renderAll();

        log("INFO", "[canvas-constraints] Blocked ActiveSelection move (locked member present)");
        return;
      }

      // Normal path: clamp within background image bounds
      if (img) {
        const didClamp = clampTargetWithinImage(target, img);
        if (didClamp) {
          if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
          else canvas.renderAll();
          log("DEBUG", "[canvas-constraints] Movement clamped within image bounds", {
            left: target.left, top: target.top
          });
        }
      }

      // Persist previous position for revert logic
      target._prevLeft = target.left;
      target._prevTop = target.top;
      // Only set moveStart if not set yet (start of gesture)
      if (target._moveStartLeft === undefined || target._moveStartTop === undefined) {
        recordMoveStartPosition(target);
      }
    } catch (e) {
      log("ERROR", "[canvas-constraints] onObjectMoving error", e);
    }
  };

  canvas.on('selection:created', onSelectionCreatedOrUpdated);
  canvas.on('selection:updated', onSelectionCreatedOrUpdated);
  canvas.on('selection:cleared', onSelectionCleared);
  canvas.on('mouse:down', onMouseDown);
  canvas.on('object:moving', onObjectMoving);

  log("INFO", "[canvas-constraints] Installed constraints (selection guards + object:moving clamp/lock)");

  return function detach() {
    try {
      canvas.off('selection:created', onSelectionCreatedOrUpdated);
      canvas.off('selection:updated', onSelectionCreatedOrUpdated);
      canvas.off('selection:cleared', onSelectionCleared);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('object:moving', onObjectMoving);
      log("INFO", "[canvas-constraints] Detached constraints handlers");
    } catch (e) {
      log("ERROR", "[canvas-constraints] Detach error", e);
    }
  };
}

