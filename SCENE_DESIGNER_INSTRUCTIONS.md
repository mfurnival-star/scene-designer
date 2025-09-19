# Scene Designer – Engineering & Review Instructions

These instructions are binding for all development, code review, and delivery in the Scene Designer project.

---

## 1. **ES Module Enforcement**

- All code must use ES module syntax for imports and exports.
- No use of window.*, global variables, or global libraries.
- External dependencies (e.g., Konva, Pickr, Golden Layout) must be imported as ES modules.

### 1A. **Transitional Exception: Remote Logging via Console.Re**

- **Remote log streaming must use the official Console.Re connector script:**
  ```html
  <script src="//console.re/connector.js" data-channel="scene-designer"></script>
  ```
- This ensures compatibility with the current Console.Re dashboard and captures early errors.
- The legacy npm UMD CDN (`console-remote-client`) is deprecated and MUST NOT be used except for backward compatibility with older builds.
- This exception is strictly for remote logging only.
- All other dependencies and code must remain ES module–only and avoid global/window usage.
- Remove this exception as soon as Console.Re provides a proper ES module export.

---

## 2. **Import/Export Consistency**

- Every import must be satisfied by a real export in the source file.
- Update the source or import as needed to ensure consistency.
- Enforce for all code changes and file deliveries.

---

## 3. **File Delivery and Review Workflow**

- All code delivery, review, and requests operate on complete files only (never snippets).
- File-by-file delivery workflow:
    1. List all files to be delivered up front, with explicit numbering (e.g., 1. fileA.js, 2. fileB.js, ...).
    2. Deliver each file, one at a time, in the order listed.
    3. After each file, state the name and number of the next file to expect (e.g., "Next file: 2. sidebar.js").
    4. Wait for explicit confirmation ("next", "ready", etc.) before delivering the next file.
    5. Keep a running list of remaining files/numbers in each reply until all are delivered.
    6. After all files, explicitly confirm completion (e.g., "All files delivered. Refactor complete.").
- If a module is added, removed, or renamed, update `src/modules.index.md`.

---

## 4. **File Size Policy and Splitting**

- No single file should exceed ~350 lines.
- If a file does, split into logical ES module parts (e.g., `settings-core.js`, `settings-ui.js`, or `settings.part1.js`, `settings.part2.js`).
- Each part should be ≤350 lines if possible.
- When splitting:
    - Prefer logical separation (core, UI, data, helpers, etc).
    - Each part must begin with a summary comment.
    - Update all imports/exports to use new modules.
    - Update `src/modules.index.md` to list all new files.
    - Document the split in the PR/commit summary.
- This policy is mandatory for all new code and for any refactoring of large files.

---

## 5. **Logging and Documentation**

- Use the shared logger (`log()`) from `log.js` with proper log levels and tags.
    - `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` (TRACE is very verbose; rarely used).
- Never use `console.log` directly except inside the logger implementation.
- Every module/file must begin with a comment summarizing purpose, exports, and dependencies.
- All cross-module communication must use ES module imports/exports.

---

## 6. **Example (Good/Bad)**

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

Refer to `SCENE_DESIGNER_MANIFESTO.md` for detailed philosophy and rules.

