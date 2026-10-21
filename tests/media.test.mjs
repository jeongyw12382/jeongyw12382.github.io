import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vdir = resolve(root, 'assets/video/papers');
// Source media that no longer exists upstream (cards fall back to static thumbnails):
//  - jeon2026valr: teaser.mp4 is commented out / 404 on the project page (poster = figure1 only)
//  - jeong2022scnerf: cvlab.postech.ac.kr/~seokjun/scnerf clips 404 (no slider, no poster)
const NO_VIDEO = ['jeon2026valr', 'jeong2022scnerf'];
const NO_MEDIA = ['jeong2022scnerf'];
const KEYS = ['gwak2026cog3dmap', 'jeon2026valr', 'jeon2026larc', 'jeong2026mvsam',
  'jeong2025quantile', 'jeong2024rodygs', 'jeong2024nvsadapter', 'jeong2022scnerf', 'park2022fpt'];

test('every hover key has a clip (or FPT png) and a poster', () => {
  for (const k of KEYS) {
    if (NO_MEDIA.includes(k)) continue;
    if (NO_VIDEO.includes(k)) { assert.ok(existsSync(resolve(vdir, `${k}.jpg`))); continue; }
    const hover = k === 'park2022fpt' ? `assets/img/papers/${k}.png` : `assets/video/papers/${k}${k === 'jeong2022scnerf' ? '-a' : ''}.mp4`;
    assert.ok(existsSync(resolve(root, hover)), `missing ${hover}`);
    assert.ok(existsSync(resolve(vdir, `${k}.jpg`)), `missing poster ${k}.jpg`);
  }
});

test('each mp4 <= 1.5 MB and directory < 20 MB', () => {
  assert.ok(existsSync(vdir), 'assets/video/papers missing');
  let total = 0;
  for (const f of readdirSync(vdir)) {
    const s = statSync(resolve(vdir, f)).size;
    total += s;
    if (f.endsWith('.mp4')) assert.ok(s <= 1.5 * 1024 * 1024, `${f} is ${s} bytes`);
  }
  assert.ok(total < 20 * 1024 * 1024, `total ${total}`);
});

test('manifest paths all exist and cover every key', () => {
  const txt = readFileSync(resolve(root, '_data/paper_media.yml'), 'utf8');
  for (const k of KEYS.filter((k) => !NO_MEDIA.includes(k))) assert.match(txt, new RegExp(`^${k}:`, 'm'), `manifest lacks ${k}`);
  const paths = txt.match(/assets\/[^\s,\]"']+/g) || [];
  assert.ok(paths.length >= (KEYS.length - 1) * 2);
  for (const p of paths) assert.ok(existsSync(resolve(root, p)), `missing ${p}`);
});

test('extra still images are <= 400 KB', () => {
  const d = resolve(root, 'assets/img/papers');
  assert.ok(existsSync(d));
  for (const f of readdirSync(d)) assert.ok(statSync(resolve(d, f)).size <= 400 * 1024, f);
});
