## 🚀 Overview

A visual tool to create `[Scene]` config sections for an ADB automation suite.  
Users upload or pick a screenshot, annotate with shapes (points, rectangles, circles), and export as `.ini` compatible with Python-based automation.

---

## 🆕 What’s new (2025-09-22)

- Color controls now use Pickr (ESM) popovers instead of native inputs.
  - Stroke: hex only.
  - Fill: hex with opacity.
  - With selection: live-apply to unlocked selected shapes.
  - No selection: update defaults in settings (persisted).
- Toolbar layout updated to two rows to reduce horizontal scrolling.
  - Row 1: Image controls, Shape type + Add, Delete, Select All.
  - Row 2: Duplicate, Reset Rotation, Lock/Unlock, Color (Pickr hosts).

See details below (Color Controls and Toolbar Layout).

---

## ✨ Main Features & Workflow

1. **Image Management**
   - Upload a local screenshot or select from server-provided options.
   - Display the selected image as a locked canvas background.

2. **Shape Annotation**
   - Supported: Point (`require_pixel`), Rectangle (`require_pixel_rect`), Circle (`require_pixel_circle`).
   - Restrict dropdown to only these shapes.
   - Draw, move, and label shapes (label optional).
   - Store scene name and AND/OR logic.

3. **Color Sampling**
   - On shape placement, auto-sample color(s) at:
     - Point: exact pixel.
     - Rect/Circle: center pixel (for now).
   - Show sampled color in UI (e.g., hex value).
   - (Manual override: data model only, UI in future.)

4. **Export**
   - Export as `.ini` file, with `[SceneName]` section.
   - Each shape outputs a `require_*` line as per schema.

5. **Config Parameters**
   - Backend/data model includes:
     - Rectangle step: `step=8`
     - Circle count: `count=12`
     - Color region tolerance: `tolerance=40`
   - These are not user-editable yet, but can be exposed in UI in future.

---

## 🛠️ Modular Actions & Separation of Concerns (2025 Update)

- Toolbar and UI panels emit "intents" or "actions" only.
  - All business logic for scene actions (delete, duplicate, lock, unlock, etc.) is centralized in `src/actions.js`.
  - Toolbars are decoupled: you can swap, extend, or test toolbars without touching business logic.
  - Actions module ensures consistent rules for deletion, duplication, locking, etc.

- State management uses a Zustand-style store in `src/state.js`.
  - UI and business logic modules communicate via exported functions.
  - No direct mutation from UI components.

- Shapes module split:
  - `src/shapes.js` is now a facade that re-exports from:
    - `src/shapes-core.js` (helpers, Rect, Circle, stroke width, diagnostic labels)
    - `src/shapes-point.js` (Point/reticle-only logic)
  - All other modules should continue to import from `./shapes.js`.

- Toolbar wiring (current):
  - Two-row layout
  - Row 1: Image controls, Shape type + Add, Delete, Select All
  - Row 2: Duplicate, Reset Rotation, Lock, Unlock, Stroke/Fill color pickers (Pickr)

See [SCENE_DESIGNER_MANIFESTO.md](SCENE_DESIGNER_MANIFESTO.md) for architectural rules.

---

## 🎨 Color Controls (Pickr)

- Implementation
  - Uses @simonwep/pickr (ESM). Theme imported from the module (no CDN).
  - Two pickers:
    - Stroke: hex only (no opacity slider).
    - Fill: hex + opacity.
- Behavior
  - If any shapes are selected: apply stroke/fill to unlocked selected shapes live as the user changes.
  - If none selected: update defaults in settings (persisted):
    - defaultStrokeColor is stored as #RRGGBBAA (alpha forced to FF).
    - defaultFillColor is stored as #RRGGBBAA.
- Defaults
  - Pickers initialize from settings.defaultStrokeColor and settings.defaultFillColor.
- Dev setup
  - Install dependency:
    - npm: npm install @simonwep/pickr
    - yarn: yarn add @simonwep/pickr
    - pnpm: pnpm add @simonwep/pickr

---

## 🧰 Toolbar Layout (Two Rows)

- Rationale: Reduce horizontal scrolling and make frequently used actions more accessible.
- Row 1
  - Upload Image, Server image select
  - Shape type dropdown + Add
  - Delete, Select All
- Row 2
  - Duplicate, Reset Rotation
  - Lock, Unlock
  - Color group: Stroke (Pickr), Fill (Pickr with opacity)
- Scaling
  - Toolbar scales via settings.toolbarUIScale (applied as CSS var; reflows, no transform scaling).

---

## 📋 Updated TODO

### MVP

#### 1. Image Loader (Completed)
   - [x] File upload (device)
   - [x] Dropdown for hardcoded server images
   - [x] Display chosen image as background

#### 2. Shape Annotation (Point support implemented)
   - [x] Add "Point" annotation support
   - [x] Restrict dropdown to Point, Rect, Circle
   - [x] Place/move shapes on image
   - [x] Store type, position, and size
   - [x] Lock/unlock shapes (cannot move when locked)
   - [x] Duplicate shape(s)
   - [x] Delete shape(s)
   - [x] Selection logic (single/multiselect, transformer for single select)
   - [x] Drag and marquee select

#### 3. Scene Management
   - [ ] Scene name field
   - [ ] AND/OR logic selector

#### 4. Color Sampling
   - [ ] Auto-sample color for each shape placement
   - [ ] Show sampled color in shape list/properties

#### 5. Config Export
   - [ ] Generate `.ini` section for current scene
   - [ ] Each shape outputs the correct `require_*` line
   - [ ] Download/export as `.ini` file

#### 6. UI/UX Improvements (in progress)
   - [x] Settings panel is collapsible and accessible via a toggle button
   - [x] Save button for label editing
   - [x] Responsive #container resizing to fit image/canvas
   - [x] Only show selection highlight box for multiselect (single uses transformer/anchors)
   - [x] Settings panel toggle always visible/clickable
   - [x] MiniLayout panel size persistence: splitter-drag sizes saved/restored via localStorage
   - [x] Toolbar: Duplicate / Select All / Lock / Unlock wired to actions
   - [x] Color controls use Pickr popovers (stroke hex; fill hex + opacity)
   - [x] Toolbar layout changed to two rows (reduced horizontal scrolling)

---

### Shape Table Display (Design/UX Plan)

- Concise Table Columns:
  - Lock status (icon)
  - Label (text, possibly inline-editable)
  - Color swatches (stroke/fill color chips)
  - Coordinates (adapted per shape)
- Touch/Click to Select: Selecting a row selects the shape on canvas.
- Detail on Demand: Info/expand control or modal for full editing.
- Clean, Fast Scanning, with optional row expansion in future.

---

### Stretch/Future

- [ ] Manual color override in UI (per shape)
- [ ] Expose config params (step, count, tolerance) in UI
- [ ] Multiple scenes per config
- [ ] Import/edit existing `.ini` files
- [ ] Additional shape/check types (lines, polygons, templates)
- [ ] Export as JSON (optional)
- [ ] Keyboard shortcuts
- [ ] Undo/redo support
- [ ] Auto-detect rectangles from images to speed up annotation
- [x] MiniLayout panel size persistence via localStorage

---

## 🐞 Known Issues / Tweaks

- [ ] Settings panel content only populates when `buildSettingsPanel()` is called—ensure it's invoked after DOM ready.
- [ ] Settings panel toggle button may still need polish.
- [ ] Label save UX can be improved (confirm flash, Enter to save).
- [ ] Some mobile/touch devices may have scaling/input quirks.
- [ ] Toolbar actions are dispatched as intents to `actions.js`.

Resolved items are tracked in `defects.md`.

---

## 🗂️ `.ini` Schema Reference

```
[SceneName]
logic = AND|OR
require_pixel = X,Y,#RRGGBB
require_pixel_rect = X1,Y1,X2,Y2,#RRGGBB,step=8
require_pixel_circle = X,Y,RADIUS,#RRGGBB,count=12
require_color_region = X1,Y1,X2,Y2,#RRGGBB,tolerance=40
```

---

## 🏁 Restart/Resume Guide

To restart or fork:
- Start with image loading
- Add shape annotation (ensure Point support)
- Add color sampling
- Add config export
- UI/logic must always match the `.ini` schema and ADB automation workflow

---

## 🏗️ Architecture Notes (2025 Update)

- See `src/actions.js` for centralized scene actions.
- Toolbars and other UI emit actions only—no direct state mutation.
- State managed in `src/state.js` (Zustand pattern).
- Panels and UI factories follow MiniLayout API: `{ element, title, componentName }`.
- Shapes module split:
  - `shapes.js` facade → `shapes-core.js`, `shapes-point.js`.
- MiniLayout panel size persistence via localStorage.

---

## 📚 Documentation & Manifest

- For engineering/code delivery rules, see [SCENE_DESIGNER_MANIFESTO.md](SCENE_DESIGNER_MANIFESTO.md)
- For full module list, see [`src/modules.index.md`](src/modules.index.md)

---

## 🧩 Auto-generated files

- `src/exports.index.json` is auto-generated by tooling. Do not edit it by hand.
  - Manual edits are not required when APIs change; the generator will refresh it.
  - If it looks out of sync locally, run the usual dev/build task to regenerate.
  - PRs may include this file; reviewers should not request manual edits to it.

Note: `src/modules.index.md` is curated manually and should be updated when modules are added/removed/renamed.

---

## ⚠️ Manifesto Caveat: Remote Logging via Console.Re

Console.Re remote log streaming requires a temporary exception to our strict ES module and no-globals policy:

- Use the official Console.Re connector script:
  ```
  <script src="//console.re/connector.js" data-channel="scene-designer"></script>
  ```
- This exception is strictly for remote log streaming only.
- Remove once Console.Re provides a proper ES module export.

Rationale: The connector.js CDN is currently the only supported way to stream logs to the Console.Re dashboard and reliably capture early errors.

---

