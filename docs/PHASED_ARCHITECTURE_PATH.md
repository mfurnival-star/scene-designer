# Scene Designer – Phased Architecture Path

## Purpose
This document enshrines the incremental architectural evolution toward a professional, studio-grade, scalable Scene Designer.  
All engineering decisions should align with these phases unless a justified deviation is reviewed and accepted.

---

## Phase 1: Stabilize Selection and Geometry  ✅ (Completed 2025-09-24)

FOCUS AREAS (Delivered):
- Transactional (tokenized) Fabric ↔ Store selection sync (canvas-events.js) with suppression rules and structured event trace ring buffer.
- Centralized geometry:
  - geometry/selection-rects.js (selection hull + member rects for overlays & alignment).
  - geometry/shape-rect.js (single-shape canonical bbox, center, aspectRatio, outerRadius).
- Consumers updated to use unified geometry (constraints, debug, overlays).
- Transformer hardening (circle uniform scaling guard).
- Stroke width optimization (transform tracking + targeted reapply).
- Dev diagnostics (geometry sanity script; debug snapshot integration).
- Stability patches (constraints idempotence, multi-select deletion correctness).
- Documentation/manifest alignment.

RESULT: Geometry and selection layers are consistent and instrumented, enabling Phase 2 without mid-flight refactors.

---

## Phase 2: Command Layer & History  ⏳ In Progress (Scope Locked 2025-09-26)

### Goal Restatement
Express every user-visible scene mutation as a reversible command recorded in history (undo/redo), with coalescing for high-frequency adjustments. `actions.js` becomes a thin intent layer (or is eventually dissolved) with business rules living inside command executors. Selection commands are used for explicit UI intents; Fabric-origin selection sync remains temporarily (full unidirectional model in Phase 3).

### In-Scope (Phase 2)
Structural:
- Add shape(s), delete shape(s), duplicate shape(s)
- Move delta (keyboard nudges)
- Alignment (selection + optional canvas reference)
- Reset rotation / set rotation
- Lock / unlock
- Aggregate transform gesture (scale/rotate/move → single SET_TRANSFORMS)
- Selection intents: set explicit selection, select all, deselect all

Style:
- Stroke color
- Fill color
- Stroke width

Scene / Misc:
- Background image set / clear
- Scene name set
- Scene logic (enum/string) set
- Diagnostic labels visibility toggle (global)
- (Optional) BATCH meta-command (group multiple commands into one history frame) – nice to have; not blocking.

History Behavior:
- Undo/redo for all above
- Coalescing for:
  - Stroke color drag
  - Fill color + alpha drag
  - Stroke width numeric scrubbing / typing
  - (Transform gestures already aggregate via SET_TRANSFORMS)

Testing & Reliability:
- Minimal automated inversion harness (forward → undo → state equivalence on core fields)
- Document numeric tolerance for float comparisons

Documentation:
- Phase file (this) updated with checklist
- Manifest updated once new command modules / test harness file(s) are added

### Explicitly Deferred (Phase 3 or later)
- Model-driven (store-authoritative) selection eliminating Fabric→store token suppression
- Marquee / hit-test geometry abstraction
- Full POJO domain model (shape graph adapter)
- Plugin / extension registration system
- Undo for low-signal settings (UI scale toggles, logging prefs)
- Multi-user sync / CRDT strategy
- Advanced snapping / guides
- Batch geometry ops beyond current alignment set

### Phase 2 Completion Criteria (All must be true)
1. Coverage: Every in-scope mutation path uses a command (no direct state mutation from UI handlers).
2. Inversion: Each command returns a valid inverse command pushed onto undo stack (or documented no-op).
3. Consistency: `actions.js` contains only intent dispatch (no correctness‑critical logic); authoritative validation in command executors.
4. Selection: UI select-all and deselect-all produce history entries (SELECT_ALL / DESELECT_ALL or SET_SELECTION wrapper).
5. Style Coalescing: Color / fill / stroke width drags each produce ≤1 history frame per continuous interaction.
6. Image & Metadata: SET_IMAGE (and CLEAR_IMAGE if separate), SET_SCENE_NAME, SET_SCENE_LOGIC, SET_DIAGNOSTIC_LABEL_VISIBILITY are undoable.
7. Optional BATCH (decide implemented or deferred; state documented).
8. Test Harness: Script validates forward/undo for each command type (shape list length, per-shape transform & style fields, selection set, image URL).
9. Docs Updated: This file + Manifest reflect final command list and note any consciously deferred candidates.
10. No Regression: Manual smoke test: add → duplicate → align → style changes → transform gesture → undo chain restores initial clean state.

### Command Inventory & Status
(Updated through Batch 5 – executor validation & standardized no-op logging added)

| Command | Purpose | Status | Notes |
|---------|---------|--------|-------|
| ADD_SHAPE / ADD_SHAPES | Create shapes | Implemented | Inverse: DELETE_SHAPES |
| DELETE_SHAPES | Remove shapes | Implemented | Inverse: ADD_SHAPES |
| DUPLICATE_SHAPES | Clone shapes | Implemented | Inverse: DELETE_SHAPES |
| SET_SELECTION | Set explicit selection | Implemented (internal) | Used by inverses & programmatic sets |
| SELECT_ALL | Wrapper intent (all shapes) | Implemented | Inverse: SET_SELECTION (prev IDs) |
| DESELECT_ALL | Wrapper intent (clear selection) | Implemented | Inverse: SET_SELECTION (prev IDs) |
| MOVE_SHAPES_DELTA | Keyboard nudge move | Implemented | Inverse: SET_POSITIONS |
| SET_POSITIONS | Apply absolute positions | Implemented | Self-inverse pattern |
| RESET_ROTATION | Zero rotation | Implemented | Inverse: SET_ANGLES_POSITIONS |
| SET_ANGLES_POSITIONS | Apply angle+center | Implemented | Self-inverse pattern |
| LOCK_SHAPES | Lock listed shapes | Implemented | Inverse: UNLOCK_SHAPES |
| UNLOCK_SHAPES | Unlock shapes | Implemented | Inverse: LOCK_SHAPES |
| ALIGN_SELECTED | Align selection | Implemented | Inverse: SET_POSITIONS |
| SET_TRANSFORMS | Gesture aggregate | Implemented | Inverse: SET_TRANSFORMS |
| SET_STROKE_COLOR | Style stroke | Implemented | Inverse: SET_STROKE_COLOR (prev items) |
| SET_FILL_COLOR | Style fill | Implemented | Inverse: SET_FILL_COLOR |
| SET_STROKE_WIDTH | Style stroke width | Implemented | Inverse: SET_STROKE_WIDTH |
| SET_IMAGE | Set / clear background image | Implemented | Null URL clears; inverse stores prior |
| CLEAR_IMAGE (optional) | Explicit clear | Not needed | Use SET_IMAGE null |
| SET_SCENE_NAME | Update scene name | Implemented | Inverse captures previous |
| SET_SCENE_LOGIC | Update logic flag | Implemented | Inverse captures previous |
| SET_DIAGNOSTIC_LABEL_VISIBILITY | Toggle labels | Implemented | Inverse captures prior boolean |
| BATCH (optional) | Group commands | TBD | Decision pending |

### Phase 2 Detailed Checklist
(Will be ticked in-place as batches land)

Structural & Style (Existing):
- [x] ADD_SHAPE(S)
- [x] DELETE_SHAPES
- [x] DUPLICATE_SHAPES
- [x] MOVE_SHAPES_DELTA
- [x] SET_POSITIONS
- [x] RESET_ROTATION
- [x] SET_ANGLES_POSITIONS
- [x] LOCK_SHAPES / UNLOCK_SHAPES
- [x] ALIGN_SELECTED
- [x] SET_TRANSFORMS
- [x] SET_STROKE_COLOR
- [x] SET_FILL_COLOR
- [x] SET_STROKE_WIDTH

New / Missing / In Progress:
- [x] SET_IMAGE
- [x] (Optional) CLEAR_IMAGE (handled via SET_IMAGE null)
- [x] SET_SCENE_NAME
- [x] SET_SCENE_LOGIC
- [x] SET_DIAGNOSTIC_LABEL_VISIBILITY
- [x] SELECT_ALL (wrapper) / DESELECT_ALL (wrapper)
- [ ] Actions refactor (executor parity pass started – standardized no-op reasons added; thinning continues)
- [ ] Style command payload normalization (full unified items[] form & doc)  (scheduled next batch)
- [x] Coalescing policy doc comment (added to command-bus.js)
- [ ] Inversion test harness script (dev/commands-inversion-test.js)
- [ ] History panel mapping (friendly labels) – optional cosmetic
- [ ] BATCH meta command (decide implement or defer; document decision)
- [ ] Documentation final update & Manifest entry for new commands
- [ ] Phase 2 Completion Review (exit checklist all green)

Testing:
- [ ] Add inversion test cases for each existing command
- [ ] Add new tests for SET_IMAGE / SET_SCENE_NAME / SET_SCENE_LOGIC / SET_DIAGNOSTIC_LABEL_VISIBILITY / SELECT_ALL / DESELECT_ALL
- [ ] Tolerance constants documented (e.g., position EPS=0.01, scale EPS=0.0001, angle EPS=0.01)

Docs & Manifest:
- [ ] Manifest updated with any new command modules / test harness
- [ ] This file marks Phase 2 “Complete” once all above are green (with deferrals clearly labeled)

### Standardized No-op Reason Codes (Batch 5)
Used by executors (structure/style) for deterministic logging & future test harness assertions:
- NO_CHANGE
- NO_TARGETS
- NO_TARGETS_UNLOCKED
- INVALID_PAYLOAD
- INVALID_COLOR
- INVALID_FILL
- INVALID_WIDTH

(Additional codes may be added with justification; harness will map these to expected skip semantics.)

### Coalescing Policy (Codified)
(See command-bus.js header comment)
- Style drags (stroke color, fill color/alpha, stroke width) coalesce via coalesceKey + rolling window (default 800–1000ms).
- Transform gestures already produce a single SET_TRANSFORMS.
- Selection commands (SELECT_ALL / DESELECT_ALL / SET_SELECTION) never coalesce.
- Structural & scene metadata commands do not coalesce.
- Coalesced frame retains original inverse until interaction ends.

### Policy Update (2025-09-26)
- Rule 8 revised to Hybrid Option B (command executors authoritative).
- Batch 5: Implemented standardized no-op logging + coalescing policy header comment.
- Actions thinning initiated (removed correctness filtering; retained cosmetic early logs).

### Planned Incremental Batches (Subject to Adjustment)
1. (Done) Scope lock + checklist.
2. (Done) Implement SET_IMAGE + SET_SCENE_NAME / SET_SCENE_LOGIC.
3. (Done) Add SET_DIAGNOSTIC_LABEL_VISIBILITY.
4. (Done) SELECT_ALL / DESELECT_ALL wrappers + toolbar integration.
5. (Done) Executor validation + standardized no-op logging + actions thinning (phase 1) + coalescing policy doc.
6. (Pending) Style payload normalization (mandatory items[] form) + finish actions thinning pass 2.
7. (Pending) Inversion test harness + baseline equivalence tests.
8. (Pending) BATCH meta-command decision (implement minimal or document deferral).
9. (Pending) History panel friendly label map + final doc polish → Phase 2 completion review.

---

## Phase 3: Model-Driven Selection (PLANNED)
Goals:
- Store is the single source of truth for selection.
- Fabric ActiveSelection becomes purely a visual derivative.
- Remove token suppression logic.
- Provide selection diff instrumentation for deterministic tests.

## Phase 4: Central Geometry & Hit-Testing (PLANNED)
Goals:
- All hit-testing & marquee selection computed via geometry layer.
- Snap / collision groundwork.

## Phase 5: Full Domain Model for Shapes (PLANNED)
Goals:
- POJO scene graph → Fabric adapter (render-only).
- Headless testability & potential server-side usage.

## Phase 6: History, Persistence, Extensibility (PLANNED)
Goals:
- Stable, versioned serialization / migration.
- Plugin / tool registry.
- Optional multi-user sync approach.
- Extended undo coverage (settings, diagnostics, advanced ops).

---

## Guiding Principle
> At every phase, prioritize testability, separation of concerns, and extensibility.  
> No business logic or state lives in UI or Fabric handlers; all domain logic is centralized and pure.

---

## Change Management
- Deviations require explicit engineering review and documentation.
- Update this file and the Manifest before making architectural changes.

---

## Progress Tracking

| Phase | Status | Date | Summary |
|-------|--------|------|---------|
| 1 – Stabilize Selection & Geometry | ✅ Complete | 2025-09-24 | Unified geometry + stable selection sync foundation. |
| 2 – Command Layer & History | ⏳ In Progress | 2025-09-26 | Wrapper commands + executor validation/no-op logging underway. |
| 3 – Model-Driven Selection | ⏳ Pending | — | One-way (store→Fabric) selection model. |
| 4 – Central Geometry & Hit-Testing | ⏳ Pending | — | Hit-test & marquee via geometry layer. |
| 5 – Domain Model Adapter | ⏳ Pending | — | POJO scene graph with Fabric adapter. |
| 6 – History, Persistence, Plugins | ⏳ Pending | — | Versioned persistence + plugin system. |

---

## Phase 1 Checklist (Historical Reference)
- [x] Transactional selection event tokenization
- [x] Selection trace ring buffer
- [x] Unified single-shape geometry helper
- [x] Consumers refactored to geometry
- [x] Circle scaling guard
- [x] Stroke width transform-based reapplication
- [x] Selection-core cleanup
- [x] Geometry sanity script
- [x] Documentation & manifest updates
- [x] Debug snapshot integration

---

## Onboarding Note
Before implementing anything in Phase 2+ read:
1. SCENE_DESIGNER_MANIFESTO.txt (engineering rules)
2. This file (scope + checklist)
3. geometry/shape-rect.js & geometry/selection-rects.js (current geometry surface)
4. commands/* (command patterns & inversion idioms)

All new geometry-dependent features MUST use geometry helpers—never direct Fabric boundingRect calls.

---

_Last updated: 2025-09-26 (Batch 5: executor validation, standardized no-op logging, coalescing policy doc, actions thinning pass 1)._
