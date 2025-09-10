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
  - Future: Will show the table of annotation shapes and handle selection, lock, delete, etc.

---

### **PART 2: CanvasPanel Logic**  
*(Stub/hello world only; see 2A for real logic. Should be removed when 2A is active.)*
- **Filename:** `shapes.part2.canvas.js`
- **Responsibility:**  
  - Placeholder/hello world logic for the Canvas panel.

---

### **PART 2A: CanvasPanel – Image Display & Point Placement**  
- **Filename:** `shapes.part2a.konva.js`
- **Responsibility:**  
  - Fully implements the Canvas panel using Konva.
  - Loads and displays the selected/uploaded image.
  - Allows "Point" annotation placement via click.
  - Renders draggable points as colored circles.
  - Hooks for future rectangle/circle shapes.

---

### **PART 3: SettingsPanel Logic**
- **Filename:** `shapes.part3.settings.js`
- **Responsibility:**  
  - Implements the content and UI for the Settings panel.
  - Current: Placeholder/hello world.
  - Future: Scene name, logic selector, color/tolerance, export, etc.

---

## Integration/Load Order

1. `shapes.part0.layout.js`
2. `shapes.part1.sidebar.js`
3. `shapes.part2.canvas.js` *(stub; remove once 2A is active)*
4. `shapes.part2a.konva.js`
5. `shapes.part3.settings.js`

---

## Change Log

- **2024-09-10**:  
  - Standardized on `shapes.part0.layout.js` for Golden Layout bootstrap.
  - Added description for each part, clarified stub vs. real logic.
  - Ready for migration: Remove `shapes.part2.canvas.js` when fully switching to Konva logic in 2A.

---

*Update this index whenever a part file is added, removed, or renamed, or its description/role changes.*
