/* News ticker banner. Plain script; pure logic exported for tests. */
function shouldShowBanner(latestISO, dismissedISO) {
  if (!dismissedISO) return true;
  return latestISO > dismissedISO; // ISO dates compare lexicographically
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

    banner.querySelector('.news-close').addEventListener('click', function () {
      banner.hidden = true;
      try { window.localStorage.setItem(KEY, latest); } catch (e) {}
    });

    var track = banner.querySelector('.news-track');
    var items = Array.prototype.slice.call(track.children);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      banner.classList.add('is-static');
      var idx = 0;
      var show = function (i) {
        idx = (i + items.length) % items.length;
        items.forEach(function (el, j) { el.hidden = j !== idx; });
      };
      show(0);
      banner.querySelector('.news-prev').addEventListener('click', function () { show(idx - 1); });
      banner.querySelector('.news-next').addEventListener('click', function () { show(idx + 1); });
    } else {
      // Duplicate the track content (hidden from assistive tech) for a seamless loop.
      items.forEach(function (el) {
        var c = el.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.classList.add('is-clone');
        Array.prototype.forEach.call(c.querySelectorAll('a'), function (a) { a.tabIndex = -1; });
        track.appendChild(c);
      });
      banner.classList.add('is-animated');
      // Speed scales with content width (~60px/s).
      var w = track.scrollWidth / 2;
      track.style.animationDuration = Math.max(20, Math.round(w / 60)) + 's';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

if (typeof module !== 'undefined') module.exports = { shouldShowBanner };
