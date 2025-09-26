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
| state.js | MOD | Scene metadata + background image + settings store |
| fabric-wrapper.js | STABLE | ESM Fabric constructors wrapper |
| main.js | STABLE | Entry (remote logging init) |
| layout.js | STABLE | MiniLayout bootstrap & dynamic rebuild |
| keybindings.js | STABLE | Undo/redo, movement & common shortcuts |
| history-panel.js | STABLE | History UI (raw command types listed) |

## Commands Layer
| File | Status | Notes |
|------|--------|-------|
| commands/command-bus.js | STABLE | dispatch / undo / redo / coalescing |
| commands/commands.js | STABLE | Dispatcher: scene → structure → style |
| commands/commands-structure.js | MOD | Added SELECT_ALL / DESELECT_ALL wrapper commands |
| commands/commands-style.js | STABLE | Style ops (stroke/fill/strokeWidth) |
| commands/commands-scene.js | MOD | Scene ops (image, name, logic, diagnostic labels) |

## Actions (Intent Layer – pending full thin-refactor)
| File | Status | Notes |
|------|--------|-------|
| actions.js | MOD | Added selectAllCommand / deselectAllCommand wrappers |
| actions-alignment.js | STABLE | Align intent dispatch |

## Selection & Transformer
| File | Status | Notes |
|------|--------|-------|
| selection-core.js | STABLE | Dual-path selection (pre-Phase 3) |
| selection.js | STABLE | Public selection facade |
| transformer.js | STABLE | Transformer attach/update (circle scale guard) |
| canvas-events.js | STABLE | Fabric ↔ store selection sync (token suppression) |

## Geometry
| File | Status | Notes |
|------|--------|-------|
| geometry/shape-rect.js | STABLE | Canonical bbox/center/aspect/outerRadius |
| geometry/selection-rects.js | STABLE | Multi-selection member & hull rects |
| dev/geometry-sanity.js | STABLE | Dev validation script |

## Shapes & Rendering
| File | Status | Notes |
|------|--------|-------|
| shapes-core.js | STABLE | Rect/Circle/Ellipse factories + stroke normalization |
| shapes-point.js | STABLE | Point reticle variants |
| shape-defs.js | STABLE | Per-shape transform/edit capabilities |
| shape-state.js | STABLE | Per-shape state tracking |
| shapes.js | STABLE | Facade re-exports |
| canvas-core.js | STABLE | Canvas lifecycle + background image adaptation |
| canvas-constraints.js | STABLE | Movement clamping & lock-aware dragging |
| canvas-transform-history.js | STABLE | Gesture aggregation → SET_TRANSFORMS |

## Overlays & Visuals
| File | Status | Notes |
|------|--------|-------|
| selection-outlines.js | STABLE | Hull + member overlay painter |
| loupe.js | STABLE | Magnifier overlay |
| loupe-controller.js | STABLE | Loupe anchoring & settings integration |

## Toolbar
| File | Status | Notes |
|------|--------|-------|
| toolbar-panel.js | STABLE | Panel assembler |
| toolbar-dom.js | STABLE | DOM structure & refs |
| toolbar-handlers.js | MOD | Now dispatches SELECT_ALL command (history-backed) |
| toolbar-state.js | STABLE | Button enable/disable + scale sync |
| toolbar-styles.js | STABLE | Toolbar CSS injection |
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
| serialization/scene-io.js | STABLE | Versioned scene serialize/deserialize (v1) |

## Debug / Diagnostics
| File | Status | Notes |
|------|--------|-------|
| debug.js | (Not listed earlier) | Debug snapshot collector |
| errorlog.js | (Not listed) | Error log panel sink |
| console-re-wrapper.js | (Not listed) | Remote logging bridge (temp) |

## Phase 2 Additions / Changes (Recent Batches)
- commands/commands-scene.js (scene commands: SET_IMAGE, SET_SCENE_NAME, SET_SCENE_LOGIC, SET_DIAGNOSTIC_LABEL_VISIBILITY)
- actions.js (scene command intents + diagnostic label visibility; now selection wrapper intents)
- commands/commands-structure.js (added SELECT_ALL / DESELECT_ALL command types)
- toolbar-handlers.js (Select All now via command for history entry)
- modules.index.md (this file)
- docs/PHASED_ARCHITECTURE_PATH.md (checklist progressing)

## Implemented Selection Wrapper Commands
- SELECT_ALL: Captures previous selection; inverse is SET_SELECTION (prev IDs)
- DESELECT_ALL: Captures previous selection; inverse is SET_SELECTION (prev IDs)
(Note: Toolbar wired for SELECT_ALL; Escape key → DESELECT_ALL TBD)

## Upcoming (Planned Next Batches)
- Actions refactor (move filtering/validation into command executors)
- Style command payload normalization + explicit coalescing policy doc in command-bus.js
- Inversion test harness (dev/commands-inversion-test.js)
- Optional BATCH meta-command decision (implement or defer)
- History panel friendly label mapping (cosmetic)
- Phase 2 completion docs pass

## Notes
- Keep this index <500 lines; trim “Recent Batches” section after Phase 2 closure.
- Architectural rationale lives in docs/PHASED_ARCHITECTURE_PATH.md.
- Phase 3 will introduce a Selection Adapter section once store → Fabric becomes one-way.

_Last updated: 2025-09-26 (Batch 4 – selection wrapper commands integrated)_
