import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const C = createRequire(import.meta.url)('../assets/js/companion.js');
const { reduce, onFace, isShake, isNightOwl, HIT_LINES, initState, bubbleOf, track, initGesture } = C;

// his box: 84px wide at (200, 200); face center (242, 250.4), box center (242, 242)
const box = { left: 200, top: 200, width: 84 };
const run = (s, events) => events.reduce(reduce, s);

test('HIT_LINES are the approved escalation', () => {
  assert.deepEqual(HIT_LINES, ['Ouch!', 'Hey, that hurts!', 'Why me?!', "I'm telling my advisor."]);
});

test('onFace: true at the face center, false at the box corner', () => {
  const r = { left: 100, top: 100, width: 84 };
  assert.equal(onFace(100 + 42, 100 + 84 * 0.6, r), true);
  assert.equal(onFace(100, 100, r), false);
  assert.equal(onFace(184, 184, r), false);
});

test('cursor stepping toward his face within 100 px makes him rest', () => {
  let s = initState(0);
  s = reduce(s, { type: 'move', now: 10, x: 330, y: 250, box });
  assert.equal(s.mode, 'follow');
  s = reduce(s, { type: 'move', now: 20, x: 320, y: 250, box }); // 78 px away, closer
  assert.equal(s.mode, 'rest');
});

test('his own catch-up toward a still cursor does not count as approach', () => {
  let s = initState(0);
  s = reduce(s, { type: 'move', now: 10, x: 330, y: 250, box: { left: 150, top: 200, width: 84 } });
  // cursor unchanged; he moved closer (box shifted right)
  s = reduce(s, { type: 'move', now: 20, x: 330, y: 250, box: { left: 200, top: 200, width: 84 } });
  s = reduce(s, { type: 'move', now: 30, x: 330, y: 250, box: { left: 230, top: 200, width: 84 } });
  assert.equal(s.mode, 'follow');
  // and a cursor moving away from the same face position also does not count
  s = reduce(s, { type: 'move', now: 40, x: 340, y: 250, box: { left: 240, top: 200, width: 84 } });
  assert.equal(s.mode, 'follow');
});

test('cursor more than 160 px away returns him to follow', () => {
  let s = run(initState(0), [
    { type: 'move', now: 10, x: 330, y: 250, box },
    { type: 'move', now: 20, x: 320, y: 250, box }
  ]);
  assert.equal(s.mode, 'rest');
  s = reduce(s, { type: 'move', now: 30, x: 380, y: 250, box }); // 138 px from box center: still near
  assert.equal(s.mode, 'rest');
  s = reduce(s, { type: 'move', now: 35, x: 402, y: 242, box }); // exactly 160 px: still near (> 160 leaves)
  assert.equal(s.mode, 'rest');
  s = reduce(s, { type: 'move', now: 40, x: 420, y: 250, box }); // 178 px
  assert.equal(s.mode, 'follow');
});

test('rests after 1100 ms still once he has caught up', () => {
  let s = reduce(initState(0), { type: 'move', now: 0, x: 600, y: 600, box });
  s = reduce(s, { type: 'tick', now: 1000, box, settled: true });
  assert.equal(s.mode, 'follow');
  s = reduce(s, { type: 'tick', now: 1200, box, settled: false });
  assert.equal(s.mode, 'follow');
  s = reduce(s, { type: 'tick', now: 1210, box, settled: true });
  assert.equal(s.mode, 'rest');
});

test('4 hits say HIT_LINES in order, the 5th sends him to sulk', () => {
  let s = initState(0);
  for (let i = 0; i < 4; i++) {
    s = reduce(s, { type: 'hit', now: 100 + i * 200 });
    assert.equal(s.say.text, HIT_LINES[i]);
    assert.equal(s.ouch, true);
    assert.equal(s.mode, 'rest');
  }
  s = reduce(s, { type: 'hit', now: 1000 });
  assert.equal(s.mode, 'sulk');
  assert.equal(s.say.text, 'Hmph.');
  s = reduce(s, { type: 'tick', now: 1000 + 3499 });
  assert.equal(s.mode, 'sulk');
  s = reduce(s, { type: 'tick', now: 1000 + 3500 });
  assert.equal(s.mode, 'follow');
});

test('hit counter resets after 5000 ms', () => {
  let s = run(initState(0), [{ type: 'hit', now: 0 }, { type: 'hit', now: 100 }]);
  assert.equal(s.say.text, HIT_LINES[1]);
  s = reduce(s, { type: 'hit', now: 5200 });
  assert.equal(s.say.text, HIT_LINES[0]);
});

test('a hit during the choir reaction winces but keeps the reaction', () => {
  let s = reduce(initState(0), { type: 'paperHover', now: 0, react: 'choir', say: 'Canonical pose!', accent: '#c2255c' });
  s = reduce(s, { type: 'hit', now: 50 });
  assert.equal(s.ouch, true);
  assert.equal(s.react, 'choir');
  s = reduce(s, { type: 'tick', now: 1000 });
  assert.equal(s.ouch, false);
  assert.equal(s.react, 'choir');
  // once the hit line expires the paper's line comes back
  assert.equal(bubbleOf(s, 2000).text, 'Canonical pose!');
});

test('paper hover sets react, line and accent; leave clears them', () => {
  let s = reduce(initState(0), { type: 'paperHover', now: 0, react: 'distill', say: 'Fits in my pocket!', accent: '#123456' });
  assert.equal(s.react, 'distill');
  assert.deepEqual(bubbleOf(s, 10), { text: 'Fits in my pocket!', accent: '#123456', hover: true });
  s = reduce(s, { type: 'paperLeave', now: 100 });
  assert.equal(s.react, null);
  assert.ok(bubbleOf(s, 200));
  assert.equal(bubbleOf(s, 500), null);
  // LARC has no line: no bubble at all
  s = reduce(s, { type: 'paperHover', now: 600, react: 'larc', say: '', accent: '#7b61ff' });
  assert.equal(bubbleOf(s, 700), null);
});

test('career hover shows the greeting with its accent', () => {
  let s = reduce(initState(0), { type: 'careerHover', now: 0, greet: 'Bonjour!', accent: '#0055a4' });
  assert.equal(bubbleOf(s, 10).text, 'Bonjour!');
  assert.equal(bubbleOf(s, 10).accent, '#0055a4');
  s = reduce(s, { type: 'careerLeave', now: 20 });
  assert.equal(bubbleOf(s, 1000), null);
});

test('idle for 8000 ms puts him to sleep; a move wakes him startled', () => {
  let s = reduce(initState(0), { type: 'idle', now: 7999 });
  assert.equal(s.mode, 'follow');
  s = reduce(s, { type: 'idle', now: 8000 });
  assert.equal(s.mode, 'sleep');
  s = reduce(s, { type: 'move', now: 9000, x: 10, y: 10, box });
  assert.equal(s.mode, 'follow');
  assert.equal(s.startle, true);
  assert.equal(s.say.text, '!');
  s = reduce(s, { type: 'tick', now: 10000, box, settled: false });
  assert.equal(s.startle, false);
});

test('scroll/key input also counts as activity and wakes him', () => {
  let s = reduce(initState(0), { type: 'input', now: 7000 });
  s = reduce(s, { type: 'idle', now: 9000 });
  assert.equal(s.mode, 'follow');
  s = reduce(s, { type: 'idle', now: 15000 });
  assert.equal(s.mode, 'sleep');
  s = reduce(s, { type: 'input', now: 15100 });
  assert.equal(s.mode, 'follow');
  assert.equal(s.startle, true);
});

test('shake makes him dizzy with "@_@" for 1500 ms', () => {
  let s = reduce(initState(0), { type: 'shake', now: 100 });
  assert.equal(s.mode, 'dizzy');
  assert.equal(bubbleOf(s, 200).text, '@_@');
  s = reduce(s, { type: 'tick', now: 1599 });
  assert.equal(s.mode, 'dizzy');
  s = reduce(s, { type: 'tick', now: 1600 });
  assert.equal(s.mode, 'follow');
});

test('isShake: zig-zag yes, straight drag no', () => {
  const zig = [0, 50, 0, 50, 0, 50].map((x, i) => ({ x, t: 1000 + i * 80 }));
  assert.equal(isShake(zig), true);
  const straight = Array.from({ length: 10 }, (_, i) => ({ x: i * 40, t: 1000 + i * 50 }));
  assert.equal(isShake(straight), false);
  const small = [0, 20, 0, 20, 0, 20].map((x, i) => ({ x, t: 1000 + i * 80 }));
  assert.equal(isShake(small), false);
  const slow = [0, 50, 0, 50, 0, 50].map((x, i) => ({ x, t: 1000 + i * 300 }));
  assert.equal(isShake(slow), false);
});

test('isNightOwl: 02:00 yes, 14:00 no', () => {
  assert.equal(isNightOwl(new Date(2026, 0, 1, 2)), true);
  assert.equal(isNightOwl(new Date(2026, 0, 1, 14)), false);
  assert.equal(isNightOwl(new Date(2026, 0, 1, 5)), false);
});

test('night owl yawns at most once per 60 s', () => {
  const night = new Date(2026, 0, 1, 1);
  let s = reduce(initState(0), { type: 'night', now: 1000, date: night });
  assert.equal(s.say.text, 'Still up? Deadline too?');
  const first = s.lastNight;
  s = reduce(s, { type: 'night', now: 30000, date: night });
  assert.equal(s.lastNight, first);
  s = reduce(s, { type: 'night', now: 61000, date: night });
  assert.equal(s.lastNight, 61000);
  const day = reduce(initState(0), { type: 'night', now: 1000, date: new Date(2026, 0, 1, 14) });
  assert.equal(day.say, null);
});

test('contact links say hi; page end thanks once', () => {
  let s = reduce(initState(0), { type: 'contact', now: 0, on: true });
  assert.equal(bubbleOf(s, 10).text, 'Say hi!');
  s = reduce(s, { type: 'contact', now: 20, on: false });
  assert.equal(bubbleOf(s, 1000), null);
  // asleep: no hover chatter
  const zz = reduce(reduce(s, { type: 'contact', now: 1100, on: true }), { type: 'idle', now: 9000 });
  assert.equal(zz.mode, 'sleep');
  assert.equal(bubbleOf(zz, 9100), null);
  s = reduce(s, { type: 'end', now: 2000 });
  assert.equal(bubbleOf(s, 2100).text, 'Thanks for reading!');
  assert.ok(s.waveUntil > 2000);
  const again = reduce(s, { type: 'end', now: 9000 });
  assert.equal(again.waveUntil, s.waveUntil);
});

test('reduce does not mutate its input', () => {
  const s = initState(0);
  const copy = JSON.stringify(s);
  reduce(s, { type: 'hit', now: 1 });
  reduce(s, { type: 'move', now: 1, x: 1, y: 1, box });
  assert.equal(JSON.stringify(s), copy);
});

test('built pages include the companion once, its script, and the footer toggle', async () => {
  const { loadSite, count } = await import('./helpers.mjs');
  for (const page of ['index.html', 'publications/index.html']) {
    const html = loadSite(page);
    assert.equal(count(html, /id="buddy"/), 1, page);
    assert.equal(count(html, /id="yw-art"/), 1, page);
    assert.match(html, /assets\/js\/companion\.js/);
    assert.equal(count(html, /id="companion-toggle"/), 1, page);
  }
});

// ---- face-hit gesture tracker: decides hits and which click to swallow ----
const down = (o) => Object.assign({ type: 'down', now: 0, x: 0, y: 0, pointerType: 'mouse', button: 0, isPrimary: true, face: true }, o);

test('gesture: primary left mouse press on his face is a hit and swallows the following click', () => {
  let r = track(initGesture(), down({ now: 0 }));
  assert.equal(r.hit, true);
  r = track(r.g, { type: 'click', now: 80 });
  assert.equal(r.swallow, true);
  r = track(r.g, { type: 'click', now: 120 });
  assert.equal(r.swallow, false, 'only one click is swallowed');
});

test('gesture: right/middle click or a non-primary pointer does not arm', () => {
  for (const o of [{ button: 2 }, { button: 1 }, { isPrimary: false }]) {
    let r = track(initGesture(), down(o));
    assert.equal(r.hit, false, JSON.stringify(o));
    r = track(r.g, { type: 'click', now: 50 });
    assert.equal(r.swallow, false, JSON.stringify(o));
  }
});

test('gesture: pointercancel disarms', () => {
  let r = track(initGesture(), down({ now: 0 }));
  r = track(r.g, { type: 'cancel', now: 30 });
  r = track(r.g, { type: 'click', now: 60 });
  assert.equal(r.swallow, false);
});

test('gesture: a stale flag cannot swallow a click more than 600 ms later', () => {
  let r = track(initGesture(), down({ now: 0 }));
  r = track(r.g, { type: 'click', now: 601 });
  assert.equal(r.swallow, false);
});

test('gesture: every new press resets the flag', () => {
  let r = track(initGesture(), down({ now: 0 }));
  r = track(r.g, down({ now: 100, face: false }));
  assert.equal(r.hit, false);
  r = track(r.g, { type: 'click', now: 150 });
  assert.equal(r.swallow, false);
});

test('gesture: touch scroll starting on his face is not a hit; a still tap is', () => {
  let r = track(initGesture(), down({ now: 0, x: 100, y: 100, pointerType: 'touch' }));
  assert.equal(r.hit, false, 'touch hits are decided on release');
  r = track(r.g, { type: 'move', now: 30, x: 100, y: 130 });
  r = track(r.g, { type: 'up', now: 60, x: 100, y: 160 });
  assert.equal(r.hit, false);
  r = track(r.g, { type: 'click', now: 80 });
  assert.equal(r.swallow, false);
  // browser takes over the scroll -> pointercancel, no hit
  r = track(r.g, down({ now: 200, x: 100, y: 100, pointerType: 'touch' }));
  r = track(r.g, { type: 'cancel', now: 230 });
  r = track(r.g, { type: 'up', now: 260, x: 100, y: 100 });
  assert.equal(r.hit, false);
  // still tap
  r = track(r.g, down({ now: 400, x: 100, y: 100, pointerType: 'touch' }));
  r = track(r.g, { type: 'move', now: 420, x: 104, y: 103 });
  r = track(r.g, { type: 'up', now: 450, x: 104, y: 103 });
  assert.equal(r.hit, true);
  r = track(r.g, { type: 'click', now: 470 });
  assert.equal(r.swallow, true);
});

/* ---- idle: the frame loop sleeps when nothing moves, and wakes for the next deadline ---- */
test('nextWake: nothing pending while resting with no bubble -> only the sleep deadline', () => {
  let s = initState(0);
  s = reduce(s, { type: 'move', now: 100, x: 500, y: 500, box });
  s = reduce(s, { type: 'tick', now: 1300, box, settled: true }); // -> rest
  assert.equal(s.mode, 'rest');
  assert.equal(C.nextWake(s, 1300), 100 + C.T.sleep);
});

test('nextWake: following waits for the rest deadline; bubbles, ouch, sulk wake earlier', () => {
  let s = initState(0);
  s = reduce(s, { type: 'move', now: 100, x: 500, y: 500, box });
  assert.equal(C.nextWake(s, 200), 100 + C.T.rest);
  s = reduce(s, { type: 'hit', now: 300 });
  assert.equal(C.nextWake(s, 310), 300 + C.T.ouch);
  s = reduce(s, { type: 'tick', now: 300 + C.T.ouch, box, settled: true });
  assert.equal(C.nextWake(s, 300 + C.T.ouch), 300 + C.T.line);
});

test('nextWake: asleep with nothing else pending never wakes on its own', () => {
  let s = assign0({ mode: 'sleep' });
  assert.equal(C.nextWake(s, 50000), Infinity);
});
function assign0(o) { return Object.assign(initState(0), o); }

test('nextWake: past deadlines are ignored', () => {
  const s = assign0({ mode: 'sulk', sulkUntil: 10, say: { text: 'x', until: 5 }, lastInput: 0 });
  assert.equal(C.nextWake(s, 100), Infinity);
});

test('busy: the loop keeps running only while something actually moves', () => {
  const still = { dist: 0.1, hop: 0, kick: { x: 0.01, y: 0 }, jitter: false };
  assert.equal(C.busy(still), false);
  assert.equal(C.busy({ ...still, dist: 3 }), true);
  assert.equal(C.busy({ ...still, hop: 0.5 }), true);
  assert.equal(C.busy({ ...still, kick: { x: 2, y: 0 } }), true);
  assert.equal(C.busy({ ...still, jitter: true }), true);
});

test('contactOf: mail/GitHub/Scholar links count, except inside paper cards and the timeline', () => {
  const link = (excluded) => ({ closest: q => (q === C.CONTACT ? null : excluded ? {} : null) });
  const a = link(false), b = link(true);
  assert.equal(C.contactOf({ closest: q => (q === C.CONTACT ? a : null) }), a);
  assert.equal(C.contactOf({ closest: q => (q === C.CONTACT ? b : null) }), null);
  assert.equal(C.contactOf({ closest: () => null }), null);
  assert.equal(C.contactOf(null), null);
  assert.match(C.NOT_CONTACT, /\.paper-card/);
  assert.match(C.NOT_CONTACT, /\.tl-item/);
});

test('companion.js leaks no globals', async () => {
  const vm = await import('node:vm');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../assets/js/companion.js', import.meta.url), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(src, ctx);
  assert.deepEqual(Object.keys(ctx), []);
});

// ---- stepping aside for links/buttons ----
const overlaps = (a, r) => a.x < r.right && a.x + a.w > r.left && a.y < r.bottom && a.y + a.h > r.top;

test('dodge: leaves a target alone when it does not cover the control', () => {
  const t = { x: 500, y: 500, w: 84, h: 84 };
  assert.deepEqual(C.dodge(t, { left: 100, top: 100, right: 160, bottom: 130 }, 1200, 900), { x: 500, y: 500 });
});

test('dodge: moves him off a link he would cover, staying inside the viewport', () => {
  const r = { left: 300, top: 300, right: 360, bottom: 324 };      // e.g. a "PDF" button
  const t = { x: 320, y: 316, w: 84, h: 84 };                        // cursor+offset lands on it
  const p = C.dodge(t, r, 1200, 900);
  const moved = { x: p.x, y: p.y, w: 84, h: 84 };
  assert.ok(!overlaps(moved, { left: r.left - 10, top: r.top - 10, right: r.right + 10, bottom: r.bottom + 10 }));
  assert.ok(p.x >= 0 && p.y >= 0 && p.x + 84 <= 1200 && p.y + 84 <= 900);
});

test('dodge: near the bottom-right corner it picks a side that still fits', () => {
  const r = { left: 1100, top: 840, right: 1190, bottom: 870 };
  const p = C.dodge({ x: 1110, y: 800, w: 84, h: 84 }, r, 1200, 900);
  assert.ok(p.x + 84 <= 1200 && p.y + 84 <= 900 && p.x >= 0 && p.y >= 0);
  assert.ok(!overlaps({ x: p.x, y: p.y, w: 84, h: 84 }, r));
});

test('INTERACTIVE selector covers links, buttons, chips and paper media', () => {
  for (const s of ['a[href]', 'button', '.filter-chip', '.paper-media']) assert.ok(C.INTERACTIVE.includes(s), s);
});
