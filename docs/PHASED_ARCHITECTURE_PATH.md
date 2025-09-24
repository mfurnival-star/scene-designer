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
  - NEW: geometry/shape-rect.js (single-shape canonical bbox, center, aspectRatio, outerRadius).
- Consumers updated to use unified geometry:
  - canvas-constraints.js (single-shape movement clamping now uses getShapeBoundingBox).
  - debug.js (shape summaries now include aspectRatio, outerRadius, geometrySource).
- Transformer hardening:
  - Defensive circle uniform scaling guard (lockUniScaling + post-normalization if scaleX ≠ scaleY).
- Stroke width optimization:
  - Removed unconditional reapplication on selection changes.
  - Added transform tracking (_pendingStrokeWidthReapply) in shapes-core.js; stroke width reapplied only after actual scaling/rotation (modified event).
- Selection cleanliness:
  - selection-core.js no longer triggers redundant stroke normalization.
- Dev diagnostics:
  - dev/geometry-sanity.js compares unified geometry vs Fabric getBoundingRect() (tolerance-based).
  - debug-snapshot-5 integrates direct selection event trace + tolerant bleed evaluation.
- Stability patches:
  - canvas-constraints.js made idempotent and non-clobbering (no global canvas.off('selection:*')).
  - Multi-select deletion & ActiveSelection visuals stabilized (hasControls=false enforced).
- Documentation:
  - modules.index.md updated (Phase 1 completion section).
  - This file updated with completion summary & checklist below.

RESULT: Geometry and selection layers are consistent and instrumented, enabling Phase 2 (Command Layer / History) without mid-flight refactors.

---

## Phase 2: Command Layer and History (PLANNED)

Goals:
- Introduce a minimal command bus: every core action (add, delete, duplicate, lock, unlock, select, align, transform) becomes a Command object or pure function with metadata.
- History stack (undo/redo) capturing reversible deltas.
- Actions.js becomes a thin intent-to-command dispatcher.
- Begin shaping serialization format for future persistence.

Success Criteria:
- All user-visible mutations reversible via undo/redo.
- No UI module directly mutates state (already enforced; will be formally codified via commands).

---

## Phase 3: Model-Driven Selection (PLANNED)

Goals:
- Store is the single source of truth for the selection set.
- Fabric ActiveSelection becomes a purely visual reflection (built from the model), never an authoritative source.
- Eliminate tokenized suppression (no need when flow is unidirectional).
- Deterministic selection diffing → easier test harnesses.

---

## Phase 4: Centralize Geometry + Hit-Testing (PLANNED)

Goals:
- All geometry (including future marquee hit-testing, snap guides, collision) flows through geometry module(s).
- No direct Fabric boundingRect calls from business logic.
- Marquee selection computed in the model.

---

## Phase 5: Full Domain Model for Shapes (PLANNED)

Goals:
- Pure POJO scene graph: shapes, transforms, selection, constraints.
- Fabric adapter layer renders POJO graph → Fabric objects (one-way).
- Easier headless testing & server-side rendering scenarios.
- ActiveSelection only for visual hull / drag ergonomics.

---

## Phase 6: History, Persistence, Extensibility (PLANNED)

Goals:
- Full undo/redo across all command types (transform, geometry, style, structural).
- Stable serialization/deserialization (shape schema versioning).
- Plugin/extension registry for new tools, alignment modes, or constraint policies.
- Optional multi-user sync groundwork (structural CRDT or command log stream).

---

## Guiding Principle

> At every phase, prioritize testability, separation of concerns, and extensibility.  
> No business logic or state lives in UI or Fabric handlers; all domain logic is centralized and pure.

---

## Change Management

- Deviations require explicit engineering review and documentation.
- Update this file and the Manifesto section before making architectural changes.

---

## Progress Tracking

| Phase | Status | Date | Summary |
|-------|--------|------|---------|
| 1 – Stabilize Selection & Geometry | ✅ Complete | 2025-09-24 | Tokenized selection sync; unified geometry (shape + selection); circle uniform scaling guard; stroke width transform optimization; constraints & debug refactors; dev sanity tooling. |
| 2 – Command Layer & History | ⏳ Pending | — | Define Command API + history stack; migrate actions.js. |
| 3 – Model-Driven Selection | ⏳ Pending | — | Store as authoritative; Fabric becomes passive renderer for selection. |
| 4 – Central Geometry & Hit-Testing | ⏳ Pending | — | Consolidate all bbox & hit logic; model-driven marquee. |
| 5 – Domain Model Adapter | ⏳ Pending | — | POJO scene graph; Fabric adapter only. |
| 6 – History, Persistence, Plugins | ⏳ Pending | — | Full undo/redo, serialization, plugin registry. |

Checklist (Phase 1 Detailed):
- [x] Transactional selection event tokenization
- [x] Selection trace ring buffer (canvas-events.js)
- [x] Unified single-shape geometry helper (geometry/shape-rect.js)
- [x] Consumers refactored (canvas-constraints.js, debug.js)
- [x] Circle scaling guard (transformer.js)
- [x] Stroke width transform-based reapplication
- [x] Selection-core cleanup (remove redundant stroke fixes)
- [x] Dev geometry sanity script
- [x] Documentation + manifest updates
- [x] Debug snapshot v5 integration (direct trace, tolerant bleed)

---

## Onboarding Note

Before implementing anything in Phase 2+, read:
1. SCENE_DESIGNER_MANIFESTO.txt (engineering rules)
2. docs/modules.index.md (module map)
3. geometry/shape-rect.js & geometry/selection-rects.js (current geometry surface)

All new geometry-dependent features MUST use the geometry helpers—not ad hoc Fabric APIs.

---

