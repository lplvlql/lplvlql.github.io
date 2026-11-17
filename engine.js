// Shared background engine: one cloud of permanent dot homes, dynamic
// proximity lines recomputed every frame, cursor attractor with
// underdamped elastic settle, tilt gravity, reduced-motion clock.
// Pages supply only geometry: build fills pts, place returns cards.
// Proportional scatter: object count scales with screen area, one
// object per shuffled cell so the spread stays even. No fixed grids.
function scatterCells(W, H, ref, min, max) {
  "use strict";
  var n = Math.max(min, Math.min(max, Math.round(ref * W * H / (1280 * 800))));
  var cols = Math.max(1, Math.round(Math.sqrt(n * W / H)));
  var rows = Math.ceil(n / cols);
  var cells = [];
  for (var gy = 0; gy < rows; gy++) for (var gx = 0; gx < cols; gx++) cells.push([gx, gy]);
  for (var ci = cells.length - 1; ci > 0; ci--) {
    var cj = Math.floor(Math.random() * (ci + 1));
    var tmp = cells[ci]; cells[ci] = cells[cj]; cells[cj] = tmp;
  }
  return cells.slice(0, n).map(function (c) {
    return [(c[0] + 0.2 + Math.random() * 0.6) / cols, (c[1] + 0.2 + Math.random() * 0.6) / rows];
  });
}
function startBackground(canvasId, build, place, maxz) {
  "use strict";
  var canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, lastFrame = null;

  // Same seeded RNG as the home sphere: identical on every load.
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry(42);

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = window.innerWidth, h = window.innerHeight;
    if (W && Math.abs(w - W) < 2 && Math.abs(h - H) < 2) return; // ignore URL-bar wobble
    W = w; H = h;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize); // the loop repaints, as home
  resize();

  var pts = [];
  build(pts, rng, W, H);
  var cards = place(W, H);

  var N = cards.length * pts.length;
  var bx = new Float32Array(N), by = new Float32Array(N); // projected homes
  var px = new Float32Array(N), py = new Float32Array(N); // homes + elastic offset
  var sf = new Float32Array(N);
  var OFF = new Float32Array(N * 2), VEL = new Float32Array(N * 2);
  var MAXZ = maxz; // farthest dot from the home centre

  // Cursor attractor and its energy — the home page's numbers.
  var attrX = 0, attrY = 0, attrTX = 0, attrTY = 0, energy = 0;
  var gravX = 0, gravY = 0, gravAmt = 0;

  function project(t) {
    var n = 0;
    cards.forEach(function (c) {
      var cxp = c.x * W, cyp = c.y * H;
      var ax = c.rx + t / 1000 * c.sx, ay = c.ry + t / 1000 * c.sy, az = c.rz + t / 1000 * c.sz;
      var cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay), caz = Math.cos(az), saz = Math.sin(az);
      for (var i = 0; i < pts.length; i++, n++) {
        var lx = pts[i][0], ly = pts[i][1], lz = pts[i][2] || 0;
        var y1 = ly * cax - lz * sax, z1 = ly * sax + lz * cax;
        var x2 = lx * cay + z1 * say, z2 = z1 * cay - lx * say;
        var x3 = x2 * caz - y1 * saz, y3 = x2 * saz + y1 * caz;
        var s = 1 / (1 + z2 / 400);
        bx[n] = cxp + x3 * s; by[n] = cyp + y3 * s;
        var f = Math.max(0, Math.min(1, (MAXZ - z2) / (2 * MAXZ)));
        sf[n] = f + (1 - f) / 8; // front solid, back diffused — as the sphere
      }
    });
  }

  // Elastic step — the home sphere's spring, falloff and decay.
  function stepElastic(dtMs) {
    var step = Math.min(3, dtMs / 16.7);
    energy *= Math.exp(-dtMs / 1200);
    var ae = 1 - Math.exp(-dtMs / 150);
    attrX += (attrTX - attrX) * ae;
    attrY += (attrTY - attrY) * ae;
    var R = Math.min(W, H) / 2;
    for (var n = 0; n < N; n++) {
      var ddx = bx[n] - attrX, ddy = by[n] - attrY;
      var dd2 = ddx * ddx + ddy * ddy;
      var w = Math.exp(-dd2 / (2 * 0.09 * R * R)) * energy * 0.45;
      var wf = Math.exp(-dd2 / (2 * 0.5625 * R * R)) * energy * 0.03;
      var tx = (attrX - bx[n]) * (w + wf) + gravX * gravAmt * 10 * sf[n];
      var ty = (attrY - by[n]) * (w + wf) + gravY * gravAmt * 10 * sf[n];
      var k = n * 2;
      VEL[k] = (VEL[k] + (tx - OFF[k]) * 0.02 * step) * Math.pow(0.92, step);
      VEL[k + 1] = (VEL[k + 1] + (ty - OFF[k + 1]) * 0.02 * step) * Math.pow(0.92, step);
      OFF[k] += VEL[k] * step; OFF[k + 1] += VEL[k + 1] * step;
      px[n] = bx[n] + OFF[k]; py[n] = by[n] + OFF[k + 1];
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(28,28,28,.8)";
    ctx.strokeStyle = "rgba(28,28,28,.8)";
    ctx.lineWidth = 0.5;
    // Lines are dynamic, as home: dots within range of each other
    // right now get a line, found through a spatial grid, bucketed
    // by opacity so each bucket is a single stroke.
    // Cutoff a bit past the dot spacing — not a neighbour count.
    var DIST = 16, CELL = DIST;
    var buckets = [[], [], [], [], [], [], [], []];
    var grid = new Map();
    for (var gj = 0; gj < N; gj++) {
      var gk = Math.floor(px[gj] / CELL) + Math.floor(py[gj] / CELL) * 4096;
      if (!grid.has(gk)) grid.set(gk, []);
      grid.get(gk).push(gj);
    }
    for (var aj = 0; aj < N; aj++) {
      var ax8 = Math.floor(px[aj] / CELL), ay8 = Math.floor(py[aj] / CELL);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var cell = grid.get((ax8 + ox) + (ay8 + oy) * 4096);
        if (!cell) continue;
        for (var ci = 0; ci < cell.length; ci++) {
          var bj = cell[ci];
          if (bj <= aj) continue;
          var ddx = px[aj] - px[bj], ddy = py[aj] - py[bj];
          var dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd >= DIST) continue;
          var bk = Math.min(7, Math.floor((1 - dd / DIST) * 8));
          buckets[bk].push(px[aj], py[aj], px[bj], py[bj]);
        }
      }
    }
    for (var bi = 0; bi < 8; bi++) {
      var pts8 = buckets[bi];
      if (!pts8.length) continue;
      var ba = (bi + 1) / 8;
      ctx.globalAlpha = ba * ba * ba; // nearest opaque, faster falloff
      ctx.beginPath();
      for (var pi = 0; pi < pts8.length; pi += 4) {
        ctx.moveTo(pts8[pi], pts8[pi + 1]);
        ctx.lineTo(pts8[pi + 2], pts8[pi + 3]);
      }
      ctx.stroke();
    }
    for (var dj = 0; dj < N; dj++) {
      ctx.globalAlpha = sf[dj];
      ctx.beginPath();
      ctx.arc(px[dj], py[dj], 1.5, 0, Math.PI * 2); // every dot the same size
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Pointer feeds the attractor; energy follows pointer speed.
  var lastMX = null, lastMY = null;
  function feedAttractor(x, y) {
    attrTX = x; attrTY = y;
    if (lastMX !== null) {
      var moved = Math.sqrt((x - lastMX) * (x - lastMX) + (y - lastMY) * (y - lastMY));
      energy = Math.min(1, energy + moved / 240);
    }
    lastMX = x; lastMY = y;
  }
  window.addEventListener("pointermove", function (e) { feedAttractor(e.clientX, e.clientY); });
  var askedOrientation = false;
  window.addEventListener("pointerdown", function (e) {
    if (e.target && e.target.closest && e.target.closest(".scroll-arrow")) return;
    if (!askedOrientation) {
      askedOrientation = true;
      if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === "function") {
        window.DeviceOrientationEvent.requestPermission().catch(function () {});
      }
    }
    feedAttractor(e.clientX, e.clientY);
  });
  window.addEventListener("deviceorientation", function (e) {
    if (e.gamma === null || e.beta === null) return;
    var gx = Math.max(-45, Math.min(45, e.gamma)) / 45;
    var gy = (Math.max(0, Math.min(90, e.beta)) - 45) / 45;
    var gm = Math.sqrt(gx * gx + gy * gy) || 1;
    gravX = gx / gm; gravY = gy / gm;
    gravAmt = Math.min(1, gm);
  });

  var animNow = 2989; // the home clock's starting moment
  function frame(now) {
    var dt = lastFrame === null ? 16 : Math.min(50, now - lastFrame);
    lastFrame = now;
    var adt = reduceMotion ? 0 : dt; // reduced motion is this delta being zero
    animNow += adt;
    project(animNow);
    stepElastic(adt);
    draw();
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}
