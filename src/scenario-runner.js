/**
 * scenario-runner.js
 * -----------------------------------------------------------
 * Scene Designer – Scenario Runner Module (ESM only, future-proof)
 * - Runs scripted scenarios: sequences of UI actions, business logic, and log/assert steps.
 * - Calls any exported function from action/state modules—future-proof for new features.
 * - Supports special steps: log, dump, assert, comment for in-scenario diagnostics.
 * - No business logic or state mutation; only calls exported APIs.
 * - Exports: runScenario, registerScenario, getRegisteredScenarios, runScenarioStep
 * - Logging via log.js.
 * -----------------------------------------------------------
 */

import * as Actions from './actions.js';
import * as Selection from './selection.js';
import * as State from './state.js';
import { log } from './log.js';

// Registry: all available exported functions (future-proof, auto-extendable)
const API = { ...Actions, ...Selection, ...State };

// Scenario registry for named scenarios
const _scenarioRegistry = {};

/**
 * Register a named scenario (array of steps).
 * @param {string} name
 * @param {Array} steps
 */
export function registerScenario(name, steps) {
  _scenarioRegistry[name] = steps;
  log("INFO", "[scenario-runner] Scenario registered", { name, steps });
}

/**
 * Get all registered scenarios (for UI panel).
 */
export function getRegisteredScenarios() {
  return { ..._scenarioRegistry };
}

/**
 * Run a single scenario step.
 * @param {object} step - { fn: "functionName", args: [...], type: "log"/"assert"/"comment"/"dump", expr, text }
 * @returns {Promise<any>} result of the function or log/assert output
 */
export async function runScenarioStep(step) {
  try {
    if (step.fn && API[step.fn]) {
      // Call exported function by name with arguments
      const result = await API[step.fn](...(step.args || []));
      log("INFO", `[scenario-runner] Ran action: ${step.fn}`, { args: step.args, result });
      return result;
    }
    // Special step types
    if (step.type === "log") {
      // Evaluate expr if function, else output as-is
      const val = typeof step.expr === "function" ? step.expr() : step.expr;
      log("INFO", `[scenario-runner] LOG:`, val);
      return val;
    }
    if (step.type === "dump") {
      // Dump variable (for deep inspection)
      const val = typeof step.expr === "function" ? step.expr() : step.expr;
      log("INFO", `[scenario-runner] DUMP:`, val);
      return val;
    }
    if (step.type === "assert") {
      // Evaluate expr (should return boolean)
      let ok, msg;
      if (typeof step.expr === "function") {
        ok = !!step.expr();
        msg = step.expr.toString();
      } else {
        ok = !!step.expr;
        msg = String(step.expr);
      }
      log(ok ? "INFO" : "ERROR", `[scenario-runner] ASSERT:`, ok ? "PASS" : "FAIL", msg);
      return ok;
    }
    if (step.type === "comment") {
      log("DEBUG", `[scenario-runner] COMMENT: ${step.text}`);
      return step.text;
    }
    log("WARN", "[scenario-runner] Unknown step type", step);
    return null;
  } catch (e) {
    log("ERROR", "[scenario-runner] Error running scenario step", { step, error: e });
    throw e;
  }
}

/**
 * Run a full scenario (array of steps).
 * @param {Array} steps - scenario steps, each { fn, args } or {type, expr/text}
 * @param {object} [opts] - { delayMs: number, onStep: fn }
 * @returns {Promise<Array>} array of results from each step
 */
export async function runScenario(steps, opts = {}) {
  log("INFO", "[scenario-runner] Running scenario", { steps, opts });
  const delayMs = typeof opts.delayMs === "number" ? opts.delayMs : 0;
  const results = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    log("DEBUG", `[scenario-runner] Step ${i+1}/${steps.length}`, step);
    try {
      const result = await runScenarioStep(step);
      results.push(result);
      if (typeof opts.onStep === "function") opts.onStep({ index: i, step, result });
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    } catch (e) {
      log("ERROR", `[scenario-runner] Error in scenario step ${i+1}`, { step, error: e });
      results.push(e);
      break; // Stop on first error for now; or continue if desired
    }
  }
  log("INFO", "[scenario-runner] Scenario complete", { results });
  return results;
}

/**
 * Run a named scenario from registry.
 * @param {string} name
 * @param {object} [opts]
 */
export async function runRegisteredScenario(name, opts = {}) {
  const steps = _scenarioRegistry[name];
  if (!Array.isArray(steps)) {
    log("ERROR", "[scenario-runner] Scenario not found", { name });
    throw new Error(`Scenario '${name}' not found`);
  }
  return await runScenario(steps, opts);
}

// --- Enhanced diagnostic scenarios for defect1 and related selection/delete bugs ---

registerScenario("defect1-delete-flow", [
  { type: "comment", text: "Create a rectangle shape at (100,120)" },
  { fn: "addShapeOfType", args: ["rect", {x:100, y:120}] },
  { type: "log", expr: () => State.getState().shapes },
  { type: "comment", text: "Deselect all shapes" },
  { fn: "setSelectedShapes", args: [[]] },
  { type: "assert", expr: () => State.getState().selectedShapes.length === 0 },
  { type: "comment", text: "Reselect the first shape (should be the rectangle)" },
  { fn: "setSelectedShapes", args: [[() => State.getState().shapes[0]]] },
  { type: "log", expr: () => State.getState().selectedShapes },
  { type: "comment", text: "Delete selected shape" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 0 },
  { type: "comment", text: "End of defect1 scenario" }
]);

registerScenario("defect1-server-image-delete", [
  { type: "comment", text: "Load sample1.png as server image" },
  { fn: "setImage", args: ["./images/sample1.png", null] },
  { type: "log", expr: () => State.getState().imageURL },
  { type: "comment", text: "Create a rectangle shape at (140, 140)" },
  { fn: "addShapeOfType", args: ["rect", {x:140, y:140}] },
  { type: "log", expr: () => State.getState().shapes },
  { type: "comment", text: "Deselect all shapes" },
  { fn: "setSelectedShapes", args: [[]] },
  { type: "assert", expr: () => State.getState().selectedShapes.length === 0 },
  { type: "comment", text: "Reselect the first shape (should be the rectangle)" },
  { fn: "setSelectedShapes", args: [[() => State.getState().shapes[0]]] },
  { type: "log", expr: () => State.getState().selectedShapes },
  { type: "comment", text: "Delete selected shape" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 0 },
  { type: "comment", text: "End of server image defect1 scenario" }
]);

registerScenario("defect1-point-delete", [
  { type: "comment", text: "Create a point shape at (70, 80)" },
  { fn: "addShapeOfType", args: ["point", {x:70, y:80}] },
  { type: "log", expr: () => State.getState().shapes },
  { type: "comment", text: "Deselect all shapes" },
  { fn: "setSelectedShapes", args: [[]] },
  { type: "assert", expr: () => State.getState().selectedShapes.length === 0 },
  { type: "comment", text: "Reselect the point shape" },
  { fn: "setSelectedShapes", args: [[() => State.getState().shapes[0]]] },
  { type: "log", expr: () => State.getState().selectedShapes },
  { type: "comment", text: "Delete selected point" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 0 },
  { type: "comment", text: "End of defect1 point scenario" }
]);

registerScenario("defect1-multiselect-delete", [
  { type: "comment", text: "Create two rectangle shapes" },
  { fn: "addShapeOfType", args: ["rect", {x:60, y:60}] },
  { fn: "addShapeOfType", args: ["rect", {x:160, y:160}] },
  { type: "log", expr: () => State.getState().shapes },
  { type: "comment", text: "Multi-select both shapes" },
  { fn: "setSelectedShapes", args: [[() => State.getState().shapes[0], () => State.getState().shapes[1]]] },
  { type: "log", expr: () => State.getState().selectedShapes },
  { type: "comment", text: "Delete selected shapes" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 0 },
  { type: "comment", text: "End of defect1 multiselect scenario" }
]);

registerScenario("defect1-locked-shape-delete", [
  { type: "comment", text: "Create a rectangle shape and lock it" },
  { fn: "addShapeOfType", args: ["rect", {x:200, y:60}] },
  { type: "log", expr: () => State.getState().shapes },
  { fn: "setSelectedShapes", args: [[() => State.getState().shapes[0]]] },
  { fn: "lockSelectedShapes" },
  { type: "log", expr: () => State.getState().selectedShapes },
  { type: "comment", text: "Try to delete locked shape" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 1 },
  { type: "comment", text: "Unlock and delete shape" },
  { fn: "unlockSelectedShapes" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 0 },
  { type: "comment", text: "End of defect1 locked shape scenario" }
]);

registerScenario("defect1-circle-delete", [
  { type: "comment", text: "Create a circle shape at (80, 110)" },
  { fn: "addShapeOfType", args: ["circle", {x:80, y:110}] },
  { type: "log", expr: () => State.getState().shapes },
  { type: "comment", text: "Deselect all shapes" },
  { fn: "setSelectedShapes", args: [[]] },
  { type: "assert", expr: () => State.getState().selectedShapes.length === 0 },
  { type: "comment", text: "Reselect the circle shape" },
  { fn: "setSelectedShapes", args: [[() => State.getState().shapes[0]]] },
  { type: "log", expr: () => State.getState().selectedShapes },
  { type: "comment", text: "Delete selected circle" },
  { fn: "deleteSelectedShapes" },
  { type: "dump", expr: () => State.getState().shapes },
  { type: "assert", expr: () => State.getState().shapes.length === 0 },
  { type: "comment", text: "End of defect1 circle scenario" }
]);

/*
Example scenario step:
{ fn: "addShapeOfType", args: ["rect", {x:100, y:120}] }
{ type: "log", expr: () => State.getState().shapes }
{ type: "assert", expr: () => State.getState().shapes.length === 1 }
{ type: "comment", text: "End of scenario." }
*/

// Future: scenario-panel.js can import getRegisteredScenarios() and runRegisteredScenario(name)


