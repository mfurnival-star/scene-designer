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
- ./commands/commands.js → public commands facade (delegates to commands-structure.js and commands-style.js)

Core Modules
- log.js                      – central logger (ESM)
- state.js                    – Zustand-style store and mutators
- fabric-wrapper.js           – ESM wrapper for Fabric constructors (exports Ellipse)

Commands
- commands/command-bus.js     – command history bus: dispatch, undo/redo, subscriptions; supports history coalescing via options.coalesceKey (+ coalesceWindowMs)
- commands/commands-structure.js – structural/transform commands:
  - ADD_SHAPE, ADD_SHAPES, DELETE_SHAPES, DUPLICATE_SHAPES, SET_SELECTION
  - MOVE_SHAPES_DELTA, SET_POSITIONS
  - RESET_ROTATION, SET_ANGLES_POSITIONS
  - LOCK_SHAPES, UNLOCK_SHAPES
  - ALIGN_SELECTED
  - SET_TRANSFORMS
- commands/commands-style.js  – style commands:
  - SET_STROKE_COLOR, SET_FILL_COLOR, SET_STROKE_WIDTH
- commands/commands.js        – facade that routes to structure/style implementations; public entrypoint for executeCommand(cmd)

Keybindings
- keybindings.js              – global Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z / Ctrl+Y (redo), Arrow key nudges (Shift=10px), Delete/Backspace (delete selection), Ctrl/Cmd+D (duplicate), Ctrl/Cmd+L (lock), Ctrl/Cmd+Shift+L (unlock), R (reset rotation); installed in layout.js

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
- toolbar-styles.js           – injects toolbar CSS (two-row layout); includes numeric input styling (stroke width), scale-aware
- toolbar-dom.js              – renders toolbar DOM; returns element refs (Ellipse option, Debug button, Undo/Redo buttons, Stroke Width input)
- toolbar-handlers.js         – wires events; actions/selection; Pickr; Debug snapshot; Undo/Redo buttons; Stroke Width input → command bus or defaults; passes coalesceKey for stroke width typing/changes
- toolbar-state.js            – enable/disable logic; scale sync; subscribes to history for Undo/Redo enabled state
- toolbar-color.js            – Pickr integration (stroke hex, fill hex+alpha) using command bus; debounced live updates; history coalescing during drags; selection/default sync (mixed state indicated via title; silent updates to avoid loops)

Selection
- selection-core.js           – single/multi selection; transformer lifecycle
- transformer.js              – attach/detach/update Fabric controls (circle uniform scaling defensive guard)

Shapes
- shapes-core.js              – rect / circle / ellipse factories; colors; stroke width; labels; initial placement clamp; transform-based stroke normalization
- shapes-point.js             – point reticle factory and variants
- shape-defs.js               – per-shape transform/edit capabilities (ellipse added; circle aspect-lock clarified)
- shape-state.js              – per-shape state machine (selected/dragging/locked)

Actions
- actions.js                  – dispatches add/delete/duplicate/lock/unlock/resetRotation/align via command bus; style intents setStrokeColorForSelected and setFillColorForSelected; stroke width intent setStrokeWidthForSelected dispatches SET_STROKE_WIDTH; all style intents (stroke, fill, width) accept optional { coalesceKey, coalesceWindowMs } for history coalescing
- actions-alignment.js        – dispatches ALIGN_SELECTED command (alignSelected(mode, ref))

Settings
- settings-core.js            – registry, persistence, side effects (logging, console)
  - Includes loupe controls: loupeEnabled, loupeSizePx, loupeMagnification, loupeCrosshair
  - UI/Sidebar toggles: showRightSidebarPanel, showSettingsPanel, showHistoryPanel
- settings-ui.js              – Tweakpane panel binding to settings

Serialization
- serialization/scene-io.js   – serializeScene(), deserializeScene(), exportSceneJSON(), importSceneJSON()

Layout / Panels / Diagnostics
- layout.js                   – MiniLayout bootstrap; right sidebar stack (Settings top, History bottom); toggles via settings; installs global undo/redo keybindings
- errorlog.js                 – passive Error Log panel (Console.Re streaming in use)
- history-panel.js            – read-only command history panel (list + Undo/Redo/Clear)
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
- 2025-09-25 (Phase 2 – Serialization scaffolding)
  - Added serialization/scene-io.js with serializeScene()/deserializeScene() and JSON helpers (exportSceneJSON/importSceneJSON).
- 2025-09-25 (Commands split + facade)
  - Split commands into commands-structure.js (structural/transform) and commands-style.js (style).
  - commands/commands.js is now a facade routing to both modules; no public API changes.
- 2025-09-25 (Duplicate preserves transforms/styles)
  - DUPLICATE_SHAPES now preserves scale, angle, and style (stroke/fill/strokeWidth).
- 2025-09-25 (Phase 2 – Quick Fix + Picker Selection Sync)
  - actions.js: setStrokeWidthForSelected now accepts optional { coalesceKey, coalesceWindowMs } passed to dispatch (typing/coalesced undo).
  - toolbar-color.js: pickers sync from selection/defaults; mixed selection shows “(mixed)” via title; programmatic setColor calls muted to avoid feedback loops.
- 2025-09-25 (Phase 2 – History Coalescing)
  - commands/command-bus.js: added history coalescing with options.coalesceKey and options.coalesceWindowMs; consecutive matching commands within the window merge into one undo entry; redo stack cleared on coalesced updates.
  - actions.js: style intents (stroke, fill, width) accept optional options object that is passed to dispatch for coalescing.
  - toolbar-color.js: while dragging in Pickr, emits updates with a stable coalesceKey per interaction; swatch selections coalesce per click.
  - toolbar-handlers.js: stroke width typing/changing wrapped with a session coalesceKey so a whole typing interaction is a single undo step.
- 2025-09-25 (Phase 2 – History Inspector + Right Sidebar Toggles)
  - history-panel.js: new History panel (read-only list + Undo/Redo/Clear).
  - settings-core.js: added showRightSidebarPanel, showSettingsPanel, showHistoryPanel (persisted).
  - layout.js: renders right sidebar when enabled; stacks Settings (top) and History (bottom); rebuilds on toggle changes.
- 2025-09-25 (Phase 2 – Stroke Width Command)
  - commands/commands.js: added SET_STROKE_WIDTH (batch per-id, undoable; inverse captures previous widths).
  - actions.js: added setStrokeWidthForSelected(width) intent that dispatches SET_STROKE_WIDTH for unlocked selection.
  - toolbar-dom.js: added a Stroke Width numeric input (px) next to color pickers; exposed ref.
  - toolbar-handlers.js: wired Stroke Width input to command bus (when selection) or updates defaultStrokeWidth in settings (when no selection); debounced input events.
  - toolbar-styles.js: added scale-aware numeric input styles consistent with toolbar UI scale.
- 2025-09-24 (Phase 2 – Keybindings Expansion)
  - keybindings.js: Added Delete/Backspace (delete selection), Ctrl/Cmd+D (duplicate), Ctrl/Cmd+L (lock), Ctrl/Cmd+Shift+L (unlock), and R (reset rotation). All guarded for editable inputs and routed through the command bus.
- 2025-09-24 (Phase 2 – Style Commands)
  - commands/commands.js: added SET_STROKE_COLOR and SET_FILL_COLOR (batch, undoable per-id; inverse captures previous colors).
  - actions.js: added setStrokeColorForSelected(color) and setFillColorForSelected(fill) that dispatch the new commands for unlocked selection.
  - toolbar-color.js: switched to actions-based dispatch through the command bus; debounced live changes; when no selection, updates defaults in settings.
- 2025-09-24 (Phase 2 – Option B.2/B/C.1 and Phase 1 completion notes)
  - See prior entries for SET_TRANSFORMS, ALIGN_SELECTED, MOVE_SHAPES_DELTA, transform-history, toolbar/history integrations, and geometry/selection stability improvements.
