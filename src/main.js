(function(){
  if (typeof window.logToBox === 'function') window.logToBox("MAIN.JS: Script loaded.");
  // eslint-disable-next-line no-console
  console.log("MAIN.JS: Script loaded.");
  const glRoot = document.getElementById("gl-root");
  if (glRoot) {
    glRoot.innerHTML = "<div style='color:#d22;font-size:2em'>main.js executed!</div>";
  }
})();

