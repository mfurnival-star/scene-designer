# Scene Designer – Mermaid Architecture Diagram

This diagram shows the core modular structure, state/data flow, and main dependencies as of the 2025 engineering refactor.

```mermaid
---
config:
  layout: elk
---
flowchart TD
    %% Central State
    AppState["AppState (state.js)"]:::state

    %% UI Panels
    SidebarPanel["Sidebar Panel (sidebar.js)"]:::panel
    CanvasPanel["Canvas Panel (canvas.js)"]:::panel
    SettingsPanel["Settings Panel (settings.js)"]:::panel
    ToolbarPanel["Toolbar Panel (toolbar.js)"]:::panel
    ErrorLogPanel["Error Log Panel (errorlog.js)"]:::panel

    %% Selection and Transformer
    Selection["Selection Logic (selection.js)"]:::logic
    Transformer["Transformer Logic (transformer.js)"]:::logic

    %% Shape Logic
    ShapeFactory["Shape Factory (shapes.js)"]:::logic
    ShapeState["Shape State Machine (shape-state.js)"]:::logic
    ShapeDefs["Shape Definitions (shape-defs.js)"]:::logic

    %% Data & Logging
    Logging["Logger (log.js)"]:::logging
    SettingsRegistry["Settings Registry (settings.js)"]:::data

    %% Relationships
    SidebarPanel -->|uses| AppState
    CanvasPanel -->|uses| AppState
    SettingsPanel -->|uses| AppState
    ToolbarPanel -->|uses| AppState
    ErrorLogPanel -->|uses| AppState

    SidebarPanel -->|calls selection APIs| Selection
    CanvasPanel -->|calls selection APIs| Selection
    ToolbarPanel -->|calls selection APIs| Selection

    Selection -->|controls| Transformer
    Selection -->|sets state| ShapeState
    Selection -->|fetches config| ShapeDefs

    Transformer -->|reads config| ShapeDefs

    ShapeFactory -->|creates| ShapeState
    ShapeFactory -->|uses| ShapeDefs

    CanvasPanel -->|uses| ShapeFactory

    SettingsPanel -->|reads/writes| SettingsRegistry
    SettingsPanel -->|updates| AppState

    Logging -.->|used by all| AppState
    Logging -.->|used by all| SidebarPanel
    Logging -.->|used by all| CanvasPanel
    Logging -.->|used by all| SettingsPanel
    Logging -.->|used by all| ToolbarPanel
    Logging -.->|used by all| ErrorLogPanel
    Logging -.->|used by all| Selection
    Logging -.->|used by all| Transformer
    Logging -.->|used by all| ShapeFactory
    Logging -.->|used by all| ShapeState
    Logging -.->|used by all| ShapeDefs
    Logging -.->|used by all| SettingsRegistry

    %% Legend styles
    classDef panel fill:#f9f9ff,stroke:#2176ff,stroke-width:2px;
    classDef state fill:#f0fff0,stroke:#009c51,stroke-width:2px;
    classDef logic fill:#fffbe8,stroke:#d2a800,stroke-width:2px;
    classDef data fill:#f0f8ff,stroke:#0a5db6,stroke-width:2px;
    classDef logging fill:#fff0f0,stroke:#e53935,stroke-width:2px;
```

---

**How to read:**
- **AppState** is the central state singleton; all panels and logic modules interact only via exported APIs.
- **UI panels** (Sidebar, Canvas, Settings, Toolbar, ErrorLog) communicate with the state and selection APIs, never directly with each other.
- **Selection.js** centrally manages selection and transformer lifecycle.
- **transformer.js** is only invoked by selection.js.
- **Shape creation, config, and state** are separated into factory, definitions, and state machine modules.
- **Logging** is shared across all modules.
- **Settings** flow through the registry and SettingsPanel.

---

_You can render this diagram in any Mermaid-enabled Markdown viewer (e.g. GitHub, VSCode, Obsidian, Mermaid Live Editor)._

