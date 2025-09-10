/*********************************************************
 * PART 3: SettingsPanel Logic
 * ----------------------------------------
 * Implements the content and UI for the Settings panel.
 * Current: Placeholder/hello world.
 * Future: Scene name, logic selector, color/tolerance, export, etc.
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
