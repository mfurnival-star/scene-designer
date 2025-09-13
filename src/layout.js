console.log("LAYOUT.JS IS RUNNING");
alert("If you see this, src/layout.js is loaded and JS is running.");

let glRoot = document.getElementById("gl-root");
if (glRoot) {
  glRoot.innerHTML = "<h1 style='color: orange;'>Testing Golden Layout import...</h1>";
} else {
  document.body.innerHTML += "<div style='color: red;'>#gl-root not found</div>";
}

try {
  // Try importing Golden Layout from CDN
  import("https://cdn.jsdelivr.net/npm/golden-layout@2.5.0/+esm").then(mod => {
    const GoldenLayout = mod.GoldenLayout;
    console.log("GOLDEN LAYOUT imported:", GoldenLayout);
    alert("Golden Layout imported: " + (GoldenLayout ? "yes" : "no"));

    if (glRoot) {
      glRoot.innerHTML = "<h1 style='color: green;'>Golden Layout imported: " + (GoldenLayout ? "yes" : "no") + "</h1>";
    }
  }).catch(e => {
    console.error("FAILED TO IMPORT GOLDEN LAYOUT", e);
    alert("FAILED TO IMPORT GOLDEN LAYOUT: " + e);
    if (glRoot) {
      glRoot.innerHTML = "<h1 style='color: red;'>FAILED TO IMPORT GOLDEN LAYOUT<br>" + e + "</h1>";
    }
  });
} catch (err) {
  console.error("Import threw:", err);
  alert("Import threw: " + err);
  if (glRoot) {
    glRoot.innerHTML = "<h1 style='color: red;'>Import threw: " + err + "</h1>";
  }
}
