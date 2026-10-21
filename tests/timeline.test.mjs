import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { journeyProgress, journeyPath, careerDetail } = require('../assets/js/timeline.js');

test('journeyProgress clamps to [0, 1] and grows as the list scrolls up', () => {
  assert.equal(journeyProgress(1000, 800, 800), 0);
  assert.equal(journeyProgress(-2000, 800, 800), 1);
  const a = journeyProgress(400, 1000, 800);
  const b = journeyProgress(100, 1000, 800);
  assert.ok(a > 0 && a < b && b < 1);
  assert.equal(journeyProgress(0, 0, 800), 1);
});

test('journeyPath passes through every point in order', () => {
  assert.equal(journeyPath([], 10), '');
  assert.equal(journeyPath([{ x: 10, y: 5 }], 10), 'M10 5');
  const d = journeyPath([{ x: 20, y: 10 }, { x: 20, y: 110 }, { x: 20, y: 210 }], 12);
  assert.match(d, /^M20 10 C/);
  assert.match(d, / 20 110 C/);
  assert.match(d, / 20 210$/);
  assert.equal(count(d, /C/g), 2);
});

test('careerDetail reads greeting and accent from data attributes', () => {
  const el = { getAttribute: (k) => ({ 'data-greet': 'Bonjour!', 'data-accent': '#0866ff' })[k] ?? null };
  assert.deepEqual(careerDetail(el), { greet: 'Bonjour!', accent: '#0866ff' });
  assert.deepEqual(careerDetail({ getAttribute: () => null }), { greet: '', accent: '' });
});

function count(s, re) { return (s.match(re) || []).length; }

test('every focusable timeline card is named by its role and org', async () => {
  const { loadSite } = await import('./helpers.mjs');
  const html = loadSite('index.html');
  const items = html.match(/<li class="tl-item"[^>]*>/g) || [];
  assert.ok(items.length >= 8, `found ${items.length}`);
  const seen = new Set();
  for (const li of items) {
    assert.match(li, /tabindex="0"/);
    const ids = (li.match(/aria-labelledby="([^"]+)"/) || [])[1];
    assert.ok(ids, li);
    const [role, org] = ids.split(' ');
    assert.ok(role && org, ids);
    for (const id of [role, org]) {
      assert.ok(!seen.has(id), `duplicate id ${id}`); seen.add(id);
      assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
    }
    assert.match(html, new RegExp(`<h3 class="tl-role" id="${role}">`));
    assert.match(html, new RegExp(`<p class="tl-org" id="${org}">`));
  }
});
