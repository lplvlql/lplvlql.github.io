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

  /* ---------- Backdrop: alive on its own; wheel adds energy ----------
     Safari won't reliably scroll a scroll-less page, so the page never
     scrolls at all: a rAF loop drifts the words, and wheel/touch input
     only injects velocity (with preventDefault so Safari doesn't try). */
  var bg = document.querySelector(".stark-bg");
  if (!bg) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return; // static fallback layers stay

  var WORDS = ["CHRONICLE", "LEDGER", "USUAL TIME", "MISTER-SIMP", "240 CARDS",
    "BY CID", "DELAY", "LOOP / SAMPLE", "DIRECT", "/MEDIA/FAT", "PARCEL",
    "WIZARD POKER", "DAISY TERRARIUM", "SIX REGIONS", "KNOCK TO COMMIT", "PEERS"];
  var W = window.innerWidth, H = window.innerHeight;
  var boost = 0;
  var items = [];

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function dress(it, anywhere) {
    var el = it.el;
    el.textContent = pick(WORDS);
    el.className = "bg-item" + (Math.random() < 0.55 ? " bg-item--outline" : "") +
      (Math.random() < 0.3 ? " bg-item--mono" : "");
    var size = rand(28, Math.max(60, W * 0.17));
    el.style.fontSize = size + "px";
    el.style.opacity = rand(0.35, 1).toFixed(2);
    it.x = rand(-W * 0.15, W * 0.85);
    it.y = anywhere ? rand(-50, H) : (it.dir < 0 ? H + rand(0, 120) : -size - rand(0, 120));
    it.speed = rand(0.25, 1.5);
    if (anywhere) it.dir = Math.random() < 0.82 ? -1 : 1; // mostly rising
    it.vx = rand(-0.25, 0.25);
    it.h = size;
    it.w = size * el.textContent.length * 0.62;
  }

  bg.innerHTML = "";
  var count = Math.round(Math.min(30, Math.max(16, W / 55)));
  for (var i = 0; i < count; i++) {
    var span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    bg.appendChild(span);
    var item = { el: span, x: 0, y: 0, speed: 0.5, dir: -1, vx: 0, h: 40, w: 200 };
    dress(item, true);
    items.push(item);
  }

  window.addEventListener("resize", function () { W = window.innerWidth; H = window.innerHeight; });

  function inPanel(e) { return e.target && e.target.closest && e.target.closest(".panel"); }

  window.addEventListener("wheel", function (e) {
    if (inPanel(e)) return; // panel keeps its own scroll
    e.preventDefault();     // stop Safari trying to scroll a scroll-less page
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= window.innerHeight;
    boost += delta * 0.012;
    boost = Math.max(-28, Math.min(28, boost));
    document.body.classList.add("scrolled");
  }, { passive: false });

  var lastTouchY = null;
  window.addEventListener("touchstart", function (e) {
    lastTouchY = e.touches[0] ? e.touches[0].clientY : null;
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (inPanel(e) || lastTouchY === null) return;
    e.preventDefault();
    var y = e.touches[0] ? e.touches[0].clientY : lastTouchY;
    boost += (lastTouchY - y) * 0.04;
    boost = Math.max(-28, Math.min(28, boost));
    lastTouchY = y;
    document.body.classList.add("scrolled");
  }, { passive: false });

  var last = null;
  function frame(now) {
    var dt = last === null ? 16.7 : Math.min(50, now - last);
    last = now;
    var step = dt / 16.7;
    boost *= Math.pow(0.94, step);
    if (Math.abs(boost) < 0.01) boost = 0;
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      it.y += (it.speed * it.dir - boost * (0.35 + it.speed * 0.65)) * step;
      it.x += it.vx * step;
      if (Math.random() < 0.0015) it.el.style.opacity = rand(0.25, 1).toFixed(2);
      if ((it.dir < 0 && it.y < -it.h - 60) || (it.dir > 0 && it.y > H + 60) ||
          boost > 6 && it.y < -it.h - 60 || boost < -6 && it.y > H + 60) {
        it.dir = boost < -2 ? 1 : -1;
        dress(it, false);
      }
      if (it.x > W + 40) it.x = -it.w - 20;
      if (it.x + it.w < -40) it.x = W + 20;
      it.el.style.transform = "translate3d(" + it.x.toFixed(1) + "px," + it.y.toFixed(1) + "px,0)";
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
