# shapes.parts.index.md

This file defines the modular structure and canonical load order for the `shapes.js` application logic.  
**Each part file is listed below in the order they must be concatenated.**  
When new logic is added or stubs are replaced, update this file accordingly.

---

## 🔗 **Integration / Load Order**

```filelist
shapes.logserver.js
shapes.layout.js
shapes.handlers.js
shapes.sidebar.js
shapes.konva.js
shapes.multiselect.js
shapes.settings.js
```

---

## Part Descriptions

### **shapes.logserver.js**  
**Log Streaming and External Log Server Integration**  
- Initializes log streaming hooks.
- Provides methods to stream log/error events to an external server or local endpoint.
- Must be loaded before any part that depends on log streaming.

### **shapes.layout.js**  
**Golden Layout Bootstrapping & Panel Registration**  
- Initializes Golden Layout with Sidebar, Canvas, and Settings panels.
- Registers panel components and placeholder logic.
- Handles show/hide logic for Settings panel and exposes `myLayout` for debugging.
- Integration: Requires `<div id="main-layout"></div>` in `index.html`.

### **shapes.handlers.js**  
**UI Event Handler Attachment**  
- Attaches all toolbar and global event handlers after Golden Layout and panels are ready.
- Centralizes event handler logic for maintainability.
- Ensures handlers are attached only after the DOM is fully constructed (including dynamically generated panels).
- Should be loaded/concatenated immediately after `shapes.layout.js`.

### **shapes.sidebar.js**  
**Sidebar Panel Logic**  
- Implements the content and UI logic for the Sidebar panel (shape table/list).
- Current: Placeholder/hello world.
- Planned: Will show the table of annotation shapes and handle selection, lock, delete, etc.

### **shapes.konva.js**  
**Canvas Panel – Image Display & Shape Creation**  
- Handles Canvas setup, image loading, and single-shape creation/selection.
- Provides creation for "Point", "Rectangle", and "Circle" shapes.
- Handles single-shape selection and transformer UI.
- Exports key hooks for `shapes.multiselect.js` (multi-select, drag, highlights).

### **shapes.multiselect.js**  
**Multi-Select, Group Drag, Highlights, Lock UI**  
- Handles all multi-selection, group drag, bounding box, and lock UI logic.
- Multi-select: Select All, marquee/box selection, multi-selection highlights.
- Multi-select drag, clamped group bounding box (with rotation/scale).
- Orange debug bounding box during group drag.
- Locking: Locked shapes block group drag and show red highlight feedback.
- Lock checkbox UI always reflects current selection.
- Depends on `shapes.konva.js` for shape creation and single selection.

### **shapes.settings.js**  
**Settings Panel Logic**  
- Implements the content and UI for the Settings panel.
- Current: Minimal log level setting.
- Planned: Scene name, logic selector, color/tolerance, export, etc.

---

## Change Log

- **2025-09-11**:  
  - Added `shapes.logserver.js` for log streaming support before layout/init.
  - Switched to canonical `filelist` block for modular load order.  
  - All code, reviews, and concatenation must refer to this block.
  - All filenames now use descriptive, order-agnostic names.

---

**Whenever a part file is added, removed, renamed, or its description/role changes, update this index and the filelist above.**
