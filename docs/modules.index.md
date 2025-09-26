# Module Index (Auto-Maintained Manually – Phase 2 Interim)

Purpose: Fast lookup of modules, their surface area role, and recent additions.  
Update this file whenever adding / removing / renaming a module (engineering rule #3).

Status Legend:
- NEW: Added in current or immediately prior batch.
- MOD: Recently modified in current batch (structural / API significance).
- STABLE: No structural changes this batch.

## Core / Infrastructure
| File | Status | Notes |
|------|--------|-------|
| log.js | STABLE | Central logging (levels: ERROR,WARN,INFO,DEBUG) |
| state.js | MOD | Holds sceneName, sceneLogic, imageURL/imageObj (scene commands now active) |
| fabric-wrapper.js | STABLE | ESM Fabric constructors wrapper |
| main.js | STABLE | Entry point (remote logging init) |
| layout.js | STABLE | MiniLayout bootstrap & dynamic rebuild |
| keybindings.js | STABLE | Undo/redo, movement & common shortcuts |
| history-panel.js | STABLE | History UI (raw command types listed) |

## Commands Layer
| File | Status | Notes |
|------|--------|-------|
| commands/command-bus.js | STABLE | dispatch / undo / redo / coalescing |
| commands/commands.js | STABLE | Dispatcher: scene → structure → style |
| commands/commands-structure.js | STABLE | Structural ops (add/delete/duplicate/move/selection/lock/align/transforms) |
| commands/commands-style.js | STABLE | Style ops (stroke/fill/strokeWidth) |
| commands/commands-scene.js | MOD | Scene ops: SET_IMAGE, SET_SCENE_NAME, SET_SCENE_LOGIC, SET_DIAGNOSTIC_LABEL_VISIBILITY (new) |

## Actions (Intent Layer – pending refactor to pure thin wrappers)
| File | Status | Notes |
|------|--------|-------|
| actions.js | MOD | Added setDiagnosticLabelsVisibility + prior scene wrappers |
| actions-alignment.js | STABLE | Align intent dispatch |

## Selection & Transformer
| File | Status | Notes |
|------|--------|-------|
| selection-core.js | STABLE | Dual-path selection (Fabric ↔ store) pre-Phase 3 |
| selection.js | STABLE | Public re-exports / window hooks |
| transformer.js | STABLE | Per-shape control visibility & circle scaling guard |
| canvas-events.js | STABLE | Fabric selection sync with suppression tokens |

## Geometry
| File | Status | Notes |
|------|--------|-------|
| geometry/shape-rect.js | STABLE | Canonical per-shape bbox/center/aspect/outerRadius |
| geometry/selection-rects.js | STABLE | Multi-selection member & hull rects |
| dev/geometry-sanity.js | STABLE | Dev validation script (not production bundled) |

## Shapes & Rendering
| File | Status | Notes |
|------|--------|-------|
| shapes-core.js | STABLE | Rect/Circle/Ellipse factories + stroke normalization |
| shapes-point.js | STABLE | Point reticle variants |
| shape-defs.js | STABLE | Shape transform/edit capabilities |
| shape-state.js | STABLE | Simple internal state flags |
| shapes.js | STABLE | Facade re-exports |
| canvas-core.js | STABLE | Fabric canvas lifecycle, background image application |
| canvas-constraints.js | STABLE | Movement clamping & lock-aware group moves |
| canvas-transform-history.js | STABLE | Gesture aggregation → SET_TRANSFORMS |

## Overlays & Visuals
| File | Status | Notes |
|------|--------|-------|
| selection-outlines.js | STABLE | Dashed hull + member boxes |
| loupe.js | STABLE | Magnifier overlay |
| loupe-controller.js | STABLE | Selection-aware loupe lifecycle |

## Toolbar
| File | Status | Notes |
|------|--------|-------|
| toolbar-panel.js | STABLE | Panel assembler |
| toolbar-dom.js | STABLE | DOM structure & element refs |
| toolbar-handlers.js | STABLE | Image operations now command-based (SET_IMAGE) |
| toolbar-state.js | STABLE | Button enable/disable & scale sync |
| toolbar-styles.js | STABLE | Injected styles (responsive) |
| toolbar-color.js | STABLE | Pickr integration (stroke/fill with coalescing) |

## Settings
| File | Status | Notes |
|------|--------|-------|
| settings-core.js | STABLE | Registry + persistence + logging reconfig |
| settings-ui.js | STABLE | Tweakpane UI |
| settings.js | STABLE | Facade re-exports |

## Serialization
| File | Status | Notes |
|------|--------|-------|
| serialization/scene-io.js | STABLE | Versioned scene (v1) serialize / deserialize |

## Debug / Diagnostics
| File | Status | Notes |
|------|--------|-------|
| debug.js | (Not shown here) | Debug snapshot collector |
| errorlog.js | (Not shown) | Error log panel sink |
| console-re-wrapper.js | (Not shown) | Remote logging bridge (temporary) |

## Phase 2 Additions / Changes (Recent Batches)
- commands/commands-scene.js (added earlier; now extended with SET_DIAGNOSTIC_LABEL_VISIBILITY)
- actions.js (scene command dispatchers + diagnostic labels intent)
- toolbar-handlers.js (image set/clear via commands)
- modules.index.md (this file) initialized then updated
- docs/PHASED_ARCHITECTURE_PATH.md (Phase 2 checklist – scene commands pending tick update next batch)

## Upcoming (Planned Next Batches)
- SELECT_ALL / DESELECT_ALL wrapper commands (decide explicit types vs alias to SET_SELECTION)
- Actions refactor (remove filtering; move validation into command executors)
- Inversion test harness (dev/commands-inversion-test.js)
- Optional BATCH meta-command
- Style command payload normalization + documented coalescing policy

## Notes
- Keep this index <500 lines; trim historical notes once Phase 2 finishes.
- Do not duplicate long-form architectural rationale here (see PHASED_ARCHITECTURE_PATH.md).
- When Phase 3 begins, add a section for Selection Adapter abstractions.

_Last updated: 2025-09-26 (Batch 3B – added SET_DIAGNOSTIC_LABEL_VISIBILITY, updated actions.js)_
