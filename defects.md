# Scene Designer – Local Defect & Issue Log

> Track all open defects and issues for engineering and review.  
> Maintained in Copilot Space and manually updated here.

---

## Defects / Issues (Open)

### defect14: Multi-select drag behavior and clamping — OPEN
- Summary:
  - When multiple shapes are selected, dragging should move them as a group.
  - A single outer bounding “hull” should appear for multi-select and be the drag handle.
  - Movement should be clamped to the canvas image bounds so no selected shape can be moved outside.
  - If any selected shape is locked, group drag should be disabled (no movement).
- Repro:
  1. Create 2–3 shapes.
  2. Multi-select them (drag marquee or Shift+click).
  3. Try dragging the selection.
- Current:
  - Multi-select outlines show, but drag does not move all shapes together; no outer hull or clamping yet.
- Expected:
  - Dragging moves the entire selection as a group.
  - An outer bounding box is visible and acts as the drag handle.
  - Dragging is clamped so none of the shapes leave the canvas.
  - If any selected shape is locked, the group does not move.
- Acceptance:
  - Group drag moves all shapes together.
  - Outer hull appears and is used for drag/clamp.
  - Clamp logic verified on all edges.
  - Locked shape within selection prevents any group movement.

### defect15: Lock/unlock selection UX and safeguards — OPEN
- Summary:
  - After locking a multi-select, re-selecting to unlock may be difficult or impossible.
  - Ensure users can always unlock (via toolbar Unlock when none selected, and via selecting locked items).
  - Verify individual lock/unlock works consistently.
- Repro:
  1. Multi-select several shapes and lock them.
  2. Attempt to select them again and unlock.
- Current:
  - Unlock button is enabled when locked shapes exist (even with none selected), but selection/UX flows need validation with locked items.
- Expected:
  - Toolbar “Unlock” works when nothing selected but locked shapes exist (unlocks all locked).
  - Locked shapes can still be selected from the sidebar or via marquee to enable “Unlock selected.”
  - Single-shape lock/unlock flows work reliably.
- Acceptance:
  - Can unlock via “Unlock all locked” when none selected.
  - Can select a locked shape via sidebar and unlock it.
  - Single-shape lock/unlock confirmed.

---

## Resolved / Closed

### defect16: Duplicate should preserve all properties — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - Exact clone via Fabric’s clone() with offsets; preserves size, rotation, stroke/fill, reticle style, etc.
  - Removes any selection-outline artifacts on clone; re-applies strokeUniform to primitives.
  - Modules: src/actions.js (duplicateSelectedShapes)

### defect17: Unlock button disabled after locking — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - Unlock button now enabled if any locked shapes exist, even with no selection; tooltip clarifies action.
  - unlockSelectedShapes() unlocks selected shapes, or all locked if none selected; preserves selection.
  - Modules: src/toolbar.js (state logic), src/actions.js (unlockSelectedShapes)

### defect18: Multi-select selection visibility (dashed outlines) — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - Blue dashed outline for selected shapes in multi-select; red dashed outline if a selected shape is locked.
  - Outlines hidden for single selection (transformer used) and when nothing is selected.
  - Modules: src/selection.js

### defect3: Point shape reticle style/size feels uneven at small sizes — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - Added reticle styles: crosshair, crosshairHalo, bullseye, dot, target.
  - Implemented size control (reticleSize); accepts numbers or strings like "20px".
  - Dot style now has a transparent crosshair cutout at the exact center so the underlying pixel is visible.
  - Points remain selectable/movable but are non-resizable and non-rotatable by design.
- Acceptance confirmed: Visuals verified at small and large sizes; transparent center verified over high-contrast backgrounds.

### defect12: Keep stroke width constant on scale/transform (configurable) — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - All primitives use Fabric’s strokeUniform=true to keep stroke width constant during transforms.
  - Re-applies configured width after transforms via fixStrokeWidthAfterTransform().
  - Settings: defaultStrokeWidth applied to selection when changed.
  - Verified on rectangles, circles, and reticle elements (lines/rings) during scale/rotate.
- Acceptance confirmed: Stroke width remains visually constant during and after transforms.

### defect13: Panel visibility toggles not synchronized (Error Log + Scenario Runner) — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - Layout subscribes to settings changes and rebuilds to add/remove the Error Log and Scenario Runner panels immediately on toggle.
  - Settings UI no longer reloads persisted settings during panel rebuilds when in-memory settings are already initialized, preventing checkbox state from being overwritten.
- Acceptance confirmed: Checkbox state updates immediately and persists across reloads.

### defect11: Scenario Runner visibility toggle (settings) — RESOLVED
- Resolution date: 2025-09-20
- Fixes delivered:
  - Added boolean setting showScenarioRunner (default: false).
  - Layout conditionally includes Scenario Runner and rebuilds on toggle via store subscription.
  - Persisted via existing settings infrastructure; reflected on load.

### defect1: Shape delete issue (core bug) — RESOLVED
- Fixes delivered: Selection is synced from Fabric events, reentrancy guarded, transformer attach/detach idempotent.
- Status: Closed.

### defect5: MiniLayout panel sizes not saved/restored — RESOLVED
- Fixes delivered: Panel size persistence implemented in MiniLayout using localStorage. Sizes restored on reload.
- Status: Closed.

### defect10: Scenario Runner not working — REMOVED
- Decision: Not needed right now; can be revisited later if automation is required.
- Status: Removed from active list.

---

## Notes
- Settings module refactor (2025-09-20):
  - Split settings into core and UI:
    - settings-core.js: registry, persistence, non-UI side effects (logging, console interception, diagnostics).
    - settings-ui.js: Tweakpane panel rendering and bindings.
    - settings.js: Facade re-exporting core + UI to keep imports stable.
  - modules.index.md and deploy.sh updated accordingly.

---

Last updated: 2025-09-20

