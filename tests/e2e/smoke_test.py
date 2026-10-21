"""E2E smoke for the interactive site. Run: see tests/e2e/README.md"""
import os, subprocess, sys, time
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
time.sleep(1)
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
        # (b)-(e) desktop
        pg, errs = new_page(b, 'light', viewport={'width': 1200, 'height': 900})
        go(pg, '/publications/', 'light')
        cards = pg.locator('.paper-card')
        n = cards.count(); maxp = 0
        for i in range(n):
            c = cards.nth(i); c.scroll_into_view_if_needed(); c.locator('.paper-media').hover(); pg.wait_for_timeout(250)
            maxp = max(maxp, pg.evaluate("[...document.querySelectorAll('video')].filter(v=>!v.paused).length"))
        check('(b) at most 1 video playing', maxp <= 1, f'max={maxp} over {n} cards')
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
        check('(e) face click shows Ouch!', 'Ouch!' in txt or txt.strip() in ('Hey, that hurts!', 'Why me?!', "I'm telling my advisor.") or 'Ouch' in txt, repr(txt))
        # bubble stays inside the viewport near the right edge
        pg.mouse.move(600, 450); pg.wait_for_timeout(200); pg.mouse.move(1195, 450); pg.wait_for_timeout(2500)
        b3 = buddy.bounding_box()
        pg.mouse.click(b3['x'] + b3['width'] * .5, b3['y'] + b3['height'] * .6); pg.wait_for_timeout(300)
        r = pg.evaluate("(()=>{const r=document.querySelector('#buddy .bubble').getBoundingClientRect();return [r.left,r.right,innerWidth]})()")
        check('(e) bubble clamped inside viewport', r[0] >= 15 and r[1] <= r[2] - 15, r)
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
