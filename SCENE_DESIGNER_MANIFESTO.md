# Scene Designer – Engineering & Review Instructions (Zustand Refactor Edition)

These instructions are binding for all development, code review, and delivery in the Scene Designer project.

---

## 1. **ES Module Enforcement**

- All code must use ES module syntax for imports and exports.
- No use of `window.*`, global variables, or global libraries.
- External dependencies (e.g. Fabric.js, Tweakpane, Tabulator) must be imported as ES modules.
- **No CDN/global scripts.** All dependencies must be installed via npm and imported.

---

## 2. **Import/Export Consistency**

- Every import must be satisfied by a real export in the source file.
- Update the source or import as needed to ensure consistency.
- Enforce for all code changes and file deliveries.
- **State management uses exported functions and the Zustand-style store from `state.js`.**
    - **Do not import or reference a singleton `AppState` object.**
    - Use `getState()`, mutators, and the exported `sceneDesignerStore` object.

---

## 3. **File Delivery and Review Workflow**

- **All code delivery, review, and requests operate on complete files only (never snippets).**
- **File-by-file delivery workflow:**
    1. **List all files to be delivered up front, with explicit numbering (e.g., 1. fileA.js, 2. fileB.js, ...).**
    2. **Deliver each file, one at a time, in the order listed.**
    3. **After each file, state the name and number of the next file to expect (e.g., "Next file: 2. sidebar.js").**
    4. **Wait for explicit confirmation ("next", "ready", etc.) before delivering the next file.**
    5. **Keep a running list of remaining files and their numbers in each reply until all are delivered.**
    6. **After all files, explicitly confirm completion (e.g., "All files delivered. Refactor complete.").**
- **If a module is added, removed, or renamed, update `src/modules.index.md` accordingly.**

---

## 4. **File Size Policy and Splitting**

- No single file should exceed approximately 350 lines.
- If a file does, it must be split into logical ES module parts (e.g. `settings-core.js`, `settings-ui.js`, or `settings.part1.js`, `settings.part2.js`).
- Each part should be ≤350 lines if possible.
- When splitting:
    - Prefer splitting by logical concern (core, UI, data, helpers, etc).
    - Each part must begin with a summary comment.
    - Update all imports/exports to use new modules.
    - Update `src/modules.index.md` to list all new files.
    - Document the split in the PR/commit summary.
- This policy is mandatory for all new code and for any refactoring of large files.
- Do not split arbitrarily—each file must remain logically cohesive and independently testable.

---

## 5. **Logging and Documentation**

- Use the shared logger (`log()`) from `log.js` with proper log levels and tags.
    - `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` (TRACE is very verbose and rarely used).
- Never use `console.log` directly except inside the logger implementation.
- Every module/file must begin with a comment summarizing purpose, exports, and dependencies.
- All cross-module communication must use ES module imports/exports.

---

## 6. **State Management (Zustand-style, 2025 Update)**

- **All state flows through exported functions and the store object in `state.js`.**
    - Use `getState()` to access the current state object.
    - Use mutators like `setShapes`, `addShape`, `removeShape`, etc.
    - Subscribe to state changes via `sceneDesignerStore.subscribe(fn)`.
    - Do **not** import a singleton `AppState` object.
    - Example:
        ```js
        import { getState, setShapes } from "./state.js";
        // Usage: getState().shapes
        ```

---

## 7. **Action/Intent-Based Separation of Concerns (2025 Update)**

- **All UI components emit "intents" or "actions" to dedicated handler modules.**
    - Toolbar, keyboard shortcuts, and other panels DO NOT contain business logic for deletion, duplication, locking, etc.
    - All business logic for scene actions (delete, duplicate, lock, unlock, add shape, etc.) is centralized in `src/actions.js`.
    - UI emits an intent (e.g., `deleteSelectedShapes()`), and the actions module performs the logic.
    - This ensures:
        - Maximum separation of concerns
        - Swappable toolbars and input methods
        - Consistent business rules
        - Testable and maintainable code
    - See `src/toolbar.js` for an example: all shape/scene actions are routed via `actions.js`.

- **Cross-module communication always uses ES module imports/exports.**
    - Never directly mutate state or shape arrays from UI modules.

---

## 8. **Example (Good/Bad)**

```js
// Good: UI emits intent, logic is centralized
import { deleteSelectedShapes } from "./actions.js";
deleteSelectedShapes();

import { getState, setShapes } from "./state.js";
import { buildSidebarPanel } from "./sidebar.js";

// Bad: UI contains business logic
// (NOT ALLOWED)
deleteShapeBtn.addEventListener('click', () => {
  // ...directly mutating state, filtering shapes, etc.
});
```

---

## 9. **Manifest and Documentation Updates**

- All new modules (added/removed/renamed) must be reflected in `src/modules.index.md`.
- Update this file and module manifest as needed to document architecture changes.

---

Refer to **SCENE_DESIGNER_MANIFESTO.md** for the definitive engineering rules and architectural philosophy.

