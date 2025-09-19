# MiniLayout – Scene Designer Native Layout Engine

> Minimal, GL-inspired layout manager for Scene Designer.  
> Drop-in ES module alternative to Golden Layout for panel/row/column/stacks, with draggable splitters and compact headers.

---

## File Manifest

```filelist
minilayout.js
minilayout-ui.js
minilayout.demo.js
minilayout.css
minilayout.DOCS.md
```

---

## File Purpose Overview

- **minilayout.js**  
  Main MiniLayout engine (layout tree, panel logic, splitters, tab/stack, header, close, resizing).
  - **Panel size persistence:** Splitter drag changes are now saved/restored via localStorage. Panel proportions are remembered between reloads.

- **minilayout-ui.js**  
  *Advanced UI helpers for MiniLayout.*  
  - Splitter bars (animated, ARIA, pixel sizing, callbacks)
  - Custom tab bars with accessibility
  - Panel transition/animation helpers
  - Accessibility utilities

- **minilayout.demo.js**  
  Demo bootstrapping for MiniLayout (panel registration, layout config, stub factories).
  - Use for testing, not needed in production.

- **minilayout.css**  
  Styles for MiniLayout panels, splitters, tabs, headers.
  - Some additional UI styles are injected by minilayout-ui.js.

- **minilayout.DOCS.md**  
  Documentation and API reference (this file).

---

## Overview

MiniLayout is a minimal, ES module–only layout engine for Scene Designer and similar apps.  
It supports rows, columns, stacks (tabs), and component panels—each with configurable headers, drag-to-resize splitters, and a robust event API.

- **No globals:** All usage is via ES module imports/exports.
- **No window/global dependencies.**  
- **Log everything via `log.js` (see Logging section).**
- **API is GL-v3–inspired:** Each panel/component factory receives `{element, title, componentName}`.

---

## Installation & Setup

**1. Import as ES module:**

```js
import { MiniLayout } from './minilayout.js';
import { log } from './log.js'; // Required for logging
// Optional: Import UI helpers if needed
import * as MiniLayoutUI from './minilayout-ui.js';
```

**2. Provide a root container:**

```html
<div id="ml-root"></div>
```

**3. Instantiate and initialize:**

```js
const layoutConfig = { /* see below */ };
const container = document.getElementById("ml-root");
const layout = new MiniLayout(layoutConfig, container);
layout.registerComponent('SidebarPanel', buildSidebarPanel); // Register factories
layout.init();
```

---

## Layout Configuration

The config is a nested object describing the layout tree:

```js
const panelLayoutConfig = {
  root: {
    type: 'column',
    content: [
      {
        type: 'row',
        content: [
          { type: 'component', componentName: 'SidebarPanel', ... },
          { type: 'column', content: [ ... ] },
          { type: 'component', componentName: 'SettingsPanel', ... }
        ]
      },
      { type: 'component', componentName: 'ErrorLogPanel', ... }
    ]
  }
};
```

- **Top-level** must be `{ root: { ... } }`.
- **Types:** `'row'` (horizontal), `'column'` (vertical), `'stack'` (tabs), `'component'` (panel).
- **Panel options:** `title`, `componentName`, `width`, `height`, `closable`, `headerHeight`, `headerFontSize`.

---

## Component Registration

Register each panel/component factory before calling `init`:

```js
layout.registerComponent('SidebarPanel', buildSidebarPanel);
layout.registerComponent('SettingsPanel', buildSettingsPanel);
// ...etc
```

Each factory receives:

```js
function buildSidebarPanel({ element, title, componentName }) {
  // Render the panel using `element` as the root
}
```

---

## Splitter Bars & Drag-to-Resize

- **Splitters** are automatically inserted between row/column children.
- **Drag-to-resize**:  
  - Click and drag splitter bars (vertical for columns, horizontal for rows).
  - Adjacent panels resize proportionally (flex `%`).
  - No scrollbars; all sizing is contained.

---

### Panel Size Persistence (NEW: 2025-09-19)

- **Splitter drag changes are now saved/restored via localStorage.**
- When you drag to resize any panel using a splitter, the new proportions (width/height %) are stored per panel path.
- On reload, MiniLayout restores the last user-set panel sizes automatically.
- No configuration required—works out-of-the-box.

**Implementation details:**
- Panel sizes are keyed by layout tree path and component name.
- Storage uses localStorage under the key `sceneDesignerPanelSizes`.
- If the layout config changes (e.g., new/removed panels), missing panels are ignored, and only valid sizes are restored.

---

## Panel Headers & Tabs

- **GL-inspired:** Panel headers are compact, with a "tab" effect and optional close button.
- **Customizable:**  
  - `headerHeight` (px), `headerFontSize` (CSS), `closable` (`true`/`false`).
- **Stacks:**  
  - Use `{ type: "stack", content: [ ... ] }` for tabbed panels.
  - Tabs switch between panels; only one shown at a time.

---

## Destroying Layout

```js
layout.destroy(); // Removes all panels and cleans up
```

---

## Logging

All major events, panel creation, and errors are logged via `log.js`:

- Use `log(level, message, ...)`
- Levels: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE`

---

## Styling & Customization

- **CSS is injected automatically** if not already present.
- For custom themes, override `.minilayout-panel`, `.minilayout-panel-header`, `.minilayout-splitter`, etc.
- Responsive: Adapts to screen size.

---

## Advanced UI Helpers (`minilayout-ui.js`)

### Purpose

Provides advanced UI features for MiniLayout, including:

- Custom splitter bars (`buildSplitter`)
- Accessible/tab bar rendering (`buildTabBar`)
- Panel transition/animation helpers (`applyPanelAnimation`)
- Accessibility utilities (`focusPanelHeader`, `applyAria`)
- Injects additional UI styles for splitters/tabs

### API Reference

| Export                  | Description                                                      |
|-------------------------|------------------------------------------------------------------|
| `buildSplitter`         | Create advanced splitter bar (vertical/horizontal, ARIA, callbacks) |
| `buildTabBar`           | Create accessible tab bar for stack panels                       |
| `applyPanelAnimation`   | Animate panel transitions (fade, expand, etc)                    |
| `focusPanelHeader`      | Set focus for accessibility after tab change/close               |
| `applyAria`             | Add ARIA roles/attributes to elements                            |

#### Example Usage

```js
import { buildSplitter, buildTabBar } from './minilayout-ui.js';

// Use in your custom panel/component logic for more advanced UI
const splitter = buildSplitter("row", parentEl, idx, path, (lSize, rSize) => {...});
const tabBar = buildTabBar(panels, activeTabIdx, (newIdx) => {...});
```

- All helpers use `log()` for debugging and info.
- Use in place of or alongside default MiniLayout splitters/tabs for more advanced UI.

---

## Demo & Testing

- See `minilayout.demo.js` for sample usage, dynamic panel registration, tab/splitter demo.
- Not required for main app; use for testing and prototyping.

---

## Troubleshooting

- **Panels not resizing:** Confirm splitters are present and adjacent panels are direct siblings.
- **No panel appears:** Check that `registerComponent` was called for each `componentName`.
- **Header or close button missing:** Check `closable` and header config in your panel node.
- **Drag-to-resize not working:** Inspect splitter bar logic; ensure previous/next siblings are correct.
- **Panel sizes not restored:** Confirm localStorage is available (not disabled in browser or incognito).
- **Advanced UI features not working:** Confirm you imported `minilayout-ui.js` and called the helpers.

---

## Changelog

- **2024-06**: Initial release: row/column/stack/component, draggable splitters, compact headers, tab bar, close button.
- **2024-09**: Added advanced UI helpers in `minilayout-ui.js` (ARIA, animated splitters, accessible tab bars).
- **2025-09**: **Panel size persistence:** Splitter drag changes are now saved/restored via localStorage.

---

## See Also

- `src/minilayout.js` – Main engine
- `src/minilayout-ui.js` – Advanced UI helpers
- `src/minilayout.demo.js` – Demo entry
- `src/minilayout.css` – CSS (auto-injected)
- `src/log.js` – Logging system

---

## License

MIT

---

**For updates, see `src/modules.index.md` and `SCENE_DESIGNER_MANIFESTO.md`.**

