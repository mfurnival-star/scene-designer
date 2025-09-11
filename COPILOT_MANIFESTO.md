# Copilot Collaboration Manifesto

This file defines the working agreement between the user (`mfurnival-star`) and GitHub Copilot for code requests, modularization, and update practices in this repository.

---

## 1. **Full File Delivery on Request**

- **When the user requests a code change, review, or output for any of the following:**
  - `index.html`
  - `styles.css`
- **Copilot will always supply the complete, current file**—not just a snippet or diff.  
  This ensures the user can copy and replace the whole file if desired.

---

## 2. **Explicit File List Index for Modular Parts**

- The main application (`shapes.js`) is split into modular part files (e.g., `shapes.logstream.js`, `shapes.layout.js`, etc.).
- **The canonical order of these part files is defined by a `filelist` code block in `shapes.parts.index.md`.**
- **All code requests, reviews, and concatenation must refer to the file order in the index’s `filelist` block.**
- **Whenever a new part is added, removed, or reordered, the `filelist` in `shapes.parts.index.md` must be updated accordingly.**
- **File naming is otherwise unconstrained (no numbers or letters needed). Order is determined solely by the index filelist.**
- The `filelist` block in `shapes.parts.index.md` is always the authoritative list of files to be concatenated for `shapes.js`.

**Example (the real list is always in the index):**
```filelist
shapes.logstream.js
shapes.layout.js
shapes.handlers.js
shapes.sidebar.js
shapes.konva.js
shapes.multiselect.js
shapes.settings.js
```

---

## 3. **Maintaining the Parts Index**

- **Whenever Copilot makes changes to any part file**, the `shapes.parts.index.md` file will be updated to reflect:
  - New, removed, or renamed parts
  - Revised descriptions, key features, or responsibilities
  - Integration points and cross-part references, as appropriate
- **The `filelist` block must always be kept up to date.**
- **If the filelist is not updated, the modular build and code review process may break.**

---

## 4. **General Principles**

- Copilot will always provide complete files for modular parts upon request or when making changes.
- Copilot will never provide partial snippets for modular files unless explicitly requested.
- The index will serve as the canonical reference for modular structure and responsibilities.
- When multiple files are being changed, Copilot will send one per message, waiting for the user to ask for the next by saying "ready" or similar.

---

## 5. **Modular Part Identification & Versioning**

- **Every modular part file delivered or updated by Copilot will include a unique marker comment at the top,**  
  e.g. `// COPILOT_PART_logstream: 2025-09-11T18:13:00Z`
- This timestamp or marker is unique to each delivery so the user can confirm which version is being used after concatenation.

---

**This manifesto is intended as a living agreement.  
If user requirements or project structure change, update this file accordingly.**
