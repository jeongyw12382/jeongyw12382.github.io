import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite } from './helpers.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// jekyll-minifier (JEKYLL_ENV=production) rewrites `--` inside calc()/min()/max()/clamp()
// into ` -  - `, which browsers drop. Keep var() out of CSS math functions in the sources.
test('no var() inside calc/min/max/clamp in _sass', () => {
  const dir = resolve(root, '_sass');
  const bad = [];
  for (const f of readdirSync(dir, { recursive: true })) {
    if (!String(f).endsWith('.scss')) continue;
    readFileSync(resolve(dir, String(f)), 'utf8').split('\n').forEach((line, i) => {
      if (/\b(calc|min|max|clamp)\([^;]*var\(/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('built main.css has no minifier corruption of custom properties', () => {
  const css = loadSite('assets/css/main.css');
  for (const re of [/var\(\s+-/, /calc\(\s+-\s/, /-\s+-\s+[a-z]/]) {
    const m = css.match(re);
    assert.equal(m, null, m && css.slice(Math.max(0, m.index - 60), m.index + 60));
  }
  assert.match(css, /--bshift/);
});
