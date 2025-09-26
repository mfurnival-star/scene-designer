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
| state.js | STABLE | Scene metadata + background image + settings store |
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
| commands/commands-structure.js | STABLE | SELECT_ALL / DESELECT_ALL wrapper commands |
| commands/commands-style.js | MOD | **Batch 6:** Style commands now require items[] payload; legacy forms rejected. |
| commands/commands-scene.js | STABLE | Scene ops (image, name, logic, diagnostic labels) |

## Actions (Intent Layer)
| File | Status | Notes |
|------|--------|-------|
| actions.js | MOD | **Batch 6:** setStrokeColorForSelected, setFillColorForSelected, setStrokeWidthForSelected now emit items[] payload. |
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
| toolbar-handlers.js | STABLE | Select All now via command for history entry |
| toolbar-state.js | STABLE | Button enable/disable + scale sync |
| toolbar-styles.js | STABLE | Toolbar CSS injection |
| toolbar-color.js | MOD | **Batch 6:** Color pickers now call setStrokeColorForSelected/setFillColorForSelected with items[] payload. |

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

## Batch 6: Style Payload Normalization (items[] only)
- commands/commands-style.js: Now requires items[] array for style commands (SET_STROKE_COLOR, SET_FILL_COLOR, SET_STROKE_WIDTH). Legacy payloads (ids + color/fill/width) are rejected (LEGACY_PAYLOAD reason).
- actions.js: setStrokeColorForSelected, setFillColorForSelected, setStrokeWidthForSelected now build items[] payload directly from current selection. No legacy mode remains.
- toolbar-color.js: Color pickers now pass items[] to actions; selectionless updates still set defaults.
- PHASED_ARCHITECTURE_PATH.md: Checklist ticked, schema added.
- modules.index.md: This file updated (MOD).

_Keep this index <500 lines; trim “Recent Batches” after Phase 2 closure._

_Last updated: 2025-09-26 (Batch 6 – style payload normalization, items[] only)_
