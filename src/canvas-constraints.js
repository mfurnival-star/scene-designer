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
 * Phase 1 Completion (2025-09-24):
 * - Single-shape geometry no longer uses target.getBoundingRect().
 *   Instead we consume geometry/shape-rect.getShapeBoundingBox() for width/height.
 * - ActiveSelection (multi-object) still uses Fabric getBoundingRect(true,true) as an
 *   interim step; multi-object hull geometry will be unified in a later phase.
 * - Added explicit branch comments for future migration points.
 *
 * IMPORTANT (2025-09-24 PATCH from earlier commit):
 * - Removed blanket canvas.off('selection:*') calls (non‑destructive install).
 * - Tracks ONLY its own handlers so other modules’ handlers are preserved.
 *
 * Dependencies:
 * - state.js (getState)
 * - log.js (log)
 * - geometry/shape-rect.js (getShapeBoundingBox)  ← Phase 1 unified single-shape geometry
 * -----------------------------------------------------------
 */

import { getState } from './state.js';
import { log } from './log.js';
import { getShapeBoundingBox } from './geometry/shape-rect.js';

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
 * Clamp a target within the background image.
 * - Single Shape: uses unified geometry helper (getShapeBoundingBox) (Phase 1 requirement).
 * - ActiveSelection: still uses Fabric getBoundingRect(true,true) for aggregated hull (temporary).
 *
 * Returns true if clamped (position adjusted), false if no change.
 */
function clampTargetWithinImage(target, img) {
  if (!target || !img) return false;

  // MULTI: ActiveSelection (temporary path until multi-geometry unified)
  if (isActiveSelection(target)) {
    try {
      const rect = target.getBoundingRect(true, true); // OK for group hull (temporary)
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
        return true;
      }
      return false;
    } catch (e) {
      log("WARN", "[canvas-constraints] clampTargetWithinImage (ActiveSelection hull) failed", e);
      return false;
    }
  }

  // SINGLE: unified geometry
  try {
    const bbox = getShapeBoundingBox(target);
    if (!bbox) return false;

    let dx = 0;
    let dy = 0;

    if (bbox.left < 0) dx = -bbox.left;
    if (bbox.top < 0) dy = -bbox.top;
    if (bbox.left + bbox.width > img.width) dx = img.width - (bbox.left + bbox.width);
    if (bbox.top + bbox.height > img.height) dy = img.height - (bbox.top + bbox.height);

    if (dx !== 0 || dy !== 0) {
      target.set({
        left: (target.left ?? bbox.left) + dx,
        top: (target.top ?? bbox.top) + dy
      });
      if (typeof target.setCoords === 'function') target.setCoords();
      log("DEBUG", "[canvas-constraints] Single-shape clamp applied", {
        id: target._id,
        type: target._type,
        dx,
        dy,
        bboxSource: bbox.source
      });
      return true;
    }
  } catch (e) {
    log("WARN", "[canvas-constraints] clampTargetWithinImage (single) failed", e);
  }
  return false;
}

/**
 * Cache the current position of the active object as a "move start" origin.
 */
function recordMoveStartPosition(target) {
  if (!target) return;
  if (target._moveStartLeft === undefined || target._moveStartTop === undefined) {
    target._moveStartLeft = target.left ?? 0;
    target._moveStartTop = target.top ?? 0;
  }
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
  try {
    recordMoveStartPosition(activeSel);
  } catch {}
  log("DEBUG", "[canvas-constraints] Group move lock state", {
    locked, left: activeSel.left, top: activeSel.top
  });
}

// Symbol / key to store prior handlers on the canvas safely
const HANDLERS_KEY = '__sceneDesignerCanvasConstraintsHandlers__';

/**
 * Install movement constraints and guards on the Fabric canvas.
 * Returns a detach function to remove handlers.
 *
 * Idempotent: On re-install, existing handlers installed by THIS module
 * are removed first (other modules' handlers are preserved).
 */
export function installCanvasConstraints(canvas) {
  if (!canvas) {
    log("ERROR", "[canvas-constraints] installCanvasConstraints: canvas is null/undefined");
    return () => {};
  }

  // Detach our prior handlers only (non-destructive)
  try {
    if (canvas[HANDLERS_KEY] && Array.isArray(canvas[HANDLERS_KEY])) {
      canvas[HANDLERS_KEY].forEach(({ event, fn }) => {
        try { canvas.off(event, fn); } catch {}
      });
      canvas[HANDLERS_KEY] = [];
    }
  } catch (e) {
    log("WARN", "[canvas-constraints] Failed detaching prior handlers (safe to ignore)", e);
  }

  const localHandlers = [];
  function on(event, fn) {
    canvas.on(event, fn);
    localHandlers.push({ event, fn });
  }

  const onSelectionCreatedOrUpdated = () => {
    try {
      const active = typeof canvas.getActiveObject === "function" ? canvas.getActiveObject() : null;
      if (!isActiveSelection(active)) return;
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
      recordMoveStartPosition(active);
    } catch {}
  };

  const onObjectMoving = (opt) => {
    try {
      const target = opt?.target;
      if (!target) return;

      const img = getState().bgFabricImage;
      const isGroup = isActiveSelection(target);
      const anyLocked = isGroup && anyLockedInSelection(target);

      // Block ActiveSelection drag if any locked member present
      if (isGroup && anyLocked) {
        const backLeft = (target._moveStartLeft !== undefined) ? target._moveStartLeft : (target._prevLeft ?? target.left);
        const backTop = (target._moveStartTop !== undefined) ? target._moveStartTop : (target._prevTop ?? target.top);

        if (typeof target.set === "function") {
          target.set({ left: backLeft, top: backTop });
          if (typeof target.setCoords === 'function') target.setCoords();
        }

        target.lockMovementX = true;
        target.lockMovementY = true;
        target.hoverCursor = 'not-allowed';

        if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
        else canvas.renderAll();

        log("INFO", "[canvas-constraints] Blocked ActiveSelection move (locked member present)");
        return;
      }

      // Clamp if background image present
      if (img) {
        const didClamp = clampTargetWithinImage(target, img);
        if (didClamp) {
          if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
          else canvas.renderAll();
          log("DEBUG", "[canvas-constraints] Movement clamped within image bounds", {
            left: target.left, top: target.top, id: target._id, type: target._type
          });
        }
      }

      target._prevLeft = target.left;
      target._prevTop = target.top;
      if (target._moveStartLeft === undefined || target._moveStartTop === undefined) {
        recordMoveStartPosition(target);
      }
    } catch (e) {
      log("ERROR", "[canvas-constraints] onObjectMoving error", e);
    }
  };

  // Attach handlers
  on('selection:created', onSelectionCreatedOrUpdated);
  on('selection:updated', onSelectionCreatedOrUpdated);
  on('selection:cleared', onSelectionCleared);
  on('mouse:down', onMouseDown);
  on('object:moving', onObjectMoving);

  canvas[HANDLERS_KEY] = localHandlers;

  log("INFO", "[canvas-constraints] Installed constraints (single-shape bbox unified, ActiveSelection hull temporary)");

  return function detach() {
    try {
      if (canvas[HANDLERS_KEY]) {
        canvas[HANDLERS_KEY].forEach(({ event, fn }) => {
          try { canvas.off(event, fn); } catch {}
        });
        canvas[HANDLERS_KEY] = [];
      }
      log("INFO", "[canvas-constraints] Detached constraints handlers");
    } catch (e) {
      log("ERROR", "[canvas-constraints] Detach error", e);
    }
  };
}
