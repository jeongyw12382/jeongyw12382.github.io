import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite, count } from './helpers.mjs';

const { pickPlaying, filterKeys, truncateAuthors, createPlayer } = createRequire(import.meta.url)('../assets/js/papers.js');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- pure functions ----------
test('pickPlaying pauses the current card and plays the entering one', () => {
  assert.deepEqual(pickPlaying('a', 'b'), { pause: 'a', play: 'b' });
  assert.deepEqual(pickPlaying(null, 'b'), { pause: null, play: 'b' });
  assert.deepEqual(pickPlaying('b', 'b'), { pause: null, play: 'b' });
});

test('createPlayer: one shared slot, starting B pauses A (card hover and extra clips alike)', () => {
  const fake = (name, log) => ({ name, paused: true,
    play() { this.paused = false; log.push(`play ${name}`); },
    pause() { this.paused = true; log.push(`pause ${name}`); } });
  const log = [];
  const slot = createPlayer();
  const cardHover = fake('card', log), extraA = fake('extraA', log), extraB = fake('extraB', log), other = fake('other', log);
  slot.start(cardHover);
  slot.start(extraA);            // hovering an extra clip in the expanded card
  assert.equal(cardHover.paused, true);
  assert.equal(extraA.paused, false);
  slot.start(extraB);            // tapping an extra clip in another card
  slot.start(other);             // hovering another card
  const playing = [cardHover, extraA, extraB, other].filter((v) => !v.paused).map((v) => v.name);
  assert.deepEqual(playing, ['other']);
  assert.equal(slot.current(), other);
  slot.claim(extraA);            // a clip started by native controls
  assert.equal(other.paused, true);
  slot.stop(extraA);
  assert.equal(slot.current(), null);
  slot.start(other); slot.start(other); // re-entering the same item never pauses it
  assert.equal(other.paused, false);
  assert.deepEqual(log.slice(0, 3), ['play card', 'pause card', 'play extraA']);
});

test('filterKeys filters by topic/category and All returns everything', () => {
  const cards = [
    { key: 'mvsam', topics: ['Segmentation', '3D Understanding'] },
    { key: 'scnerf', topics: ['Neural Fields'] },
    { key: 'fpt', topics: ['Point Cloud', 'Segmentation'] },
  ];
  assert.deepEqual(filterKeys(cards, 'Segmentation'), ['mvsam', 'fpt']);
  assert.deepEqual(filterKeys(cards, 'All'), ['mvsam', 'scnerf', 'fpt']);
});

test('truncateAuthors shows 6 and counts the rest', () => {
  assert.deepEqual(truncateAuthors(7), { shown: 6, more: 1 });
  assert.deepEqual(truncateAuthors(5), { shown: 5, more: 0 });
  assert.deepEqual(truncateAuthors(6), { shown: 6, more: 0 });
});

// ---------- built HTML ----------
const ROLES = ['First author', 'Co-first author', 'Second author', 'Third author', 'Project lead'];
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function cards(html) {
  const parts = html.split(/<article class="paper-card"/).slice(1);
  return parts.map((p) => {
    const body = p.slice(0, p.indexOf('</article>'));
    const key = body.match(/data-key="([^"]+)"/)[1];
    return { key, body };
  });
}
const pub = () => loadSite('publications/index.html');
const card = (key) => cards(pub()).find((c) => c.key === key);

test('publications page has 15 cards with hook, self, role, category', () => {
  const cs = cards(pub());
  assert.equal(cs.length, 15);
  for (const { key, body } of cs) {
    const hook = body.match(/<p class="paper-hook">([\s\S]*?)<\/p>/);
    assert.ok(hook && strip(hook[1]).length > 10, `${key} hook`);
    for (const f of ['problem', 'idea', 'result', 'role']) {
      const blk = body.match(new RegExp(`class="[^"]*paper-${f === 'role' ? 'myrole' : f}"[^>]*>[\\s\\S]*?<p>([\\s\\S]*?)<\\/p>`));
      assert.ok(blk && strip(blk[1]).length > 10, `${key} ${f}`);
    }
    const authors = body.match(/<p class="paper-authors">([\s\S]*?)<\/p>/)[1];
    assert.match(authors, /class="me"/, `${key} self`);
    const role = strip(body.match(/<span class="role-badge">([\s\S]*?)<\/span>/)[1]);
    assert.ok(ROLES.includes(role), `${key} role ${role}`);
    const cat = body.match(/<p class="paper-category">([\s\S]*?)<\/p>/);
    assert.ok(cat && strip(cat[1]).length > 3, `${key} category`);
    assert.match(body, /style="--accent:#[0-9a-f]{6}"/i, `${key} accent`);
    assert.match(body, /data-react="[a-z0-9]+"/, `${key} react`);
    assert.match(body, /<button class="paper-more" aria-expanded="false" aria-controls="[^"]+-detail"/);
    assert.match(body, /class="paper-detail" id="[^"]+-detail" hidden/);
    assert.match(body, /<button[^>]*class="copy-bib"/);
  }
});

test('media kinds follow the manifest and anim ids', () => {
  assert.match(card('jeong2026mvsam').body, /class="paper-media" data-kind="video"/);
  assert.match(card('jeong2022scnerf').body, /class="paper-media" data-kind="canvas"[^>]*data-anim="scnerf"/);
  assert.match(card('kim2023choir').body, /data-kind="canvas"[^>]*data-anim="choir"/);
  assert.match(card('park2022fpt').body, /data-kind="crossfade"/);
  assert.match(card('jeon2026valr').body, /data-kind="crossfade"/);
  // entries without video media never render a <video>
  for (const k of ['jeong2022scnerf', 'kim2023choir', 'park2022fpt', 'jeon2026valr', 'lee2021learning'])
    assert.equal(count(card(k).body, /<video/), 0, k);
  // videos are lazy
  for (const m of card('jeong2026mvsam').body.match(/<video[^>]*>/g)) {
    assert.match(m, /preload="none"/);
    assert.doesNotMatch(m, /\ssrc=/);
  }
  // thumbnails are not click-to-zoom
  assert.equal(count(pub(), /data-zoomable/), 0);
});

test('companion contract and author marks', () => {
  assert.match(card('jeong2024rodygs').body, /data-react="rodygs" data-say="Hold the camera still!"/);
  assert.match(card('jeong2026mvsam').body, /data-react="mvsam" data-say="Segment me!"/);
  assert.match(card('jeon2026larc').body, /data-react="larc" data-say=""/);
  assert.match(card('jeong2025quantile').body, /data-say="43.7× faster!"/);
  const cog = card('gwak2026cog3dmap').body;
  assert.match(cog, /<b class="me">Yoonwoo Jeong<\/b><sup title="Equal contribution">\*<\/sup>/);
  assert.match(cog, /Gwak<\/a><sup title="Equal contribution">\*<\/sup>|Gwak<sup title="Equal contribution">\*<\/sup>/);
  const larc = card('jeon2026larc').body;
  assert.equal(count(larc, /title="Equal advising">†/), 2);
  const ro = card('jeong2024rodygs').body;
  assert.equal(count(ro, /<sup title=/), 0);
  assert.match(ro, /<span class="role-badge">Third author<\/span>/);
  assert.match(card('jeong2022nerffac').body, /<span class="role-badge">Project lead<\/span>/);
  assert.match(card('jeong2025quantile').body, /class="result-num">43.7×</);
  assert.doesNotMatch(card('jeon2026larc').body, /result-num/);
  assert.doesNotMatch(card('jeong2022nerffac').body, /April/);
  // "and" lives inside the last author's span, so it hides with truncated authors
  const perfAuthors = card('jeong2022perf').body.match(/<p class="paper-authors">([\s\S]*?)<\/p>/)[1];
  assert.doesNotMatch(perfAuthors.replace(/<span class="author">[\s\S]*?<\/span>(?=\s*(<span class="author">|$))/g, ''), /and/);
  assert.match(perfAuthors, /<span class="author">and <a[^>]*>Jaesik Park<\/a><\/span>/);
});

test('bibtex copy text hides internal fields but keeps authors', () => {
  const perf = card('jeong2022perf').body;
  const bib = perf.match(/<pre class="bibtex-text"[^>]*>([\s\S]*?)<\/pre>/)[1];
  assert.match(bib, /Anandkumar, Animashree/);
  assert.doesNotMatch(bib, /&lt;b&gt;|,\}/);
  for (const f of ['hook', 'problem', 'idea', 'result', 'role', 'accent', 'react', 'say', 'category', 'topics', 'anim', 'img_path', 'equal_contrib_authors', 'my_role'])
    assert.doesNotMatch(bib, new RegExp(`^\\s*${f}\\s*=`, 'm'), f);
});

test('publications page: category chips with counts, year headings kept', () => {
  const html = pub();
  assert.match(html, /class="paper-filters"/);
  assert.match(strip(html.match(/<button[^>]*data-filter="all"[^>]*>([\s\S]*?)<\/button>/)[1]), /^All \(15\)$/);
  const chipCounts = [...html.matchAll(/<button[^>]*class="filter-chip"[^>]*data-filter="(?!all)[^"]+"[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => +strip(m[1]).match(/\((\d+)\)$/)[1]);
  assert.ok(chipCounts.length >= 5 && chipCounts.length <= 6, `chips ${chipCounts.length}`);
  assert.equal(chipCounts.reduce((a, b) => a + b, 0), 15);
  assert.ok(count(html, /<h2 class="year">/) >= 5);
});

test('about page selected papers use the same card', () => {
  const html = loadSite('index.html');
  assert.equal(count(html, /<article class="paper-card"/), 8); // ruling M: 8 selected
  assert.match(html, /assets\/js\/papers\.js/);
});

test('every bib entry has a category and the coauthor template is gone', () => {
  const bib = readFileSync(resolve(root, '_bibliography/papers.bib'), 'utf8');
  const entries = bib.split(/\n@(?!string)/).slice(1);
  assert.equal(entries.length, 15);
  for (const e of entries) assert.match(e, /\n\s*category\s*=\s*\{[a-z-]+\}/, e.slice(0, 40));
  const co = readFileSync(resolve(root, '_data/coauthors.yml'), 'utf8');
  assert.doesNotMatch(co, /Einstein|Planck|Bach|Schr/);
});
