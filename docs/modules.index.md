# Scene Designer – Module Manifest (Concise)

Purpose
- Curated, human-readable list of modules and facades in this repo.
- Keep it short: what exists, where to import from, and recent changes.
- For rules/philosophy, see SCENE_DESIGNER_MANIFESTO.md.

Update Policy
- Edit this file when modules are added/removed/renamed.
- Keep entries brief; link to source when needed.

Facades (public import paths)
- ./canvas.js → buildCanvasPanel (delegates to canvas-core.js)
- ./toolbar.js → buildCanvasToolbarPanel (delegates to toolbar-panel.js)
- ./selection.js → public selection API (from selection-core.js)
- ./settings.js → core + UI (from settings-core.js, settings-ui.js)
- ./shapes.js → shape helpers/factories (from shapes-core.js, shapes-point.js)

Core Modules
- log.js                      – central logger (ESM)
- state.js                    – Zustand-style store and mutators
- fabric-wrapper.js           – ESM wrapper for Fabric constructors

Canvas
- canvas-core.js              – Fabric canvas creation, image, sync, overlays (now calls MiniLayout resize API)
- canvas-events.js            – Fabric selection sync → store selection
- canvas-constraints.js       – movement clamping + multi-drag lock guard
- selection-outlines.js       – overlay painter for multi-select hull/boxes

Toolbar
- toolbar-panel.js            – assemble styles, DOM, handlers, state sync
- toolbar-styles.js           – injects toolbar CSS (two-row layout)
- toolbar-dom.js              – renders toolbar DOM; returns element refs (now includes Debug button ref)
- toolbar-handlers.js         – wires events; calls actions/selection; installs Pickr; wires Debug snapshot button
- toolbar-state.js            – enable/disable logic; scale sync
- toolbar-color.js            – Pickr integration (stroke hex, fill hex+alpha)

Selection
- selection-core.js           – single/multi selection; transformer lifecycle
- transformer.js              – attach/detach/update Fabric controls
- **geometry/selection-rects.js** – centralized geometry for selection hulls, overlays, alignment

Shapes
- shapes-core.js              – rect/circle factories; colors; stroke width; labels
- shapes-point.js             – point reticle factory and variants
- shape-defs.js               – per-shape transform/edit capabilities
- shape-state.js              – per-shape state machine (selected/dragging/locked)

Actions
- actions.js                  – centralized business logic (add/delete/dup/lock/etc)
- actions-alignment.js        – alignSelected(mode) relative to selection hull only

Settings
- settings-core.js            – registry, persistence, side effects (logging, console)
- settings-ui.js              – Tweakpane panel binding to settings

Layout / Panels / Diagnostics
- layout.js                   – MiniLayout bootstrap, panel wiring
- errorlog.js                 – passive Error Log panel (Console.Re streaming in use)
- global-errors.js            – window error/unhandledrejection → logger
- debug.js                    – Debug Snapshot Collector (collectDebugSnapshot, runDebugCapture). Invoked by the toolbar Debug button
- scenario-runner.js          – scriptable scenarios for dev/QA

MiniLayout (split)
- minilayout-core.js          – layout engine (**exposes panel resizing API**)
- minilayout-splitter-persist.js – splitter + size persistence
- minilayout.js               – facade export { MiniLayout }
- minilayout-ui.js            – advanced UI helpers (splitters/tabs/ARIA)
- minilayout.css              – base styles
- minilayout.DOCS.md          – docs

Other Notes
- Console.Re remote logging is documented in README and Manifesto (temporary CDN exception).
- Index.html should inject the Console.Re connector only if remote logging is desired.

Recent Changes (brief)
- 2025-09-23
  - ALN-01: Alignment wired with six buttons relative to selection hull only; removed reference dropdown from toolbar.
  - PHASE-01: Added geometry/selection-rects.js for centralized selection hull/rect math; overlays and alignment now use shared geometry (see docs/PHASED_ARCHITECTURE_PATH.md).
  - MINILAYOUT-API: Added panel resizing API to minilayout-core.js: `resizePanelBody(componentName, widthPx, heightPx)` and `resizePanelByElement(element, widthPx, heightPx)`. Canvas panels now auto-resize to image.
  - DBG-01: Added debug.js (Debug Snapshot Collector) and a new “Debug” button in the toolbar (toolbar-dom.js, toolbar-handlers.js). Clicking Debug collects a snapshot and copies it to clipboard, also logs at DEBUG
- 2025-09-22
  - STY-01: Pickr color pickers added (toolbar-color.js); toolbar split into panel/styles/dom/handlers/state.
  - Selection overlays moved to top-context painter (selection-outlines.js).
  - Movement clamping and multi-drag lock guard (canvas-constraints.js).
  - iOS double‑tap zoom suppression in canvas-core.js.

How to add here
- When you add/rename/remove a module: update the relevant section above and keep the line short.
- If you add a new facade, list it in “Facades (public import paths)”.
