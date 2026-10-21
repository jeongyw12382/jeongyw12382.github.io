/* Companion: the little hand-drawn Yoonwoo head that follows the cursor.
 * Pure logic (reduce, onFace, isShake, isNightOwl, HIT_LINES) is exported for tests;
 * the browser glue below routes every state change through reduce().
 * Ported from the approved prototype docs/superpowers/specs/assets/yoonwoo-companion.html (v9).
 * Written in ES5 so jekyll-minifier can handle it. */

var HIT_LINES = ['Ouch!', 'Hey, that hurts!', 'Why me?!', "I'm telling my advisor."];

var T = {
  rest: 1100,       // still this long (and caught up) -> rest
  approach: 100,    // cursor moving toward his face within this -> rest
  leave: 160,       // cursor farther than this from him -> follow again
  sleep: 8000,      // no input this long -> sleep
  hitReset: 5000,
  ouch: 900,
  line: 1300,
  sulk: 3500,
  dizzy: 1500,
  startle: 700,
  night: 60000,
  fade: 300,
  wave: 2600
};
var HIT_RED = '#e03131';

function assign(a, b) {
  var o = {}, k;
  for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
  for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
  return o;
}

/** Geometric face hit test: center (left + w*.5, top + w*.6), radius w*.42. */
function onFace(px, py, rect) {
  var w = rect.width;
  return Math.hypot(px - (rect.left + w * 0.5), py - (rect.top + w * 0.6)) < w * 0.42;
}

/** >= 4 x-direction reversals, each leg moving > 30 px, within the last 600 ms. */
function isShake(samples) {
  if (!samples || samples.length < 2) return false;
  var end = samples[samples.length - 1].t;
  var pts = samples.filter(function (p) { return end - p.t <= 600; });
  var legs = [];            // signed travel of each monotonic x run
  var run = 0;
  for (var i = 1; i < pts.length; i++) {
    var dx = pts[i].x - pts[i - 1].x;
    if (!dx) continue;
    if (run && (dx > 0) !== (run > 0)) { legs.push(run); run = 0; }
    run += dx;
  }
  if (run) legs.push(run);
  var big = legs.filter(function (d) { return Math.abs(d) > 30; });
  var rev = 0;
  for (var j = 1; j < big.length; j++) if ((big[j] > 0) !== (big[j - 1] > 0)) rev++;
  return rev >= 4;
}

/** Visitor local time 00:00–04:59. */
function isNightOwl(date) {
  var h = date.getHours();
  return h >= 0 && h < 5;
}

function initState(now) {
  now = now || 0;
  return {
    mode: 'follow',          // 'follow' | 'rest' | 'sleep' | 'sulk' | 'dizzy'
    hits: 0, lastHit: -Infinity,
    react: null, accent: '',
    ouch: false, ouchUntil: 0,
    startle: false, startleUntil: 0,
    sulkUntil: 0, dizzyUntil: 0,
    lastInput: now, lastMove: now,
    mouse: null,
    say: null,               // transient line {text, accent, until}
    hover: null,             // line held while hovering a paper / career / contact {text, accent}
    lastNight: -Infinity, yawnUntil: 0,
    ended: false, waveUntil: 0
  };
}

function say(s, text, ms, now, accent) {
  return assign(s, { say: { text: text, accent: accent || '', until: now + ms } });
}

function fadeHover(s, now) {
  var h = s.hover;
  return assign(s, { hover: null, say: h ? { text: h.text, accent: h.accent, until: now + T.fade } : s.say });
}

function hoverLine(s, text, accent) {
  return assign(s, { hover: text ? { text: text, accent: accent || '' } : null, say: null });
}

function input(s, now) {
  s = assign(s, { lastInput: now });
  if (s.mode !== 'sleep') return s;
  s = assign(s, { mode: 'follow', startle: true, startleUntil: now + T.startle });
  return say(s, '!', 900, now);
}

function far(s, box) {
  if (!box || !s.mouse) return false;
  var w = box.width;
  return Math.hypot(s.mouse.x - (box.left + w / 2), s.mouse.y - (box.top + w / 2)) >= T.leave;
}

function maybeSleep(s, now) {
  if ((s.mode === 'follow' || s.mode === 'rest') && now - s.lastInput >= T.sleep) {
    return assign(s, { mode: 'sleep', startle: false });
  }
  return s;
}

/** Pure state transition. Never mutates `s`. */
function reduce(s, e) {
  var now = e.now || 0;
  switch (e.type) {
    case 'move': {
      s = input(s, now);
      var prev = s.mouse;
      s = assign(s, { lastMove: now, mouse: { x: e.x, y: e.y } });
      var b = e.box;
      if (b && prev && s.mode === 'follow') {
        // compare old vs new cursor against the SAME face position, so his own catch-up never counts
        var fx = b.left + b.width * 0.5, fy = b.top + b.width * 0.6;
        var d = Math.hypot(e.x - fx, e.y - fy);
        if (d < T.approach && d < Math.hypot(prev.x - fx, prev.y - fy) - 0.8) s = assign(s, { mode: 'rest' });
      }
      if (s.mode === 'rest' && far(s, b)) s = assign(s, { mode: 'follow' });
      return s;
    }
    case 'input':
      return input(s, now);
    case 'idle':
      return maybeSleep(s, now);
    case 'tick': {
      if (s.ouch && now >= s.ouchUntil) s = assign(s, { ouch: false });
      if (s.startle && now >= s.startleUntil) s = assign(s, { startle: false });
      if (s.mode === 'sulk' && now >= s.sulkUntil) s = assign(s, { mode: 'follow' });
      if (s.mode === 'dizzy' && now >= s.dizzyUntil) s = assign(s, { mode: 'follow' });
      if (s.mode === 'follow' && e.settled && now - s.lastMove > T.rest) s = assign(s, { mode: 'rest' });
      else if (s.mode === 'rest' && far(s, e.box)) s = assign(s, { mode: 'follow' });
      return maybeSleep(s, now);
    }
    case 'hit': {
      s = assign(s, { lastInput: now, startle: false });
      var hits = now - s.lastHit > T.hitReset ? 0 : s.hits;
      s = assign(s, { lastHit: now, ouch: true, ouchUntil: now + T.ouch });
      if (hits < HIT_LINES.length) {
        s = assign(s, { hits: hits + 1, mode: s.mode === 'sulk' ? 'sulk' : 'rest' });
        return say(s, HIT_LINES[hits], T.line, now, HIT_RED);
      }
      // had enough: run off to the far corner and sulk
      s = assign(s, { hits: 0, mode: 'sulk', sulkUntil: now + T.sulk });
      return say(s, 'Hmph.', 3000, now, HIT_RED);
    }
    case 'shake':
      if (s.mode === 'sulk' || s.mode === 'sleep') return s;
      s = assign(s, { mode: 'dizzy', dizzyUntil: now + T.dizzy, lastInput: now });
      return say(s, '@_@', T.dizzy, now);
    case 'paperHover':
      s = assign(s, { react: e.react || null, accent: e.accent || '' });
      return hoverLine(s, e.say, e.accent);
    case 'paperLeave':
      return assign(fadeHover(s, now), { react: null });
    case 'careerHover':
      return hoverLine(s, e.greet, e.accent);
    case 'careerLeave':
      return fadeHover(s, now);
    case 'contact':
      return e.on ? hoverLine(s, 'Say hi!', '') : fadeHover(s, now);
    case 'night':
      if (s.mode === 'sleep' || !isNightOwl(e.date) || now - s.lastNight < T.night) return s;
      s = assign(s, { lastNight: now, yawnUntil: now + 2200 });
      return say(s, 'Still up? Deadline too?', 2600, now);
    case 'end':
      if (s.ended) return s;
      s = assign(s, { ended: true, waveUntil: now + T.wave });
      return say(s, 'Thanks for reading!', T.wave, now);
    default:
      return s;
  }
}

/** What the speech bubble shows right now: a live transient line wins over a hover line. */
function bubbleOf(s, now) {
  if (s.say && now < s.say.until) return { text: s.say.text, accent: s.say.accent, hover: false };
  if (s.hover && s.hover.text && s.mode !== 'sleep') return { text: s.hover.text, accent: s.hover.accent, hover: true };
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { reduce: reduce, onFace: onFace, isShake: isShake, isNightOwl: isNightOwl,
    HIT_LINES: HIT_LINES, initState: initState, bubbleOf: bubbleOf, T: T };
}

/* ------------------------------------------------------------------ browser glue */
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  function boot() {
    var buddy = document.getElementById('buddy');
    var art = document.getElementById('yw-art');
    if (!buddy || !art || !window.requestAnimationFrame) return;
    var bubble = buddy.querySelector('.bubble');
    var rig = buddy.querySelector('.rig');
    var toggle = document.getElementById('companion-toggle');

    rig.insertBefore(art.content.cloneNode(true), rig.firstChild);
    rig.querySelectorAll('.ghost').forEach(function (g) { g.appendChild(art.content.cloneNode(true)); });
    // the clones carry no ids; only the main rig tracks the cursor and blinks
    var svg = rig.querySelector(':scope > svg');
    var pupils = svg.querySelector('.pupils');
    var eyes = svg.querySelectorAll('.eye');

    var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
    var reduced = mq('(prefers-reduced-motion: reduce)');
    var finePointer = mq('(hover: hover) and (pointer: fine)');

    var enabled = true;
    try { enabled = localStorage.getItem('companionHidden') !== '1'; } catch (err) { /* ignore */ }

    var t0 = performance.now();
    var state = initState(t0);
    function dispatch(e) { state = reduce(state, e); }

    var W = 84;
    var mouse = { x: innerWidth * 0.7, y: innerHeight * 0.6, seen: false };
    var pos = { x: innerWidth - 90, y: innerHeight - 110 };
    var hop = 0, phase = 0, kick = { x: 0, y: 0 };
    var samples = [];
    var parked = !finePointer || reduced;

    function boxNow() { return { left: pos.x, top: pos.y, width: W }; }

    /* ---- input ---- */
    addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') { dispatch({ type: 'input', now: performance.now() }); return; }
      var now = performance.now();
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
      dispatch({ type: 'move', now: now, x: e.clientX, y: e.clientY, box: boxNow() });
      samples.push({ x: e.clientX, t: now });
      while (samples.length && now - samples[0].t > 600) samples.shift();
      if (!parked && isShake(samples)) { samples = []; dispatch({ type: 'shake', now: now }); }
    }, { passive: true });
    ['scroll', 'keydown', 'touchstart', 'wheel'].forEach(function (n) {
      addEventListener(n, function () { dispatch({ type: 'input', now: performance.now() }); }, { passive: true });
    });

    // a hit is decided by where you click (inside his face), not by whether he is resting
    var swallowClick = false;
    addEventListener('pointerdown', function (e) {
      var now = performance.now();
      if (enabled && onFace(e.clientX, e.clientY, buddy.getBoundingClientRect())) {
        swallowClick = true;
        var b = buddy.getBoundingClientRect();
        var dx = b.left + b.width / 2 - e.clientX, dy = b.top + b.height / 2 - e.clientY, d = Math.hypot(dx, dy) || 1;
        if (!reduced && !parked) kick = { x: dx / d * 14, y: dy / d * 10 };
        dispatch({ type: 'hit', now: now });
        buddy.classList.remove('ouch'); void buddy.offsetWidth; buddy.classList.add('ouch');
        return;
      }
      dispatch({ type: 'input', now: now });
      if (hop <= 0) hop = 1;
    }, true);
    // don't let a hit also follow a link underneath him
    addEventListener('click', function (e) {
      if (swallowClick) { swallowClick = false; e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* ---- page events ---- */
    document.addEventListener('paper:hover', function (e) {
      var d = e.detail || {};
      dispatch({ type: 'paperHover', now: performance.now(), react: d.react, say: d.say, accent: d.accent });
    });
    document.addEventListener('paper:leave', function () { dispatch({ type: 'paperLeave', now: performance.now() }); });
    document.addEventListener('career:hover', function (e) {
      var d = e.detail || {};
      dispatch({ type: 'careerHover', now: performance.now(), greet: d.greet, accent: d.accent });
    });
    document.addEventListener('career:leave', function () { dispatch({ type: 'careerLeave', now: performance.now() }); });

    var CONTACT = 'a[href^="mailto:"], a[href*="github.com"], a[href*="scholar.google"]';
    var contactLink = null;
    document.addEventListener('pointerover', function (e) {
      var a = e.target && e.target.closest ? e.target.closest(CONTACT) : null;
      if (a === contactLink) return;
      contactLink = a;
      dispatch({ type: 'contact', now: performance.now(), on: !!a });
    });

    addEventListener('scroll', function () {
      var doc = document.documentElement;
      if (innerHeight + (window.scrollY || doc.scrollTop) >= doc.scrollHeight - 40) dispatch({ type: 'end', now: performance.now() });
    }, { passive: true });

    function night() { dispatch({ type: 'night', now: performance.now(), date: new Date() }); }
    setTimeout(night, 4000);
    setInterval(night, 61000);

    /* ---- toggle ---- */
    function applyEnabled() {
      buddy.hidden = !enabled;
      if (toggle) {
        toggle.textContent = enabled ? 'Hide companion' : 'Show companion';
        toggle.setAttribute('aria-pressed', enabled ? 'false' : 'true');
      }
    }
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', function () {
        enabled = !enabled;
        try { localStorage.setItem('companionHidden', enabled ? '0' : '1'); } catch (err) { /* ignore */ }
        applyEnabled();
      });
    }
    applyEnabled();

    /* ---- blink: dot eyes squash into little dashes ---- */
    function setEyes(rx, ry) { eyes.forEach(function (el) { el.setAttribute('rx', rx); el.setAttribute('ry', ry); }); }
    function blink() {
      setEyes(3, 0.6);
      setTimeout(function () { setEyes(1.9, 1.9); }, 140);
      setTimeout(blink, 2200 + Math.random() * 3200);
    }
    if (!reduced) setTimeout(blink, 1500);

    /* ---- hand-drawn line boil ---- */
    var noise = document.getElementById('wobble-noise');
    if (!reduced && noise) {
      var seed = 2;
      setInterval(function () { if (!enabled || document.hidden) return; seed = (seed % 4) + 1; noise.setAttribute('seed', seed); }, 180);
    }

    /* ---- render ---- */
    var shown = { cls: '', text: null, accent: null, react: null, hover: null };
    var MODES = ['rest', 'sleep', 'sulk', 'dizzy'];
    function render(now) {
      var s = state;
      MODES.forEach(function (m) { buddy.classList.toggle('is-' + m, s.mode === m); });
      buddy.classList.toggle('resting', s.mode === 'rest');
      if (!s.ouch) buddy.classList.remove('ouch');
      buddy.classList.toggle('yawn', now < s.yawnUntil);
      buddy.classList.toggle('waves', now < s.waveUntil);
      if (s.react !== shown.react) {
        if (shown.react) buddy.classList.remove('react-' + shown.react);
        if (s.react) buddy.classList.add('react-' + s.react);
        buddy.classList.toggle('push', !!s.react);
        shown.react = s.react;
      }
      if (s.accent !== shown.accent) {
        if (s.accent) buddy.style.setProperty('--react', s.accent); else buddy.style.removeProperty('--react');
        shown.accent = s.accent;
      }
      var b = bubbleOf(s, now);
      var text = b ? b.text : null;
      if (text !== shown.text) {
        if (text) bubble.textContent = text;
        bubble.classList.toggle('on', !!text);
        shown.text = text;
      }
      var bAccent = b && b.accent ? b.accent : '';
      if (bAccent !== shown.bAccent) { bubble.style.borderColor = bAccent; shown.bAccent = bAccent; }
      var fromHover = !!(b && b.hover);
      if (fromHover !== shown.hover) { bubble.classList.toggle('from-hover', fromHover); shown.hover = fromHover; }
    }

    function look(tx, ty) {
      var b = svg.getBoundingClientRect();
      var cx = b.left + b.width / 2, cy = b.top + b.height * 0.58;
      var dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy) || 1;
      var k = Math.min(1, d / 100);
      pupils.setAttribute('transform', 'translate(' + (dx / d * 5 * k).toFixed(2) + ' ' + (dy / d * 5 * k).toFixed(2) + ')');
    }

    var last = performance.now();
    var wasStartled = false;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!enabled) { last = now; return; }
      var dt = Math.min(50, now - last) / 16.67; last = now;
      var H = W;

      // sit just below-right of the cursor, never underneath it
      var tx = mouse.x + 20, ty = mouse.y + 16;
      if (parked || !mouse.seen) { tx = innerWidth - W - 24; ty = innerHeight - H - 24; }
      var settled = Math.hypot(tx - pos.x, ty - pos.y) < 6;
      dispatch({ type: 'tick', now: now, box: boxNow(), settled: settled });
      var s = state;

      if (s.startle && !wasStartled && hop <= 0) hop = 1;
      wasStartled = s.startle;

      if (s.mode === 'rest' || s.mode === 'sleep') { tx = pos.x; ty = pos.y; }
      if (s.mode === 'sulk') {
        tx = mouse.x < innerWidth / 2 ? innerWidth - W - 24 : 24;
        ty = mouse.y < innerHeight / 2 ? innerHeight - H - 24 : 24;
      }
      tx = Math.min(Math.max(tx + kick.x, 4), innerWidth - W - 4);
      ty = Math.min(Math.max(ty + kick.y, 4), innerHeight - H - 4);
      kick.x *= 0.85; kick.y *= 0.85;

      var ease = reduced ? 1 : Math.min(1, (s.react === 'qrender' ? 0.22 : 0.075) * dt);
      var vx = (tx - pos.x) * ease, vy = (ty - pos.y) * ease;
      pos.x += vx; pos.y += vy;
      var speed = Math.hypot(vx, vy);
      var moving = speed > 0.35 && !reduced;

      phase += moving ? Math.min(0.4, speed * 0.05) * dt : 0;
      var bounce = reduced ? 0 : moving ? Math.abs(Math.sin(phase)) * -7 : Math.sin(now / 800) * 1;
      if (hop > 0) hop = Math.max(0, hop - 0.04 * dt);
      var jump = reduced ? 0 : -Math.sin(hop * Math.PI) * 18;
      var tilt = reduced ? 0 : moving ? Math.max(-12, Math.min(12, vx * 1.5)) : Math.sin(now / 1300) * 3;
      // squash a little on each landing
      var squash = moving ? 1 - (1 - Math.abs(Math.sin(phase))) * 0.06 : 1;

      // RoDyGS: casual handheld shake
      var shake = s.react === 'rodygs' && !reduced ? 2.6 : 0;
      var sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;

      buddy.style.transform = 'translate(' + (pos.x + sx).toFixed(1) + 'px, ' + (pos.y + bounce + jump + sy).toFixed(1) + 'px) rotate(' +
        tilt.toFixed(2) + 'deg) scale(' + (2 - squash).toFixed(3) + ', ' + squash.toFixed(3) + ')';
      if (mouse.seen) look(mouse.x, mouse.y);
      render(now);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
