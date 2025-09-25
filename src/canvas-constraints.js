import { getState } from './state.js';
import { log } from './log.js';
import { getShapeBoundingBox } from './geometry/shape-rect.js';

function isActiveSelection(obj) {
  return !!obj && obj.type === 'activeSelection';
}

function anyLockedInSelection(activeSel) {
  if (!activeSel || !Array.isArray(activeSel._objects)) return false;
  return activeSel._objects.some(o => o && o.locked);
}

function clampTargetWithinImage(target, img) {
  if (!target || !img) return false;

  if (isActiveSelection(target)) {
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
        return true;
      }
      return false;
    } catch (e) {
      log("WARN", "[canvas-constraints] clampTargetWithinImage (ActiveSelection hull) failed", e);
      return false;
    }
  }

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
      return true;
    }
  } catch (e) {
    log("WARN", "[canvas-constraints] clampTargetWithinImage (single) failed", e);
  }
  return false;
}

function recordMoveStartPosition(target) {
  if (!target) return;
  if (target._moveStartLeft === undefined || target._moveStartTop === undefined) {
    target._moveStartLeft = target.left ?? 0;
    target._moveStartTop = target.top ?? 0;
  }
  target._prevLeft = target.left ?? 0;
  target._prevTop = target.top ?? 0;
}

function applyGroupMoveLockState(activeSel) {
  if (!isActiveSelection(activeSel)) return;
  const locked = anyLockedInSelection(activeSel);
  activeSel.lockMovementX = locked;
  activeSel.lockMovementY = locked;
  activeSel.hoverCursor = locked ? 'not-allowed' : 'move';
  try {
    recordMoveStartPosition(activeSel);
  } catch {}
}

const HANDLERS_KEY = '__sceneDesignerCanvasConstraintsHandlers__';

export function installCanvasConstraints(canvas) {
  if (!canvas) {
    log("ERROR", "[canvas-constraints] installCanvasConstraints: canvas is null/undefined");
    return () => {};
  }

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

        log("INFO", "[canvas-constraints] Blocked group move (locked member present)");
        return;
      }

      if (img) {
        const didClamp = clampTargetWithinImage(target, img);
        if (didClamp) {
          if (typeof canvas.requestRenderAll === "function") canvas.requestRenderAll();
          else canvas.renderAll();
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

  on('selection:created', onSelectionCreatedOrUpdated);
  on('selection:updated', onSelectionCreatedOrUpdated);
  on('selection:cleared', onSelectionCleared);
  on('mouse:down', onMouseDown);
  on('object:moving', onObjectMoving);

  canvas[HANDLERS_KEY] = localHandlers;

  log("INFO", "[canvas-constraints] Constraints installed");
  return function detach() {
    try {
      if (canvas[HANDLERS_KEY]) {
        canvas[HANDLERS_KEY].forEach(({ event, fn }) => {
          try { canvas.off(event, fn); } catch {}
        });
        canvas[HANDLERS_KEY] = [];
      }
      log("INFO", "[canvas-constraints] Constraints detached");
    } catch (e) {
      log("ERROR", "[canvas-constraints] Detach error", e);
    }
  };
}
