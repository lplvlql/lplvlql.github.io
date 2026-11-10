// Single-page app: hash router + endless scroll backdrop.
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

  /* ---------- Endless scroll backdrop ---------- */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var layers = Array.prototype.slice.call(document.querySelectorAll(".bg-layer"));
  if (reduceMotion || !layers.length) return;

  var LOOP = window.innerHeight * 3; // one full loop of scroll room
  var bgOffset = 0;
  var lastY = window.scrollY;
  var adjusting = false;
  var ticking = false;

  // Start mid-page so you can scroll up or down forever.
  window.scrollTo(0, LOOP);
  lastY = window.scrollY;

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

  function onScroll() {
    var y = window.scrollY;
    var delta = y - lastY;

    // Our own loop-jump fires a scroll event too — don't count it as motion.
    if (adjusting) {
      lastY = y;
      adjusting = false;
      return;
    }
    bgOffset += delta;
    lastY = y;

    // Wrap around silently: the backdrop never ends.
    if (y > LOOP * 2) {
      adjusting = true;
      window.scrollTo(0, y - LOOP);
    } else if (y < LOOP * 0.5) {
      adjusting = true;
      window.scrollTo(0, y + LOOP);
    }

    if (Math.abs(bgOffset) > 40) document.body.classList.add("scrolled");
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(paint);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  paint();
})();
