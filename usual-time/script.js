// USUAL TIME — rotating pedals backdrop, effect switcher, footer year.
(function () {
  "use strict";

  // Background: stomp boxes on the shared sphere/card rules —
  // dotted bodies with dotted controls (6 knobs, 4 toggles,
  // 2 footswitches), dynamic proximity lines, cursor attractor,
  // elastic settle, tilt gravity, reduced-motion clock.
  (function pedals() {
    var canvas = document.getElementById("bg-pedals");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var W = 0, H = 0, lastFrame = null;
    function mulberry(seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    var rng = mulberry(42);
    // Fixed world: one seeded minimum-distance pool, sized for a
    // 2560x1440 field. Viewports crop the field; never reshape it.
    var WORLD_W = 2560, WORLD_H = 1440;
    var FIELD_SEED = (Math.random() * 4294967296) | 0; // fresh field every load, stable within it
    function scatterLayout(minDist, max, salt) {
      var seed = (FIELD_SEED + salt) | 0;
      function rnd() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      }
      var r2 = (minDist / WORLD_W) * (minDist / WORLD_W);
      var pool = [], guard = 0;
      while (pool.length < max && guard < max * 400) {
        guard++;
        var cx = rnd(), cy = rnd(), ok = true;
        for (var i = 0; i < pool.length; i++) {
          var dx = cx - pool[i][0], dy = cy - pool[i][1];
          if (dx * dx + dy * dy < r2) { ok = false; break; }
        }
        if (ok) pool.push([cx, cy]);
      }
      while (pool.length < max) pool.push([rnd(), rnd()]);
      return pool.slice(0, Math.min(max, Math.round(WORLD_W * WORLD_H / (minDist * minDist))));
    }
    var layoutTimer = null;
    function scheduleLayout() {
      if (layoutTimer) clearTimeout(layoutTimer);
      layoutTimer = setTimeout(layout, 150);
    }
    function resize() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = window.innerWidth, h = window.innerHeight;
      if (W && Math.abs(w - W) < 2 && Math.abs(h - H) < 2) return; // ignore URL-bar wobble
      W = w; H = h;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scheduleLayout();
    }
    window.addEventListener("resize", resize);

    // One stomp box as a true 3D polygon at real scale (units
    // are mm): a 125B enclosure (Hammond 1590N1) in portrait,
    // 66 wide x 121 long x 40 deep. Controls at their real sizes:
    // Controls at the actual build's sizes: knobs 12.7 across,
    // MTS-102 mini toggles (10.5 bat), long-bushing 3PDT
    // footswitches, and an LED above each footswitch.
    var PW = 66, PH = 121, PD = 40;
    var pts = [];
    (function buildPedal() {
      var i, j, k;
      function face(nx, ny, place) {
        for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
          place(-1 + (i + 0.5) * 2 / nx + (rng() - 0.5) * 0.04,
                -1 + (j + 0.5) * 2 / ny + (rng() - 0.5) * 0.04);
        }
      }
      var hw = PW / 2, hh = PH / 2, hd = PD / 2;
      face(6, 10, function (u, v) { pts.push([u * hw, v * hh, hd]); });         // top
      face(3, 5, function (u, v) { pts.push([u * hw, v * hh, -hd]); });         // bottom, sparser
      face(3, 10, function (u, v) { pts.push([-hw, v * hh, u * hd]); });        // left side
      face(3, 10, function (u, v) { pts.push([hw, v * hh, u * hd]); });         // right side
      face(6, 3, function (u, v) { pts.push([u * hw, -hh, v * hd]); });         // front edge
      face(6, 3, function (u, v) { pts.push([u * hw, hh, v * hd]); });          // back edge
      function ring(cx, cy, cz, r, n) {
        for (k = 0; k < n; k++) {
          var a = k / n * Math.PI * 2;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
        }
      }
      // Heights on this build, in toggle units: toggles 1x,
      // knobs 2x, footswitches 2.5x. Toggle bat is 10.5, so
      // knobs top out at 21 and footswitches at 26.
      // 6 knobs: two rows of three.
      for (var r2 = 0; r2 < 2; r2++) for (var c = 0; c < 3; c++) {
        var kx = -20 + c * 20, ky = -40 + r2 * 24;
        ring(kx, ky, hd + 1, 6.3, 10);
        ring(kx, ky, hd + 15, 5.4, 10);
      }
      // 4 toggles in a row: base at the face, 10.5-long bat.
      for (var t = 0; t < 4; t++) {
        var tx = -24 + t * 16, ty = 10;
        for (var l = 0; l < 4; l++) pts.push([tx + l * 1.6, ty - l * 2.2, hd + l * 3.5]);
      }
      // 2 footswitches, each with an LED right above it.
      for (var f = 0; f < 2; f++) {
        var fx = -16 + f * 32, fy = 40;
        ring(fx, fy, hd + 2, 6, 10);
        ring(fx, fy, hd + 18, 5.4, 10);
        ring(fx, fy - 17, hd + 2, 2.5, 6); // 5mm LED in a bezel
      }
    })();

    // Layout owns the population: fixed field, viewport crops it.
    var pedals = [], N = 0, activeN = 0;
    var bx = new Float32Array(0), by = new Float32Array(0);
    var px = new Float32Array(0), py = new Float32Array(0);
    var sf = new Float32Array(0);
    var OFF = new Float32Array(0), VEL = new Float32Array(0);
    var MAXZ = Math.sqrt(PW * PW / 4 + PH * PH / 4 + PD * PD / 4);
    function layout() {
      layoutTimer = null;
      var spots = scatterLayout(384, 64, 77);
      var fresh = [];
      for (var i = 0; i < spots.length; i++) {
        fresh.push({
          x: spots[i][0],
          y: spots[i][1],
          rx: Math.random() * Math.PI * 2, ry: Math.random() * Math.PI * 2, rz: Math.random() * Math.PI * 2,
          sx: (Math.random() - 0.5) * 0.22, sy: (Math.random() - 0.5) * 0.18, sz: (Math.random() - 0.5) * 0.14,
        });
      }
      for (var j = 0; j < fresh.length && j < pedals.length; j++) {
        fresh[j].rx = pedals[j].rx; fresh[j].ry = pedals[j].ry; fresh[j].rz = pedals[j].rz;
        fresh[j].sx = pedals[j].sx; fresh[j].sy = pedals[j].sy; fresh[j].sz = pedals[j].sz;
      }
      pedals = fresh;
      N = pedals.length * pts.length;
      bx = new Float32Array(N); by = new Float32Array(N);
      px = new Float32Array(N); py = new Float32Array(N);
      sf = new Float32Array(N);
      OFF = new Float32Array(N * 2); VEL = new Float32Array(N * 2);
    }
    resize();
    layout();
    if (layoutTimer) { clearTimeout(layoutTimer); layoutTimer = null; }
    var attrX = 0, attrY = 0, attrTX = 0, attrTY = 0, energy = 0;
    var gravX = 0, gravY = 0, gravAmt = 0;

    function project(t) {
      var n = 0;
      var ox = (WORLD_W - W) / 2, oy = (WORLD_H - H) / 2; // centre the field
      for (var ci = 0; ci < pedals.length; ci++) {
        var c = pedals[ci];
        var cxp = c.x * WORLD_W - ox, cyp = c.y * WORLD_H - oy;
        if (cxp < -256 || cxp > W + 256 || cyp < -256 || cyp > H + 256) continue; // offscreen: cropped, not generated
        var ax = c.rx + t / 1000 * c.sx, ay = c.ry + t / 1000 * c.sy, az = c.rz + t / 1000 * c.sz;
        var cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay), caz = Math.cos(az), saz = Math.sin(az);
        for (var i = 0; i < pts.length; i++, n++) {
          var lx = pts[i][0], ly = pts[i][1], lz = pts[i][2];
          var y1 = ly * cax - lz * sax, z1 = ly * sax + lz * cax;
          var x2 = lx * cay + z1 * say, z2 = z1 * cay - lx * say;
          var x3 = x2 * caz - y1 * saz, y3 = x2 * saz + y1 * caz;
          var s = 1 / (1 + z2 / 400);
          bx[n] = cxp + x3 * s; by[n] = cyp + y3 * s;
          var f = Math.max(0, Math.min(1, (MAXZ - z2) / (2 * MAXZ)));
          sf[n] = f + (1 - f) / 8;
        }
      }
      activeN = n;
    }
    function stepElastic(dtMs) {
      var step = Math.min(3, dtMs / 16.7);
      energy *= Math.exp(-dtMs / 1200);
      var ae = 1 - Math.exp(-dtMs / 150);
      attrX += (attrTX - attrX) * ae;
      attrY += (attrTY - attrY) * ae;
      var R = Math.min(W, H) / 2;
      for (var n = 0; n < activeN; n++) {
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
      var DIST = 16, CELL = DIST; // distance-based, as the other pages
      var buckets = [[], [], [], [], [], [], [], []];
      var grid = new Map();
      for (var gj = 0; gj < activeN; gj++) {
        var gk = Math.floor(px[gj] / CELL) + Math.floor(py[gj] / CELL) * 4096;
        if (!grid.has(gk)) grid.set(gk, []);
        grid.get(gk).push(gj);
      }
      for (var aj = 0; aj < activeN; aj++) {
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
        ctx.globalAlpha = ba * ba * ba;
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
        ctx.arc(px[dj], py[dj], 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
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
      if (e.target && e.target.closest && e.target.closest("a, button")) return;
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
    var animNow = 2989;
    function frame(now) {
      var dt = lastFrame === null ? 16 : Math.min(50, now - lastFrame);
      lastFrame = now;
      var adt = reduceMotion ? 0 : dt;
      animNow += adt;
      project(animNow);
      stepElastic(adt);
      draw();
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  })();

  var year = document.getElementById("year");
  if (year) year.textContent = "© " + new Date().getFullYear();
})();
