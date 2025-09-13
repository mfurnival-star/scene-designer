import { GoldenLayout } from 'golden-layout';

document.addEventListener("DOMContentLoaded", () => {
  const glRoot = document.getElementById("gl-root");
  const layout = new GoldenLayout(glRoot, {
    root: {
      type: 'row',
      content: [
        {
          type: 'component',
          componentName: 'testPanel',
          title: 'Test Panel'
        }
      ]
    }
  });

  layout.registerComponent('testPanel', (container) => {
    container.element.innerHTML = "<div style='background:#fda;padding:2em;font-size:2em;'>Golden Layout IS WORKING</div>";
  });

  layout.init();
});
