# Scene Designer: ES Modules Engineering Manifesto

> **Reference:**  
> This document is the single source of truth for Scene Designer architecture, code review, and delivery.  
> All contributors must adhere to these rules for all code, documentation, and review.

---

## 1. Vision

Build a modular, professional, maintainable scene annotation tool for ADB automation using only ES modules for all code and dependencies.

---

## 2. ES Module & Import/Export Policy

- **All project code and dependencies must use ES module syntax (`import`/`export`).**
- **No file may reference any global (`window.*`) variable, function, or library (e.g., `window.Konva`, `window.Pickr`).**
    - If a library is needed, it must be imported as an ES module.
    - CDN/global scripts (e.g., `<script src="...">`) are forbidden for anything used in code.
- **Every cross-file dependency must be imported explicitly.**
    - If a file needs a function, it must be exported from its source and imported where used.
    - If an import is not exported by the source, update the source to export it, or update the importing file to use the correct source.
- **No global state is permitted except for the exported `AppState` from `state.js`.**
- **All cross-module communication must be via ES module imports/exports.**

---

## 3. File Delivery, Review, and Change Policy

- **All code requests, reviews, and deliveries must be for full files, never code snippets or diffs.**
- **All deliveries and reviews must comply with the explicit file-by-file workflow:**
    1. **List all files that require changes up front.**
    2. **Deliver each file, one at a time, in the order listed.**
    3. **After each file, state the name of the next file to expect, e.g., "Next file: `src/sidebar.js`".**
    4. **Wait for explicit user confirmation ("next", "ready", etc.) before delivering the next file.**
    5. **Keep a list of remaining files in each reply until all are delivered.**
    6. **After all files are delivered, explicitly confirm completion (e.g., "All done – ES module migration is complete").**
- **If a module is added, removed, or renamed, update `src/modules.index.md` accordingly.**
- **All code delivery, review, and requests operate on complete files, never snippets.**

---

## 4. File Size and Splitting Policy

- **No single file should exceed approximately 350 lines.**
- **If a file grows beyond 350 lines, it must be split into logically separated ES module files (e.g., `settings.part1.js`, `settings.part2.js`, or `settings-core.js`, `settings-ui.js`).**
- **Each part should be ≤350 lines if possible.**
- **When splitting:**
    - Prefer splitting by logical concern (core logic, UI/panel, data, helpers, etc).
    - Each split file must have a clear summary comment at the top.
    - Update all imports/exports to use the new module parts.
    - Update `src/modules.index.md` to reflect all new files.
    - Document the split in the commit or pull request summary.
- **File splitting is mandatory for all new code and for any refactoring where a file exceeds this size.**
- **Do not split arbitrarily—ensure each file remains logically cohesive and independently testable.**

---

## 5. Logging Policy (MANDATORY)

- **All modules must use the shared logger, `log()`, with standardized log levels:**
    - `ERROR` – Unexpected or fatal failures
    - `WARN` – Recoverable or suspicious situations
    - `INFO` – Major app events, module/component init, user actions
    - `DEBUG` – Internal state changes, logic flow, useful during development
    - `TRACE` – Function entry/exit, extremely verbose, for deep diagnostics (rarely used)
- **Logging must always be via ES module import, never via global.**
- **No direct use of `console.log` except inside the logger implementation itself.**
- **All key state changes, user actions, and panel/component inits must be logged at INFO or DEBUG as appropriate.**
- **TRACE is expected to be very noisy and is reserved for deep diagnostics only.**
- **Every future module or code addition must follow this logging policy.**

---

## 6. Documentation & API Contract

- **Every module/file starts with a JSDoc-style or Markdown comment summarizing:**
    - Its responsibilities
    - Exports
    - Dependencies
- **All cross-module usage is via explicit, documented ES module imports/exports.**
- **All new modules must adhere to this documentation standard.**

---

## 7. File and Module Structure

- All logic is organized into ES module files under `src/`.
- Each module:
    - Exports only what is necessary.
    - Imports dependencies explicitly using ES module syntax.
    - May depend on the central `AppState` from `state.js`.
    - **Must not import or use any window/global variable, function, or library.**
- All library dependencies (e.g., Konva, Pickr, Golden Layout) must be installed as npm packages and imported as ES modules.
- **No reliance on CDN scripts or window-attached properties is permitted.**

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

## 9. Review Checklist

- [ ] All code delivered as full files.
- [ ] All dependencies imported as ES modules (no window/global usage).
- [ ] All imports correspond to real exports from their source.
- [ ] No references to CDN/global scripts in code or HTML.
- [ ] Updated `src/modules.index.md` if modules changed.
- [ ] Logging and documentation policies followed.
- [ ] Delivery workflow (list, one-by-one, next file named, explicit "all done") followed.
- [ ] **No single file exceeds 350 lines; split as per policy if needed.**

---

## 10. Example Delivery Workflow

1. List all files that require changes for ES module or logging compliance.
2. Deliver each file, in full, one at a time.
3. After each file, explicitly mention the name of the next file to expect.
4. Wait for explicit user confirmation after each.
5. After the final file, state "All done – ES module migration is complete."

---

_This contract is enforceable for all code, review, and documentation in Scene Designer._
