```filelist
log.js
console-stream.js
global-errors.js
state.js
canvas.js
canvas-core.js
canvas-events.js
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
scenario-runner.js
scenario-panel.js
```

---

- log.js  
  Centralized, pluggable logging system for Scene Designer.  
  All logs use `log()`; supports runtime config, pluggable sinks, and safe serialization.

- console-stream.js  
  Console method interception for streaming all console logs (log/error/warn/info/debug/trace) via logger.

- global-errors.js  
  Global error and unhandled promise rejection handler; forwards all browser-level errors to logger.

- state.js  
  Centralized Zustand-style store and state management for all app logic.

- canvas.js  
  Thin facade that re-exports the public Canvas API from `canvas-core.js`.  
  Keeps the public import path stable: `import { buildCanvasPanel } from './canvas.js'`.

- canvas-core.js  
  Fabric.js Canvas Core.  
  - Creates and manages the canvas panel (MiniLayout component).  
  - Loads/updates background image and resizes panel to match.  
  - Subscribes to state changes and syncs canvas objects (add/remove/render).  
  - Installs Fabric selection lifecycle sync via `canvas-events.js`.  
  - Ensures shapes render above the background image.

- canvas-events.js  
  Fabric selection lifecycle event sync.  
  - Listens to `selection:created`, `selection:updated`, `selection:cleared`.  
  - Updates app selection via `selection.setSelectedShapes()` / `selection.deselectAll()`.  
  - Fix for defect1: ensures Delete operates on the visually selected shape (no namespaced Fabric events).

- selection.js  
  Centralized selection logic and transformer lifecycle.  
  - Single source of truth for selected shape(s).  
  - Attaches/detaches/upgrades transformer appropriately.  
  - Integrates with shape-state, shape-defs, and transformer modules.

- settings.js  
  Settings registry, persistence (via localForage), and UI panel (Tweakpane+Pickr).

- errorlog.js  
  Error log panel (currently passive while Console.Re streaming is active).

- main.js  
  App entry point (MiniLayout bootstrapping, logging setup, optional Console.Re init).

- toolbar.js  
  Modular toolbar UI (image selection/upload, add/delete shapes).  
  Emits intents to `actions.js`; contains no business logic.

- actions.js  
  Centralized business logic for scene actions (delete, duplicate, lock, unlock, add shape, etc).  
  UI modules emit intents to this module.

- shapes.js  
  Shape factories and per-shape config application for Fabric.js objects.  
  Diagnostic labels, stroke width handling, and transform event hooks.

- transformer.js  
  Fabric.js control attach/detach/update for selected shapes. Called only by `selection.js`.

- shape-state.js  
  Per-shape state machine (selected, default, dragging, locked, etc).

- shape-defs.js  
  Centralized per-shape definitions (controls, editability, rotation/ratio flags).

- sidebar.js  
  Tabulator-based shape list panel. Row click selects the corresponding shape.

- minilayout.js  
  Native layout engine (rows/columns/stacks/components) with splitters and panel size persistence.

- minilayout-ui.js  
  Advanced UI helpers for MiniLayout: splitter bars, tab styling, transitions, accessibility.

- minilayout.css  
  Styles for MiniLayout: panels, splitters, tabs, transitions, responsive layout.

- minilayout.DOCS.md  
  Documentation and API reference for MiniLayout.

- scenario-runner.js  
  Scenario runner for scripted actions/log/assert flows; used by automation/testing panel.

- scenario-panel.js  
  Scenario Runner UI panel (MiniLayout) to select and run scenarios with live logs.

---

Notes:
- Public exports remain stable through `canvas.js` (facade). `exports.index.json` still lists `buildCanvasPanel` under `canvas.js`.
- The canvas split removes any reliance on namespaced Fabric events; selection sync is now event-driven via `canvas-events.js` to resolve defect1.
