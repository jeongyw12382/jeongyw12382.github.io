/* Procedural concept animations for paper cards (no libraries).
 * PaperAnim[id](canvas, {accent, ink, reduced, raf, caf}) -> {start, stop, setColors, destroy}
 * Each scene is draw(g, t) with g = {ctx, w, h, u, accent, ink, ctl, st}; t in seconds. */
(function () {
  'use strict';

  // ---------- helpers ----------
  function rng(seed) {                       // mulberry32
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  // yaw (around y), then pitch (around x), then perspective. p = [x,y,z] in about [-1,1].
  function project3D(p, yaw, pitch, cx, cy, s) {
    var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var x = p[0] * cyw + p[2] * syw, z = -p[0] * syw + p[2] * cyw;
    var y = p[1] * cp - z * sp; z = p[1] * sp + z * cp;
    var k = 3 / (3 + z);
    return { x: cx + x * s * k, y: cy - y * s * k, k: k, z: z };
  }
  function dot(g, x, y, r, a, color) {
    var c = g.ctx; c.globalAlpha = a == null ? 1 : a; c.fillStyle = color || g.accent;
    c.beginPath(); c.arc(x, y, Math.max(r, 0.3), 0, 6.2832); c.fill(); c.globalAlpha = 1;
  }
  function line(g, x1, y1, x2, y2, a, color, w) {
    var c = g.ctx; c.globalAlpha = a == null ? 1 : a; c.strokeStyle = color || g.ink; c.lineWidth = w || 1.5;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.globalAlpha = 1;
  }
  function arrow(g, x1, y1, x2, y2, color, w) {
    var a = Math.atan2(y2 - y1, x2 - x1), h = g.u * 0.045;
    line(g, x1, y1, x2, y2, 1, color, w || 2.5);
    var c = g.ctx; c.fillStyle = color || g.accent; c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45));
    c.lineTo(x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45)); c.closePath(); c.fill();
  }
  function text(g, s, x, y, a, size, align) {
    var c = g.ctx; c.globalAlpha = a == null ? 0.8 : a; c.fillStyle = g.ink;
    c.font = '600 ' + (size || g.u * 0.05) + 'px system-ui, sans-serif';
    c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); c.globalAlpha = 1;
  }

  // ---------- player: sizes canvas, runs the loop, wires drag ----------
  function make(draw, drag) {
    return function (canvas, opts) {
      opts = opts || {};
      var win = typeof window !== 'undefined' ? window : null;
      var raf = opts.raf || (win && win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); });
      var caf = opts.caf || (win && win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : clearTimeout);
      var ctx = canvas.getContext('2d');
      var g = { ctx: ctx, w: 0, h: 0, u: 0, accent: opts.accent || '#4a7cbc', ink: opts.ink || '#333', ctl: { dragging: false, x: 0.5, dx: 0 }, st: {} };
      var id = null, t = 0, last = null, running = false, ro = null;
      if (drag) canvas.style.touchAction = 'pan-y';   // vertical scroll stays native

      function resize() {
        var r = canvas.getBoundingClientRect(), dpr = (win && win.devicePixelRatio) || 1;
        g.w = r.width || 320; g.h = r.height || 200; g.u = Math.min(g.w, g.h * 1.4);
        canvas.width = Math.round(g.w * dpr); canvas.height = Math.round(g.h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function frame() {
        ctx.clearRect(0, 0, g.w, g.h);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        draw(g, t);
      }
      function tick(ts) {
        id = null; if (!running) return;
        var now = typeof ts === 'number' ? ts / 1000 : last + 1 / 60;
        var dt = last == null ? 1 / 60 : clamp(now - last, 0, 0.1);
        last = now; t += dt; g.dt = dt;
        frame();
        id = raf(tick);
      }
      function px(e) { var r = canvas.getBoundingClientRect(); return r.width ? (e.clientX - r.left) / r.width : 0.5; }
      var startX = 0, moved = false;
      var onClick = function (e) {            // a drag must not toggle the card's tap-to-play
        if (!moved) return;
        moved = false; e.stopPropagation(); e.preventDefault();
      };
      var onDown = function (e) {
        g.ctl.dragging = true; g.ctl.x = px(e); g.ctl.lastX = e.clientX; startX = e.clientX; moved = false;
        try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      };
      var onMove = function (e) {
        if (!g.ctl.dragging) return;
        e.preventDefault();
        if (Math.abs(e.clientX - startX) > 4) moved = true;
        g.ctl.dx += e.clientX - g.ctl.lastX; g.ctl.lastX = e.clientX; g.ctl.x = px(e);
      };
      var onUp = function (e) {
        g.ctl.dragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (x) {}
      };
      if (drag) {
        canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('click', onClick);
      }
      resize();
      if (typeof ResizeObserver !== 'undefined' && canvas.parentNode) {
        ro = new ResizeObserver(function () { resize(); if (!running) frame(); });
        ro.observe(canvas.parentNode);
      }
      var drawn = false;
      return {
        start: function () {
          if (opts.reduced) { if (!drawn) { drawn = true; t = 1.2; frame(); } return; }   // one still frame
          if (running) return;
          running = true; last = null; id = raf(tick);
        },
        // theme toggles change ink/accent: re-color, and redraw now unless the loop will anyway
        setColors: function (c) {
          var accent = (c && c.accent) || g.accent, ink = (c && c.ink) || g.ink;
          if (accent === g.accent && ink === g.ink) return;
          g.accent = accent; g.ink = ink;
          if (!running && (drawn || t > 0)) frame();
        },
        stop: function () {
          running = false; g.ctl.dragging = false;
          if (id != null) { caf(id); id = null; }
        },
        destroy: function () {
          this.stop(); if (ro) ro.disconnect();
          if (drag) {
            canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('click', onClick);
          }
        }
      };
    };
  }

  // ---------- scenes ----------
  // choir: a chair point cloud; drag rotates it, release springs back to the canonical pose.
  var chair = (function () {
    var r = rng(7), pts = [], i;
    function box(x0, x1, y0, y1, z0, z1, n) {
      for (i = 0; i < n; i++) pts.push([lerp(x0, x1, r()), lerp(y0, y1, r()), lerp(z0, z1, r())]);
    }
    box(-0.5, 0.5, -0.05, 0.05, -0.5, 0.5, 120);          // seat
    box(-0.5, 0.5, 0.05, 0.95, -0.5, -0.4, 110);          // back
    [[-0.5, -0.5], [0.4, -0.5], [-0.5, 0.4], [0.4, 0.4]].forEach(function (p) { box(p[0], p[0] + 0.1, -0.8, -0.05, p[1], p[1] + 0.1, 28); });
    return pts;
  })();
  function choir(g, t) {
    var s = g.st, c = g.ctl;
    s.off = s.off || 0; s.vel = s.vel || 0;
    if (c.dragging) { s.off += c.dx * 0.012; s.vel = 0; }
    else { s.vel += (-s.off * 40 - s.vel * 7) * (g.dt || 1 / 60); s.off += s.vel * (g.dt || 1 / 60); }
    c.dx = 0;
    var yaw = 0.55 + s.off + (c.dragging || Math.abs(s.off) > 0.05 ? 0 : 0.25 * Math.sin(t * 1.4));
    var cx = g.w / 2, cy = g.h * 0.5, sc = g.u * 0.3;
    var proj = chair.map(function (p) { return project3D(p, yaw, 0.3, cx, cy, sc); }).sort(function (a, b) { return b.z - a.z; });
    proj.forEach(function (q) { dot(g, q.x, q.y, g.u * 0.011 * q.k, 0.35 + 0.65 * (q.k - 0.8) / 0.4); });
    var home = Math.abs(s.off) < 0.08;
    text(g, home ? 'canonical pose' : 'rotated input', cx, g.h * 0.93, 0.7);
    text(g, 'drag to rotate', cx, g.h * 0.07, 0.45, g.u * 0.04);
  }

  // selca: an object's axis arrow swings to align with the canonical up axis.
  var cube = (function () {
    var v = [], e = [], i, j;
    for (i = 0; i < 8; i++) v.push([(i & 1 ? 1 : -1) * 0.45, (i & 2 ? 1 : -1) * 0.45, (i & 4 ? 1 : -1) * 0.45]);
    for (i = 0; i < 8; i++) for (j = i + 1; j < 8; j++) { var d = i ^ j; if (d === 1 || d === 2 || d === 4) e.push([i, j]); }
    return { v: v, e: e };
  })();
  function selca(g, t) {
    var T = 5, p = (t % T) / T, k = p < 0.15 ? 0 : p < 0.65 ? ease((p - 0.15) / 0.5) : 1;
    if (p > 0.9) k = 1 - ease((p - 0.9) / 0.1);
    var ang = lerp(1.15, 0, k), cx = g.w / 2, cy = g.h * 0.54, s = g.u * 0.34;
    function rot(v) { var c = Math.cos(ang), n = Math.sin(ang); return [v[0] * c - v[1] * n, v[0] * n + v[1] * c, v[2]]; }
    line(g, cx, cy + s * 0.85, cx, cy - s * 0.95, 0.4, g.ink, 1.5);         // canonical up axis
    text(g, 'canonical axis', cx, g.h * 0.07, 0.55, g.u * 0.04);
    var pr = cube.v.map(function (v) { return project3D(rot(v), 0.6, 0.35, cx, cy, s); });
    cube.e.forEach(function (e) { line(g, pr[e[0]].x, pr[e[0]].y, pr[e[1]].x, pr[e[1]].y, 0.45, g.ink, 1.3); });
    var tip = project3D(rot([0, 1.25, 0]), 0.6, 0.35, cx, cy, s), o = project3D([0, 0, 0], 0, 0, cx, cy, s);
    arrow(g, o.x, o.y, tip.x, tip.y, g.accent, 3.5);
    dot(g, o.x, o.y, g.u * 0.014, 1, g.accent);
    text(g, k > 0.98 ? 'aligned' : 'self-calibrating', cx, g.h * 0.93, 0.75);
  }

  // perf: scene blobs flow along curves into their labels.
  function perf(g, t) {
    var r = rng(11), names = ['chair', 'lamp', 'table'], cols = [g.accent, g.ink, g.accent];
    var T = 5, p = (t % T) / T, lx = g.w * 0.82, n = 18, i;
    for (i = 0; i < 3; i++) {
      var ly = g.h * (0.22 + 0.28 * i);
      ctxChip(g, lx, ly, names[i], g.u * 0.2, g.u * 0.075);
    }
    for (i = 0; i < n; i++) {
      var grp = i % 3, sx = g.w * (0.1 + 0.3 * r()), sy = g.h * (0.12 + 0.76 * r()), rad = g.u * (0.03 + 0.03 * r());
      var d = i / n * 0.35, k = ease((p - 0.15 - d * 0.6) / 0.45), ex = lx - g.u * 0.13, ey = g.h * (0.22 + 0.28 * grp);
      var fade = p > 0.92 ? 1 - (p - 0.92) / 0.08 : 1;
      var x = lerp(sx, ex, k), y = lerp(sy, ey, k) - Math.sin(k * Math.PI) * g.h * 0.12;
      dot(g, x, y, rad * lerp(1, 0.45, k), (grp === 1 ? 0.45 : 0.85) * fade, cols[grp]);
    }
    text(g, 'splats → labels', g.w * 0.33, g.h * 0.93, 0.6);
  }
  function ctxChip(g, x, y, label, w, h) {
    var c = g.ctx; c.globalAlpha = 0.7; c.strokeStyle = g.ink; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x - w / 2 + h / 2, y - h / 2); c.lineTo(x + w / 2 - h / 2, y - h / 2);
    c.arc(x + w / 2 - h / 2, y, h / 2, -1.5708, 1.5708); c.lineTo(x - w / 2 + h / 2, y + h / 2);
    c.arc(x - w / 2 + h / 2, y, h / 2, 1.5708, 4.7124); c.stroke(); c.globalAlpha = 1;
    text(g, label, x, y, 0.85, h * 0.55);
  }

  // sslso: a patch rotates and scales; a dial shows the estimated rotation and scale.
  function sslso(g, t) {
    var ang = t * 0.9, sc = 1 + 0.35 * Math.sin(t * 1.3), est = ang + 0.08 * Math.sin(t * 5);
    var px = g.w * 0.3, py = g.h * 0.5, a = g.u * 0.2 * sc, c = g.ctx;
    c.save(); c.translate(px, py); c.rotate(ang);
    c.globalAlpha = 0.9; c.strokeStyle = g.ink; c.lineWidth = 2; c.strokeRect(-a, -a, 2 * a, 2 * a);
    c.fillStyle = g.accent; c.globalAlpha = 0.85;                       // asymmetric mark so rotation is visible
    c.beginPath(); c.moveTo(-a * 0.6, a * 0.6); c.lineTo(-a * 0.6, -a * 0.6); c.lineTo(a * 0.1, -a * 0.6);
    c.lineTo(a * 0.1, -a * 0.3); c.lineTo(-a * 0.3, -a * 0.3); c.lineTo(-a * 0.3, a * 0.6); c.closePath(); c.fill();
    c.restore(); c.globalAlpha = 1;
    var dx = g.w * 0.74, dy = g.h * 0.48, R = g.u * 0.24;
    dot(g, dx, dy, R, 0.08, g.ink);
    c.strokeStyle = g.ink; c.globalAlpha = 0.4; c.lineWidth = 1.5; c.beginPath(); c.arc(dx, dy, R, 0, 6.2832); c.stroke(); c.globalAlpha = 1;
    arrow(g, dx, dy, dx + R * Math.cos(est - 1.5708) * 0.95, dy + R * Math.sin(est - 1.5708) * 0.95, g.accent, 3.5);
    line(g, g.w * 0.74 - R, g.h * 0.86, g.w * 0.74 - R + 2 * R * (sc - 0.6) / 0.8, g.h * 0.86, 1, g.accent, 4);   // scale bar
    line(g, g.w * 0.3 + a * 1.5, py, g.w * 0.74 - R * 1.3, py, 0.25, g.ink, 1.5);
    text(g, 'rotation θ', dx, g.h * 0.12, 0.6, g.u * 0.045); text(g, 'scale', dx, g.h * 0.93, 0.6, g.u * 0.04);
  }

  // distill: student features (noisy) are pulled toward teacher features along match lines.
  function distill(g, t) {
    var r = rng(5), n = 9, T = 5, p = (t % T) / T, k = ease((p - 0.1) / 0.6), i;
    var lx = g.w * 0.2, rx = g.w * 0.8, fade = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;
    for (i = 0; i < n; i++) {
      var y = g.h * (0.12 + 0.76 * i / (n - 1)), ny = y + (r() - 0.5) * g.h * 0.3, nx = rx - (r()) * g.w * 0.1;
      var sy = lerp(ny, y, k), sx = lerp(nx, rx, k);
      var reveal = clamp((p * 1.6 - i / n * 0.5), 0, 1);
      line(g, lx, y, sx, sy, reveal * lerp(0.2, 0.7, k) * fade, g.accent, 1 + k);
      dot(g, lx, y, g.u * 0.022, 1, g.ink);
      dot(g, sx, sy, g.u * 0.022, fade, g.accent);
    }
    text(g, 'teacher', lx, g.h * 0.05, 0.6, g.u * 0.04); text(g, 'student', rx, g.h * 0.05, 0.6, g.u * 0.04);
    text(g, k > 0.95 ? 'matched' : 'matching features', g.w / 2, g.h * 0.95, 0.65, g.u * 0.045);
  }

  // nerffactory: cameras orbit a radiance blob scene.
  function nerffactory(g, t) {
    var cx = g.w / 2, cy = g.h * 0.52, rx = g.w * 0.38, ry = g.h * 0.2, c = g.ctx, i, a;
    c.strokeStyle = g.ink; c.globalAlpha = 0.25; c.lineWidth = 1.2; c.setLineDash([4, 5]);
    c.beginPath(); c.moveTo(cx + rx, cy);
    for (i = 1; i <= 48; i++) { a = i / 48 * 6.2832; c.lineTo(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
    c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    var blobs = [[0, 0, 0.1], [-0.3, 0.1, 0.07], [0.28, -0.06, 0.08], [0.05, -0.25, 0.06], [-0.1, 0.28, 0.06]];
    blobs.forEach(function (b) { dot(g, cx + b[0] * g.u * 0.5, cy + b[1] * g.u * 0.4, b[2] * g.u, 0.35, g.accent); dot(g, cx + b[0] * g.u * 0.5, cy + b[1] * g.u * 0.4, b[2] * g.u * 0.45, 0.8, g.accent); });
    for (i = 0; i < 6; i++) {
      a = t * 0.7 + i / 6 * 6.2832;
      var x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a), front = Math.sin(a) > 0;
      line(g, x, y, cx, cy, front ? 0.35 : 0.12, g.accent, 1.2);
      dot(g, x, y, g.u * (front ? 0.026 : 0.018), front ? 1 : 0.5, g.ink);
    }
    text(g, 'many views → one radiance field', cx, g.h * 0.93, 0.6, g.u * 0.045);
  }

  // scnerf: a barrel-distorted lens grid straightens as a tiny scene sharpens (camera calibration).
  function scnerf(g, t) {
    var s = g.st, c = g.ctl, T = 6, p = (t % T) / T;
    var auto = p < 0.15 ? 0 : p < 0.7 ? ease((p - 0.15) / 0.55) : p < 0.85 ? 1 : 1 - ease((p - 0.85) / 0.15);
    var target = c.dragging ? clamp(c.x, 0, 1) : auto;
    s.k = s.k == null ? target : s.k + (target - s.k) * (c.dragging ? 0.35 : 0.15);
    var k = s.k, cx = g.w / 2, cy = g.h / 2, half = g.u * 0.4, n = 8, i, j, r = rng(3);
    var amt = (1 - k) * 0.55;
    function warp(u, v) { var d = u * u + v * v; return [cx + u * half * (1 + amt * d * 2 - amt * 0.3), cy + v * half * (1 + amt * d * 2 - amt * 0.3)]; }
    var wob = (1 - k) * g.u * 0.006;
    for (i = 0; i <= n; i++) {
      var f = i / n * 2 - 1, prev = null, prev2 = null;
      for (j = 0; j <= 24; j++) {
        var q = j / 24 * 2 - 1, a1 = warp(f, q), a2 = warp(q, f);
        a1[0] += (r() - 0.5) * wob; a1[1] += (r() - 0.5) * wob; a2[0] += (r() - 0.5) * wob; a2[1] += (r() - 0.5) * wob;
        if (prev) line(g, prev[0], prev[1], a1[0], a1[1], 0.55, g.ink, 1.2);
        if (prev2) line(g, prev2[0], prev2[1], a2[0], a2[1], 0.55, g.ink, 1.2);
        prev = a1; prev2 = a2;
      }
    }
    // tiny scene (sun, blobs, a fern-like triangle) blurred when uncalibrated
    var blur = (1 - k) * g.u * 0.03, objs = [[-0.4, -0.3, 0.07, 0], [0.35, -0.35, 0.05, 1], [0.0, 0.1, 0.09, 1], [-0.25, 0.3, 0.05, 0]];
    objs.forEach(function (o) { var p0 = warp(o[0], o[1]); dot(g, p0[0], p0[1], g.u * o[2] + blur, 0.25 + 0.7 * k, o[3] ? g.accent : g.ink); });
    var b = warp(0.45, 0.4), tp = warp(0.45, 0.05), l = warp(0.3, 0.4), rt = warp(0.6, 0.4), c2 = g.ctx;
    c2.globalAlpha = 0.3 + 0.7 * k; c2.fillStyle = g.accent;
    c2.beginPath(); c2.moveTo(tp[0], tp[1]); c2.lineTo(l[0], l[1]); c2.lineTo(rt[0], rt[1]); c2.closePath(); c2.fill(); c2.globalAlpha = 1;
    line(g, b[0], b[1], b[0], b[1] + g.u * 0.02, 0.5, g.ink, 2);
    text(g, k > 0.97 ? 'calibrated' : 'drag to calibrate the lens', cx, g.h * 0.95, 0.65, g.u * 0.045);
  }

  var PaperAnim = {
    choir: make(choir, true), selca: make(selca), perf: make(perf), sslso: make(sslso),
    distill: make(distill), nerffactory: make(nerffactory), scnerf: make(scnerf, true)
  };
  PaperAnim._helpers = { rng: rng, project3D: project3D };

  if (typeof window !== 'undefined') window.PaperAnim = PaperAnim;
  if (typeof module !== 'undefined') module.exports = PaperAnim;
})();
