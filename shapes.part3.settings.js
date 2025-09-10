/*********************************************************
 * PART 3: SettingsPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Settings panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real settings UI,
 * replace this with the actual logic/settings controls.
 *********************************************************/

window.buildSettingsPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Settings!";
  const p = document.createElement("p");
  p.innerText = "This is the settings panel.";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};

