import { GoldenLayout } from "https://cdn.jsdelivr.net/npm/golden-layout@2.5.0/+esm";

// Minimal Golden Layout config: single component
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
  // Ensure root is empty
  while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

  // Create Golden Layout instance
  const layout = new GoldenLayout(glRoot, layoutConfig);

  // Register a single panel/component called "HelloPanel"
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
