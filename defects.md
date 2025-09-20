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
