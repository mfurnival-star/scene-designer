# Scene Designer – Phased Architecture Path

## Purpose
This document enshrines the incremental architectural evolution toward a professional, studio-grade, scalable Scene Designer.  
All engineering decisions should align with these phases unless a justified deviation is reviewed and accepted.

---

## Phase 1: Stabilize Selection and Geometry

- **Transactional Selection Sync:**  
  Use a tokenized (transactional) approach for syncing selection between Fabric and the domain store. This eliminates reentrancy bugs and stale UI states.
- **Centralized Geometry Utilities:**  
  Move all geometry (absolute rects, hulls, bounds) to a shared module.  
  Alignment, overlays, and selection logic must consume these utilities—never query Fabric’s bounding APIs directly at call sites.

---

## Phase 2: Command Layer and History

- **Command Bus:**  
  Introduce a minimal command bus to route all core actions—select, align, move, lock, delete, duplicate—through commands with pure signatures.
- **Undo/Redo:**  
  Actions.js delegates to commands; a history stack supports undo/redo out of the box.

---

## Phase 3: Model-Driven Selection

- **Single Source of Truth:**  
  Treat the domain model/store as authoritative for shapes and selection.  
  Fabric becomes a pure input/view adapter: input events dispatch intents, selection is mirrored from model to Fabric.
- **No Double Writes:**  
  Handler suppression for selection is eliminated; the model owns selection, and Fabric is a visual reflection.

---

## Phase 4: Centralize Geometry and Hit-Testing

- **Shared Geometry Library:**  
  All modules—alignment, overlays, constraints, marquee—use the geometry utility, ensuring hit-testing and selection policies are deterministic.
- **Model-Driven Marquee:**  
  Marquee selection is computed in the model, making selection policies extensible and reliable.

---

## Phase 5: Full Domain Model for Shapes

- **POJO Scene State:**  
  Shapes, transforms, selection sets, and scene state live as plain objects in the model.
- **Pure View Adapter:**  
  The adapter maps model state to Fabric visuals; business logic never depends on Fabric’s internal state.
- **ActiveSelection for Visuals Only:**  
  Fabric’s ActiveSelection (or equivalent) is used for rendering, not for business logic.

---

## Phase 6: History, Persistence, and Plugins

- **Undo/Redo Completeness:**  
  All commands support undo/redo and can be serialized.
- **Stable Scene Serialization:**  
  Scenes serialize/deserialize from the domain model, not Fabric.
- **Extensible Tool/Command Registry:**  
  The architecture allows plugins and new tools without modifying the core.

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

Each phase should be checked off (with a date and summary) in this file as completed.
For onboarding, always read the latest version of this document and SCENE_DESIGNER_MANIFESTO.txt.

