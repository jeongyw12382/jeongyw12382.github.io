import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSite } from './helpers.mjs';

const config = readFileSync(new URL('../_config.yml', import.meta.url), 'utf8');
const token = (config.match(/^mapmyvisitors_token:[ \t]*([A-Za-z0-9_-]*)/m) || [])[1] || '';

test('config declares a mapmyvisitors_token key', () => {
  assert.match(config, /^mapmyvisitors_token:/m);
});

test('visitor map renders on the About page only when a token is set', () => {
  const html = loadSite('index.html');
  if (token) {
    assert.match(html, /<section class="visitor-map"/);
    assert.ok(html.includes(`mapmyvisitors.com/map.js?`) && html.includes(`d=${token}`));
  } else {
    assert.doesNotMatch(html, /mapmyvisitors/);
  }
});

test('visitor map is not loaded on other pages', () => {
  assert.doesNotMatch(loadSite('publications/index.html'), /mapmyvisitors/);
});
