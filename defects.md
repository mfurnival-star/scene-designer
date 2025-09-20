# Scene Designer – Local Defect & Issue Log

> Track all open defects and issues for engineering and review.  
> Maintained in Copilot Space and manually updated here.

---

## Defects / Issues (Open)

### defect3: Point shape reticle style/size feels uneven at small sizes
- Summary: Current reticle (crosshair with halo) looks uneven when very small. We want multiple reticle style options and a size control in Settings.
- Plan:
  - Add Settings:
    - reticleStyle (select): crosshair, crosshairHalo, bullseye, dot, target
    - reticleSize (number): default 14px
  - Point creation respects these settings.
  - Optional future: live-update existing points when these settings change.

### defect11: Scenario Runner visibility toggle (settings)
Add a settings toggle to show/hide the Scenario Runner panel. This panel is not needed most of the time but can be useful for diagnostics in the future.

- Problem: Scenario Runner panel is always present in the layout; users who don’t need it would prefer it hidden by default.
- Expected: A boolean setting (e.g., showScenarioRunner) in Settings. Toggling it adds/removes the Scenario Runner panel from the layout immediately.
- Scope: Settings UI, layout bootstrapper wiring, and persistence via existing settings infrastructure.
- Priority: Low
- Status: Todo

### defect12: Keep stroke width constant on scale/transform (configurable)
- Summary: When shapes are resized or transformed, their stroke width should remain constant (e.g., 1px) rather than scaling with the shape.
- Expected:
  - A setting defaultStrokeWidth (number; default 1) controls stroke width for all primitives (rect, circle, point reticle lines/rings).
  - Stroke remains at that width during transforms/moves.
- Plan:
  - Set strokeUniform=true for primitives (Fabric property to keep stroke width constant during scaling).
  - Ensure creation and transform handlers re-apply stroke width from settings.defaultStrokeWidth.
  - Provide a helper to update selected shapes when this setting changes.

---

## Resolved / Closed

### defect1: Shape delete issue (core bug) — RESOLVED
- Fixes delivered: Selection is now synced from Fabric events, reentrancy guarded, and transformer attach/detach idempotent.
- Status: Closed.

### defect5: MiniLayout panel sizes not saved/restored — RESOLVED
- Fixes delivered: Panel size persistence implemented in MiniLayout using localStorage. Sizes restored on reload.
- Status: Closed.

### defect10: Scenario Runner not working — REMOVED
- Decision: Not needed right now; can be revisited later if automation is required.
- Status: Removed from active list.

---

## Instructions

- To add, update, or resolve any defect, request changes in Copilot Space.
- To publish an issue to GitHub, ask Copilot to draft a GitHub issue for the defect and attach relevant code or logs.
- For next actions, ask for “details on defectX”, “add a new defect”, or “mark defectX resolved”.

---

*Last updated: 2025-09-20*

