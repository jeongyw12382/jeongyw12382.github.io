/* News banner: one item at a time, rotating. Plain script; pure logic exported for tests. */
var ROTATE_MS = 5000;

function shouldShowBanner(latestISO, dismissedISO) {
  if (!dismissedISO) return true;
  return latestISO > dismissedISO; // ISO dates compare lexicographically
}

function stepIndex(i, n, dir) {
  return ((i + dir) % n + n) % n;
}

(function () {
  if (typeof document === 'undefined') return;
  var KEY = 'newsDismissed';

  function init() {
    var banner = document.querySelector('.news-banner');
    if (!banner) return;
    var latest = banner.getAttribute('data-latest') || '';
    var dismissed = null;
    try { dismissed = window.localStorage.getItem(KEY); } catch (e) {}
    if (!shouldShowBanner(latest, dismissed)) { banner.hidden = true; return; }

    var timer = 0;
    banner.querySelector('.news-close').addEventListener('click', function () {
      banner.hidden = true;
      clearInterval(timer);
      try { window.localStorage.setItem(KEY, latest); } catch (e) {}
    });

    var track = banner.querySelector('.news-track');
    var items = Array.prototype.slice.call(track.children);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var idx = 0;

    function show(i) {
      idx = i;
      items.forEach(function (el, j) {
        el.hidden = j !== idx;
        el.classList.toggle('is-current', j === idx);
      });
    }
    banner.classList.add('is-rotating');
    show(0);

    // auto-advance unless the reader is pointing at / focused in the banner, or paused it
    var paused = false, hovering = false;
    var pause = banner.querySelector('.news-pause');
    function tick() { if (!paused && !hovering && !document.hidden) show(stepIndex(idx, items.length, 1)); }
    function setPaused(on) {
      paused = on;
      if (pause) pause.setAttribute('aria-pressed', on ? 'true' : 'false');
      // announce changes only when the reader drives them (no chatter while rotating)
      track.setAttribute('aria-live', on ? 'polite' : 'off');
    }

    function step(dir) {
      show(stepIndex(idx, items.length, dir));
      clearInterval(timer);
      if (!reduce && items.length > 1) timer = setInterval(tick, ROTATE_MS);
    }
    banner.querySelector('.news-prev').addEventListener('click', function () { step(-1); });
    banner.querySelector('.news-next').addEventListener('click', function () { step(1); });

    if (reduce || items.length < 2) {
      setPaused(true);
      return;
    }
    banner.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovering = true; });
    banner.addEventListener('pointerleave', function () { hovering = false; });
    banner.addEventListener('focusin', function () { hovering = true; });
    banner.addEventListener('focusout', function (e) { if (!banner.contains(e.relatedTarget)) hovering = false; });
    // a visible pause control, so touch users (no hover/focus pause) can stop the rotation (WCAG 2.2.2)
    if (pause) {
      pause.hidden = false;
      pause.addEventListener('click', function () { setPaused(pause.getAttribute('aria-pressed') !== 'true'); });
    }
    setPaused(false);
    timer = setInterval(tick, ROTATE_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

if (typeof module !== 'undefined') module.exports = { shouldShowBanner: shouldShowBanner, stepIndex: stepIndex, ROTATE_MS: ROTATE_MS };
