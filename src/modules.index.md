```filelist
log.js
state.js
canvas.js
selection.js
main.js
```

---

- **log.js**  
  Centralized logging system for Scene Designer.  
  - Provides `log()`, log level/destination, external streaming hooks.
  - Used by all modules for standardized logging.

- **state.js**  
  Centralized `AppState` singleton and state management API.  
  - Holds all model data: shapes, selection, scene, settings.
  - Provides subscription/event system for state changes.

- **canvas.js**  
  Konva canvas initialization, image background, and shape factories.  
  - Sets up Konva stage/layer, loads images, creates shapes.
  - Exports shape creation, add/remove APIs.

- **selection.js**  
  Shape selection logic for single/multi-select.  
  - Exports selection mutators and helpers.
  - Used by sidebar, toolbar, and canvas.

- **main.js**  
  Entry point for the app (when NOT using Golden Layout).  
  - Wires up modules, initializes UI, connects handlers.

---

**When you add Golden Layout:**
- Add `layout.js` to this index (as the new entry point).
- Add `sidebar.js` and `settings.js` as you modularize those panels.

---

**Instructions:**
- Place this file in your `src/` directory.
- Update it whenever you add, remove, or rename module files, per SCENE_DESIGNER_MANIFESTO.md.

