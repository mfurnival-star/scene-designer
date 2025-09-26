# Module Index (Auto-Maintained Manually – Phase 2 Interim)

Purpose: Fast lookup of modules, their surface area role, and recent additions / hotfixes.  
Update this file whenever adding / removing / renaming a module (engineering rule #3).

Status Legend:
- NEW: Added in current or immediately prior batch.
- MOD: Recently modified in current batch (structural / API significance or logic hotfix).
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
| commands/commands-structure.js | STABLE | Structural + selection + transforms |
| commands/commands-style.js | MOD | Batch 6: items[] payload only; legacy forms rejected (LEGACY_PAYLOAD). |
| commands/commands-scene.js | STABLE | Scene ops (image, name, logic, diagnostic labels) |

## Actions (Intent Layer)
| File | Status | Notes |
|------|--------|-------|
| actions.js | MOD | Batch 6: style actions emit items[] payload; still thin with early UX logs. |
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
| toolbar-handlers.js | STABLE | Select All via command for history entry |
| toolbar-state.js | STABLE | Button enable/disable + scale sync |
| toolbar-styles.js | STABLE | Toolbar CSS injection |
| toolbar-color.js | MOD | Batch 6 + Hotfix: items[] normalization; HOTFIX restored full file & fixed applyStroke/applyFill to pass plain color / rgba to actions (removed incorrect items[] argument). |

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
| debug.js | STABLE | Debug snapshot collector |
| errorlog.js | STABLE | Error log panel sink |
| console-re-wrapper.js | STABLE | Remote logging bridge (temporary) |

## Documentation
| File | Status | Notes |
|------|--------|-------|
| docs/PHASED_ARCHITECTURE_PATH.md | MOD | Batch 6: style payload normalization ticked; schema + reason codes updated. |
| docs/SCENE_DESIGNER_MANIFESTO.txt | STABLE | Core engineering rules (Rule 8 Hybrid policy adopted). |

---

### Recent Batch / Hotfix Summary
- Batch 6: Style payload normalization (items[] only) across commands-style/actions/toolbar-color.
- Hotfix (post Batch 6): Replaced incomplete toolbar-color.js (previous placeholder utilities) with full implementation; corrected regression (passing items[] to actions instead of plain color/fill string).

### Upcoming (Planned Modifications)
- Batch 7: Inversion test harness (will add dev/commands-inversion-test.js).
- Batch 8: BATCH meta-command decision (may introduce commands/commands-meta.js).
- Batch 9: History panel friendly labels (likely history-label-map module or extension of history-panel).

_Keep this index <500 lines; prune batch history notes after Phase 2 closure._

_Last updated: 2025-09-26 (Hotfix: toolbar-color.js full restoration & action call fix)._
