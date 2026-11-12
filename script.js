// One page, three buttons, one living sphere of connected points.
// The page itself never scrolls; the sphere deforms around you.
(function () {
  "use strict";

  var canvas = document.getElementById("bg-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var Y = 3000; // points in the network
  var W = 0, H = 0, lastFrame = null;

  // Small seeded RNG, so the point set is identical on every load.
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // The points: a Fibonacci sphere with seeded jitter — irregular
  // but evenly spread, fixed forever. One sphere, no stages.
  var DIRS = new Float32Array(Y * 3);
  var rng = mulberry(42);
  for (var di = 0; di < Y; di++) {
    var dy0 = 1 - ((di + 0.5) / Y) * 2;
    var dr0 = Math.sqrt(Math.max(0, 1 - dy0 * dy0)), dth0 = di * 2.4;
    var fx = Math.cos(dth0) * dr0, fy = dy0, fz = Math.sin(dth0) * dr0;
    var ja = rng() * Math.PI * 2, jm = rng() * 0.03;
    var tx = -fz, tz = fx;
    var tl = Math.sqrt(tx * tx + tz * tz) || 1;
    var ox = (tx / tl) * Math.cos(ja) + (-fy * (tz / tl)) * Math.sin(ja);
    var oy = dr0 * Math.sin(ja);
    var oz = (tz / tl) * Math.cos(ja) + (fy * (tx / tl)) * Math.sin(ja);
    var gx = fx + ox * jm, gy = fy + oy * jm, gz = fz + oz * jm;
    var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    DIRS[di * 3] = gx / gl;
    DIRS[di * 3 + 1] = gy / gl;
    DIRS[di * 3 + 2] = gz / gl;
  }

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", function () {
    resize();
    // Resizing clears the canvas; reduced-motion has no loop
    // to repaint it, so redraw the static frame explicitly.
    if (reduceMotion) drawStatic();
  });
  resize();

  // Elastic state: each point has an offset from its home position
  // and a velocity. Springs pull offsets toward a moving target
  // (idle waves + cursor + gravity), slightly underdamped, so the
  // surface overshoots a little as it settles.
  var OFF = new Float32Array(Y * 3), VEL = new Float32Array(Y * 3);
  var sx = new Float32Array(Y), sy = new Float32Array(Y), sf = new Float32Array(Y);
  var vx = new Float32Array(Y), vy = new Float32Array(Y), vz = new Float32Array(Y);

  // Cursor attractor (world space, on the front of the sphere) and
  // how much energy the cursor has right now. Energy builds while
  // the mouse moves and decays when it stops — that decay is what
  // lets the surface relax.
  var attrX = 0, attrY = 0, attrZ = -3 / 5, attrTX = 0, attrTY = 0, energy = 0;
  // Gravity direction from phone tilt (unit-ish), 0 = none.
  var gravX = 0, gravY = 0, gravAmt = 0;

  function stepElastic(now, dtMs) {
    var t = now / 1000;
    var step = Math.min(3, dtMs / 16.7);
    energy *= Math.exp(-dtMs / 1200);
    // The attractor itself eases toward the cursor: weight.
    var ae = 1 - Math.exp(-dtMs / 150);
    attrX += (attrTX - attrX) * ae;
    attrY += (attrTY - attrY) * ae;
    var attrLen = Math.sqrt(attrX * attrX + attrY * attrY + attrZ * attrZ) || 1;
    var ax = attrX / attrLen * 3 / 4, ay = attrY / attrLen * 3 / 4, az = attrZ / attrLen * 3 / 4;
    // Autonomous swells: two broad regions that slowly drift all
    // over the sphere (front and back alike), swelling and
    // contracting on incommensurate timescales, so the motion
    // never settles into a recognizable cycle.
    var c1th = t * 0.021, c1ph = 1.1 + 0.7 * Math.sin(t * 0.017);
    var c1 = [Math.sin(c1ph) * Math.cos(c1th), Math.cos(c1ph), Math.sin(c1ph) * Math.sin(c1th)];
    var a1 = 0.045 * (0.5 + 0.5 * Math.sin(t * 0.09 + 1.7)) * (0.6 + 0.4 * Math.sin(t * 0.031));
    var c2th = 2.5 - t * 0.016, c2ph = 2.0 + 0.6 * Math.sin(t * 0.023 + 4);
    var c2 = [Math.sin(c2ph) * Math.cos(c2th), Math.cos(c2ph), Math.sin(c2ph) * Math.sin(c2th)];
    var a2 = -0.035 * (0.5 + 0.5 * Math.sin(t * 0.073 + 0.3));
    for (var j = 0; j < Y; j++) {
      var k = j * 3;
      var dx = DIRS[k], dy = DIRS[k + 1], dz = DIRS[k + 2];
      var hx = dx * 3 / 4, hy = dy * 3 / 4, hz = dz * 3 / 4;
      // Idle: slow low-frequency waves travelling across the
      // surface, radial only — regions expand and contract.
      var wave = Math.sin(dx * 2 + t * 0.35) + Math.sin(dy * 2 - t * 0.27) + Math.sin(dz * 2 + t * 0.31);
      var radial = wave * 0.012;
      // Plus the drifting swells, also radial, front and back.
      var s1x = hx - c1[0] * 3 / 4, s1y = hy - c1[1] * 3 / 4, s1z = hz - c1[2] * 3 / 4;
      radial += a1 * Math.exp(-(s1x * s1x + s1y * s1y + s1z * s1z) / (2 * 0.3025));
      var s2x = hx - c2[0] * 3 / 4, s2y = hy - c2[1] * 3 / 4, s2z = hz - c2[2] * 3 / 4;
      radial += a2 * Math.exp(-(s2x * s2x + s2y * s2y + s2z * s2z) / (2 * 0.49));
      var tx2 = dx * radial, ty2 = dy * radial, tz2 = dz * radial;
      // Cursor: nearby points are pulled toward the attractor,
      // with smooth Gaussian falloff so neighbourhoods move as one.
      // A second, much weaker and broader component reaches the
      // far side, so the back answers subtly instead of sitting
      // still — one continuous surface, depth-dependent response.
      if (energy > 0.002) {
        var ddx = hx - ax, ddy = hy - ay, ddz = hz - az;
        var dd2 = ddx * ddx + ddy * ddy + ddz * ddz;
        var w = Math.exp(-dd2 / (2 * 0.09)) * energy * 0.45;
        tx2 += (ax - hx) * w; ty2 += (ay - hy) * w; tz2 += (az - hz) * w;
        var wf = Math.exp(-dd2 / (2 * 0.5625)) * energy * 0.03;
        tx2 += (ax / (3 / 4)) * wf; ty2 += (ay / (3 / 4)) * wf; tz2 += (az / (3 / 4)) * wf;
      }
      // Gravity: the whole network sags a little toward tilt.
      if (gravAmt > 0.02) {
        var gd = (dx * gravX + dy * gravY) * 0.05 * gravAmt;
        tx2 += gravX * gd; ty2 += gravY * gd;
      }
      // Spring toward the target, underdamped: overshoot on settle.
      for (var c = 0; c < 3; c++) {
        var tgt = c === 0 ? tx2 : c === 1 ? ty2 : tz2;
        VEL[k + c] = (VEL[k + c] + (tgt - OFF[k + c]) * 0.02 * step) * Math.pow(0.92, step);
        OFF[k + c] += VEL[k + c] * step;
      }
      vx[j] = hx + OFF[k]; vy[j] = hy + OFF[k + 1]; vz[j] = hz + OFF[k + 2];
    }
  }

  function draw() {
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#1c1c1c";
    for (var j = 0; j < Y; j++) {
      var s = 1 / (1 + vz[j] / 4);
      sx[j] = cx + vx[j] * R * s;
      sy[j] = cy + vy[j] * R * s;
      sf[j] = Math.max(0, Math.min(1, (3 / 4 - vz[j]) / (3 / 2)));
    }
    // Lines are dynamic: every frame, dots within 1/16 of each
    // other (where they are right now) get a line. Closer = more
    // opaque. Lines are bucketed by opacity so each bucket is
    // a single stroke.
    var buckets = [[], [], [], [], [], [], [], []];
    var grid = new Map();
    for (var gj = 0; gj < Y; gj++) {
      var gk = Math.floor((vx[gj] + 1) * 16) + Math.floor((vy[gj] + 1) * 16) * 64 + Math.floor((vz[gj] + 1) * 16) * 4096;
      if (!grid.has(gk)) grid.set(gk, []);
      grid.get(gk).push(gj);
    }
    for (var aj = 0; aj < Y; aj++) {
      var ax8 = Math.floor((vx[aj] + 1) * 16), ay8 = Math.floor((vy[aj] + 1) * 16), az8 = Math.floor((vz[aj] + 1) * 16);
      for (var ox2 = -1; ox2 <= 1; ox2++) for (var oy2 = -1; oy2 <= 1; oy2++) for (var oz2 = -1; oz2 <= 1; oz2++) {
        var cell = grid.get((ax8 + ox2) + (ay8 + oy2) * 64 + (az8 + oz2) * 4096);
        if (!cell) continue;
        for (var ci = 0; ci < cell.length; ci++) {
          var bj = cell[ci];
          if (bj <= aj) continue;
          var ddx = vx[aj] - vx[bj], ddy = vy[aj] - vy[bj], ddz = vz[aj] - vz[bj];
          var dd = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
          if (dd >= 1 / 16) continue;
          var bk = Math.min(7, Math.floor((1 - dd * 16) * 8));
          buckets[bk].push(sx[aj], sy[aj], sx[bj], sy[bj]);
        }
      }
    }
    ctx.strokeStyle = "#1c1c1c";
    ctx.lineWidth = 1 / 2;
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
    // Dots. Front solid, back diffused: same size, just fainter,
    // so it reads as fog behind.
    for (var dj = 0; dj < Y; dj++) {
      ctx.globalAlpha = sf[dj] + (1 - sf[dj]) / 8;
      ctx.beginPath();
      ctx.arc(sx[dj], sy[dj], 3 / 2, 0, Math.PI * 2); // every dot the same size
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Point the attractor at a screen position and feed it energy
  // proportional to how fast the pointer is moving.
  var lastMX = null, lastMY = null;
  function feedAttractor(x, y) {
    attrTX = (x / W * 2 - 1) * 3 / 4;
    attrTY = (y / H * 2 - 1) * 3 / 4;
    if (lastMX !== null) {
      var moved = Math.sqrt((x - lastMX) * (x - lastMX) + (y - lastMY) * (y - lastMY));
      energy = Math.min(1, energy + moved / 240);
    }
    lastMX = x; lastMY = y;
    if (reduceMotion) drawStatic();
  }
  function drawStatic() {
    for (var j = 0; j < Y; j++) {
      vx[j] = DIRS[j * 3] * 3 / 4; vy[j] = DIRS[j * 3 + 1] * 3 / 4; vz[j] = DIRS[j * 3 + 2] * 3 / 4;
    }
    draw();
  }

  // Desktop: moving the mouse deforms the surface near the cursor.
  // Dragging does the same thing harder — it's the touch fallback.
  // Drags starting on a button never steer, so navigation stays
  // fully interactive.
  var dragging = false, dragMoved = 0, lastPX = 0, lastPY = 0, suppressClick = false;
  window.addEventListener("pointermove", function (e) {
    if (dragging || e.pointerType !== "mouse") return;
    feedAttractor(e.clientX, e.clientY);
  });
  var askedOrientation = false;
  window.addEventListener("pointerdown", function (e) {
    if (e.target && e.target.closest && e.target.closest(".stark-btn")) return;
    // Phones: orientation permission needs a user tap (and HTTPS),
    // but only ask when the tap is on the background — never when
    // someone is just following a navigation link.
    if (!askedOrientation) {
      askedOrientation = true;
      if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === "function") {
        window.DeviceOrientationEvent.requestPermission().catch(function () {});
      }
    }
    dragging = true; dragMoved = 0;
    lastPX = e.clientX; lastPY = e.clientY;
    feedAttractor(e.clientX, e.clientY);
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    dragMoved += Math.abs(e.clientX - lastPX) + Math.abs(e.clientY - lastPY);
    lastPX = e.clientX; lastPY = e.clientY;
    feedAttractor(e.clientX, e.clientY);
  });
  window.addEventListener("pointerup", function () {
    if (dragging && dragMoved > 6) suppressClick = true;
    dragging = false;
  });
  window.addEventListener("click", function (e) {
    if (!suppressClick) return;
    suppressClick = false;
    if (e.target && e.target.closest && e.target.closest(".stark-btn")) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Phone tilt becomes gravity: gamma is sideways, beta (from a
  // natural 45° hold) is forward/back. Wherever this never fires
  // (denied, unsupported, desktop), dragging remains the control.
  window.addEventListener("deviceorientation", function (e) {
    if (e.gamma === null || e.beta === null) return;
    var gx = Math.max(-45, Math.min(45, e.gamma)) / 45;
    var gy = (Math.max(0, Math.min(90, e.beta)) - 45) / 45;
    var gm = Math.sqrt(gx * gx + gy * gy) || 1;
    gravX = gx / gm; gravY = gy / gm;
    gravAmt = Math.min(1, gm);
    if (reduceMotion) drawStatic();
  });

  if (reduceMotion) { drawStatic(); return; }

  function frame(now) {
    var dt = lastFrame === null ? 16 : Math.min(50, now - lastFrame);
    lastFrame = now;
    stepElastic(now, dt);
    draw();
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
