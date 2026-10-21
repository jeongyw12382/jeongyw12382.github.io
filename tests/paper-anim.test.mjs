import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const PaperAnim = createRequire(import.meta.url)('../assets/js/paper-anim.js');
const IDS = ['choir', 'selca', 'perf', 'sslso', 'distill', 'nerffactory', 'scnerf'];

function fakeCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); }),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  const listeners = {};
  const canvas = {
    width: 0, height: 0, style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 320, height: 200, left: 0, top: 0 }),
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    removeEventListener: (n, f) => { listeners[n] = (listeners[n] || []).filter((g) => g !== f); },
    setPointerCapture() {}, releasePointerCapture() {},
    parentNode: null
  };
  return { canvas, calls, listeners };
}
const drew = (calls) => calls.some((c) => c === 'arc' || c === 'lineTo');
const frames = (calls) => calls.filter((c) => c === 'clearRect').length;

test('exports one factory per paper id', () => {
  for (const id of IDS) assert.equal(typeof PaperAnim[id], 'function', id);
});

for (const id of IDS) {
  test(`${id}: runs 10 injected frames, draws, stops cleanly`, () => {
    const { canvas, calls } = fakeCanvas();
    const queue = [];
    const raf = (cb) => { queue.push(cb); return queue.length; };
    const a = PaperAnim[id](canvas, { accent: '#4a7cbc', ink: '#222', reduced: false, raf, caf() {} });
    a.start();
    for (let i = 0; i < 10; i++) queue.shift()(i * 16);
    a.stop();
    assert.ok(drew(calls), 'recorded arc or lineTo');
    assert.ok(frames(calls) >= 10);
    assert.equal(canvas.width, 320);
    a.destroy();
  });

  test(`${id}: reduced motion draws exactly one frame`, () => {
    const { canvas, calls } = fakeCanvas();
    let scheduled = 0;
    const a = PaperAnim[id](canvas, { accent: '#4a7cbc', ink: '#222', reduced: true, raf: () => { scheduled++; return 1; } });
    a.start(); a.start();
    a.stop();
    assert.equal(frames(calls), 1);
    assert.equal(scheduled, 0);
    assert.ok(drew(calls));
  });
}

test('choir and scnerf handle pointer drag only while dragging', () => {
  for (const id of ['choir', 'scnerf']) {
    const { canvas, listeners } = fakeCanvas();
    const queue = [];
    const a = PaperAnim[id](canvas, { accent: '#4a7cbc', ink: '#222', raf: (cb) => queue.push(cb), caf() {} });
    a.start();
    let prevented = 0;
    const ev = (x) => ({ clientX: x, pointerId: 1, preventDefault() { prevented++; } });
    listeners.pointermove[0](ev(50));
    assert.equal(prevented, 0, 'hover move is not prevented');
    listeners.pointerdown[0](ev(40));
    listeners.pointermove[0](ev(90));
    assert.ok(prevented > 0, 'drag move is prevented');
    listeners.pointerup[0](ev(90));
    for (let i = 0; i < 5; i++) queue.shift()(i * 16);
    a.destroy();
    assert.equal((listeners.pointerdown || []).length, 0);
  }
});
