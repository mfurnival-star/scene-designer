/**
 * canvas-core.js
 * -----------------------------------------------------------
 * Scene Designer – Fabric Canvas Core (ESM ONLY)
 * Purpose:
 * - Factory for creating the main canvas panel.
 * - Handles background image, selection overlays, constraints, and sync.
 * - Used by canvas.js facade.
 * Exports:
 * - buildCanvasPanel({ element, title, componentName })
 */

import { log } from './log.js';
import { installFabricSelectionSync } from './canvas-events.js';
import { installCanvasConstraints } from './canvas-constraints.js';
import { installSelectionOutlines } from './selection-outlines.js';

export function buildCanvasPanel({ element, title, componentName }) {
  log("INFO", "[canvas-core] buildCanvasPanel ENTRY", { elementType: element?.tagName, title, componentName });

  // ... canvas setup logic goes here ...
  // This should create and initialize the Fabric canvas, install selection sync, constraints, overlays, etc.

  // For example:
  // const canvas = new fabric.Canvas(element, { ...options });
  // installFabricSelectionSync(canvas);
  // installCanvasConstraints(canvas);
  // installSelectionOutlines(canvas);

  log("INFO", "[canvas-core] buildCanvasPanel EXIT");
}
