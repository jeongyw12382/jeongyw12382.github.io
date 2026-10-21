# Interactive Site Refresh — Design

Date: 2026-10-22
Site: jeongyw12382.github.io (Jekyll, al-folio theme, GitHub Pages)

## Intent

The owner (PhD student, POSTECH CVLab, 3D vision / foundation models) feels the
site is static and lacks interactivity. The refresh should make visitors *play*
with the research — especially the papers — and give the site a personal touch,
while staying an academic homepage first. Records must match the newly updated CV.

## Goals

1. **Records synced to the CV** (`assets/pdf/CV_of_YoonWooJeong.pdf` is the source of truth).
2. **Blog removed entirely** from navigation and build.
3. **News as a top banner** instead of the list on the About page.
4. **A mouse-following character** drawn in SVG, based on the owner's photo.
5. **Interactive papers**: real media scraped from each paper's project page,
   procedural canvas animations for papers without media, expandable cards, topic filters.

## Non-goals

- No redesign of the overall visual identity / color scheme / fonts.
- No new pages (no "research map" page in this round).
- No CMS or build-tool changes (stay on plain Jekyll + vanilla JS; no npm bundler).

## Anti-goals (failure even if it "works")

- Site becomes heavy or slow: repo bloat from raw videos, autoplaying many videos at once.
- Gimmicky/noisy: character or animations that obstruct reading or clicking.
- Broken on mobile or for keyboard users.
- Any record on the site that contradicts the CV.

## Constraints

- GitHub Pages static hosting; Jekyll plugins already in `_plugins/` and Gemfile.
- Videos committed to the repo → must be short and compressed.
- Respect `prefers-reduced-motion`: disable character motion & autoplay, show static thumbnails.
- Must work in light and dark themes (al-folio theme toggle).
- `ffmpeg` is not installed system-wide; use a pip/conda-provided binary (e.g. `imageio-ffmpeg`) for transcoding — tooling only, nothing added to the site.

## Decisions

### 1. Records (CV sync)

- CV PDF was renamed by the owner: `cv_yoonwoojeong.pdf` → `CV_of_YoonWooJeong.pdf`.
  Update `_includes/header.html` and `_pages/cv.md` links. Commit the rename.
- Delete `_experience/experience_1.md` (CVLab RA/TA 2018–Present; not in CV) — builder's call per
  "CV wins", flagged to owner as easily reversible.
- Update `_experience/`: add/adjust entries per CV (Meta DINO 2026, NVIDIA 2025, Kakao Brain 2022–23,
  CVLab undergrad intern 2018–20, Data Intelligence Lab 2017–18). Keep existing file format.
- Update `_education/` per CV (POSTECH integrated M.S./Ph.D. 2021–2027 expected; B.S. 2017–2020; KSA 2014–2017).
- Update `_honors/` per CV award list (CV wins on conflicts, e.g. 2022 POSTECH Research Award paper,
  Programming Contest year 2019, add both Postechian Fellowships).
- Academic services (`academic.html` section): reviewing list per CV.
- Add presentations and extracurriculars to the About page only if an existing section fits;
  otherwise skip (builder's call, keep page short).
- `papers.bib`:
  - VaLR → ICML 2026 (was arXiv).
  - Add "LARC: Latent Reasoning in Continuous Space for Unified Multimodal Models" (NeurIPS 2026, 2nd author).
    Authors: Byungwoo Jeon, Yoonwoo Jeong, Hyunseok Lee, Minsu Cho†, Jinwoo Shin† (†equal advising).
    website = https://rootyjeon.github.io/latent-reasoning-umm/ ; pdf = that site's `assets/larc.pdf`.
    arXiv/code links on the project page are still placeholders → omit them.
  - CV wins on every factual conflict, not only those listed here (e.g. RoDyGS → 2025,
    SSL scale/orientation → BMVC 2021, 2021 POSTECH Research Award → SSL paper).
  - Dates use years only, as in the CV (B.S. 2017–2020).
  - Fix NVS-Adapter abstract (currently contains FREST's abstract) using its arXiv abstract.
  - Q-Render title "Feature" → "Features"; SeLCA "Canonical Axis" → "Canonical Axes";
    PeRFception typo "Fieldsn"; SSL title "…Orientation Estimation"; WACV string shows "IJCV" — fix to WACV.
  - Venue strings for Cog3DMap / MV-SAM / Q-Render stay as preprints.
  - Add a `tldr` field per paper using the CV's one-liners; add `topics` field for filtering.
  - Publications page `years` list: ensure 2026 includes the new entries.

### 2. Blog removal

- Remove nav entry (`blog_nav_title` blank / header block), delete `blog/` directory,
  drop blog-only config (`blog_name`, `display_tags`, `jekyll-archives` blog permalinks) where safe.
- `_posts/` does not exist; nothing else to migrate.

### 2b. Papers front and center (owner: "papers should be easy to see")

- About page order: intro → **Selected publications** (large cards, as in §5) → experience/education timeline
  → awards → services. Publications page uses the same cards.
- Collapsed card shows, without clicking: plain-language one-liner (largest text), title, full author list
  (self in bold, `*` equal contribution / `†` equal advising with hover explanations, coauthors linked via
  `_data/coauthors.yml`, long lists truncated "+N" until expanded), venue, role badge from CV
  (First / Co-first / Second / Third author), links, topic chips.
- Expanded card: Problem → Key idea (+ method figure) → Result (one big number + media) → My role → BibTeX copy.
  Builder drafts all copy from abstracts/project pages; owner reviews afterwards.

### 3. News banner

- Thin full-width banner directly under the fixed navbar on all pages.
- Shows the latest news items (from `_news/`, newest first) as a horizontally scrolling ticker;
  pauses on hover; each item can link if the news item has a `link`.
- Dismissible (×), remembered per-visitor in `localStorage` (wrapped in try/catch) until a newer
  news item appears.
- Remove the News list from the About page (`news: false`).
- Add news items from the CV delta: Meta internship (2026), VaLR ICML 2026, new NeurIPS 2026 paper.
- reduced-motion: no scroll; shows the newest item statically with prev/next arrows.

### 4. Mouse-following character

- **Approved prototype** (owner liked it): `docs/superpowers/specs/assets/yoonwoo-companion.html`
  (artifact https://claude.ai/artifact/TdJ4qiR1Vevb8PzKdWkxqy). Port its SVG, CSS and JS; don't redesign.
- Size: 84px wide (owner asked for bigger than 60px).
- Look (from the owner's own sketch): head only, pen-ink lines on paper fill, slightly tilted round face
  with a small gap in the outline, headphones, big round glasses with dot eyes, brow ticks, pencil blush,
  smug smile with curled corners, a twinkling ✦ sparkle; subtle hand-drawn "line boil" via SVG turbulence.
- **Per-paper reactions** when hovering a paper card (bubble border takes the paper's accent color):
  RoDyGS shaky cam + trailing ghosts; MV-SAM marching mask ring + click point; SCNeRF viewfinder
  brackets + squash-to-calibrated; Q-Render speed lines + faster follow ("43.7× faster!");
  LARC thought cloud with blinking dots; CHOIR spin then snap upright. Every other paper gets a reaction
  in the same spirit (builder's call), defined per paper in bib fields (`react`, `say`, `accent`).
- Behavior:
  - Follows cursor with easing at an offset (sits ~20px bottom-right of the cursor, never under it).
  - Bobs/"walks" while moving; idle breathing when stopped; random blink.
  - Pupils look toward the cursor.
  - When hovering a paper card: pushes up glasses + the per-paper reaction above.
  - **Poke to annoy**: after ~1 s of cursor stillness he rests in place (stops following until the cursor
    goes >160px away). A click inside his face circle is a hit **whether or not he is resting**
    (geometric hit test on capture-phase pointerdown; the following click is swallowed so links
    underneath don't fire). A hit also makes him rest. Hit reaction: `> <` eyes, wobbly mouth, red anger mark,
    shake, knockback away from the click. Escalating lines: "Ouch!" → "Hey, that hurts!" → "Why me?!" →
    "I'm telling my advisor."; the 5th hit sends him sulking to the far corner ("Hmph.") for ~3.5 s.
  - **Sleep**: after ~8 s with no input (mouse/scroll/key) he dozes: eyes become closed arcs, head droops
    and nods, "z Z z" floats up. Any input wakes him with a startled "!" hop.
  - **Dizzy**: shaking the mouse fast (many direction reversals within ~0.6 s) → spiral eyes, "@_@".
  - **Night owl**: visitor local time 00:00–05:00 → occasional yawn + "Still up? Deadline too?".
  - **Contact links**: hovering email / GitHub / Scholar links → "Say hi!".
  - **Page end**: scrolling to the bottom → sparkle waves, "Thanks for reading!".
  - Otherwise `pointer-events: none`; only while resting is he clickable (accepted trade-off).
- On touch devices it parks in the bottom-right corner (as in the prototype); motion off under reduced-motion.
- Small toggle (e.g. in footer or navbar) to hide it, remembered in `localStorage`.
- Single file `assets/js/companion.js` + SVG embedded in an include.

### 5. Interactive papers

Applies to both the Publications page and the About page "selected papers" list,
via the shared `_layouts/bib.html`.

**Card behavior**
- Default: current static thumbnail (`img_path`).
- Hover (desktop) / tap (mobile): media plays (muted, looped, `playsinline`); stops and rewinds on leave.
  Only one video plays at a time. Videos use `preload="none"` and load on first hover.
- Click "more" / card body: expands inline (animated height) showing TL;DR, abstract,
  extra media gallery (if any), links, and a **Copy BibTeX** button.
- Topic filter chips above the list on the Publications page (e.g. Neural Fields, Gaussian Splatting,
  3D Understanding, Multimodal LLM, Point Cloud, Matching). Filtering animates; "All" default.
  Topic assignment is the builder's call based on titles/abstracts.

**Media per paper** (scraped from project pages; trimmed to 4–6 s muted loops, ≤ ~1.5 MB each,
H.264 mp4, ~480p width, stored under `assets/video/papers/`):

| Paper | Source | Hover media | Expanded extras |
|---|---|---|---|
| Cog3DMap | cog3dmap.github.io | robofac_demo.mp4 | main_figure.png |
| VaLR | rootyjeon.github.io/valr | teaser.mp4 | figure1.png |
| MV-SAM | jaesung-choe.github.io/mv_sam | banner.mp4 | sample1–3.mp4 |
| Q-Render | jaesung-choe.github.io/qrender | teaser.mp4 | comparison.png |
| RoDyGS | rodygs.github.io | rodygs_bear.mp4 (or best) | 3 more result clips |
| NVS-Adapter | postech-cvlab.github.io/nvsadapter | sds_image.mp4 | sds_text.mp4 |
| SCNeRF | postech-cvlab.github.io/SCNeRF | before/after slider: `*_colmap` vs `*_wo_colmap` (one scene) | — |
| FPT | cvlab.postech.ac.kr/research/FPT | crossfade thumbnail → qual-seg.png | qual-det.png |
| LARC (NeurIPS 2026) | rootyjeon.github.io/latent-reasoning-umm | larc-demo.mp4 | qual-edit-scaling.jpg |

Builder picks the most visually striking clip/segment where several exist.

**Procedural canvas animations** (no media available), drawn in a shared small canvas module,
play on hover, theme-aware colors:
- CHOIR: point cloud of a chair randomly rotating; **drag to rotate**, snaps back to canonical pose.
- SeLCA: point cloud with a predicted axis arrow that aligns the shape.
- PeRFception: grid of tiny radiance-field "blobs" flowing into perception labels.
- SSL scale/orientation: an image patch rotating/scaling with an estimated arrow tracking it.
- Descriptor distillation (WACV): two image patches with match lines appearing.
- NeRF-Factory (project entry, if shown): several NeRF variants as orbiting blobs.

**Fallbacks**: if media fails to load or reduced-motion is set → static thumbnail only.

**Per-paper identity** (owner asked that each paper feel distinct):
- Each paper gets an accent color (from its thumbnail's dominant color / project-page theme),
  stored as a bib field (`accent`), used for the card's left border, hover glow, chip highlight,
  and the expanded card's header.
- Combined with the unique hover media/animation above, every card looks and behaves differently,
  while layout stays uniform so the list remains scannable.

### 6. Distinct career entries

Owner asked that each career entry feel distinct too. The Experience (and Education) section on the
About page becomes a vertical timeline:
- Each entry gets an accent color and a small hand-drawn SVG landmark of its city
  (Paris → Eiffel Tower, Taipei → Taipei 101, Pangyo → office skyline, Pohang → POSTECH/sea,
  Busan → bridge/sea for KSA). Landmarks are simple line art in the accent color; no company logos.
- Entries animate in as they scroll into view; hovering an entry draws the landmark line art
  (stroke animation) and shows the one-line description from the CV.
- Layout stays a consistent timeline (date | landmark | role, org, location, mentor, description).
- Front matter of `_experience/*.md` / `_education/*.md` gains `accent` and `landmark` fields.

## Left to the builder

- Exact visual styling of banner, chips, expanded card, within the al-folio look.
- Exact topic taxonomy and per-paper TL;DR wording (start from the CV one-liners).
- Which clip segments to cut.
- File/module structure for JS (vanilla, no bundler).
- Whether presentations/extracurriculars appear on the About page.

## Verification

- `bundle exec jekyll build` succeeds; serve locally and check: no blog links, banner on every page,
  character follows cursor and never blocks clicks, every paper card hover/expand works,
  filters work, light + dark mode, mobile width (375px), reduced-motion.
- Total added media size reported (target < 20 MB).
