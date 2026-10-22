import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { shouldShowBanner, stepIndex, ROTATE_MS } = createRequire(import.meta.url)('../assets/js/news-banner.js');

test('shows when nothing dismissed', () => assert.equal(shouldShowBanner('2026-09-01', null), true));
test('hidden when latest already dismissed', () => assert.equal(shouldShowBanner('2026-09-01', '2026-09-01'), false));
test('shows again when newer news arrives', () => assert.equal(shouldShowBanner('2026-10-01', '2026-09-01'), true));

test('stepIndex wraps around both ways', () => {
  assert.equal(stepIndex(0, 5, 1), 1);
  assert.equal(stepIndex(4, 5, 1), 0);
  assert.equal(stepIndex(0, 5, -1), 4);
  assert.equal(stepIndex(0, 1, 1), 0);
});
test('rotates one item every few seconds', () => assert.ok(ROTATE_MS >= 4000 && ROTATE_MS <= 8000));

test('banner has a pause toggle for touch users (shown by JS only when rotating)', async () => {
  const { loadSite } = await import('./helpers.mjs');
  const html = loadSite('index.html');
  assert.match(html, /<button type="button" class="news-pause" aria-label="Pause news" aria-pressed="false" hidden>/);
});
