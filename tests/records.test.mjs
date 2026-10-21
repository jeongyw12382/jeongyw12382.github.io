import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(resolve(root, p), 'utf8');
const dir = (p) => readdirSync(resolve(root, p)).filter((f) => f.endsWith('.md')).sort().map((f) => rd(`${p}/${f}`));
const bib = rd('_bibliography/papers.bib');
const entry = (key) => {
  const m = bib.match(new RegExp(`@\\w+\\{${key},[\\s\\S]*?\\n\\}`));
  assert.ok(m, `bib entry ${key} missing`);
  return m[0];
};
const { match, doesNotMatch, equal } = assert;

test('bib: LARC present with authors', () => {
  const e = entry('jeon2026larc');
  match(e, /LARC: Latent Reasoning in Continuous Space for Unified Multimodal Models/);
  match(e, /Byungwoo Jeon and Yoonwoo Jeong and Hyunseok Lee and Minsu Cho and Jinwoo Shin/);
  match(e, /booktitle=NeurIPS,/);
  match(e, /year=\{2026\}/);
  match(e, /website=\{https:\/\/rootyjeon\.github\.io\/latent-reasoning-umm\/\}/);
  match(e, /pdf=\{https:\/\/rootyjeon\.github\.io\/latent-reasoning-umm\/assets\/larc\.pdf\}/);
  match(e, /selected=\{true\}/);
  assert.ok(existsSync(resolve(root, 'assets/img/publication_preview/neurips_2026_larc.jpg')));
  match(e, /img_path=\{assets\/img\/publication_preview\/neurips_2026_larc\.jpg\}/);
});
test('bib: VaLR is ICML 2026', () => {
  const e = entry('jeon2026valr');
  match(e, /booktitle=ICML,/);
  match(e, /year=\{2026\}/);
  match(e, /abbr=\{ICML\}/);
});
test('bib: RoDyGS year 2025, authors per ruling F', () => {
  const e = entry('jeong2024rodygs'.replace('2024', '2024'));
  match(e, /year=\{2025\}/);
  match(e, /author=\{Junmyeong Lee and Hoseung Choi and Yoonwoo Jeong and Minsu Cho\}/);
  doesNotMatch(e, /\*/);
  doesNotMatch(e, /equal_contrib/);
});
test('bib: SSL scale/orientation is BMVC 2021', () => {
  const e = entry('lee2022sslso');
  match(e, /title=\{Self-supervised Learning of Image Scale and Orientation Estimation\}/);
  match(e, /year=\{2021\}/);
});
test('bib: NVS-Adapter abstract is not FREST', () => {
  const e = entry('jeong2024nvsadapter');
  doesNotMatch(e, /FREST/);
  match(e, /plug-and-play module for a T2I model/);
});
test('bib: typo fixes', () => {
  match(bib, /Features on 3D Gaussian Splatting/);
  match(bib, /Canonical Axes\}/);
  doesNotMatch(bib, /Fieldsn/);
  match(bib, /@string\{WACV = \{[^}]*\(<b>WACV<\/b>\)/);
});
test('years list covers publications', () => {
  const years = [...bib.matchAll(/year=\{(\d{4})\}/g)].map((m) => m[1]);
  const page = rd('_pages/publications.md');
  for (const y of new Set(years)) match(page, new RegExp(`years:.*${y}`));
});
test('cv link points to CV_of_YoonWooJeong.pdf', () => {
  match(rd('_includes/header.html'), /\/assets\/pdf\/CV_of_YoonWooJeong\.pdf/);
  match(rd('_pages/cv.md'), /cv_pdf: CV_of_YoonWooJeong\.pdf/);
  assert.ok(existsSync(resolve(root, 'assets/pdf/CV_of_YoonWooJeong.pdf')));
  assert.ok(!existsSync(resolve(root, 'assets/pdf/cv_yoonwoojeong.pdf')));
});
test('experience matches CV', () => {
  const x = dir('_experience');
  equal(x.length, 5);
  const all = x.join('\n---FILE---\n');
  doesNotMatch(all, /Present/);
  const want = [
    [/Meta/, /DINO/, /2026"/, /Paris/],
    [/NVIDIA/, /2025"/, /Taipei/, /Jaesung Choe/],
    [/Kakao ?Brain/, /2022 - 2023"/, /Pangyo/, /Doyup Lee/],
    [/Computer Vision Lab/, /2018 - 2020"/, /Undergraduate Research Intern/],
    [/Data Intelligence Lab/, /2017 - 2018"/, /Undergraduate Research Intern/],
  ];
  for (const res of want) assert.ok(x.some((f) => res.every((r) => r.test(f))), String(res));
});
test('education matches CV', () => {
  const x = dir('_education');
  equal(x.length, 3);
  const want = [
    [/2021 - 2027 \(expected\)"/, /Integrated M\.S\.\/Ph\.D\. in .*Artificial Intelligence/, /Minsu Cho/],
    [/2017 - 2020"/, /B\.S\. in .*Computer Science and Engineering/],
    [/2014 - 2017"/, /Korea Science Academy of KAIST/, /Busan/],
  ];
  for (const res of want) assert.ok(x.some((f) => res.every((r) => r.test(f))), String(res));
  doesNotMatch(x.join(''), /Present/);
});
test('honors match CV', () => {
  const h = rd('_honors/honor_1.md');
  match(h, /Postechian Fellowship \(2025\)/);
  match(h, /Postechian Fellowship \(2023\)/);
  match(h, /POSTECH Research Award \(2022\)\*\*\n- Top Award.*Self-Calibrating Neural Radiance Fields/);
  match(h, /POSTECH Research Award \(2021\)\*\*\n- Top Award.*Self-supervised Learning of Image Scale and Orientation Estimation/);
  match(h, /POSTECH Programming Contest \(2019\)/);
  doesNotMatch(h, /Programming Contest \(2020\)/);
  match(h, /POSTECH Research Award \(2023\)\*\*\n- Excellence Award.*PeRFception/);
});
test('reviewing services match CV', () => {
  const a = dir('_academic').join('\n');
  for (const s of ['2026', 'ICLR, CVPR, ECCV', '2025', 'CVPR, NeurIPS, TPAMI', 'ECCV, NeurIPS Datasets and Benchmarks Track', 'WACV', '2020', 'NeurIPS'])
    match(a, new RegExp(s));
  equal(dir('_academic').length, 6);
  match(rd('_layouts/about.html'), /include academic\.html/);
});
test('news items present', () => {
  const n = dir('_news').join('\n');
  match(n, /Meta/);
  match(n, /ICML 2026/);
  match(n, /NeurIPS 2026/);
});
test('config excludes docs, tests, .superpowers', () => {
  const c = rd('_config.yml');
  for (const d of ['docs', 'tests', '.superpowers']) match(c, new RegExp(`exclude:[\\s\\S]*?\\n  - ${d.replace('.', '\\.')}\\n`));
});
