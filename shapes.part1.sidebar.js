/*********************************************************
 * PART 1: SidebarPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Sidebar panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real shape table,
 * replace this with the actual UI logic.
 *********************************************************/

window.buildSidebarPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Sidebar!";
  const p = document.createElement("p");
  p.innerText = "This is the shape table panel (sidebar).";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
