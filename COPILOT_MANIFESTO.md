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

## 2. **Modular Handling of `shapes.js` (and Related Application Logic)**

- The main application is split into modular part files (e.g., `shapes.part1.settings.js`, `shapes.part2a.konva.js`, etc.).
- These files are indexed in `shapes.parts.index.md` (the index).
- **When the user requests a code change or review for `shapes.js`:**
  - Copilot will refer to the index and identify the relevant individual part(s).
  - Copilot will deliver the full, complete code for the affected part file(s) only—not snippets or the concatenated `shapes.js`.
  - This allows the user to copy and paste each part into their server and concatenate them into the full file as needed.

---

## 3. **Maintaining the Parts Index**

- **Whenever Copilot makes changes to any part file**, the `shapes.parts.index.md` file will be updated to reflect:
  - New, removed, or renamed parts
  - Revised descriptions, key features, or responsibilities
  - Integration points and cross-part references, as appropriate

---

## 4. **General Principles**

- Copilot will always provide complete files for modular parts upon request or when making changes.
- Copilot will never provide partial snippets for modular files unless explicitly requested.
- The index will serve as the canonical reference for modular structure and responsibilities.

---

**This manifesto is intended as a living agreement.  
If user requirements or project structure change, update this file accordingly.**
