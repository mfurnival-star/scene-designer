/**
 * scenario-panel.js
 * -----------------------------------------------------------
 * Scene Designer – Scenario Runner UI Panel (MiniLayout, ESM-only)
 * - Panel for running scripted scenarios and viewing step logs/results.
 * - Lists registered scenarios from scenario-runner.js; allows run, step, and log dump.
 * - Uses only ES module imports; no globals.
 * - Logging via log.js.
 * - Exports: buildScenarioPanel({ element, title, componentName })
 * -----------------------------------------------------------
 */

import { log } from './log.js';
import {
  getRegisteredScenarios,
  runRegisteredScenario
} from './scenario-runner.js';

/**
 * Build the Scenario Runner Panel
 * MiniLayout-compliant: accepts { element, title, componentName }
 */
export function buildScenarioPanel({ element, title, componentName }) {
  log("TRACE", "[scenario-panel] buildScenarioPanel entry", {
    elementType: element?.tagName,
    title,
    componentName
  });

  // Inject styles (once per document)
  if (typeof document !== "undefined" && !document.getElementById("scenario-panel-style")) {
    const style = document.createElement("style");
    style.id = "scenario-panel-style";
    style.textContent = `
      #scenario-panel-container {
        width: 100%;
        height: 100%;
        background: #e6f2fc;
        font-family: inherit;
        padding: 0;
        overflow: auto;
        display: flex;
        flex-direction: column;
      }
      #scenario-panel-select-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px 2px 16px;
      }
      #scenario-panel-scenario-select {
        font-size: 1.09em;
        min-width: 150px;
      }
      #scenario-panel-run-btn {
        font-size: 1em;
        padding: 7px 18px;
        border-radius: 4px;
        border: 1px solid #2176ff;
        background: #2176ff;
        color: #fff;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.13s;
      }
      #scenario-panel-run-btn:hover {
        background: #0057d8;
      }
      #scenario-panel-log {
        flex: 1 1 0;
        background: #fff;
        border-radius: 6px;
        margin: 8px 16px 16px 16px;
        padding: 10px 8px;
        font-size: 0.99em;
        color: #222;
        overflow: auto;
        box-shadow: 0 2px 8px -6px #2176ff;
        min-height: 120px;
        max-height: 250px;
      }
      #scenario-panel-log .log-step {
        margin-bottom: 7px;
        padding: 6px 8px;
        border-radius: 4px;
        background: #f7f9fc;
        border-left: 3px solid #2176ff;
        font-family: monospace;
        font-size: 0.97em;
      }
      #scenario-panel-log .log-step.error {
        border-left: 3px solid #e53935;
        background: #fff2f2;
        color: #c00;
      }
      #scenario-panel-log .log-step.assert {
        border-left: 3px solid #ffaa00;
        background: #fffbe9;
        color: #a60;
      }
    `;
    document.head.appendChild(style);
  }

  // Main panel HTML
  element.innerHTML = `
    <div id="scenario-panel-container">
      <div id="scenario-panel-select-row">
        <label for="scenario-panel-scenario-select" style="font-weight:bold;">Scenario:</label>
        <select id="scenario-panel-scenario-select"></select>
        <button id="scenario-panel-run-btn">Run Scenario</button>
      </div>
      <div id="scenario-panel-log"></div>
    </div>
  `;

  const scenarioSelect = element.querySelector("#scenario-panel-scenario-select");
  const runBtn = element.querySelector("#scenario-panel-run-btn");
  const logDiv = element.querySelector("#scenario-panel-log");

  // Populate scenario dropdown
  function populateScenarioOptions() {
    const scenarios = getRegisteredScenarios();
    scenarioSelect.innerHTML = "";
    Object.keys(scenarios).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      scenarioSelect.appendChild(opt);
    });
  }
  populateScenarioOptions();

  // Utility: Show log/result steps in logDiv
  function showScenarioLog(logSteps) {
    logDiv.innerHTML = "";
    logSteps.forEach((step, idx) => {
      const div = document.createElement("div");
      div.className = "log-step";
      if (step && step.__error) div.classList.add("error");
      if (step && step.__assert) div.classList.add("assert");
      div.innerHTML = `<b>Step ${idx + 1}:</b> ${step && step.__desc ? step.__desc : ""}<br>` +
        `<pre>${step && step.__log ? step.__log : JSON.stringify(step)}</pre>`;
      logDiv.appendChild(div);
    });
  }

  // Run scenario on button click
  runBtn.addEventListener("click", async () => {
    const scenarioName = scenarioSelect.value;
    if (!scenarioName) return;
    logDiv.innerHTML = `<div style="color:#888;font-size:1.08em;">Running scenario "<b>${scenarioName}</b>"...</div>`;
    try {
      const steps = [];
      await runRegisteredScenario(scenarioName, {
        delayMs: 120,
        onStep: ({ index, step, result }) => {
          // For log display, annotate errors/asserts
          let logStep = {
            __desc: step.fn ? `Action: ${step.fn}` : step.type ? `Type: ${step.type}` : "Step",
            __log: result && typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)
          };
          if (step.type === "assert") {
            logStep.__assert = true;
            logStep.__log = `Assert: ${logStep.__log}`;
          }
          if (result instanceof Error) {
            logStep.__error = true;
            logStep.__log = `Error: ${result.message}`;
          }
          steps.push(logStep);
          showScenarioLog(steps);
        }
      });
      // Final log update
      if (steps.length === 0) {
        logDiv.innerHTML = `<div style="color:#c00;">No steps executed. Check scenario definition.</div>`;
      }
    } catch (e) {
      logDiv.innerHTML = `<div style="color:#c00;">Error running scenario: ${e.message}</div>`;
    }
  });

  log("INFO", "[scenario-panel] Scenario Runner panel initialized");
  log("TRACE", "[scenario-panel] buildScenarioPanel exit", {
    elementType: element?.tagName,
    title,
    componentName
  });
}

