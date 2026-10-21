# Interactive Site Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync records to the new CV, remove the blog, add a news ticker, put rich interactive paper cards front and center, give careers a landmark timeline, and ship the approved mouse-following companion.

**Architecture:** Stay on the existing Jekyll + al-folio + jekyll-scholar stack. Paper data lives in `_bibliography/papers.bib` as extra fields that `_layouts/bib.html` renders into cards. Behavior is vanilla JS modules in `assets/js/`, each loaded with `defer` from `_includes/scripts/misc.html`. Pure logic in every module is exported for `node --test`.

**Tech Stack:** Jekyll (built in Docker, `jekyll/jekyll` image via `bin/docker_build_image.sh`), Liquid, SCSS, vanilla ES2020 JS, Node 24 `node --test`, Python + `imageio-ffmpeg` for media transcoding (tooling only), Playwright Docker image for the final smoke check.

**Spec:** `docs/superpowers/specs/2026-10-22-interactive-site-refresh-design.md`
**Approved companion prototype:** `docs/superpowers/specs/assets/yoonwoo-companion.html`

## Global Constraints

- The CV (`assets/pdf/CV_of_YoonWooJeong.pdf`) wins on every factual conflict. Dates are years only.
- No npm bundler. JS files are plain scripts that also `module.exports` their pure functions when `typeof module !== 'undefined'`.
- Every animation and autoplay respects `prefers-reduced-motion: reduce`, falling back to a static thumbnail with no motion.
- Everything works in the light and dark al-folio themes (`html[data-theme="dark"]`) and at 375px width.
- Each paper video is a 4–6 s muted loop, H.264 mp4, about 480px wide, ≤ 1.5 MB, stored under `assets/video/papers/`. Total added media is < 20 MB.
- Videos use `preload="none"` and play only on hover, one at a time.
- Every `localStorage` access is wrapped in try/catch.
- The companion never sits under the cursor. It is clickable only by the geometric face hit test, and a hit swallows the click that follows it.
- Copy on the site is English.

## Review Focus

1. **A paper without media or animation** (e.g. WACV 2021) must still render a clean card with a static thumbnail, with no broken `<video>` and no console error. Test: Task 4 built-HTML test, "entry without media has no video tag".
2. **Rapidly hovering across many cards** must leave at most one video playing and no stuck companion reaction class. Test: Task 4 `pickPlaying` unit test plus a Task 8 Playwright sweep.
3. **Dismissed banner, then a newer news item is added**: the banner must reappear. Test: Task 2 `shouldShowBanner` unit test.
4. **Touch device**: no hover. A tap on a card must expand it without playing an endless video, and the companion must park in the corner. Test: Task 8 Playwright mobile viewport check.
5. **A hit while a paper reaction animation is running** (CHOIR spin, SCNeRF calib): the wince must still show and the classes must clear. Test: Task 6 state-machine unit test `reduce(state, 'hit')` during `react`.

---

### Task 0: Tooling — local build + test harness

**Files:**
- Create: `tests/build.sh` (runs Jekyll build in Docker into `_site/`)
- Create: `tests/helpers.mjs` exporting `loadSite(path: string) -> string` (reads `_site/<path>`) and `count(html: string, re: RegExp) -> number` (no npm deps; regex-based assertions)
- Modify: `.gitignore` (ensure `_site/`, `.jekyll-cache/`, `node_modules/`)

- [ ] **Step 1:** Run `bash bin/docker_build_image.sh` to build the `al-folio:latest` image. Expected: the image is built.
- [ ] **Step 2:** In `tests/build.sh`, run `docker run --rm -v "$PWD:/srv/jekyll" al-folio:latest bundle exec jekyll build`. Expected: exit 0 and `_site/index.html` exists. This is the baseline before any change. Record any pre-existing warnings.
- [ ] **Step 3:** Write `tests/smoke.test.mjs` with `test('site builds with index')`, asserting `_site/index.html` contains `Yoonwoo`. Run `node --test tests/`. Expected: PASS.
- [ ] **Step 4:** Commit with `chore: local docker build + node test harness`.

### Task 1: Records synced to the CV

**Files:**
- Modify: `_bibliography/papers.bib`, `_experience/*.md`, `_education/*.md`, `_honors/honor_1.md`, `_includes/academic.html` (or its data), `_includes/header.html:66`, `_pages/cv.md:8`, `_pages/publications.md` (years)
- Delete: `_experience/experience_1.md`, `assets/pdf/cv_yoonwoojeong.pdf` (already renamed by the owner)
- Add: `_news/ann_4.md` (Meta internship, 2026-05), `_news/ann_5.md` (VaLR → ICML 2026), `_news/ann_6.md` (LARC → NeurIPS 2026). Use the real announcement months when known; otherwise use the month the venue's decisions came out.
- Test: `tests/records.test.mjs`

- [ ] **Step 1: Write the failing tests.** The tests read the source files, not `_site`.

```js
test('bib: LARC present with authors', () => { match(bib, /LARC: Latent Reasoning in Continuous Space/); match(bib, /Byungwoo Jeon and Yoonwoo Jeong and Hyunseok Lee and Minsu Cho and Jinwoo Shin/); });
test('bib: VaLR is ICML 2026', ...);          // VaLR entry booktitle=ICML, year 2026
test('bib: RoDyGS year 2025', ...);
test('bib: SSL scale/orientation is BMVC 2021 and title ends "Orientation Estimation"', ...);
test('bib: NVS-Adapter abstract is not FREST', () => doesNotMatch(nvsEntry, /FREST/));
test('bib: typo fixes', ...);                 // "Features on 3D Gaussian", "Canonical Axes", no "Fieldsn", WACV string has (<b>WACV</b>)
test('cv link points to CV_of_YoonWooJeong.pdf', ...);  // header.html and cv.md
test('experience matches CV', ...);           // 5 files: Meta DINO 2026 Paris; NVIDIA 2025 Taipei (Mentor: Jaesung Choe); Kakao Brain 2022–2023 Pangyo (Mentor: Doyup Lee); CVLab undergrad intern 2018–2020; Data Intelligence Lab 2017–2018
test('honors match CV', ...);                 // 2025 + 2023 Postechian Fellowship; 2022 POSTECH Research Award → SCNeRF; 2021 → SSL paper; PPC 2019
test('reviewing services match CV', ...);     // 2026 ICLR, CVPR, ECCV … 2020 NeurIPS
```

- [ ] **Step 2:** Run `node --test tests/records.test.mjs`. Expected: FAIL on most assertions.
- [ ] **Step 3: Edit the records.** Take values verbatim from the CV text (the spec §1 lists the deltas).
  - For the NVS-Adapter abstract, fetch the arXiv 2312.07315 abstract.
  - For LARC: `website=https://rootyjeon.github.io/latent-reasoning-umm/`, `pdf=https://rootyjeon.github.io/latent-reasoning-umm/assets/larc.pdf`, `selected={true}`, and save the thumbnail from the project page's `assets/videos/larc-demo.jpg` as `assets/img/publication_preview/neurips_2026_larc.jpg`.
- [ ] **Step 4:** Run the tests plus `bash tests/build.sh`. Expected: PASS, and the build exits 0.
- [ ] **Step 5:** Commit with `feat: sync records with updated CV`.

### Task 2: Remove blog + news ticker banner

**Files:**
- Delete: `blog/`
- Modify: `_config.yml` (blank `blog_nav_title`; remove `blog_name`, `blog_description`, `display_tags`, and the `jekyll-archives` blog permalinks), `_includes/header.html:54-63` (remove the blog item), `_pages/about.md` (`news: false`), `_layouts/default.html` (include the banner right after the header)
- Create: `_includes/news_banner.html`, `assets/js/news-banner.js`, `_sass/_news_banner.scss` (import it in `assets/css/main.scss`)
- Test: `tests/news-banner.test.mjs`, `tests/site.test.mjs`

**Interfaces:**
- Produces: `shouldShowBanner(latestISO: string, dismissedISO: string|null) -> boolean` from `news-banner.js`
- Banner markup: `<div class="news-banner" data-latest="YYYY-MM-DD">` containing a `.news-track` of `.news-item` elements (newest first, at most 5, each with a date and an optional `<a>` when the item has `link`), plus a `button.news-close[aria-label="Dismiss news"]`. The localStorage key is `newsDismissed`.

- [ ] **Step 1: Write the failing tests.**
  - `shouldShowBanner('2026-09-01', null) === true`
  - `shouldShowBanner('2026-09-01', '2026-09-01') === false`
  - `shouldShowBanner('2026-10-01', '2026-09-01') === true` (Review Focus #3)
  - Site test: `_site/index.html` has no `href="/blog/"`, has exactly one `.news-banner`, and its first `.news-item` is the newest news. `_site/blog/` does not exist.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The ticker scrolls with a CSS `@keyframes` translateX over a duplicated track and pauses on `:hover` and `:focus-within`.
  - Under reduced motion, show one item at a time with prev/next buttons.
  - The banner sits under the fixed navbar, so adjust the `body.fixed-top-nav` padding.
- [ ] **Step 4:** Rebuild and run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: remove blog, add news ticker banner`.

### Task 3: Paper media fetch + transcode

**Files:**
- Create: `bin/fetch_paper_media.py` (tooling; reads the table below; downloads into a scratch dir; trims and transcodes into `assets/video/papers/<key>[ -n].mp4` plus `<key>.jpg` posters; copies still images into `assets/img/papers/`)
- Test: `tests/media.test.mjs`

Media table (bib key → source → hover clip, extras):

| key | page | hover | extras |
|---|---|---|---|
| gwak2026cog3dmap | https://cog3dmap.github.io/ | static/videos/robofac_demo.mp4 | static/images/main_figure.png |
| jeon2026valr | https://rootyjeon.github.io/valr/ | static/videos/teaser.mp4 | static/figure/figure1.png |
| jeon2026larc | https://rootyjeon.github.io/latent-reasoning-umm/ | assets/videos/larc-demo.mp4 | assets/img/qual-edit-scaling.jpg, assets/img/method-overview.png |
| jeong2026mvsam | https://jaesung-choe.github.io/mv_sam/ | videos/banner.mp4 | videos/sample1–3.mp4, images/method.png |
| jeong2025quantile | https://jaesung-choe.github.io/qrender/ | videos/teaser.mp4 | images/comparison.png, images/method1.png |
| jeong2024rodygs | https://rodygs.github.io/ | static/videos/rodygs_bear.mp4 | rodygs_blackswan, rodygs_rhino clips, static/images/main_figure.png |
| jeong2024nvsadapter | https://postech-cvlab.github.io/nvsadapter/ | video/sds_image.mp4 | video/sds_text.mp4, images/main_framework.png |
| jeong2022scnerf | https://postech-cvlab.github.io/SCNeRF/ | slider: nerf_colmap/fern_colmap.mp4 vs nerf_wo_colmap/fern_wo_colmap.mp4 (cvlab.postech.ac.kr/~seokjun/scnerf/…) | — |
| park2022fpt | https://cvlab.postech.ac.kr/research/FPT/ | crossfade to images_fpt/qual-seg.png | images_fpt/architecture.png |

- [ ] **Step 1: Write the failing test.** For every `assets/video/papers/*.mp4`, the size is ≤ 1.5 MB. Each hover key above has `<key>.mp4` (or `<key>.png` for FPT) and `<key>.jpg`. The directory total is < 20 MB. For the duration check, run `ffprobe` from `imageio_ffmpeg.get_ffmpeg_exe()` via a Python one-liner, or skip it if unavailable; the size limit is the hard gate.
- [ ] **Step 2:** Run the test. Expected: FAIL (no files).
- [ ] **Step 3: Implement the script.** `pip install imageio-ffmpeg` (in the user env, tooling only).
  - Command: `ffmpeg -ss <start> -t 5 -i in.mp4 -an -vf "scale=480:-2,fps=24" -c:v libx264 -crf 28 -preset slow -movflags +faststart out.mp4`
  - Pick `<start>` by eye from extracted frames, choosing the most striking 5 s. If the file is still > 1.5 MB, raise CRF in steps of 2.
  - Downloads go to a fresh scratch dir. Never execute anything fetched.
- [ ] **Step 4:** Run the script and the test. Expected: PASS. Report the total size.
- [ ] **Step 5:** Commit with `feat: add trimmed paper media`. Commit the script too.

### Task 4: Paper cards (layout, data, behavior)

**Files:**
- Modify: `_layouts/bib.html` (full rewrite of the card markup), `_config.yml` (`filtered_bibtex_keywords` += new fields), `_bibliography/papers.bib` (new fields), `_data/coauthors.yml` (replace the template entries), `_pages/publications.md` (filter chips + single list sorted by year, keeping year headings)
- Create: `assets/js/papers.js`, `_sass/_papers.scss`
- Test: `tests/papers.test.mjs`, extend `tests/site.test.mjs`

**New bib fields** (all optional):
- `hook`: plain one-liner shown largest
- `problem`, `idea`, `result`: 1–2 sentences each
- `result_num` + `result_label`: e.g. `43.7×`, `faster 512-D feature rendering`
- `role`: First / Co-first / Second / Third author, per CV
- `topics`: comma list from {Neural Fields, Gaussian Splatting, 3D Understanding, Segmentation, Multimodal LLM, Generation, Point Cloud, Matching}
- `accent`: hex color
- `media`: hover file under `assets/video/papers/`
- `media_kind`: video | slider | crossfade | canvas
- `media_b`: second video for the slider
- `extras`: semicolon list of paths
- `anim`: canvas animation id for Task 5
- `react` and `say`: companion reaction id and bubble text

The builder writes `hook`, `problem`, `idea`, and `result` for all 15 entries from the abstracts and project pages. Use these hooks verbatim where given:
- MV-SAM: "Click one object in one photo — get it segmented consistently in every view."
- Q-Render: "Render 512-D feature maps from 3D Gaussians ~44× faster by sampling only the Gaussians that matter."
- RoDyGS: "Rebuild moving scenes in 3D from a casual phone video — no camera poses needed."
- LARC: "Lets image-generating multimodal models think in continuous latents, so more thinking gives better images."
- SCNeRF: "Learn a NeRF and the camera itself — lens distortion included — without COLMAP."

**Card markup contract** (consumed by `papers.js`, the companion, and the tests):

```html
<article class="paper-card" id="{{key}}" data-key="{{key}}" data-topics="a|b" data-react="…" data-say="…" style="--accent:#hex">
  <div class="paper-media" data-kind="video|slider|crossfade|canvas|static" data-src="…" data-src-b="…" data-anim="…"><img class="paper-thumb" …></div>
  <div class="paper-body">
    <p class="paper-hook">…</p> <h3 class="paper-title">…</h3>
    <p class="paper-authors">… <b class="me">Yoonwoo Jeong</b><sup title="Equal contribution">*</sup> …</p>
    <p class="paper-meta"><span class="venue">…</span> <span class="role-badge">First author</span></p>
    <div class="paper-links">…<button class="paper-more" aria-expanded="false" aria-controls="{{key}}-detail">More</button></div>
    <ul class="paper-topics">…</ul>
  </div>
  <section class="paper-detail" id="{{key}}-detail" hidden>Problem / Key idea (+figure) / Result (big number + extras) / My role / BibTeX + <button class="copy-bib"></button></section>
</article>
```

**Interfaces:**
- Produces from `papers.js`:
  - `pickPlaying(current: string|null, entering: string) -> {pause: string|null, play: string}`
  - `filterKeys(cards: {key, topics: string[]}[], topic: string|'All') -> string[]`
  - `truncateAuthors(n: number, limit = 6) -> {shown: number, more: number}`
- Produces: a DOM event `paper:hover` with detail `{key, react, say, accent}` and a `paper:leave` event, both dispatched on `document`. The companion (Task 6) listens to these.

- [ ] **Step 1: Write the failing tests.**
  - `pickPlaying('a','b')` deep-equals `{pause:'a', play:'b'}`
  - `pickPlaying(null,'b')` deep-equals `{pause:null, play:'b'}`
  - `filterKeys` with 'Segmentation' returns only the matching keys, and with 'All' returns all of them
  - `truncateAuthors(7)` deep-equals `{shown:6, more:1}`
  - Built HTML: `_site/publications/index.html` has 15 `.paper-card`. Every card has a non-empty `.paper-hook`, `.paper-authors` contains `class="me"`, and `.role-badge` text is in the role set. An entry without media has no `<video` (Review Focus #1). The `jeong2026mvsam` card has `data-kind="video"`, and `jeong2022scnerf` has `data-kind="slider"`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement the layout, SCSS, and JS.**
  - Card grid: thumbnail column 40% on desktop, stacked under 576px.
  - `--accent` drives the left edge, the hover glow, the chip highlight, and the detail header.
  - Hover/focus (desktop): lazily set `src`, then `play()`. On leave, `pause()` and rewind.
  - Touch: a tap on the media toggles play, and a tap on the body toggles the detail (Review Focus #4).
  - The slider is two stacked `<video>` elements with a draggable `clip-path` divider, plus keyboard arrows.
  - Expand animates `grid-template-rows: 0fr → 1fr`.
  - The copy-bib button uses `navigator.clipboard.writeText` with a select-text fallback and shows "Copied".
  - Filter chips sit above the list on the publications page. Hidden cards get `hidden`, and the transition is a FLIP fade.
  - Replace the template entries in `coauthors.yml` with coauthor homepages collected from the project pages' author links.
  - The About page selected list uses the same layout.
- [ ] **Step 4:** Rebuild and run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: interactive paper cards`.

### Task 5: Procedural canvas animations

**Files:**
- Create: `assets/js/paper-anim.js`
- Modify: `papers.js` (for `data-kind="canvas"`, mount `PaperAnim[anim](canvas, opts)` on hover and stop it on leave), `papers.bib` (`media_kind=canvas`, `anim=…`)
- Test: `tests/paper-anim.test.mjs`

**Interfaces:**
- Produces: `PaperAnim = { choir, selca, perf, sslso, distill, nerffactory }`. Each has the shape `(canvas, {accent, ink, reduced}) -> {start(), stop(), destroy()}`. `choir` also handles pointer drag: dragging rotates the shape, and on release it springs back to the canonical pose.
- Content per spec §5:
  - `choir`: a chair point cloud.
  - `selca`: an axis arrow aligning.
  - `perf`: blobs flowing into labels.
  - `sslso`: a patch rotating/scaling with an estimate arrow.
  - `distill`: match lines.
  - `nerffactory`: orbiting blobs.

- [ ] **Step 1: Write the failing test.** For each animation id, use a fake canvas with a stub 2D context (record calls). `start()`, then manually tick 10 frames by injecting `requestAnimationFrame` via `opts.raf`, then `stop()`. Assert that no exception is thrown and that at least one `arc` or `lineTo` call was recorded. With `reduced: true`, exactly one frame is drawn.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3: Implement.** The canvas is sized by `devicePixelRatio`, and colors come from `opts`, read by the caller via `getComputedStyle`.
- [ ] **Step 4:** Run the tests and rebuild. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: procedural paper animations`.

### Task 6: Companion

**Files:**
- Create: `assets/js/companion.js`, `_includes/companion.html` (template SVG + wobble filter + fx SVGs, ported verbatim from the prototype), `_sass/_companion.scss`
- Modify: `_layouts/default.html` (include before the scripts), `_includes/footer.html` (a "Hide/Show companion" text button, remembered in localStorage key `companionHidden`)
- Test: `tests/companion.test.mjs`

**Interfaces:**
- Consumes: the `paper:hover` and `paper:leave` events from Task 4.
- Produces pure functions:
  - `reduce(state, event) -> state`. The state is `{mode: 'follow'|'rest'|'sleep'|'sulk'|'dizzy', hits, react, …}`. Events are `{type:'move'|'idle'|'hit'|'paperHover'|'paperLeave'|'shake'|'tick', now, …}`.
  - `onFace(px, py, rect) -> boolean`, with center `(left + w*.5, top + w*.6)` and radius `w*.42`.
  - `isShake(samples: {x,t}[]) -> boolean`: at least 4 x-direction reversals with |dx| > 30 px within 600 ms.
  - `isNightOwl(date: Date) -> boolean`: local hours 0–4.
  - `HIT_LINES = ['Ouch!', 'Hey, that hurts!', 'Why me?!', "I'm telling my advisor."]`

**Behavior values:**
- Width 84px; offset from cursor +20,+16; follow ease 0.075 (0.22 during `qrender`).
- Rest after 1100 ms still, **or immediately when the cursor moves toward his face within 100 px** (compare previous vs current cursor against the *same* face position so his own catch-up movement never counts); leave rest when the cursor is > 160 px away.
- Sleep after 8000 ms with no input: closed-arc eyes, nodding head, floating "z Z z". Waking does a "!" hop.
- Dizzy shows spiral eyes and "@_@" for 1500 ms.
- Night owl: a yawn bubble "Still up? Deadline too?" at most once per 60 s.
- Contact links (`a[href^="mailto:"]`, github.com, scholar.google): "Say hi!".
- Page end (scrolled within 40 px of the bottom): the sparkle waves and the bubble says "Thanks for reading!", once per page view.
- The 5th hit makes him sulk in the far corner with "Hmph." for 3500 ms. The hit counter resets after 5000 ms.
- Touch devices park him bottom-right. Under reduced motion he is static.

- [ ] **Step 1: Write the failing tests.**
  - `onFace` is true at the face center and false at the box corner.
  - Approach: cursor stepping toward the face within 100 px gives mode 'rest'; him catching up to a stationary-relative cursor does not; cursor > 160 px away returns to 'follow'.
  - 4 hits produce the HIT_LINES in order, and the 5th gives mode 'sulk'.
  - A `hit` while `react='choir'` gives `ouch` true and keeps `react` (Review Focus #5).
  - `idle` at 8000 ms gives 'sleep', and `move` from sleep gives 'follow' with `startle` true.
  - `isShake` is true for a zig-zag sample and false for a straight drag.
  - `isNightOwl(new Date(2026,0,1,2))` is true, and at 14:00 it is false.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Port the prototype's frame loop and draw code. Route all state changes through `reduce`. Add the sleep, dizzy, night, contact, and page-end visuals inside `companion.html`, as extra `<g>` groups toggled by classes on `#buddy`.
- [ ] **Step 4:** Run the tests and rebuild. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: mouse-following companion`.

### Task 7: About page order + career timeline

**Files:**
- Modify: `_layouts/about.html` (order: intro → selected publications → experience → education → honors → academic), `_includes/experience.html`, `_includes/education.html` (timeline markup), `_experience/*.md` and `_education/*.md` front matter (`accent`, `landmark`, `org`, `role`, `place`, `mentor`, `years`, `blurb`)
- Create: `_includes/landmarks.html` (inline SVG line art, one `<symbol id="lm-…">` each: `paris`, `taipei`, `pangyo`, `pohang`, `busan`), `assets/js/timeline.js`, `_sass/_timeline.scss`
- Test: extend `tests/site.test.mjs`

**Interfaces:**
- Timeline item markup: `<li class="tl-item" style="--accent:#hex"><time>2026</time><svg class="tl-landmark"><use href="#lm-paris"/></svg><div>role · org · place · mentor · <p class="tl-blurb"></p></div></li>`.
- Landmark mapping: Meta → paris, NVIDIA → taipei, Kakao Brain → pangyo, POSTECH entries → pohang, KSA → busan.
- `timeline.js` adds `.in-view` via IntersectionObserver. Items are visible by default; the class only adds a stroke-draw animation, so items never sit at opacity 0. On hover/focus the landmark path is drawn with `stroke-dashoffset`.

- [ ] **Step 1: Write the failing tests.** In `_site/index.html`:
  - `.publications` appears before `.experience` in the source order.
  - There are 5 experience `.tl-item` and 3 education `.tl-item`.
  - Each `<use href="#lm-…">` resolves to a `<symbol id>` present in the page.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Rebuild and run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: about page order and landmark career timeline`.

### Task 8: End-to-end smoke + report

**Files:**
- Create: `tests/e2e/smoke.spec.mjs` (Playwright, run with `docker run --rm --network host -v $PWD:/w -w /w mcr.microsoft.com/playwright:v1.48.2-jammy npx -y playwright@1.48.2 test tests/e2e`), with `_site` served by `python3 -m http.server -d _site 4000`.

- [ ] **Step 1: Write the smoke spec.**
  - (a) No console errors on `/` and `/publications/`, in both light and dark.
  - (b) Hover each card in turn: at most 1 `video` has `!paused` at any moment (Review Focus #2).
  - (c) Click "More" on the MV-SAM card: the detail is visible and `aria-expanded=true`.
  - (d) Click the "Segmentation" chip: only the matching cards are visible.
  - (e) Companion: `#buddy` exists. After `mouse.move` it is offset from the cursor. Clicking at its face center shows a bubble containing "Ouch!".
  - (f) At a 375×800 viewport with `hasTouch`, there is no horizontal scroll and `#buddy` sits in the bottom-right corner (Review Focus #4).
  - (g) Save screenshots of `/` and `/publications/` in light and dark, desktop and mobile, to `tests/e2e/shots/`. The folder is gitignored.
- [ ] **Step 2:** Run it. Expected: all PASS. Then look at the screenshots and fix what is visibly wrong.
- [ ] **Step 3:** Report the total media size (`du -sh assets/video/papers`).
- [ ] **Step 4:** Commit with `test: e2e smoke for interactive site`. Do not push; the owner reviews locally first.
