"""E2E smoke for the interactive site. Run: see tests/e2e/README.md"""
import os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SHOTS = os.path.join(ROOT, 'tests', 'e2e', 'shots')
PORT = 4000
BASE = f'http://localhost:{PORT}'
os.makedirs(SHOTS, exist_ok=True)
results = []

def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS ' if ok else 'FAIL ') + name + (' -- ' + str(detail) if detail else ''))

def new_page(b, theme, **kw):
    ctx = b.new_context(**kw)
    ctx.add_init_script(f"try{{localStorage.setItem('theme','{theme}')}}catch(e){{}}")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    return pg, errs

def go(pg, path, theme):
    pg.goto(BASE + path)
    pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
    pg.wait_for_timeout(600)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', os.path.join(ROOT, '_site')],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(100):  # wait until the static server answers (startup can take > 1 s under load)
    try:
        urllib.request.urlopen(BASE + '/', timeout=1); break
    except OSError:
        time.sleep(0.1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # (a) console errors, incl. clicks on svg-heavy elements
        for theme in ('light', 'dark'):
            for path in ('/', '/publications/'):
                pg, errs = new_page(b, theme, viewport={'width': 1200, 'height': 900})
                go(pg, path, theme)
                pg.click('.paper-card .paper-media')
                pg.click('.paper-card .paper-title')
                lm = pg.locator('.tl-item svg').first
                if lm.count(): lm.click(force=True)
                bb = pg.locator('#buddy').bounding_box()
                if bb: pg.mouse.click(bb['x'] + bb['width'] * .5, bb['y'] + bb['height'] * .6)
                pg.wait_for_timeout(300)
                check(f'(a) no console errors {path} {theme}', not errs, errs[:3])
                pg.context.close()
        # svg class integrity after clicks (mdb ripple must not corrupt class attrs)
        pg, errs = new_page(b, 'light', viewport={'width': 1200, 'height': 900})
        go(pg, '/', 'light')
        sel = {'timeline landmark': '.tl-item svg', 'paper-card': '.paper-card svg'}
        for label, q in sel.items():
            els = pg.locator(q)
            if not els.count():
                check(f'(a) svg class intact: {label}', label == 'paper-card', 'no svg found'); continue
            before = els.first.get_attribute('class') or ''
            els.first.scroll_into_view_if_needed(); els.first.click(force=True); pg.wait_for_timeout(300)
            after = els.first.get_attribute('class') or ''
            check(f'(a) svg class intact: {label}', after == before and '[object' not in after, f'{before!r} -> {after!r}')
        check('(a) no errors after svg clicks', not errs, errs[:3])
        pg.context.close()
        # author lines: spaces survive minification, no overflow
        for dev, vp, kw in (('desktop', {'width': 1280, 'height': 900}, {}), ('mobile', {'width': 375, 'height': 800}, {'has_touch': True, 'is_mobile': True})):
            for path in ('/', '/publications/'):
                pg, _ = new_page(b, 'light', viewport=vp, **kw)
                go(pg, path, 'light')
                r = pg.evaluate("[...document.querySelectorAll('.paper-authors')].map(e=>[e.scrollWidth-e.clientWidth, e.innerText])")
                bad = [x for x in r if x[0] > 0 or ',Yoonwoo' in x[1] or ',and' in x[1]]
                has = any(', Yoonwoo Jeong' in x[1] or x[1].startswith('Yoonwoo Jeong') for x in r) and any(', Yoonwoo Jeong' in x[1] for x in r)
                check(f'(h) authors no overflow/spacing {path} {dev}', not bad and has and len(r) > 0, bad[:2])
                pg.context.close()
        # (i) timeline nodes sit on the journey rail (catches minifier-broken calc(var()) geometry)
        for dev, vp, rail in (('desktop', {'width': 1200, 'height': 900}, 18), ('mobile', {'width': 375, 'height': 800}, 11)):
            pg, _ = new_page(b, 'light', viewport=vp)
            go(pg, '/', 'light')
            r = pg.evaluate("(()=>{const ol=document.querySelector('ol.timeline');if(!ol)return null;const l=ol.getBoundingClientRect().left;return [...ol.querySelectorAll('.tl-node')].map(n=>{const r=n.getBoundingClientRect();return r.left+r.width/2-l})})()")
            check(f'(i) timeline nodes on rail {dev}', bool(r) and all(abs(x - rail) <= 2 for x in r), r)
            pg.context.close()
        # (b)-(e) desktop
        pg, errs = new_page(b, 'light', viewport={'width': 1200, 'height': 900})
        go(pg, '/publications/', 'light')
        cards = pg.locator('.paper-card')
        n = cards.count(); maxp = 0
        for i in range(n):
            c = cards.nth(i); c.scroll_into_view_if_needed(); c.locator('.paper-media').hover(); pg.wait_for_timeout(250)
            for _ in range(2):
                maxp = max(maxp, pg.evaluate("[...document.querySelectorAll('video')].filter(v=>!v.paused).length"))
                pg.wait_for_timeout(120)
            maxplay = max(globals().get('maxplay', 0), maxp)
        check('(b) exactly 1 video playing at peak, never more', maxp == 1, f'max={maxp} over {n} cards')
        mv = pg.locator('.paper-card[data-key*="mvsam"], .paper-card[data-key*="mv"]').first
        mv.scroll_into_view_if_needed(); mv.locator('.paper-more').click(); pg.wait_for_timeout(300)
        det = mv.locator('.paper-detail')
        check('(c) More expands detail', det.is_visible() and mv.locator('.paper-more').get_attribute('aria-expanded') == 'true', mv.get_attribute('data-key'))
        pg.evaluate("scrollTo(0,0)")
        chip = pg.locator('.filter-chip', has_text='Segmentation').first
        chip.click(); pg.wait_for_timeout(500)
        vis = pg.evaluate("[...document.querySelectorAll('.paper-card')].filter(c=>c.offsetParent!==null&&getComputedStyle(c).visibility!=='hidden').map(c=>c.dataset.category)")
        check('(d) Segmentation chip filters', 0 < len(vis) < n and set(vis) == {'understanding'}, f'{len(vis)}/{n} {set(vis)}')
        pg.locator('.filter-chip[data-filter="all"]').click()
        # (e) companion
        buddy = pg.locator('#buddy')
        check('(e) #buddy exists', buddy.count() == 1)
        pg.evaluate("scrollTo(0,0)")
        pg.mouse.move(600, 400); pg.wait_for_timeout(300); pg.mouse.move(640, 420, steps=10); pg.wait_for_timeout(2500)
        bb = buddy.bounding_box()
        cx, cy = bb['x'] + bb['width'] * .5, bb['y'] + bb['height'] * .6  # face center
        check('(e) companion offset from cursor', ((cx - 640) ** 2 + (cy - 420) ** 2) ** .5 > 8, f'buddy=({cx:.0f},{cy:.0f})')
        # make him stationary then hit his face
        for _ in range(40):
            bb = buddy.bounding_box(); pg.wait_for_timeout(100)
            b2 = buddy.bounding_box()
            if abs(bb['x'] - b2['x']) < .5 and abs(bb['y'] - b2['y']) < .5: break
        pg.mouse.click(b2['x'] + b2['width'] * .5, b2['y'] + b2['height'] * .6, button='left')
        pg.wait_for_timeout(300)
        txt = pg.locator('#buddy .bubble').inner_text()
        check('(e) face click shows Ouch!', txt.strip() == 'Ouch!' and 'on' in (pg.locator('#buddy .bubble').get_attribute('class') or '').split(), repr(txt))
        # bubble stays inside the viewport near the right edge
        pg.mouse.move(600, 450); pg.wait_for_timeout(200); pg.mouse.move(1195, 450); pg.wait_for_timeout(2500)
        b3 = buddy.bounding_box()
        pg.mouse.click(b3['x'] + b3['width'] * .5, b3['y'] + b3['height'] * .6); pg.wait_for_timeout(700)
        r = pg.evaluate("(()=>{const r=document.querySelector('#buddy .bubble').getBoundingClientRect();return [r.left,r.right,innerWidth]})()")
        check('(e) bubble clamped inside viewport', r[0] >= 15 and r[1] <= r[2] - 15, r)
        # (l) the news banner stays pinned under the navbar while scrolling
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(200)
        pg.evaluate("scrollTo(0, 1500)"); pg.wait_for_timeout(300)
        nb = pg.evaluate("(()=>{const n=document.querySelector('.navbar').getBoundingClientRect(), b=document.querySelector('.news-banner').getBoundingClientRect(); return [Math.round(n.bottom), Math.round(b.top), Math.round(b.height)]})()")
        check('(l) news banner stays under the navbar when scrolled', abs(nb[0] - nb[1]) <= 1 and nb[2] > 0, nb)
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(200)
        # (k) he steps aside from the link under the cursor, and clicks on it always reach the link
        link = pg.locator('.paper-links a').first
        link.scroll_into_view_if_needed(); pg.wait_for_timeout(200)
        lb = link.bounding_box()
        pg.evaluate("window.__linkClicks=0; document.querySelectorAll('.paper-links a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();window.__linkClicks++}))")
        pg.mouse.move(lb['x'] - 60, lb['y'] - 40); pg.wait_for_timeout(300)
        pg.mouse.move(lb['x'] + lb['width'] / 2, lb['y'] + lb['height'] / 2, steps=12); pg.wait_for_timeout(1500)
        bb = buddy.bounding_box()
        clear = bb['x'] >= lb['x'] + lb['width'] or bb['x'] + bb['width'] <= lb['x'] or bb['y'] >= lb['y'] + lb['height'] or bb['y'] + bb['height'] <= lb['y']
        check('(k) companion steps off the hovered link', clear and 'yield' in (buddy.get_attribute('class') or ''), f'link={lb} buddy={bb}')
        pg.mouse.click(lb['x'] + lb['width'] / 2, lb['y'] + lb['height'] / 2); pg.wait_for_timeout(200)
        check('(k) click on the link reaches the link', pg.evaluate('window.__linkClicks') == 1)
        pg.context.close()
        # (f) touch
        pg, errs = new_page(b, 'light', viewport={'width': 375, 'height': 800}, has_touch=True, is_mobile=True, device_scale_factor=2)
        go(pg, '/publications/', 'light'); pg.wait_for_timeout(500)
        sw = pg.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
        bb = pg.locator('#buddy').bounding_box()
        corner = bb and bb['x'] + bb['width'] > 375 * .6 and bb['y'] + bb['height'] > 800 * .6 and bb['x'] + bb['width'] <= 375
        check('(f) mobile no horizontal scroll', sw[0] <= sw[1], sw)
        check('(f) mobile buddy bottom-right', bool(corner), bb)
        card = pg.locator('.paper-card .paper-media').first
        card.scroll_into_view_if_needed(); bx = card.bounding_box()
        pg.touchscreen.tap(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2); pg.wait_for_timeout(300)
        check('(f) mobile tap no errors', not errs, errs[:3])
        # (j) news shows one item at a time, rotates, and can be paused by touch (WCAG 2.2.2)
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(200)
        vis = "[...document.querySelectorAll('.news-banner .news-item')].filter(li=>!li.hidden).map(li=>li.textContent.trim())"
        one = pg.evaluate(vis)
        pg.wait_for_timeout(6500)
        two = pg.evaluate(vis)
        check('(j) news shows one item and rotates', len(one) == 1 and len(two) == 1 and one != two, [one, two])
        pz = pg.locator('.news-banner .news-pause')
        if pz.count() and pz.is_visible():
            pz.tap(); pg.wait_for_timeout(200)
            pg.touchscreen.tap(10, 700); pg.wait_for_timeout(200)  # focus leaves the banner; stays paused
            a1 = pg.evaluate(vis); pg.wait_for_timeout(6500); a2 = pg.evaluate(vis)
            check('(j) news pause toggle stops rotation on touch', pz.get_attribute('aria-pressed') == 'true' and a1 == a2, [a1, a2])
        else:
            check('(j) news pause toggle stops rotation on touch', False, 'no visible .news-pause')
        pg.context.close()
        # (g) screenshots
        for dev, vp, kw in (('desktop', {'width': 1280, 'height': 900}, {}), ('mobile', {'width': 375, 'height': 800}, {'has_touch': True, 'is_mobile': True})):
            for theme in ('light', 'dark'):
                for path, nm in (('/', 'home'), ('/publications/', 'publications')):
                    pg, _ = new_page(b, theme, viewport=vp, **kw)
                    go(pg, path, theme)
                    pg.evaluate("document.querySelectorAll('[loading=lazy]').forEach(i=>i.loading='eager')")
                    h = pg.evaluate("document.documentElement.scrollHeight")
                    for y in range(0, h, 600): pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(120)
                    pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(300)
                    pg.screenshot(path=os.path.join(SHOTS, f'{nm}-{dev}-{theme}.png'), full_page=True)
                    pg.screenshot(path=os.path.join(SHOTS, f'{nm}-{dev}-{theme}-fold.png'))
                    pg.context.close()
        check('(g) screenshots saved', len(os.listdir(SHOTS)) >= 8, SHOTS)
        b.close()
finally:
    srv.terminate()
failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} passed')
sys.exit(1 if failed else 0)
