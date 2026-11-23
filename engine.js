// Shared background engine: one cloud of permanent dot homes, dynamic
// proximity lines recomputed every frame, and two responses to input:
// moving or scrolling shifts the camera so depth layers slide past each
// other, and every input event jolts the dots to new nearby spots, from
// where they drift home.
// Pages supply homes and a build function that fills pts and returns the
// shape's radius; an optional link distance joins nearby homes with dotted lines.
// Fixed world: homes are scattered once per load over a 2560x1440 field
// that viewports crop.
var WORLD_W = 2560, WORLD_H = 1440, DEPTH = 600; // field size and depth either side of its middle (px)
// Homes at least minDist apart, each with a random starting angle and slow spin.
function scatterHomes(minDist) {
  var homes = [], count = Math.min(64, Math.round(WORLD_W * WORLD_H / (minDist * minDist)));
  while (homes.length < count) {
    var x = Math.random(), y = Math.random();
    if (homes.some(function (h) { return Math.hypot(x - h.x, y - h.y) < minDist / WORLD_W; })) continue;
    homes.push({
      x: x, y: y, z: (Math.random() * 2 - 1) * DEPTH, // the field is a 3D cloud
      rx: Math.random() * Math.PI * 2, ry: Math.random() * Math.PI * 2, rz: Math.random() * Math.PI * 2,
      sx: (Math.random() - 0.5) * 0.25, sy: (Math.random() - 0.5) * 0.2, sz: (Math.random() - 0.5) * 0.15
    });
  }
  return homes;
}
// A dotted cube: grid x grid dots on each of six faces, half-size h.
// Shared by the ledger family of pages.
function dotCube(pts, rng, h, grid) {
  for (var i = 0; i < grid; i++) for (var j = 0; j < grid; j++) {
    var a = -h + (i + 0.5) * 2 * h / grid + (rng() - 0.5) * 2;
    var b = -h + (j + 0.5) * 2 * h / grid + (rng() - 0.5) * 2;
    pts.push([h, a, b], [-h, a, b], [a, h, b], [a, -h, b], [a, b, h], [a, b, -h]);
  }
  return Math.sqrt(3) * h;
}
function startBackground(homes, build, link) {
  "use strict";
  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  var ctx = canvas.getContext("2d");
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W, H, lastFrame = null;

  // Seeded RNG: geometry is identical on every load.
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var pts, activeN;
  var bx, by, sf; // projected dots and their opacity
  var MAXZ; // farthest dot from the home centre
  var CAM; // camera distance: gentle perspective at any size
  function resize() {
    var dpr = Math.min(2, devicePixelRatio);
    if (canvas.clientWidth === W && canvas.clientHeight === H) return; // an address bar slid
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = [];
    MAXZ = build(pts, mulberry(42));
    CAM = Math.max(400, MAXZ * 4);
    var n = homes.length * pts.length;
    bx = new Float32Array(n); by = new Float32Array(n); sf = new Float32Array(n);
    project();
    draw();
  }

  // Camera shift (px) and its speed (px per second): moves push it, friction stops it.
  var camX = 0, camY = 0, velX = 0, velY = 0;
  var FIELD = 1500; // camera distance from the focal plane (px)
  // Jolt: how far dots sit from home (0 to 1); each event draws new spots.
  var jolt = 0, roll = 0;
  var JUMP = 6; // px a dot may sit from home at full jolt

  var centres = []; // visible homes on screen, for optional links
  function hop(n, k) { var h = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return h - Math.floor(h) - 0.5; }
  var animNow = 2989; // fixed starting moment, so first frames match every load
  function wrap(v, size) { return v - size * Math.round(v / size); }
  function project() {
    var n = 0, t = animNow;
    centres = [];
    for (var ci = 0; ci < homes.length; ci++) {
      var c = homes[ci], hz = c.z || 0;
      // Parallax about the middle depth: the nearest homes move with the input,
      // the furthest against it, and the field wraps so it never runs out.
      var hs = FIELD / (FIELD + hz);
      var cxp = W / 2 + wrap((c.x - 0.5) * WORLD_W + camX * hz / DEPTH, WORLD_W) * hs;
      var cyp = H / 2 + wrap((c.y - 0.5) * WORLD_H + camY * hz / DEPTH, WORLD_H) * hs;
      if (cxp < -256 || cxp > W + 256 || cyp < -256 || cyp > H + 256) continue; // offscreen: cropped, not generated
      centres.push(cxp, cyp);
      var ax = c.rx + t / 1000 * c.sx, ay = c.ry + t / 1000 * c.sy, az = c.rz + t / 1000 * c.sz;
      var cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay), caz = Math.cos(az), saz = Math.sin(az);
      for (var i = 0; i < pts.length; i++, n++) {
        var lx = pts[i][0], ly = pts[i][1], lz = pts[i][2];
        var y1 = ly * cax - lz * sax, z1 = ly * sax + lz * cax;
        var x2 = lx * cay + z1 * say, z2 = z1 * cay - lx * say;
        var x3 = x2 * caz - y1 * saz, y3 = x2 * saz + y1 * caz;
        var s = hs / (1 + z2 / CAM);
        bx[n] = cxp + x3 * s; by[n] = cyp + y3 * s;
        var f = Math.max(0, Math.min(1, (MAXZ - z2) / (2 * MAXZ)));
        sf[n] = f + (1 - f) / 8; // front solid, back diffused
      }
    }
    activeN = n;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10,10,10,.8)";
    ctx.strokeStyle = "rgba(10,10,10,.8)";
    ctx.lineWidth = 0.5;
    // Lines are dynamic: dots within range of each other
    // right now get a line, found through a spatial grid, bucketed
    // by opacity so each bucket is a single stroke.
    // Cutoff a bit past the dot spacing — not a neighbour count.
    var DIST = 16, CELL = DIST;
    var buckets = [[], [], [], [], [], [], [], []];
    var grid = new Map();
    for (var gj = 0; gj < activeN; gj++) {
      var gk = Math.floor(bx[gj] / CELL) + Math.floor(by[gj] / CELL) * 4096;
      if (!grid.has(gk)) grid.set(gk, []);
      grid.get(gk).push(gj);
    }
    for (var aj = 0; aj < activeN; aj++) {
      var ax8 = Math.floor(bx[aj] / CELL), ay8 = Math.floor(by[aj] / CELL);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var cell = grid.get((ax8 + ox) + (ay8 + oy) * 4096);
        if (!cell) continue;
        for (var ci = 0; ci < cell.length; ci++) {
          var bj = cell[ci];
          if (bj <= aj) continue;
          var ddx = bx[aj] - bx[bj], ddy = by[aj] - by[bj];
          var dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd >= DIST) continue;
          var bk = Math.min(7, Math.floor((1 - dd / DIST) * 8));
          buckets[bk].push(bx[aj], by[aj], bx[bj], by[bj]);
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
    var away = 2 * JUMP * jolt;
    for (var dj = 0; dj < activeN; dj++) {
      ctx.globalAlpha = sf[dj];
      ctx.beginPath();
      // Dots sit away from home by the jolt; lines stay on the homes.
      ctx.arc(bx[dj] + hop(dj, roll) * away, by[dj] + hop(dj, roll + 0.5) * away, 1.5, 0, Math.PI * 2); // every dot the same size
      ctx.fill();
    }
    // Optional links: homes nearer than `link` px join with a dotted line
    // between their edges, fading with distance.
    if (link) {
      for (var la = 0; la < centres.length; la += 2) for (var lb = la + 2; lb < centres.length; lb += 2) {
        var lx = centres[lb] - centres[la], ly = centres[lb + 1] - centres[la + 1];
        var ld = Math.sqrt(lx * lx + ly * ly);
        if (ld >= link || ld <= 2 * MAXZ) continue;
        ctx.globalAlpha = 1 - ld / link;
        ctx.beginPath();
        for (var lt = MAXZ; lt <= ld - MAXZ; lt += 8) {
          ctx.moveTo(centres[la] + lx * lt / ld + 1.5, centres[la + 1] + ly * lt / ld);
          ctx.arc(centres[la] + lx * lt / ld, centres[la + 1] + ly * lt / ld, 1.5, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Reduced motion: one still picture, redrawn only on resize.
  addEventListener("resize", resize);
  resize();
  if (reduceMotion) return;

  // Only user input moves the background, never the page moving. Every event
  // jolts the dots: fully for presses, releases and keys, by distance for moves.
  // Moves and the wheel also shift the camera.
  var last = null;
  function react(e) {
    var p = e.touches && e.touches[0] || e, dx = 0, dy = 0, strength = 1;
    if (e.type === "wheel") { dx = -e.deltaX; dy = -e.deltaY; }
    else if (/move$/.test(e.type) && last && p.clientX !== undefined) { dx = p.clientX - last[0]; dy = p.clientY - last[1]; }
    if (/move$|wheel/.test(e.type)) strength = Math.min(1, (Math.abs(dx) + Math.abs(dy)) / 40);
    velX += dx * 2.5; velY += dy * 2.5; // once coasted, the nearest layer has moved as far as the input
    jolt = Math.max(jolt, strength); roll += 1;
    last = p.clientX !== undefined ? [p.clientX, p.clientY] : null;
  }
  ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "wheel", "keydown", "keyup"].forEach(function (type) {
    addEventListener(type, react, { passive: true });
  });

  function frame(now) {
    var dt = lastFrame === null ? 16 : Math.min(50, now - lastFrame);
    lastFrame = now;
    animNow += dt;
    var t = dt / 1000, drag = Math.exp(-dt / 400);
    velX *= drag; velY *= drag;
    camX += velX * t; camY += velY * t;
    jolt *= Math.exp(-dt / 400); // dots drift home
    project();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
