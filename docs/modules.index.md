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
- fabric-wrapper.js           – ESM wrapper for Fabric constructors (exports Ellipse)

Geometry
- geometry/selection-rects.js – centralized geometry for selection hulls, overlays, alignment
- geometry/shape-rect.js      – (NEW) unified single-shape bounding box + center + aspectRatio + outerRadius (Phase 1)

Canvas
- canvas-core.js              – Fabric canvas creation, image, sync, overlays (MiniLayout resize API)
- canvas-events.js            – Fabric selection sync → store selection (ring buffer trace)
- canvas-constraints.js       – movement clamping + multi-drag lock guard (idempotent, now uses unified single-shape geometry)
- selection-outlines.js       – overlay painter for multi-select hull/boxes

Toolbar
- toolbar-panel.js            – assemble styles, DOM, handlers, state sync
- toolbar-styles.js           – injects toolbar CSS (two-row layout)
- toolbar-dom.js              – renders toolbar DOM; returns element refs (Debug button, Ellipse option)
- toolbar-handlers.js         – wires events; actions/selection; Pickr; Debug snapshot button
- toolbar-state.js            – enable/disable logic; scale sync
- toolbar-color.js            – Pickr integration (stroke hex, fill hex+alpha)

Selection
- selection-core.js           – single/multi selection; transformer lifecycle (stroke fix removed – now transform driven)
- transformer.js              – attach/detach/update Fabric controls (circle uniform scaling defensive guard added)
- (uses geometry helpers indirectly via consuming modules)

Shapes
- shapes-core.js              – rect / circle / ellipse factories; colors; stroke width; labels; initial placement clamp; transform-based stroke normalization
- shapes-point.js             – point reticle factory and variants
- shape-defs.js               – per-shape transform/edit capabilities (ellipse added; circle aspect-lock clarified)
- shape-state.js              – per-shape state machine (selected/dragging/locked)

Actions
- actions.js                  – centralized business logic (add/delete/dup/lock/etc) (ellipse support)
- actions-alignment.js        – alignSelected(mode) relative to selection hull only

Settings
- settings-core.js            – registry, persistence, side effects (logging, console)
- settings-ui.js              – Tweakpane panel binding to settings

Layout / Panels / Diagnostics
- layout.js                   – MiniLayout bootstrap, panel wiring
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
- 2025-09-24 (Phase 1 Completion – Geometry & Selection Stability)
  - GEO-UNIFY: Added geometry/shape-rect.js – single source for bounding box, center, aspectRatio, outerRadius.
  - CONSTRAINTS-GEOM: canvas-constraints.js now uses getShapeBoundingBox for single shapes (ActiveSelection hull still Fabric fallback).
  - DEBUG-GEOM: debug.js shape summaries now reference unified geometry (adds aspectRatio, outerRadius, geometrySource).
  - CIRCLE-GUARD: transformer.js defensive uniform scaling guard for circle (lockUniScaling + scale normalization).
  - STROKE-OPT: shapes-core.js + selection-core.js reworked so stroke width reapplies only after actual scale/rotate (transform tracking via _pendingStrokeWidthReapply).
  - SEL-CLEAN: selection-core.js removed unconditional stroke normalization on selection changes.
  - DEV-SANITY: dev/geometry-sanity.js script validates unified geometry vs Fabric boundingRect (tolerance-based diff logging).
  - Phase 1 officially marked COMPLETE (see PHASED_ARCHITECTURE_PATH.md progress section).
- 2025-09-24 (earlier same day)
  - EVT-TRACE: canvas-events.js ring buffer (selectionEventTrace) for created/updated/cleared + blank clears (suppression flags, tokens, prev/next IDs) with enforced ActiveSelection visuals (hasControls=false).
  - DBG-05: debug.js → debug-snapshot-5 (direct trace ingestion, legacy merge, scaled dimensions, tolerant bleed evaluation, unified selectionTrace).
  - SHP-CLAMP: shapes-core.js clamps initial Rect/Circle placement (now also Ellipse) to non-negative coordinates.
  - CONSTRAINTS-PATCH: canvas-constraints.js idempotent/non-destructive (no blanket canvas.off('selection:*')), fixing multi-select deletion mismatch.
  - MULTI-DELETE-FIX: Store/Fabric selection sync stabilized—Delete removes exactly the visually selected set.
  - SHP-ELLIPSE: Added Ellipse shape (rotatable, free aspect, 8 anchors) – fabric-wrapper.js exports Ellipse, shape-defs.js entry, shapes-core.js factory makeEllipseShape(), actions.js add/duplicate support, toolbar-dom.js option.
  - SHP-CIRCLE-LOCK: Circle behavior clarified/enforced (non-rotatable, aspect-ratio locked, 4 corner anchors only).
- 2025-09-23
  - ALN-01: Alignment wired with six buttons relative to selection hull only; removed reference dropdown.
  - PHASE-01: geometry/selection-rects.js added (centralized geometry for overlays & alignment).
  - MINILAYOUT-API: Panel resizing API added to minilayout-core.js; canvas auto-resizes to image.
  - DBG-01: Initial debug.js + Debug toolbar button (snapshot + clipboard).
- 2025-09-22
  - STY-01: Pickr color pickers (toolbar-color.js); toolbar split into panel/styles/dom/handlers/state.
  - Selection overlays moved to top-context painter (selection-outlines.js).
  - Movement clamping + multi-drag lock guard (canvas-constraints.js).
  - iOS double‑tap zoom suppression in canvas-core.js.

How to add here
- When you add/rename/remove a module: update the relevant section above and keep the line short.
- If you add a new facade, list it in “Facades (public import paths)”.

