File name: src/modules.index.md
Language: markdown

```filelist
log.js
console-stream.js
console.re.js
console-re-wrapper.js
global-errors.js
state.js
canvas.js
canvas-core.js
canvas-events.js
selection.js
settings.js
errorlog.js
layout.js
main.js
toolbar.js
actions.js
shapes.js
transformer.js
shape-state.js
shape-defs.js
sidebar.js
fabric-wrapper.js
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
  - Numeric levels (0–4): SILENT, ERROR, WARN, INFO, DEBUG.  
  - TRACE passed to log() is aliased to DEBUG.  
  - Runtime-configurable level and destination (console or both).  
  - Pluggable sinks and safe serialization for complex data.

- console-stream.js  
  Console interception for log/info/warn/error/debug; forwards to the logger and optionally remote Console.Re if available.  
  Can preserve original console output while streaming.

- console.re.js  
  Console.Re remote logging integration (ESM/UMD wrapper edition).  
  Initializes the Console.Re connector (when present) to stream logs remotely.

- console-re-wrapper.js  
  Temporary wrapper that exposes the global Console.Re client as an ES module.  
  Transitional exception to ES module–only rule, limited to remote logging.

- global-errors.js  
  Global error and unhandled promise rejection handler; forwards all browser-level errors to the logger (ERROR level).

- state.js  
  Centralized Zustand-style store and state management (ESM-only).  
  Exports get/set functions, subscribe, and a small store object for advanced usage.

- canvas.js  
  Facade that re-exports the public Canvas API from canvas-core.js.  
  Keeps public imports stable: import { buildCanvasPanel } from './canvas.js'.

- canvas-core.js  
  Fabric.js canvas core panel.  
  - Creates canvas panel (MiniLayout component).  
  - Loads/updates background image and sizes panel to match.  
  - Subscribes to state and syncs canvas objects (add/remove/render).  
  - Installs Fabric selection lifecycle sync via canvas-events.js.  
  - Ensures shapes render above the background image.

- canvas-events.js  
  Fabric selection lifecycle sync.  
  - Listens to selection:created/updated/cleared.  
  - Updates app selection via selection.js APIs.  
  - Guards against re-entrant loops; fixes delete-on-selected shape reliability.

- selection.js  
  Centralized selection logic (single and multi).  
  - Owns transformer lifecycle (attach/detach/update).  
  - Integrates shape-state and shape-defs.  
  - Provides helpers to set/clear selection and query selected shapes.

- settings.js  
  Settings registry, persistence (localForage), and Tweakpane-based UI panel.  
  - Logging level/destination controls.  
  - Shape defaults, diagnostics, reticle style/size.  
  - Panel toggles (Error Log, Scenario Runner) stored in settings; layout applies them via store subscription.

- errorlog.js  
  Error Log panel (MiniLayout).  
  - Currently passive: message points to Console.Re dashboard for live logs.

- layout.js  
  MiniLayout bootstrapper and panel composition.  
  - Registers Canvas, Settings, Error Log, Scenario Runner, Toolbar panels.  
  - Rebuilds layout based on settings: showErrorLogPanel, showScenarioRunner.  
  - Exposes helpers to show/hide/sync panel visibility.

- main.js  
  App entry point.  
  - Loads layout.js, initializes logging, and optionally Console.Re.  
  - Attaches limited debug helpers to window in dev.

- toolbar.js  
  Modular toolbar UI (image upload/server image, add/delete shapes).  
  - Emits intents to actions.js; no business logic inside the toolbar.  
  - Maintains Delete button enable/disable state based on selection.

- actions.js  
  Central business logic for scene actions (add, delete, duplicate, lock/unlock).  
  - Applies selection and stroke width rules.  
  - Single source of truth for scene action behavior.

- shapes.js  
  Fabric.js shape factories and helpers.  
  - Point reticle styles/sizes, rect and circle factories.  
  - Diagnostic labels management.  
  - Stroke width stays constant on transform (strokeUniform + reapply).

- transformer.js  
  Fabric.js control attach/detach/update for single selection.  
  - Respects shape-defs config; reentrancy-safe.

- shape-state.js  
  Per-shape state machine (default, selected, dragging, locked, multi-selected).

- shape-defs.js  
  Centralized per-shape definitions (controls, editability, rotation/ratio flags).

- sidebar.js  
  Tabulator-based shape list panel.  
  - Displays shape table and selects shape on row click.

- fabric-wrapper.js  
  ES module wrapper for Fabric.js, re-exporting Canvas, Rect, Circle, Line, Group, Image.

- minilayout.js  
  Native layout engine (rows/columns/stacks/components) with draggable splitters.  
  - Panel size persistence via localStorage.  
  - Per-panel scrollbar configuration and styling.

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
- Public imports should use the canvas.js facade for the canvas panel.  
- Selection is synced via Fabric events in canvas-events.js to ensure delete/selection consistency.  
- Remote logging is provided via Console.Re (wrapper + init), per the documented transitional exception.

