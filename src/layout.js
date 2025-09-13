import { GoldenLayout } from "https://unpkg.com/golden-layout@2.5.0/dist/goldenlayout.esm.js";

console.log("LAYOUT.JS: imported GoldenLayout:", GoldenLayout);

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
  console.log("LAYOUT.JS: DOMContentLoaded");
  const glRoot = document.getElementById("gl-root");
  while (glRoot.firstChild) glRoot.removeChild(glRoot.firstChild);

  console.log("LAYOUT.JS: About to create GoldenLayout instance...");
  const layout = new GoldenLayout(glRoot, layoutConfig);

  console.log("LAYOUT.JS: About to register HelloPanel...");
  layout.registerComponent("HelloPanel", (container) => {
    console.log("LAYOUT.JS: HelloPanel factory called", container);
    const el = document.createElement("div");
    el.style.fontSize = "2em";
    el.style.color = "#0057d8";
    el.style.padding = "40px";
    el.textContent = "Hello, World!";
    container.element.appendChild(el);
  });

  console.log("LAYOUT.JS: Calling layout.init...");
  layout.init();

  console.log("LAYOUT.JS: layout.init called, done.");
});
