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

// ---- Task 7: about page order + career timeline ----
const section = (html, cls) => {
  const i = html.search(new RegExp(`<(?:div|section) class="${cls}[ "]`));
  assert.ok(i > 0, `section .${cls} missing`);
  return i;
};
const sectionBody = (html, cls) => {
  const start = section(html, cls);
  const end = html.indexOf('</section>', start);
  return html.slice(start, end > 0 ? end : undefined);
};

test('about page order: intro, publications, experience, education, honors, academic', () => {
  const html = loadSite('index.html');
  const order = ['publications', 'experience', 'education', 'honors', 'academic'].map((c) => section(html, c));
  assert.ok(html.indexOf('class="clearfix"') < order[0], 'intro first');
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] < order[i], `order at ${i}`);
});

test('about page: 8 selected papers then a link to all 15', () => {
  const html = loadSite('index.html');
  assert.equal(count(html, /<article class="paper-card"/), 8);
  const keys = ['gwak2026cog3dmap', 'jeon2026larc', 'jeon2026valr', 'jeong2026mvsam', 'jeong2025quantile', 'jeong2024rodygs', 'jeong2024nvsadapter', 'jeong2022scnerf'];
  const bib = readFileSync(resolve(root, '_bibliography/papers.bib'), 'utf8');
  const selected = bib.split(/\n@(?!string)/).slice(1).filter((e) => /selected=\{true\}/.test(e)).map((e) => e.match(/^\w+\{([^,]+),/)[1]);
  assert.deepEqual(selected.sort(), [...keys].sort());
  assert.match(html, /<a[^>]*href="\/publications\/"[^>]*>\s*See all 15 publications →\s*<\/a>/);
});

test('timeline: 5 experience and 3 education items, each a focusable accented card', () => {
  const html = loadSite('index.html');
  const exp = sectionBody(html, 'experience');
  const edu = sectionBody(html, 'education');
  assert.equal(count(exp, /<li class="tl-item"/), 5);
  assert.equal(count(edu, /<li class="tl-item"/), 3);
  const items = [...html.matchAll(/<li class="tl-item"[^>]*>/g)].map((m) => m[0]);
  assert.equal(items.length, 8);
  for (const li of items) {
    assert.match(li, /style="--accent:#[0-9a-f]{6}"/i, li);
    assert.match(li, /tabindex="0"/, li);
    assert.match(li, /data-greet="[^"]+"/, li);
  }
  for (const [frag, greet, lm] of [['Meta', 'Bonjour!', 'paris'], ['NVIDIA', '你好!', 'taipei'], ['Kakao Brain', '안녕하세요!', 'pangyo'], ['Korea Science Academy', '안녕하세요!', 'busan'], ['Computer Vision Lab', '안녕하세요!', 'pohang']]) {
    const i = html.indexOf(frag, html.indexOf('<li class="tl-item"'));
    const li = html.slice(html.lastIndexOf('<li class="tl-item"', i), i);
    assert.match(li, new RegExp(`data-greet="${greet}"`), frag);
    assert.match(li, new RegExp(`href="#lm-${lm}"`), frag);
  }
  assert.match(exp, /<time[^>]*>2026<\/time>/);
  assert.match(exp, /Mentor:[\s\S]*Jaesung Choe/);
  assert.match(edu, /Advisor:[\s\S]*Minsu Cho/);
  assert.match(exp, /class="tl-blurb"[^>]*>\s*Developed a video generative model built on DINO representations\./);
});

test('every landmark <use> resolves to a symbol on the page', () => {
  const html = loadSite('index.html');
  const uses = [...html.matchAll(/<use href="#(lm-[a-z]+)"/g)].map((m) => m[1]);
  assert.equal(uses.length, 8);
  for (const id of new Set(uses)) assert.equal(count(html, new RegExp(`<symbol id="${id}"`)), 1, id);
  for (const id of ['paris', 'taipei', 'pangyo', 'pohang', 'busan']) assert.match(html, new RegExp(`<symbol id="lm-${id}"`));
  assert.equal(count(html, /<svg class="tl-landmark"[^>]*>\s*<title>[^<]+<\/title>/), 8);
});

test('timeline styles and script are shipped', () => {
  const css = loadSite('assets/css/main.css');
  assert.match(css, /\.tl-item/);
  assert.match(css, /\.tl-journey/);
  assert.match(loadSite('index.html'), /<script defer src="\/assets\/js\/timeline\.js"><\/script>/);
});

test('Meta timeline card lists DINO managers and collaborator', () => {
  const html = loadSite('index.html');
  const card = html.match(/<li class="tl-item"[^>]*>(?:(?!<\/li>)[\s\S])*Meta \(DINO Team\)[\s\S]*?<\/li>/)[0];
  assert.match(card, /Managers:\s*Maxime Oquab,\s*Piotr Bojanowski/);
  assert.match(card, /Collaborator:\s*<a href="https:\/\/shaamallow\.com\/"[^>]*>Eyal Benaroche<\/a>/);
});

test('two embargoed DINO-team papers show as locked cards (publications 2026 + About)', () => {
  const pubs = loadSite('publications/index.html');
  const y2026 = pubs.match(/<section class="pub-year" data-year="2026">[\s\S]*?<\/section>/)[0];
  const locked = y2026.match(/<article class="locked-card"[\s\S]*?<\/article>/g) || [];
  assert.equal(locked.length, 2);
  for (const c of locked) {
    assert.match(c, /Under embargo/);
    assert.match(c, /Meta/);
    assert.match(c, /DINO Team/);
    assert.match(c, /class="lock-icon"/);
    assert.match(c, /data-say="[^"]+"/);
  }
  const about = loadSite('index.html');
  const sel = about.match(/<div class="publications selected-papers">[\s\S]*?see-all-papers/)[0];
  assert.equal(count(sel, /<article class="locked-card"/), 2);
});
