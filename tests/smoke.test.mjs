import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSite, count } from './helpers.mjs';

test('site builds with index', () => {
  const html = loadSite('index.html');
  assert.ok(count(html, /Yoonwoo/) > 0);
});
