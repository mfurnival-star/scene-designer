# Scene Designer: ES Modules Engineering Manifesto

> **Reference:**  
> This document replaces all prior modularization practices and is the authoritative contract for development and code review.  
> All architecture, code delivery, and review must strictly adhere to these rules.

---

## 1. Vision

Build a modular, professional, and maintainable scene annotation tool for ADB automation, using only ES modules for all code and dependencies.

---

## 2. ES Module Policy

- **All project code and dependencies must use ES module syntax (`import`/`export`).**
- **No file may reference any global (window.*) variable, function, or library (e.g. `window.Konva`, `window.Pickr`).**
    - If a library is needed, it must be imported as an ES module (e.g. `import Konva from 'konva'`).
    - CDN/global scripts (e.g. `<script src="...">`) are forbidden for anything used in code.
- **Every cross-file dependency must be imported explicitly.**
    - If a file needs a function, it must be exported from its source and imported where used.
    - If an import is not exported by the source, update the source to export it, or update the importing file to use the correct source.
- **No global state is permitted except for the exported `AppState` from `state.js`.**
- **All cross-module communication must be via ES module imports/exports.**

---

## 3. File Delivery, Review, and Change Policy

- **All code requests, reviews, and deliveries must be for full files, never code snippets or diffs.**
    - Any file that is changed or added must be delivered in full.
    - Every delivery must be checked for ES module import/export consistency and correctness.
- **Code review and delivery workflow:**
    1. **When code changes are needed, first produce a list of all files that must change.**
    2. **Deliver the files to the user one at a time, in the order listed.**
    3. **Wait for explicit confirmation (e.g., "next", "ready", "continue") before delivering the next file.**
    4. **After all files are delivered, end with a clear statement (e.g., "All done – ES module migration is complete").**
- **If a module is added, removed, or renamed, update `src/modules.index.md` accordingly.**

---

## 4. Import/Export Consistency Rule

> **For every code delivery and review, if a file imports a function, class, or variable from another, it must actually be exported from that source file. If not, update the source file to export it, or update the importing file to use the correct source. This must be checked and enforced for all code requests and file deliveries.**

---

## 5. File and Module Structure

- All logic is organized into ES module files under `src/`.
- Each module:
    - Exports only what is necessary.
    - Imports dependencies explicitly using ES module syntax.
    - May depend on a central `AppState` from `state.js`.
    - **Must not import or use any window/global variable, function, or library.**
- All library dependencies (e.g., Konva, Pickr, Golden Layout) must be installed as npm packages and imported as ES modules.
- **No reliance on CDN scripts or window-attached properties is permitted.**

---

## 6. Logging

- All modules use the shared logger, `log()`, with standardized log levels.
- Logging is always via ES module import; never via global.

---

## 7. Documentation & API Contract

- **Every module/file starts with a JSDoc-style or Markdown comment summarizing its responsibilities, exports, and dependencies.**
- Cross-module usage must be via explicit, documented ES module imports/exports.

---

## 8. Example: ES Module Import/Export Pattern

```js
// Good:
import Konva from "konva";
import { buildSidebarPanel } from "./sidebar.js";

// Bad:
const stage = new window.Konva.Stage(...);   // ❌ Not allowed
window.Pickr.create(...);                    // ❌ Not allowed
import { something } from "./notExportedHere.js"; // ❌ Not allowed if not actually exported
```

---

## 9. Code Review Checklist

- [ ] All code delivered as full files.
- [ ] All dependencies imported as ES modules (no window/global usage).
- [ ] All imports correspond to real exports from their source.
- [ ] No references to CDN/global scripts in code or HTML.
- [ ] Updated `src/modules.index.md` if modules changed.
- [ ] Logging and documentation policies followed.
- [ ] Delivery workflow (list, one-by-one, explicit "all done") followed.

---

## 10. Example Delivery Workflow

1. List all files that require changes for ES module compliance.
2. Deliver each file, in full, one at a time.
3. Wait for explicit user confirmation after each.
4. After the final file, state "All done – ES module migration is complete."

---

_This contract is enforceable for all code and review activity in Scene Designer._
