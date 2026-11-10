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

  /* ---------- Backdrop: point cloud morphing through shapes ----------
     168 points hold a slowly rotating 3D shape behind the buttons.
     Each cycle: hold the shape -> burst outward to random points ->
     regroup as the next shape (circle, line, triangle, square, ...).
     The page never scrolls (Safari-safe): wheel/touch only add speed. */
  var canvas = document.getElementById("bg-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var N = 168;
  var SHAPES = ["circle", "line", 3, 4, 5, 6, 7, 8]; // then back to circle
  var W = 0, H = 0, boost = 0;
  var stage = 0, stageT = 0, lastPhase = -1, rot = 0;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function polygonPoint(k, i) {
    var verts = [], j, a;
    for (j = 0; j < k; j++) {
      a = -Math.PI / 2 + (k % 2 === 0 ? Math.PI / k : 0) + j * Math.PI * 2 / k;
      verts.push([Math.cos(a) * 0.82, Math.sin(a) * 0.82]);
    }
    var s = i / N * k, side = Math.floor(s) % k, f = s - Math.floor(s);
    var p = verts[side], q = verts[(side + 1) % k];
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, 0];
  }

  function shapePoint(shape, i) {
    if (shape === "circle") {
      var a = i / N * Math.PI * 2;
      return [Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0];
    }
    if (shape === "line") {
      return [-0.88 + 1.76 * (i / (N - 1)), 0, 0];
    }
    return polygonPoint(shape, i);
  }

  function scatterPoint() {
    var u = rand(-1, 1), th = rand(0, Math.PI * 2), r = rand(1.3, 2.4);
    var s = Math.sqrt(1 - u * u) * r;
    return [Math.cos(th) * s, Math.sin(th) * s, u * r];
  }

  var pts = [];
  for (var i = 0; i < N; i++) {
    var start = shapePoint("circle", i);
    pts.push({ x: start[0], y: start[1], z: start[2], tx: start[0], ty: start[1], tz: start[2],
      size: rand(1, 2.4), tw: rand(0, Math.PI * 2) });
  }

  function setTargets(kind, shapeIdx) {
    for (var j = 0; j < N; j++) {
      var t = kind === "scatter" ? scatterPoint() : shapePoint(SHAPES[shapeIdx], j);
      pts[j].tx = t[0]; pts[j].ty = t[1]; pts[j].tz = t[2];
    }
  }

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function project(now) {
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.37;
    var tilt = Math.sin(now * 0.00021) * 0.38;
    var cy1 = Math.cos(rot), sy1 = Math.sin(rot), cx1 = Math.cos(tilt), sx1 = Math.sin(tilt);
    var out = [];
    for (var j = 0; j < N; j++) {
      var p = pts[j];
      var y1 = p.y * cx1 - p.z * sx1, z1 = p.y * sx1 + p.z * cx1;
      var x2 = p.x * cy1 + z1 * sy1, z2 = -p.x * sy1 + z1 * cy1;
      var s = 1 / (1 + z2 * 0.32);
      out.push({ x: cx + x2 * R * s, y: cy + y1 * R * s, s: s,
        a: Math.max(0.12, Math.min(1, (s - 0.72) / 0.5)) * (0.78 + 0.22 * Math.sin(now * 0.003 + p.tw)),
        r: p.size * s + 0.4 });
    }
    return out;
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var scr = project(now);
    ctx.fillStyle = "#fff";
    for (var k = 0; k < N; k++) {
      var q = scr[k];
      ctx.globalAlpha = q.a;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (reduceMotion) { // static ring, no loop
    rot = 0.6;
    lastPhase = 0;
    draw(0);
    return;
  }

  function inPanel(e) { return e.target && e.target.closest && e.target.closest(".panel"); }

  window.addEventListener("wheel", function (e) {
    if (inPanel(e)) return; // panel keeps its own scroll
    e.preventDefault();     // stop Safari trying to scroll a scroll-less page
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= window.innerHeight;
    boost += delta * 0.00045;
    boost = Math.max(-0.1, Math.min(1.5, boost));
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
    boost += (lastTouchY - y) * 0.002;
    boost = Math.max(-0.1, Math.min(1.5, boost));
    lastTouchY = y;
    document.body.classList.add("scrolled");
  }, { passive: false });

  var last = null;
  function frame(now) {
    var dt = last === null ? 16.7 : Math.min(50, now - last);
    last = now;
    rot += dt * 0.00035;
    boost *= Math.pow(0.45, dt / 1000);
    if (Math.abs(boost) < 0.001) boost = 0;

    stageT += dt / 1000 * (0.11 + boost); // ~9s a shape at idle, faster scrolled
    while (stageT >= 1) { stageT -= 1; stage = (stage + 1) % SHAPES.length; }
    while (stageT < 0) { stageT += 1; stage = (stage - 1 + SHAPES.length) % SHAPES.length; }
    var phase = stageT < 0.62 ? 0 : stageT < 0.8 ? 1 : 2;
    if (phase !== lastPhase) {
      lastPhase = phase;
      if (phase === 0) setTargets("shape", stage);
      else if (phase === 1) setTargets("scatter", stage);
      else setTargets("shape", (stage + 1) % SHAPES.length);
    }

    var f = 1 - Math.exp(-dt * (phase === 1 ? 0.006 : phase === 2 ? 0.009 : 0.0035));
    for (var j = 0; j < N; j++) {
      var p = pts[j];
      p.x += (p.tx - p.x) * f;
      p.y += (p.ty - p.y) * f;
      p.z += (p.tz - p.z) * f;
    }
    draw(now);
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
