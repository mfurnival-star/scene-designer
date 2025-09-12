# Scene Designer – Copilot Space Instructions (Summary)

This Copilot Space uses a professional, modular engineering approach, as detailed in SCENE_DESIGNER_MANIFESTO.md.

**Key Rules:**
- All logic is split into ES module files; no concatenation or global state except the exported `AppState`.
- All feature work and code delivery operate on complete files, not snippets.
- Canonical module load order is defined in `shapes.parts.index.md` (or `modules.index.md` for ES modules).
- Logging, file delivery, and review follow the standards set in COPILOT_MANIFESTO.md.
- For project goals and roadmap, see README.md.

**Always:**
- Respect modular boundaries and API contracts.
- Use standardized logging with proper levels and tags.
- Update the parts index file (`shapes.parts.index.md`) when files change.
- Refer to SCENE_DESIGNER_MANIFESTO.md for detailed policy and architecture.

(For details, see SCENE_DESIGNER_MANIFESTO.md and COPILOT_MANIFESTO.md in the repo root.)
