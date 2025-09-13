// -- TEST: Confirm this JS file runs at all --
console.log("LAYOUT.JS IS RUNNING");
alert("If you see this, src/layout.js is loaded and JS is running.");

// Try to write something directly to the DOM
const glRoot = document.getElementById("gl-root");
if (glRoot) {
  glRoot.innerHTML = "<h1 style='color: red;'>JS is running</h1>";
} else {
  document.body.innerHTML += "<div style='color: red;'>#gl-root not found</div>";
}

// Don't import or run Golden Layout yet.
