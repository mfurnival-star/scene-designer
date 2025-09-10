/*********************************************************
 * PART 2: CanvasPanel Stub (Hello World)
 * ----------------------------------------
 * This file defines the placeholder logic for the Canvas panel
 * in the Golden Layout workspace. For "hello world" testing,
 * it simply renders a static message.
 *
 * When you are ready to implement the real canvas/image/konva logic,
 * replace this with the actual UI logic.
 *********************************************************/

window.buildCanvasPanel = function(rootDiv, container, state) {
  // Clear any existing content
  rootDiv.innerHTML = "";

  // Add hello world content
  const h2 = document.createElement("h2");
  h2.innerText = "Hello, Canvas!";
  const p = document.createElement("p");
  p.innerText = "This is where your image and shapes will be drawn.";

  rootDiv.appendChild(h2);
  rootDiv.appendChild(p);
};
