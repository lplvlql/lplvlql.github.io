// Shared background engine: one cloud of permanent dot homes, dynamic
// proximity lines recomputed every frame, and a shifting viewpoint:
// pointers, touch, the wheel and keys move the camera, so every shape is seen
// from a new angle and nearer homes drift further than distant ones;
// while it moves, dots shimmer between nearby positions.
// Pages supply homes and a build function that fills pts and returns the
// shape's radius; an optional link distance joins nearby homes with dotted lines.
// Fixed world: homes are scattered once per load over a 2560x1440 field
// that viewports crop.
var WORLD_W = 2560, WORLD_H = 1440;
// Homes at least minDist apart, each with a random starting angle and slow spin.
function scatterHomes(minDist) {
  var homes = [], count = Math.min(64, Math.round(WORLD_W * WORLD_H / (minDist * minDist)));
  while (homes.length < count) {
    var x = Math.random(), y = Math.random();
    if (homes.some(function (h) { return Math.hypot(x - h.x, y - h.y) < minDist / WORLD_W; })) continue;
    homes.push({
      x: x, y: y,
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

  // Viewpoint: target in [-1, 1], eased without overshoot.
  var viewX = 0, viewY = 0, viewTX = 0, viewTY = 0;
  var VIEW = 0.5, PARALLAX = 48; // max view turn (radians) and drift (px)
  var SHIMMER = 6; // px a dot may hop while the view is moving

  var centres = []; // visible homes on screen, for optional links
  function hop(n, k) { var h = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return h - Math.floor(h) - 0.5; }
  var animNow = 2989; // fixed starting moment, so first frames match every load
  function project() {
    var n = 0, t = animNow;
    centres = [];
    // Shimmer: while the view glides, dots hop between nearby positions;
    // it fades to nothing as the view settles.
    var jump = SHIMMER * Math.min(1, (Math.abs(viewTX - viewX) + Math.abs(viewTY - viewY)) * 2);
    var step = Math.floor(t / 60);
    var ox = (WORLD_W - W) / 2, oy = (WORLD_H - H) / 2; // centre the field
    for (var ci = 0; ci < homes.length; ci++) {
      var c = homes[ci];
      var depth = (ci * 0.6180339887) % 1 * 2 - 1; // stable per home, -1 far to 1 near
      var cxp = c.x * WORLD_W - ox + viewX * depth * PARALLAX, cyp = c.y * WORLD_H - oy + viewY * depth * PARALLAX;
      if (cxp < -256 || cxp > W + 256 || cyp < -256 || cyp > H + 256) continue; // offscreen: cropped, not generated
      centres.push(cxp, cyp);
      var ax = c.rx + t / 1000 * c.sx, ay = c.ry + t / 1000 * c.sy, az = c.rz + t / 1000 * c.sz;
      var cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay), caz = Math.cos(az), saz = Math.sin(az);
      var cvy = Math.cos(viewX * VIEW), svy = Math.sin(viewX * VIEW), cvx = Math.cos(viewY * VIEW), svx = Math.sin(viewY * VIEW);
      for (var i = 0; i < pts.length; i++, n++) {
        var lx = pts[i][0], ly = pts[i][1], lz = pts[i][2];
        var y1 = ly * cax - lz * sax, z1 = ly * sax + lz * cax;
        var x2 = lx * cay + z1 * say, z2 = z1 * cay - lx * say;
        var x3 = x2 * caz - y1 * saz, y3 = x2 * saz + y1 * caz;
        var x4 = x3 * cvy + z2 * svy, z4 = z2 * cvy - x3 * svy; // the viewpoint turns
        var y5 = y3 * cvx - z4 * svx, z5 = y3 * svx + z4 * cvx;
        var s = 1 / (1 + z5 / CAM);
        bx[n] = cxp + x4 * s; by[n] = cyp + y5 * s;
        if (jump > 0.05) { bx[n] += hop(n, step) * jump; by[n] += hop(n, step + 0.5) * jump; }
        var f = Math.max(0, Math.min(1, (MAXZ - z5) / (2 * MAXZ)));
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
    for (var dj = 0; dj < activeN; dj++) {
      ctx.globalAlpha = sf[dj];
      ctx.beginPath();
      ctx.arc(bx[dj], by[dj], 1.5, 0, Math.PI * 2); // every dot the same size
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

  // Only user input moves the viewpoint, never the page moving: pointers and
  // touches aim it, the wheel pushes it, and each key press turns it somewhere new.
  function clamp(v) { return Math.max(-1, Math.min(1, v)); }
  function aim(x, y) { viewTX = x / W * 2 - 1; viewTY = y / H * 2 - 1; }
  ["pointerdown", "pointermove", "pointerup"].forEach(function (type) {
    addEventListener(type, function (e) { aim(e.clientX, e.clientY); });
  });
  addEventListener("touchmove", function (e) { aim(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  addEventListener("wheel", function (e) { viewTX = clamp(viewTX + e.deltaX / 500); viewTY = clamp(viewTY + e.deltaY / 500); }, { passive: true });
  addEventListener("keydown", function () { viewTX = Math.random() * 2 - 1; viewTY = Math.random() * 2 - 1; });

  function frame(now) {
    var dt = lastFrame === null ? 16 : Math.min(50, now - lastFrame);
    lastFrame = now;
    animNow += dt;
    var ease = 1 - Math.exp(-dt / 300);
    viewX += (viewTX - viewX) * ease; viewY += (viewTY - viewY) * ease;
    project();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
