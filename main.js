import GoldenLayout from "https://cdn.jsdelivr.net/npm/golden-layout@2.6.0/dist/goldenlayout.esm.js";

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
  const layout = new GoldenLayout(glRoot, layoutConfig);

  layout.registerComponent("HelloPanel", (container) => {
    const el = document.createElement("div");
    el.style.fontSize = "2em";
    el.style.color = "#0057d8";
    el.style.padding = "40px";
    el.textContent = "Hello, World! (Golden Layout CDN ESM)";
    container.element.appendChild(el);
  });

  layout.init();
});
