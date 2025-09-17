```filelist
log.js
console-stream.js
global-errors.js
state.js
canvas.js
selection.js
sidebar.js
settings.js
layout.js
errorlog.js
main.js
toolbar.js
shapes.js
transformer.js
shape-state.js
shape-defs.js
minilayout.js
```

---

- **log.js**  
  Centralized, pluggable logging system for Scene Designer.  
  All logs use `log()`; supports runtime config, pluggable sinks, and safe serialization.

- **console-stream.js**  
  Console method interception for streaming all console logs (log/error/warn/info/debug/trace) via logger.

- **global-errors.js**  
  Global error and unhandled promise rejection handler; forwards all browser-level errors to logger.

- **state.js**  
  Centralized AppState singleton and state management.

- **canvas.js**  
  Canvas and shape creation APIs (now Fabric.js-based after migration).

- **selection.js**  
  Shape selection logic and mutators (Fabric.js adaptation).

- **sidebar.js**  
  Shape table/list panel (Golden Layout, Tabulator implementation as of latest revision).

- **settings.js**  
  Settings registry, persistence (via localForage), and UI panel (GL, Tweakpane+Pickr).

- **layout.js**  
  Golden Layout bootstrapping and panel registration.

- **errorlog.js**  
  Error log panel (Golden Layout), log sink for all error/info/debug messages.

- **main.js**  
  App entry point (if NOT using Golden Layout).

- **toolbar.js**  
  Modular toolbar UI element factory (button, dropdown, color swatch, text input), ESM only.

- **shapes.js**  
  Shape factory module:  
  - Exports `makePointShape(x, y)`, `makeRectShape(x, y, w, h)`, `makeCircleShape(x, y, r)` (future).  
  - Centralizes all Fabric.js shape construction, selection logic, and property/event attachment.  
  - Used by toolbar, canvas, sidebar, and all shape-creation features.

- **transformer.js**  
  Shape transformer/resize logic for Fabric.js shapes:
  - Centralized attach/detach/configure of object controls for all shape types.
  - Rectangle: resize/rotate as allowed, aspect ratio enforced for circle.
  - Point: no controls/transform (not resizable).
  - Invoked by canvas.js and consumes AppState, selection.
  - All logging via log.js.

- **shape-state.js**  
  Per-shape state machine module:
  - Exports: `initShapeState`, `setShapeState`, `selectShape`, `deselectShape`, `startDraggingShape`, `stopDraggingShape`, `lockShape`, `unlockShape`, `setMultiSelected`, `isShapeInState`.
  - Used by shapes.js, canvas.js, selection.js, transformer.js for all robust state transitions.

- **shape-defs.js**  
  Centralized per-shape definition/config for Scene Designer.
  - All shape types and their edit/transform properties in one place.
  - Used by transformer.js, shapes.js, canvas.js, etc.
  - Easy to extend for new shape types or features.

- **minilayout.js**  
  Minimal layout engine: Golden Layout v3–compatible API (row/column/panel config, registerComponent, init, destroy).  
  - Use as a drop-in replacement for Golden Layout during migration or until GL v3 is adopted.

---
**Instructions:**  
Keep this file updated per SCENE_DESIGNER_MANIFESTO.md.

