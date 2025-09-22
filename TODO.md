# Scene Designer — Repository TODO Backlog (no GitHub issues)

Purpose
- Single, living backlog in-repo (no GitHub issues).
- Consolidates current TODOs with items from the legacy prototype and recent planning.
- Grouped by logical area; each item has a stable ID.

How to use
- Keep as a flat list grouped by category below.
- Use IDs to refer to items in commits/PRs and comments.
- Mark progress with [x] and move shipped items to “Done (recent)” with date.
- If you decide to drop an item, strike it through or delete it (keep the ID reserved).

Legend
- Priority: (P1)=High, (P2)=Medium, (P3)=Low/Nice-to-have
- Defect links reference defects.md (e.g., [defect14])

ID schema
- Format: [CAT-##] where:
  - CAT is a category code: INT (Interaction/Creation), SEL (Selection/Transform),
    ALN (Alignment/Distribution), SNP (Snapping/Guides), VPT (Viewport/Zoom/Pan),
    LAY (Layering/Visibility), STY (Styling/Color), MOB (Mobile/Touch/Accessibility),
    DAT (Data/Persistence), EXP (Export/Scene), DBG (Debug/Diagnostics), DEF (Defects fold-in)
  - ## is a 2-digit sequence within the category.
- Example: [ALN-01] Align left/center/right of selection

Notes
- Some items fold in open defects for convenience (see section “Defects folded into TODO”).
- Keep acceptance notes concise for faster review.

---

## STY — Styling & Color

- [STY-01] (P1) Selection color controls (stroke, fill, fill alpha)
  - Toolbar: Stroke color input; Fill color input + Alpha slider (0–100).
  - Behavior: With selection → apply to unlocked selected; none selected → update defaults.
  - Optional: Sidebar stroke/fill swatches clickable to open pickers.
  - Acceptance: Rect/Circle keep strokeUniform; Point reticles update lines/rings; locked skipped.

- [STY-02] (P2) Stroke dash presets
  - Presets: Solid, dashed, dotted for rect/circle.
  - Acceptance: Applies to selection; persists through transform/duplicate.

---

## ALN — Alignment & Distribution

- [ALN-01] (P1) Alignment tools
  - Modes: left, centerX, right, top, middleY, bottom.
  - Reference: default “Selection” hull; dropdown to switch to “Canvas”.
  - Acceptance: 2+ selected; locked don’t move; single-select no-op.

- [ALN-02] (P3) Distribute spacing (H/V)
  - Even gaps horizontally/vertically across multi-select.
  - Acceptance: Uses selection hull or canvas bounds; respects locked.

- [ALN-03] (P2) Quick align to canvas center
  - Buttons: Align to H center, V center.
  - Acceptance: Centers selection relative to image bounds.

---

## INT — Interaction & Creation

- [INT-01] (P1) Click‑drag creation with live preview
  - Rect/Circle: drag to size; Shift to constrain square/circle; Esc to cancel.
  - Acceptance: Creates correct geometry; cancels cleanly.

- [INT-02] (P2) Drag‑duplicate modifier
  - Alt/Option+Drag on selection duplicates then drags the new copy.
  - Acceptance: Preserves visuals; adds offset; selects new copy.

- [INT-03] (P1) Nudge via keyboard
  - Arrow keys = 1px, Shift+Arrows = 10px; clamped to image.
  - Acceptance: Works with single/multi; locked skipped.

- [INT-04] (P2) Shift‑constrain move
  - Hold Shift to constrain drag to dominant axis.
  - Acceptance: Works for single/multi; respects clamp.

- [INT-05] (P2) Cycle selection on overlap
  - Repeated click (or modifier) cycles shapes under pointer.
  - Acceptance: Deterministic order; status shows which is active.

- [INT-06] (P1) Esc to deselect
  - Global key handler, except when focused in text inputs.
  - Acceptance: Clears selection consistently.

---

## SEL — Selection & Transform

- [SEL-03] (P2) Numeric properties mini panel (single selection)
  - X, Y, W, H, R edit controls; Enter to apply; up/down to increment.
  - Acceptance: Values clamp/validate; round/truncate rules consistent.

---

## SNP — Snapping & Guides

- [SNP-01] (P2) Smart guides and snapping
  - Snap to image edges, shape edges/centers, and grid; show magenta guides.
  - Settings: snap enable, thresholds, grid size.
  - Acceptance: Toggleable; clear visual guides; can be temporarily bypassed (e.g., hold Alt).

- [SNP-02] (P2) Pixel snapping
  - Round positions to integer (or 0.5 for crisp 1px) on drop.
  - Acceptance: No visual stroke width drift; configurable.

---

## VPT — Viewport, Zoom & Pan

- [VPT-01] (P2) Canvas zoom and pan
  - Ctrl/Cmd+wheel zoom; Space+Drag pan; Fit/100% buttons.
  - Acceptance: Export coordinates remain in image pixels (scale-independent).

- [VPT-02] (P3) Rulers and cursor readout
  - Top/left rulers in px; status bar shows X,Y and W×H for selection.
  - Acceptance: Updates smoothly; optional toggle.

- [VPT-03] (P2) Responsive canvas scaling modes
  - fit/fill/stretch/actual + responsive toggle; parity with prototype.
  - Acceptance: Works on small screens; scrollbars as needed.

---

## LAY — Layering & Visibility

- [LAY-01] (P2) Z‑order controls
  - Bring to front/back; step forward/back; keyboard [ and ].
  - Acceptance: Deterministic stacking; persists to export.

- [LAY-02] (P2) Visibility toggles (eye)
  - Per-shape hide/show (non-exported property).
  - Acceptance: Hidden shapes non-interactive; export omits them.

---

## MOB — Mobile/Touch/Accessibility

- [MOB-02] (P2) Touch ergonomics
  - Larger hit targets for handles; touch-action: manipulation.
  - Acceptance: Comfortable selection/drag on mobile.

- [MOB-03] (P3) Focus/ARIA polish
  - Toolbar buttons and panel headers with clear focus/labels.
  - Acceptance: Keyboard navigable; ARIA roles correct.

---

## DAT — Data & Persistence

- [DAT-01] (P2) Undo/redo (history)
  - Track add/remove/move/resize/lock/unlock; Ctrl/Cmd+Z / Shift+Z.
  - Acceptance: Idempotent; coalescing rules for drags.

- [DAT-02] (P2) Draft save/load (JSON)
  - Save scene (image ref + shapes) to JSON; load later.
  - Acceptance: Round-trip stable; versioned schema.

---

## EXP — Scene & Export

- [EXP-01] (P1) Scene fields: name + AND/OR logic
  - Inputs in a small header area or in Settings.
  - Acceptance: Stored in state; used by export.

- [EXP-02] (P1) Export .ini (preview + download)
  - Generate current scene; require_pixel / _rect / _circle.
  - Acceptance: File matches schema; values reflect shapes and scene logic.

- [EXP-03] (P2) Color sampling (data + basic UI)
  - On placement: sample color(s) (point center; rect/circle center for now).
  - UI: show sampled swatch/hex in Sidebar; manual override later.
  - Acceptance: Stable sampling; export uses stored colors.

---

## DBG — Debug & Diagnostics

- [DBG-01] (P3) Debug “multi‑drag box” (setting-driven)
  - Orange dashed bounding box for multi-select while dragging.
  - Acceptance: Controlled by setting; zero cost when disabled.

- [DBG-02] (P3) Tooltip readouts while resizing
  - Show current W×H or R during transform.
  - Acceptance: Non-intrusive; precise values.

---

## Other UX polish

- [UX-01] (P2) Label editing UX (single-select)
  - Inline edit in Sidebar or minimal Properties panel.
  - Acceptance: Enter/click‑to‑save; updates store and UI.

- [UX-02] (P2) Loupe/magnifier for point dragging
  - Settings: enabled, size, zoom, FPS, crosshair, overlays, offsets.
  - Acceptance: Appears while dragging points; no perf regressions.

---

## Defects folded into this TODO (for convenience)

- [DEF-14] (P1) Multi‑select group drag + clamping — see [SEL-01] (done 2025‑09‑22)
- [DEF-15] (P1) Lock/unlock selection UX and safeguards
  - Unlock when none selected (all locked) via toolbar still available.
  - Ensure locked shapes are discoverable/selectable via Sidebar for targeted unlock.
- [DEF-19] (P1) iOS Safari double‑tap zoom suppression — see [MOB-01] (done 2025‑09‑22)

---

## Done (recent)

- 2025‑09‑22: [SEL-01] Multi‑select group drag + hull + clamp
  - Implemented canvas-constraints.js clamping and multi-drag lock guard; overlay painter renders dashed hull for ActiveSelection.

- 2025‑09‑22: [SEL-02] Locked‑drag feedback
  - When a group contains any locked member, drag is blocked, cursor shows not‑allowed, and multi‑select outlines render red to indicate the lock state. If you prefer a temporary flash instead of persistent red, we can add a 700–1000ms pulse.

- 2025‑09‑22: [ALN-04] Reset rotation
  - Added resetRotationForSelectedShapes() and wired toolbar button; preserves center and respects locks.

- 2025‑09‑22: [MOB-01] iOS double‑tap zoom suppression
  - touch-action: manipulation + touchend timing guard and gesture* preventDefault in canvas-core.js.


