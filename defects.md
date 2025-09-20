# Scene Designer – Local Defect & Issue Log

> Track all open defects and issues for engineering and review.  
> Maintained in Copilot Space and manually updated here.

---

## Defects / Issues (Open)

- None currently.

---

## Resolved / Closed

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

