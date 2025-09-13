# Scene Designer – Engineering & Review Instructions

These instructions are binding for all development, code review, and delivery in the Scene Designer project.

---

## 1. **ES Module Enforcement**

- **All code must use ES module syntax for imports and exports.**
    - No use of window.*, global variables, or global libraries.
    - Every external library (e.g. Konva, Pickr, Golden Layout) must be imported as an ES module.
    - No `<script src="...">` tags in HTML for code dependencies; only your entry bundle is allowed in HTML.

---

## 2. **Import/Export Consistency**

- **Every import must be satisfied by a real export in the source file.**
    - If a file imports a function/class/variable, that symbol must be exported from its source file.
    - If an import is missing, update the source to export it, or correct the import to point to the real source.
    - This must be checked and enforced for all code changes and file deliveries.

---

## 3. **File Delivery Policy**

- **All code delivery, review, and requests operate on complete files, never snippets.**
    - When a change is required, produce a full new version of the file.
    - Never deliver just a diff or code snippet.

---

## 4. **Change/Review Workflow**

1. **List all files that require changes for ES module or import/export compliance.**
2. **Deliver each file, one at a time, in the order listed.**
3. **Wait for explicit confirmation ("next", "ready", etc.) from the user before delivering the next file.**
4. **After all files are delivered, explicitly confirm completion (e.g. "All done – ES module migration is complete.").**

---

## 5. **Module Structure & Index**

- All code is organized as ES modules under `src/`.
- The canonical load order and module list is maintained in `src/modules.index.md`.
- This file must be updated if modules are added, removed, or renamed.

---

## 6. **Logging and Documentation**

- Use the shared logger (`log()`) from `log.js` with proper log levels and tags.
- Every module/file must begin with a comment summarizing its purpose, exports, and dependencies.
- All cross-module communication is via ES module imports/exports.

---

## 7. **Review Checklist**

- All code delivered as full files.
- All imports are satisfied by real exports.
- No global or window references for libraries or code (except for the exported AppState singleton).
- No CDN scripts or global scripts for code dependencies in HTML.
- Updated `src/modules.index.md` if modules changed.
- All logging and documentation policies followed.
- File delivery workflow strictly followed.

---

## 8. **Example of Good and Bad Practice**

```js
// Good
import Konva from "konva";
import { buildSidebarPanel } from "./sidebar.js";

// Bad
const stage = new window.Konva.Stage(...);   // ❌ Not allowed
window.Pickr.create(...);                    // ❌ Not allowed
import { foo } from "./notExportedHere.js";  // ❌ Not allowed if not exported
```

---

**Refer to `SCENE_DESIGNER_MANIFESTO.md` for the project philosophy and detailed architectural rules.**
