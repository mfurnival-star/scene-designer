/*********************************************************
 * PART 1: SidebarPanel Logic
 * ----------------------------------------
 * Implements the content and UI logic for the Sidebar panel (shape table/list).
 * Current: Placeholder/hello world.
 * Future: Will show the table of annotation shapes and handle selection, lock, delete, etc.
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
