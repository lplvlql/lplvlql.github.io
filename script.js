// Single-page app: hash router + mouse-wheel backdrop. The page itself never scrolls.
(function () {
  "use strict";

  /* ---------- Router: #/ is home, #/chronicle etc. open in place ---------- */
  var ROUTES = ["home", "chronicle", "ledger", "usual-time", "mister-simp"];
  var TITLES = {
    home: "lplvlql",
    chronicle: "Chronicle — lplvlql",
    ledger: "Ledger — lplvlql",
    "usual-time": "Usual Time — lplvlql",
    "mister-simp": "mister-simp — lplvlql"
  };

  function routeFromHash() {
    var name = window.location.hash.replace(/^#\/?/, "").split("/")[0];
    return ROUTES.indexOf(name) !== -1 ? name : "home";
  }

  function render() {
    var route = routeFromHash();
    ROUTES.forEach(function (name) {
      var el = document.getElementById("view-" + name);
      if (el) el.hidden = name !== route;
    });
    document.title = TITLES[route];
    if (route !== "home") {
      var heading = document.querySelector("#view-" + route + " h1");
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  window.addEventListener("hashchange", render);
  render();

  /* ---------- Backdrop: mouse wheel moves it, page stays put ---------- */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var layers = Array.prototype.slice.call(document.querySelectorAll(".bg-layer"));
  if (reduceMotion || !layers.length) return;

  var bgOffset = 0;
  var ticking = false;

  function paint() {
    ticking = false;
    layers.forEach(function (layer) {
      var seq = layer.querySelector(".bg-seq");
      if (!seq) return;
      var seqH = seq.offsetHeight || 1;
      var speed = parseFloat(layer.getAttribute("data-speed") || "0.4");
      var y = -((bgOffset * speed) % seqH);
      layer.style.transform = "translate3d(0," + y + "px,0)";
    });
  }

  window.addEventListener("wheel", function (e) {
    // Wheel inside an open project panel scrolls the panel, not the backdrop.
    if (e.target && e.target.closest && e.target.closest(".panel")) return;
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;                    // lines → px
    else if (e.deltaMode === 2) delta *= window.innerHeight; // pages → px
    bgOffset += delta;
    if (Math.abs(bgOffset) > 40) document.body.classList.add("scrolled");
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(paint);
    }
  }, { passive: true });

  paint();
})();
