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

### defect19: iOS Safari double‑tap zoom triggers during canvas interactions — OPEN
- Summary:
  - On iPhone, quickly tapping (likely double‑tapping) on the canvas causes the page to zoom in. This interferes with shape selection and general interaction.
  - We should prevent browser double‑tap zoom within the app’s canvas/interaction area.
- Repro:
  1. Open Scene Designer on iPhone (Safari).
  2. Tap quickly twice on the canvas area (double‑tap) during selection or general use.
  3. Observe the page zoom in.
- Current:
  - iOS Safari interprets quick double‑taps as a zoom gesture on the page.
- Expected:
  - Double‑tapping within the canvas/interaction area should not trigger browser zoom. Canvas interactions should remain stable.
- Proposed fix (options; choose the most accessible/least invasive combo):
  - CSS/HTML:
    - Ensure viewport meta includes width=device-width, initial-scale=1 (already typical). Consider maximum-scale=1, user-scalable=no to fully disable zoom (note: accessibility trade‑off).
    - Apply touch-action to canvas/container:
      - touch-action: manipulation; (preferred) reduces double‑tap to zoom without disabling all gestures on modern iOS Safari.
      - If needed, touch-action: none; on the canvas to fully suppress default gestures in the drawing area (check pointer gesture needs).
  - JS event handling (fallback/compatibility):
    - Add a double‑tap suppressor on the canvas/container that cancels default on rapid successive touchend events (use passive: false):
      - document.getElementById('fabric-main-canvas').addEventListener('touchend', handler, { passive: false })
      - Detect two taps within ~300ms and call event.preventDefault().
    - Optionally preventDefault on gesturestart/gesturechange on the canvas area for older Safari behaviors.
- Acceptance:
  - Rapid double‑tap anywhere on the canvas no longer triggers browser zoom on iPhone.
  - Normal app interactions (tap to select, drag, multi‑select) remain unaffected.
  - Non‑canvas areas retain normal page behavior.
  - Cross‑device regression check: Android Chrome and desktop browsers unaffected.

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

