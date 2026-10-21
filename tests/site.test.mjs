import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite, count } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('blog is removed', () => {
  const html = loadSite('index.html');
  assert.equal(count(html, /href="[^"]*\/blog\/"/), 0);
  assert.equal(existsSync(resolve(root, '_site/blog')), false);
});

test('exactly one news banner, newest first, max 5', () => {
  const html = loadSite('index.html');
  assert.equal(count(html, /class="news-banner"/), 1);
  assert.match(html, /class="news-banner"[^>]*data-latest="2026-09-25"/);
  const first = html.indexOf('class="news-item');
  assert.ok(first > 0);
  assert.match(html.slice(first, first + 400), /LARC was accepted to NeurIPS 2026/);
  // the track is duplicated for the loop; the original set has at most 5 non-clone items
  assert.ok(count(html, /class="news-item"/) <= 5);
  assert.equal(count(html, /aria-label="Dismiss news"/), 1);
});

test('about page no longer has the News section', () => {
  assert.equal(count(loadSite('index.html'), /<div class="news">/), 0);
});

test('banner dates match _news front matter calendar dates', () => {
  const dir = resolve(root, '_news');
  const expected = readdirSync(dir).filter(f => f.endsWith('.md'))
    .map(f => readFileSync(resolve(dir, f), 'utf8').match(/^date:\s*(\d{4}-\d{2}-\d{2})/m)[1])
    .sort().reverse().slice(0, 5);
  const html = loadSite('index.html');
  const got = [...html.matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]);
  assert.deepEqual(got, expected);
});

test('paper cards: stylesheet compiled and script loaded on both pages', () => {
  const css = loadSite('assets/css/main.css');
  assert.match(css, /\.paper-card/);
  assert.match(css, /prefers-reduced-motion/);
  for (const p of ['index.html', 'publications/index.html']) {
    assert.match(loadSite(p), /<script defer src="\/assets\/js\/papers\.js"><\/script>/, p);
  }
});
