/* Interactive paper cards. Plain deferred script; pure logic exported for tests. */

/** Only one card plays at a time: pause the current one when another starts. */
function pickPlaying(current, entering) {
  return { pause: current && current !== entering ? current : null, play: entering };
}

/**
 * One shared playback slot for every video/animation on the page (card hover
 * media and expanded-detail clips alike). Items expose play() and pause();
 * starting one pauses whichever was playing. claim() is for media that
 * started itself (native controls).
 */
function createPlayer() {
  var cur = null;
  function take(item) {
    var r = pickPlaying(cur, item);
    if (r.pause) r.pause.pause();
    cur = item;
  }
  return {
    start: function (item) { take(item); item.play(); },
    claim: function (item) { take(item); },
    stop: function (item) { if (cur === item) cur = null; item.pause(); },
    current: function () { return cur; }
  };
}

/** Keys of cards whose topics include `topic` ('All' keeps every card). */
function filterKeys(cards, topic) {
  return cards
    .filter(function (c) { return topic === 'All' || c.topics.indexOf(topic) !== -1; })
    .map(function (c) { return c.key; });
}

/** How many authors to show before a "+N" toggle. */
function truncateAuthors(n, limit) {
  if (limit === undefined) limit = 6;
  var shown = Math.min(n, limit);
  return { shown: shown, more: n - shown };
}

(function () {
  if (typeof document === 'undefined') return;

  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduced = mq('(prefers-reduced-motion: reduce)');
  var slot = createPlayer();
  var items = {}; // card key -> slot item

  function emit(name, card) {
    document.dispatchEvent(new CustomEvent(name, {
      detail: {
        key: card.dataset.key,
        react: card.dataset.react || '',
        say: card.dataset.say || '',
        accent: card.style.getPropertyValue('--accent').trim()
      }
    }));
  }

  /* ---------- media players ---------- */
  function makePlayer(card) {
    var media = card.querySelector('.paper-media');
    if (!media) return null;
    var kind = media.dataset.kind;
    var p = { start: function () {}, stop: function () {}, playing: false };

    if (kind === 'video') {
      var v = media.querySelector('video.paper-video');
      if (!v) return null;
      v.addEventListener('error', function () { media.dataset.kind = 'static'; card.classList.remove('is-playing'); });
      p.start = function () {
        // poster and clip are fetched on the first hover only; the static thumbnail shows until then
        if (!v.getAttribute('src')) {
          if (v.dataset.poster) v.setAttribute('poster', v.dataset.poster);
          v.setAttribute('src', v.dataset.src);
        }
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () {});
      };
      p.stop = function () { v.pause(); try { v.currentTime = 0; } catch (e) {} };
    } else if (kind === 'crossfade') {
      var alt = media.querySelector('img.paper-alt');
      if (!alt) return null;
      p.start = function () { if (!alt.getAttribute('src')) alt.setAttribute('src', alt.dataset.src); };
    } else if (kind === 'canvas') {
      var anim = null;
      var colors = function () {
        var cs = getComputedStyle(card);
        return { accent: cs.getPropertyValue('--accent').trim(), ink: cs.color };
      };
      p.start = function () {
        if (!anim) {
          var id = media.dataset.anim;
          if (!(window.PaperAnim && typeof window.PaperAnim[id] === 'function')) return;
          var canvas = document.createElement('canvas');
          canvas.className = 'paper-canvas';
          canvas.setAttribute('aria-hidden', 'true');
          media.appendChild(canvas);
          var c = colors();
          anim = window.PaperAnim[id](canvas, { accent: c.accent, ink: c.ink, reduced: reduced });
          media.classList.add('has-canvas');
          // the theme toggle changes ink/accent: re-color the (possibly still visible) canvas, again once
          // al-folio's 750 ms theme cross-fade (html.transition) has settled the computed colors
          if (anim.setColors && typeof MutationObserver !== 'undefined') {
            var recolor = function () { anim.setColors(colors()); };
            new MutationObserver(function () { recolor(); setTimeout(recolor, 800); })
              .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
          }
        } else if (anim.setColors) {
          anim.setColors(colors());
        }
        if (anim.start) anim.start();
      };
      p.stop = function () { if (anim && anim.stop) anim.stop(); };
    } else {
      return null;
    }
    return p;
  }

  function cardItem(card, p) {
    return {
      play: function () { p.start(); card.classList.add('is-playing'); },
      pause: function () { p.stop(); card.classList.remove('is-playing'); }
    };
  }
  function isPlaying(card) { var it = items[card.dataset.key]; return !!it && slot.current() === it; }

  function play(card) {
    if (reduced) return;
    var it = items[card.dataset.key];
    if (it) slot.start(it);
  }

  function stop(card) {
    var it = items[card.dataset.key];
    if (it && slot.current() === it) slot.stop(it);
  }

  /* ---------- authors "+N" ---------- */
  function truncate(card) {
    var box = card.querySelector('.paper-authors');
    if (!box) return;
    var names = box.querySelectorAll('.author');
    var t = truncateAuthors(names.length);
    if (!t.more) return;
    for (var i = t.shown; i < names.length; i++) names[i].classList.add('is-extra');
    box.classList.add('is-truncated');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'authors-more';
    b.textContent = '+' + t.more + ' more';
    b.setAttribute('aria-label', 'Show ' + t.more + ' more author' + (t.more > 1 ? 's' : ''));
    b.addEventListener('click', function (e) { e.stopPropagation(); expandAuthors(card); });
    names[t.shown - 1].insertAdjacentElement('afterend', b);
  }
  function expandAuthors(card) {
    var box = card.querySelector('.paper-authors');
    if (!box || !box.classList.contains('is-truncated')) return;
    box.classList.remove('is-truncated');
    var b = box.querySelector('.authors-more');
    if (b) b.remove();
  }

  /* ---------- expand / collapse ---------- */
  function setOpen(card, open) {
    var btn = card.querySelector('.paper-more');
    var d = card.querySelector('.paper-detail');
    if (!btn || !d) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Less' : 'More';
    card.classList.toggle('is-open', open);
    if (open) {
      expandAuthors(card);
      loadExtras(d);
      d.hidden = false;
      void d.offsetHeight; // commit the 0fr state so the row height animates
      d.classList.add('is-open');
    } else {
      // Don't strand keyboard focus inside a collapsing panel.
      if (d.contains(document.activeElement) || card._focusWasInDetail) btn.focus();
      card._focusWasInDetail = false;
      d.classList.remove('is-open');
      pauseExtras(d);
      if (reduced) { d.hidden = true; return; }
      var done = function (e) {
        if (e && e.target !== d) return;
        d.removeEventListener('transitionend', done);
        if (!d.classList.contains('is-open')) d.hidden = true;
      };
      d.addEventListener('transitionend', done);
      setTimeout(done, 450);
    }
  }
  function toggle(card) { setOpen(card, card.querySelector('.paper-more').getAttribute('aria-expanded') !== 'true'); }

  /* ---------- extras gallery videos ---------- */
  // Extra clips load only once their card is expanded (first frame via
  // preload=metadata), and play only on hover/tap.
  function loadExtras(root) {
    Array.prototype.forEach.call(root.querySelectorAll('video.extra-video'), function (v) {
      if (v.getAttribute('src')) return;
      v.preload = 'metadata';
      v.setAttribute('src', v.dataset.src);
    });
  }
  function extraItem(v) {
    if (!v._slotItem) {
      v._slotItem = {
        play: function () {
          loadExtras(v.parentNode);
          var pr = v.play();
          if (pr && pr.catch) pr.catch(function () {});
          v.parentNode.classList.add('is-playing');
        },
        pause: function () { v.pause(); v.parentNode.classList.remove('is-playing'); }
      };
    }
    return v._slotItem;
  }
  function pauseExtras(root) {
    Array.prototype.forEach.call(root.querySelectorAll('video.extra-video'), function (v) { slot.stop(extraItem(v)); });
  }
  function wireExtras(card) {
    Array.prototype.forEach.call(card.querySelectorAll('video.extra-video'), function (v) {
      var it = extraItem(v);
      // Fit the box to the clip once known, so very wide clips are not letterboxed.
      v.addEventListener('loadedmetadata', function () {
        if (v.videoWidth && v.videoHeight) v.style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
      });
      // Whatever starts this clip (incl. native controls), it takes the single slot.
      v.addEventListener('play', function () { if (slot.current() !== it) slot.claim(it); });
      if (reduced) { v.controls = true; v.parentNode.classList.add('has-controls'); return; }
      v.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') slot.start(it); });
      v.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') slot.stop(it); });
      v.addEventListener('click', function (e) {
        e.stopPropagation();
        if (slot.current() === it && !v.paused) slot.stop(it); else slot.start(it);
      });
    });
  }

  /* ---------- copy BibTeX ---------- */
  function copyBib(btn) {
    var pre = btn.closest('.paper-bibtex').querySelector('.bibtex-text');
    var text = pre.textContent.replace(/^\s+|\s+$/g, '') + '\n';
    var ok = function () {
      var label = btn.querySelector('.copy-label') || btn;
      label.textContent = 'Copied';
      btn.classList.add('is-copied');
      setTimeout(function () { label.textContent = 'Copy BibTeX'; btn.classList.remove('is-copied'); }, 1600);
    };
    var fallback = function () {
      var range = document.createRange();
      range.selectNodeContents(pre);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      try { if (document.execCommand('copy')) ok(); } catch (e) {}
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else {
      fallback();
    }
  }

  /* ---------- one card ---------- */
  function wire(card) {
    var key = card.dataset.key;
    var p = makePlayer(card);
    if (p) items[key] = cardItem(card, p);
    truncate(card);
    wireExtras(card);

    var d = card.querySelector('.paper-detail');
    if (d) d.classList.add('is-collapsible');
    var md = card.querySelector('.paper-media[data-kind="canvas"]');
    if (md && window.PaperAnim && typeof window.PaperAnim[md.dataset.anim] === 'function') md.classList.add('anim-ready');

    var lastPointer = 'mouse';
    card.addEventListener('pointerdown', function (e) {
      lastPointer = e.pointerType;
      // Focus moves away on mousedown; remember if it was inside the detail.
      card._focusWasInDetail = !!(d && d.contains(document.activeElement));
    });
    card.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      emit('paper:hover', card);
      play(card);
    });
    card.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      emit('paper:leave', card);
      stop(card);
    });
    var hovered = function () { try { return card.matches(':hover'); } catch (e) { return false; } };
    card.addEventListener('focusin', function (e) {
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      if (hovered()) return; // mouse hover already handled it
      emit('paper:hover', card);
      if (mq('(hover: hover)')) play(card);
    });
    card.addEventListener('focusout', function (e) {
      if (e.relatedTarget && card.contains(e.relatedTarget)) return;
      if (hovered()) return;
      emit('paper:leave', card);
      stop(card);
    });

    var media = card.querySelector('.paper-media');
    if (media) {
      media.addEventListener('click', function (e) {
        if (lastPointer === 'mouse') return; // desktop hover already plays
        e.stopPropagation();
        if (isPlaying(card)) { stop(card); emit('paper:leave', card); } else { emit('paper:hover', card); play(card); }
      });
    }

    card.querySelector('.paper-more').addEventListener('click', function (e) {
      e.stopPropagation();
      toggle(card);
    });

    var body = card.querySelector('.paper-body');
    body.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input, label, summary')) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return; // let people select text
      toggle(card);
    });

    var cb = card.querySelector('.copy-bib');
    if (cb) cb.addEventListener('click', function (e) { e.stopPropagation(); copyBib(cb); });
  }

  /* ---------- filter chips (publications page) ---------- */
  function wireFilters() {
    var bar = document.querySelector('.paper-filters');
    if (!bar) return;
    var all = Array.prototype.slice.call(document.querySelectorAll('.paper-card'));
    var model = all.map(function (c) { return { key: c.dataset.key, topics: [c.dataset.category] }; });
    var status = document.querySelector('.paper-filter-status');
    var chips = Array.prototype.slice.call(bar.querySelectorAll('.filter-chip'));

    function apply(value) {
      var keep = filterKeys(model, value === 'all' ? 'All' : value);
      var before = {};
      if (!reduced) all.forEach(function (c) { if (!c.hidden) before[c.dataset.key] = c.getBoundingClientRect(); });
      all.forEach(function (c) {
        var show = keep.indexOf(c.dataset.key) !== -1;
        c.hidden = !show;
        var li = c.closest('li');
        if (li) li.hidden = !show;
        if (!show) stop(c);
      });
      Array.prototype.forEach.call(document.querySelectorAll('.pub-year'), function (sec) {
        sec.hidden = !sec.querySelector('.paper-card:not([hidden])');
      });
      chips.forEach(function (ch) { ch.setAttribute('aria-pressed', ch.dataset.filter === value ? 'true' : 'false'); });
      if (status) status.textContent = 'Showing ' + keep.length + ' paper' + (keep.length === 1 ? '' : 's');
      if (reduced || !all[0].animate) return;
      // FLIP: slide survivors from their old spot, fade newcomers in.
      all.forEach(function (c) {
        if (c.hidden) return;
        var b = before[c.dataset.key];
        if (!b) {
          c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
            { duration: 280, easing: 'ease-out' });
          return;
        }
        var a = c.getBoundingClientRect();
        var dy = b.top - a.top;
        if (Math.abs(dy) > 1) {
          c.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }],
            { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
      });
    }

    chips.forEach(function (ch) {
      ch.addEventListener('click', function () { apply(ch.dataset.filter); });
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('.paper-card'), wire);
    wireFilters();
    document.documentElement.classList.add('papers-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

if (typeof module !== 'undefined') module.exports = { pickPlaying: pickPlaying, createPlayer: createPlayer, filterKeys: filterKeys, truncateAuthors: truncateAuthors };
