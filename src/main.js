// main.js – Golden Layout bootstrap for Scene Designer

import { GoldenLayout } from 'golden-layout';

const layoutConfig = {
  content: [
    {
      type: "component",
      componentName: "HelloPanel",
      title: "Hello"
    }
  ]
};

window.addEventListener("DOMContentLoaded", () => {
  const glRoot = document.getElementById("gl-root");
  glRoot.innerHTML = "";

  const layout = new GoldenLayout(glRoot, layoutConfig);

  layout.registerComponent("HelloPanel", (container) => {
    const el = document.createElement("div");
    el.style.fontSize = "2em";
    el.style.color = "#0057d8";
    el.style.padding = "40px";
    el.textContent = "Golden Layout is working! 🎉";
    container.element.appendChild(el);
  });

  layout.init();
});
