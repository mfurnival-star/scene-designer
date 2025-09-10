## 🚀 Overview

A visual tool to create `[Scene]` config sections for an ADB automation suite.  
Users upload or pick a screenshot, annotate with shapes (points, rectangles, circles), and export as `.ini` compatible with Python-based automation.

---

## ✨ Main Features & Workflow

1. **Image Management**
   - Upload a local screenshot **or** select from server-provided options.
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

## 📋 Updated TODO

### MVP

#### 1. Image Loader *(✅ Completed)*
   - [x] File upload (device)
   - [x] Dropdown for hardcoded server images
   - [x] Display chosen image as background

#### 2. Shape Annotation *(Point support now implemented!)*
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

#### 6. UI/UX Improvements *(recently addressed and in progress)*
   - [x] Settings panel is collapsible and now always accessible via a toggle button
   - [x] Save button for label editing
   - [x] Responsive #container resizing to fit image/canvas
   - [x] Only show selection highlight box for multiselect (not for single—single selection uses anchors/transformer only)
   - [x] Settings panel toggle always visible and clickable, even when panel is closed

---

### Shape Table Display (Design/UX Plan)

- **Concise Table Columns:**
  - Lock status (icon)
  - Label (text, possibly inline-editable)
  - Color swatches (stroke/fill color chips)
  - Coordinates (adapted for shape type: e.g. X,Y for point, X,Y,W,H for rect, X,Y,R for circle)
- **Touch/Click to Select:**  
  - Tapping or clicking a row selects/highlights the corresponding shape on the canvas.
- **Detail on Demand:**  
  - Each row has an info icon or expandable element (“…” or ⓘ) to view full properties and actions (edit all fields, duplicate, delete, lock/unlock, etc.).
- **Clean, Fast Scanning:**  
  - Table is brief and readable for scanning, but full details/actions are readily available via the info/expand control.
- **Future Option:**  
  - Table could support row expansion (accordion style) or modal for detailed editing.

---

### Stretch/Future

- [ ] Manual color override in UI (per shape)
- [ ] Expose config params (step, count, tolerance) in UI
- [ ] Multiple scenes per config
- [ ] Import/edit existing `.ini` files
- [ ] Additional shape/check types (lines, polygons, templates, etc.)
- [ ] Export as JSON (optional)
- [ ] Keyboard shortcuts for faster workflow
- [ ] Undo/redo support
- [ ] Auto-detect rectangles from images to speed up annotation

---

## 🐞 Known Issues / Tweaks

- [ ] Settings panel content only populates when `buildSettingsPanel()` is called—ensure it's invoked after DOM ready.
- [ ] Settings panel toggle button is currently only barely visible (UI/positioning needs further refinement if still an issue).
- [ ] When settings panel is closed, some users report toggle is hard to spot or not clickable.
- [ ] Label saving UI/logic is present but could benefit from clearer feedback (e.g. confirm flash, or auto-save on Enter).
- [ ] Some mobile/touch devices may have scaling or input issues.

---

*Resolved:*
- ~~The settings panel color picker is not using Pickr.~~
- ~~Locked shapes should never move in a multiselect drag; fix if possible.~~
- ~~Selection highlight box should only show for multiselect (not for single—use transformer anchors only).~~
- ~~Settings panel is now collapsible and toggle is always visible (though toggle UI can be improved further).~~
- ~~Label Save button now updates label as expected.~~
- ~~#container resizes to match image/canvas size, including tall/phone images.~~
- ~~Multiselect drag clamp logic is slightly off (edge case: when shapes are at the boundary, sometimes group can "jump" or resist).~~

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
