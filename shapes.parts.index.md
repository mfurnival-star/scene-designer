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

### **PART 2A: CanvasPanel – Image Display, Annotation, Multi-Select, Drag & Bounding Box**  
- **Filename:** `shapes.part2a.konva.js`
- **Responsibility:**  
  - Implements the full Canvas panel using Konva.
  - Loads and displays the selected/uploaded image.
  - Allows placement and manipulation of "Point", "Rectangle", and "Circle" shapes.
  - Implements robust selection logic:
    - Single and multi-selection (including "Select All" and marquee/box selection).
    - Dashed highlight outlines for multi-selected shapes.
    - Multi-select drag with custom bounding box logic (including rotation/scale).
    - Movement clamped so that no shape can be dragged out of the image/stage bounds.
    - **Debug:** Orange bounding box for multi-select group (always shown during drag; toggleable when settings are fully enabled).
  - Attaches shape events for selection, drag, and interaction.
  - Hooks for future color annotation and export logic.

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
4. `shapes.part3.settings.js`

---

## Change Log

- **2025-09-10**:  
  - Updated PART 2A to reflect restoration of full multi-select, bounding box, drag, and highlight logic.
  - Clarified current/planned responsibilities for Sidebar and Settings panels.
  - Confirmed modular structure matches delivered code and legacy feature parity.

---

*Update this index whenever a part file is added, removed, renamed, or its description/role changes.*

