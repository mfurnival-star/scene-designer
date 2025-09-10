# shapes.parts.index.md

This file defines the modular structure of the `shapes.js` application logic.  
**Each part file is listed in load/concat order.**  
Descriptions are updated as new logic is added or stubs are replaced.

---

### **PART 0: Golden Layout Bootstrapping & Panel Registration**
- **Filename:** `shapes.part0.layout.js`
- **Responsibility:**  
  - Initializes Golden Layout with three panels (Sidebar, Canvas, Settings).
  - Registers panel components and placeholder logic.
  - Handles show/hide logic for Settings panel and exposes `myLayout` for debugging.
  - Integration: Requires `<div id="main-layout"></div>` in `index.html`.

---

### **PART 1: SidebarPanel Logic**
- **Filename:** `shapes.part1.sidebar.js`
- **Responsibility:**  
  - Implements the content and UI logic for the Sidebar panel (shape table/list).
  - Current: Placeholder/hello world.
  - **Planned:** Will show the table of annotation shapes and handle selection, lock, delete, etc.

---

### **PART 2A: CanvasPanel – Image Display & Shape Creation**  
- **Filename:** `shapes.part2a.konva.js`
- **Responsibility:**  
  - Handles Canvas setup, image loading, and single-shape creation/selection.
  - Provides creation for "Point", "Rectangle", and "Circle" shapes.
  - Handles single-shape selection and transformer UI.
  - Exports key hooks for PART 2B (multi-select, drag, highlights).

---

### **PART 2B: Multi-Select, Group Drag, Highlights, Lock UI**
- **Filename:** `shapes.part2b.multiselect.js`
- **Responsibility:**  
  - Handles all multi-selection, group drag, bounding box, and lock UI logic.
  - Multi-select: Select All, marquee/box selection, multi-selection highlights.
  - Multi-select drag, clamped group bounding box (with rotation/scale).
  - Orange debug bounding box during group drag.
  - Locking: Locked shapes block group drag and show red highlight feedback.
  - Lock checkbox UI always reflects current selection.
  - Depends on PART 2A for shape creation and single selection.

---

### **PART 3: SettingsPanel Logic**
- **Filename:** `shapes.part3.settings.js`
- **Responsibility:**  
  - Implements the content and UI for the Settings panel.
  - Current: Placeholder/hello world.
  - **Planned:** Scene name, logic selector, color/tolerance, export, etc.

---

## Integration/Load Order

1. `shapes.part0.layout.js`
2. `shapes.part1.sidebar.js`
3. `shapes.part2a.konva.js`
4. `shapes.part2b.multiselect.js`
5. `shapes.part3.settings.js`

---

## Change Log

- **2025-09-10**:  
  - Split multi-select, bounding box, group drag, lock UI, and related logic into new PART 2B (`shapes.part2b.multiselect.js`).
  - Updated PART 2A description: now only canvas/image/single-shape creation/selection logic.
  - Updated integration/load order.
  - Clarified current/planned responsibilities for Sidebar and Settings panels.
  - Confirmed modular structure matches delivered code and legacy feature parity.

---

*Update this index whenever a part file is added, removed, renamed, or its description/role changes.*
