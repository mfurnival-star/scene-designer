```filelist
log.js
console-stream.js
global-errors.js
state.js
canvas.js
selection.js
sidebar.js
settings.js
layout.js
errorlog.js
main.js
```

---

- **log.js**  
  Centralized, pluggable logging system for Scene Designer.  
  All logs use `log()`; supports runtime config, pluggable sinks, and safe serialization.

- **console-stream.js**  
  Console method interception for streaming all console logs (log/error/warn/info/debug/trace) via logger.

- **global-errors.js**  
  Global error and unhandled promise rejection handler; forwards all browser-level errors to logger.

- **state.js**  
  Centralized AppState singleton and state management.

- **canvas.js**  
  Konva canvas and shape creation APIs.

- **selection.js**  
  Shape selection logic and mutators.

- **sidebar.js**  
  Shape table/list panel (Golden Layout, Tabulator implementation as of latest revision).

- **settings.js**  
  Settings registry, persistence (via localForage), and UI panel (GL, Tweakpane+Pickr).

- **layout.js**  
  Golden Layout bootstrapping and panel registration.

- **errorlog.js**  
  Error log panel (Golden Layout), log sink for all error/info/debug messages.

- **main.js**  
  App entry point (if NOT using Golden Layout).

---
**Instructions:**  
Keep this file updated per SCENE_DESIGNER_MANIFESTO.md.
