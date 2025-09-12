# Scene Designer: Engineering Manifesto

> **Historical Reference:**  
> This document builds on and supersedes the collaboration and modularization practices established in `COPILOT_MANIFESTO.md`.  
> It is directly informed by the project goals, requirements, and UX principles set out in `README.md`.  
> For logging, modular delivery, and code review practices, see `COPILOT_MANIFESTO.md`.  
> For the product roadmap, feature set, and UX plans, see `README.md`.  

---

## 1. Vision & End Goals

- **Primary Goal:**  
  Build a robust, extensible, modular, and professional scene annotation tool for ADB automation, supporting `.ini`/config export and a streamlined, maintainable UX.

- **Key Features (as per README.md):**
  - Image upload/selection and background management
  - Point, rectangle, and circle annotation with color sampling
  - Multi-select, group drag, locking, and robust selection logic
  - Shape table/sidebar with labeling, lock, color
  - Scene naming and AND/OR logic
  - Export as `.ini` (with future JSON support)
  - Settings/config panel, persistent settings
  - Advanced: loupe, color sampling, import, undo/redo, etc.

- **Design Principles (from README.md):**
  - Concise, clean, and discoverable UI
  - Fast, safe annotation with minimal click friction
  - Table-driven shape overview and editing
  - Future extensibility for new shape types and export formats

---

## 2. Principles

- **Explicit Modularity**:  
  All logic is split into ES module files with clear imports/exports.  
  No concatenation, no global state except the top-level `AppState` exported by `state.js`.

- **Single Source of Truth**:  
  All shape, selection, and scene data lives in `AppState`.  
  No duplicated or hidden state.

- **Full File Delivery**:  
  All code reviews, updates, and requests operate on complete files—never snippets or diffs.

- **Explicit, Documented APIs**:  
  Every module exports a clear, documented API surface. All cross-module communication uses these APIs.

- **Testability and Extensibility**:  
  Features are testable in isolation and easy to extend or swap out.

- **Robust Logging**:  
  Every module uses the standardized logging scheme, with levels: ERROR, WARN, INFO, DEBUG, TRACE.

- **Professional Code Review and Change Management**:  
  All file/module changes are reviewed for modularity, clarity, and adherence to this manifesto.

- **Import/Export Consistency**:  
  **Whenever a file imports a function, class, or variable from another, it must actually be exported from that source file.  
  If not, update the source file to export it, or update the importing file to use the correct source.  
  This must be checked and enforced for all code requests and file deliveries.**

---

## 3. File and Module Structure

- All logic is organized into ES module files under `src/` (or equivalent).
- Each module:
  - Exports only what is needed.
  - Imports dependencies explicitly from other modules.
  - May depend on a central `state.js` for data and event subscriptions.
  - **Must only import functions, classes, or variables that are actually exported by the source module.**
  - **If an import is not exported by the source, update the source to export it, or correct the import.**
- The canonical list of modules and their order is declared in `src/modules.index.md`.

---

## 4. State and Data Management

- The only global state is the exported `AppState` object from `state.js`.
- All shape, selection, scene, and config data flows through `AppState`.
- Modules may subscribe to changes in `AppState` via a documented event or observer pattern.

---

## 5. Logging

- All modules log via a shared logger (see COPILOT_MANIFESTO.md).
- Log levels: ERROR, WARN, INFO, DEBUG, TRACE.
- Logs include module/feature tags and relevant data.
- Log level and destination (console/server) are configurable at runtime.

---

## 6. Cross-Module Communication

- No cross-file globals except for the `AppState` singleton.
- All cross-module usage is via ES module imports/exports.
- Modules must never mutate another module’s state directly—use exported APIs or event subscriptions.
- **All imports must correspond to real exports in the source file. If not, fix the import or the export.**

---

## 7. File Delivery and Updates

- All code delivery is by complete file, never snippets.
- Any time a module is added, removed, or renamed, update `src/modules.index.md`.
- All exports and API changes must be reflected in module-level JSDoc comments.
- **All imports must be checked for correspondence to actual exports. If needed, update the imports or add the appropriate exports.**

---

## 8. Review and Change Policy

- All non-trivial feature changes, refactors, or bugfixes must be reviewed for:
  - File/module boundaries.
  - Logging coverage.
  - API stability and clarity.
  - Adherence to this manifesto.
  - **Import/export consistency and correctness.**

---

## 9. Documentation

- Every module/file starts with a JSDoc-style or Markdown comment summarizing its responsibilities, exports, and dependencies.
- The `SCENE_DESIGNER_MANIFESTO.md` is a living document—update as new needs, features, or lessons emerge.

---

## 10. Modules List (Canonical Load Order)

```filelist
log.js
state.js
canvas.js
selection.js
sidebar.js
toolbar.js
settings.js
export.js
loupe.js
main.js
```

---

## 11. Sample Logging Call

```js
log("INFO", "[selection] Multi-drag started", {shapeIDs: AppState.selectedShapes.map(s => s.id)});
```

---

## 12. Example Module API Doc

```js
/**
 * selection.js
 * Handles all selection, multi-select, group drag, highlight logic.
 * Exports:
 *   - setSelectedShapes(arr)
 *   - selectAllShapes()
 *   - attachSelectionHandlers(shape)
 *   - onMultiDragStart(evt), onMultiDragMove(evt), onMultiDragEnd(evt)
 * Depends on:
 *   - AppState from state.js
 *   - log() from log.js
 */
```

---

## 13. Historical Notes

This document replaces the modular concatenation system described in `COPILOT_MANIFESTO.md`.  
All lessons, practices, and log-level policies from COPILOT_MANIFESTO.md are maintained and extended here.  
For product direction and design rationale, see `README.md`.

---

## 14. Import/Export Consistency Rule (2025-09-12)

**Rule:**  
> For all code requests and deliveries, if a file imports a function, class, or variable from another, it must actually be exported from that source file. If not, update the source file to export it, or update the importing file to use the correct source. This must be checked and enforced for all code requests and file deliveries.

---

*This manifesto is a living contract. Update it as you learn, grow, and expand the project!*
