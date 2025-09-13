import { GoldenLayout } from "https://unpkg.com/golden-layout@2.5.0/dist/goldenlayout.esm.js";

// Basic config: single component
const layoutConfig = {
  content: [
    {
      type: "component",
      componentName: "HelloPanel",
      title: "Hello"
    }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  const glRoot = document.getElementById("gl-root");
  // Wipe the root for safety
  while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

  // Create Golden Layout instance
  const layout = new GoldenLayout(glRoot, layoutConfig);

  // Register a single panel/component
  layout.registerComponent("HelloPanel", (container) => {
    const el = document.createElement("div");
    el.style.fontSize = "2em";
    el.style.color = "#0057d8";
    el.style.padding = "40px";
    el.textContent = "Hello, World!";
    container.element.appendChild(el);
  });

  layout.init();
});
