# Scene Designer – Module Manifest (Concise)

Purpose
- Curated, human-readable list of modules and facades in this repo.
- Keep it short: what exists, where to import from, and recent changes.
- For rules/philosophy, see SCENE_DESIGNER_MANIFESTO.txt.

Update Policy
- Edit this file when modules are added/removed/renamed.
- Keep entries brief; link to source when needed.

Comment Policy:
- During development, header and function-level comments may be omitted from source files to reduce file size and speed iteration.
- Before production/release, restore concise summary headers and key function comments as per engineering rules.

Facades (public import paths)
- ./canvas.js → buildCanvasPanel (delegates to canvas-core.js)
- ./toolbar.js → buildCanvasToolbarPanel (delegates to toolbar-panel.js)
- ./selection.js → public selection API (from selection-core.js)
- ./settings.js → core + UI (from settings-core.js, settings-ui.js)
- ./shapes.js → shape helpers/factories (from shapes-core.js, shapes-point.js)

Core Modules
- log.js                      – central logger (ESM)
- state.js                    – Zustand-style store and mutators
- fabric-wrapper.js           – ESM wrapper for Fabric constructors (exports Ellipse)

Commands
- commands/command-bus.js     – command history bus: dispatch, undo/redo, subscriptions
- commands/commands.js        – core command implementations:
  - Public: ADD_SHAPE, ADD_SHAPES, DELETE_SHAPES, DUPLICATE_SHAPES, SET_SELECTION, MOVE_SHAPES_DELTA, RESET_ROTATION, LOCK_SHAPES, UNLOCK_SHAPES, ALIGN_SELECTED, SET_TRANSFORMS
  - Internal (history helpers): SET_POSITIONS, SET_ANGLES_POSITIONS

Keybindings
- keybindings.js              – global Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z / Ctrl+Y (redo), and Arrow key nudges (Shift=10px); installed in layout.js

Geometry
- geometry/selection-rects.js – centralized geometry for selection hulls, overlays, alignment
- geometry/shape-rect.js      – unified single-shape bounding box + center + aspectRatio + outerRadius

Canvas
- canvas-core.js              – Fabric canvas creation, image, sync, overlays (MiniLayout resize API); installs transform-history listeners
- canvas-events.js            – Fabric selection sync → store selection (ring buffer trace)
- canvas-constraints.js       – movement clamping + multi-drag lock guard (idempotent, unified single-shape geometry)
- selection-outlines.js       – overlay painter for multi-select hull/boxes
- loupe.js                    – magnifier overlay (independent overlay canvas; DPR/zoom-aware)
- loupe-controller.js         – attaches loupe to selected Point via settings (loupeEnabled/size/magnification/crosshair)
- canvas-transform-history.js – gesture snapshot listeners (moving/scaling/rotating); commits one history entry per gesture via SET_TRANSFORMS

Toolbar
- toolbar-panel.js            – assemble styles, DOM, handlers, state sync
- toolbar-styles.js           – injects toolbar CSS (two-row layout)
- toolbar-dom.js              – renders toolbar DOM; returns element refs (Ellipse option, Debug button, Undo/Redo buttons)
- toolbar-handlers.js         – wires events; actions/selection; Pickr; Debug snapshot; Undo/Redo buttons
- toolbar-state.js            – enable/disable logic; scale sync; subscribes to history for Undo/Redo enabled state
- toolbar-color.js            – Pickr integration (stroke hex, fill hex+alpha)

Selection
- selection-core.js           – single/multi selection; transformer lifecycle
- transformer.js              – attach/detach/update Fabric controls (circle uniform scaling defensive guard)

Shapes
- shapes-core.js              – rect / circle / ellipse factories; colors; stroke width; labels; initial placement clamp; transform-based stroke normalization
- shapes-point.js             – point reticle factory and variants
- shape-defs.js               – per-shape transform/edit capabilities (ellipse added; circle aspect-lock clarified)
- shape-state.js              – per-shape state machine (selected/dragging/locked)

Actions
- actions.js                  – dispatches add/delete/duplicate/lock/unlock/resetRotation/align via command bus
- actions-alignment.js        – dispatches ALIGN_SELECTED command (alignSelected(mode, ref))

Settings
- settings-core.js            – registry, persistence, side effects (logging, console)
  - Includes loupe controls: loupeEnabled, loupeSizePx, loupeMagnification, loupeCrosshair
- settings-ui.js              – Tweakpane panel binding to settings

Layout / Panels / Diagnostics
- layout.js                   – MiniLayout bootstrap; installs global undo/redo keybindings
- errorlog.js                 – passive Error Log panel (Console.Re streaming in use)
- global-errors.js            – window error/unhandledrejection → logger
- debug.js                    – Debug Snapshot Collector (direct selection trace + tolerant bleed + unified geometry)
- scenario-runner.js          – scriptable scenarios for dev/QA
- dev/geometry-sanity.js      – (DEV) compares unified geometry vs Fabric boundingRect for validation

MiniLayout (split)
- minilayout-core.js          – layout engine (panel resizing API)
- minilayout-splitter-persist.js – splitter + size persistence
- minilayout.js               – facade export { MiniLayout }
- minilayout-ui.js            – advanced UI helpers (splitters/tabs/ARIA)
- minilayout.css              – base styles
- minilayout.DOCS.md          – docs

Other Notes
- Console.Re remote logging is documented in README and Manifesto (temporary CDN exception).
- Index.html should inject the Console.Re connector only if remote logging is desired.

Recent Changes (brief)
- 2025-09-24 (Phase 2 – Option B)
  - commands/commands.js: added SET_TRANSFORMS to set {left, top, scaleX, scaleY, angle} per id and return inverse for undo.
  - canvas-transform-history.js: new module that snapshots pre/post transforms and dispatches a single SET_TRANSFORMS on gesture end (object:modified/mouse:up).
  - canvas-core.js: installs/uninstalls transform-history listeners during panel lifecycle.
- 2025-09-24 (Phase 2 – Option A)
  - Toolbar: Added Undo/Redo buttons. Handlers wired to command bus. Toolbar state subscribes to history to enable/disable buttons.
- 2025-09-24 (Phase 2 – Step C.1)
  - keybindings.js: Added Arrow key nudges for selected shapes (1px; Shift=10px) via MOVE_SHAPES_DELTA command.
- 2025-09-24 (Phase 2 – Step C)
  - commands/commands.js: added ALIGN_SELECTED (undo via SET_POSITIONS), using centralized selection geometry and clamped deltas.
  - actions-alignment.js: now dispatches ALIGN_SELECTED via the command bus.
  - actions.js: Actions section updated to reflect alignment using command bus.
- 2025-09-24 (Phase 2 – Step B.2)
  - commands/commands.js extended: MOVE_SHAPES_DELTA (+ SET_POSITIONS), RESET_ROTATION (+ SET_ANGLES_POSITIONS), LOCK_SHAPES, UNLOCK_SHAPES.
  - actions.js now routes lock/unlock/resetRotation through command bus.
- 2025-09-24 (Phase 2 – Step B)
  - keybindings.js added (global undo/redo). layout.js installs/uninstalls keybindings during app lifecycle.
- 2025-09-24 (Loupe Overlay)
  - Added loupe.js (DPR/zoom-aware magnifier overlay) and loupe-controller.js (anchors to selected Point via settings).
  - settings-core.js: added loupeEnabled, loupeSizePx, loupeMagnification, loupeCrosshair.
  - canvas-core.js: wires loupe-controller during panel init/cleanup.
- 2025-09-24 (Phase 1 Completion – Geometry & Selection Stability)
  - GEO-UNIFY: Added geometry/shape-rect.js – single source for bounding box, center, aspectRatio, outerRadius.
  - CONSTRAINTS-GEOM: canvas-constraints.js now uses getShapeBoundingBox for single shapes (ActiveSelection hull still Fabric fallback).
  - DEBUG-GEOM: debug.js shape summaries now reference unified geometry (adds aspectRatio, outerRadius, geometrySource).
  - CIRCLE-GUARD: transformer.js defensive uniform scaling guard (lockUniScaling + scale normalization).
  - STROKE-OPT: shapes-core.js + selection-core.js reworked so stroke width reapplies only after actual scale/rotate (transform tracking via _pendingStrokeWidthReapply).
  - SEL-CLEAN: selection-core.js removed unconditional stroke normalization logic.
  - DEV-SANITY: dev/geometry-sanity.js script validates unified geometry vs Fabric boundingRect (tolerance-based diff logging).

How to add here
- When you add/rename/remove a module: update the relevant section above and keep the line short.
- If you add a new facade, list it in “Facades (public import paths)”.
