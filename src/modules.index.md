```filelist
log.js
console-stream.js
global-errors.js
state.js
canvas.js
selection.js
settings.js
errorlog.js
main.js
toolbar.js
actions.js
shapes.js
transformer.js
shape-state.js
shape-defs.js
sidebar.js
minilayout.js
minilayout-ui.js
minilayout.css
minilayout.DOCS.md
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
  Centralized Zustand-style store and state management for all app logic.

- **canvas.js**  
  Canvas and shape creation APIs (Fabric.js-based).

- **selection.js**  
  Shape selection logic and mutators (Fabric.js adaptation).

- **settings.js**  
  Settings registry, persistence (via localForage), and UI panel (Tweakpane+Pickr).

- **errorlog.js**  
  Error log panel, log sink for all error/info/debug messages.

- **main.js**  
  App entry point (MiniLayout bootstrapping).

- **toolbar.js**  
  Modular toolbar UI element factory (image upload, shape add/select, emits action intents to actions.js, ESM only).

- **actions.js**  
  Centralized business logic for scene actions (delete, duplicate, lock, unlock, add shape, etc).
  - Toolbar and other UI modules emit intents to this module.
  - Ensures separation of concerns and swappable toolbars.

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

- **sidebar.js**  
  Tabulator-based shape table/list panel.  
  Displays all shapes, supports row selection, robust sync with AppState.

- **minilayout.js**  
  Native layout manager: robust row/column/stack API, dynamic add/remove/reinsert, close/destroy, resize, splitter support, tab/stack, settings sync, full event API.
  - **Per-panel scrollbars/overflow now supported via `scrollbars` property in panel config. See minilayout.DOCS.md for options.**

- **minilayout-ui.js**  
  Advanced UI helpers for MiniLayout: splitter bars, tab styling, animated transitions, accessibility.

- **minilayout.demo.js**  
  Demo entrypoint for MiniLayout: panel factory registration, dynamic add/remove demo, logging of all events.

- **minilayout.css**  
  Styles for MiniLayout: panels, splitters, tabs, transitions, responsive layout.

- **minilayout.DOCS.md**  
  Documentation and API reference for MiniLayout (native layout engine).

---

**Instructions:**  
Keep this file updated per SCENE_DESIGNER_MANIFESTO.md.

