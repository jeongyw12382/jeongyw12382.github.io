/* Career timeline (about page): journey path, landmark draw, companion greetings.
 * Items are fully visible without this script; everything here only enhances. */
(function () {
  'use strict';

  /** Fraction (0..1) of the journey drawn for a list whose top edge is at `top`
   *  (viewport px) and that is `height` tall, in a viewport `vh` tall. */
  function journeyProgress(top, height, vh) {
    if (!(height > 0)) return 1;
    var p = (vh * 0.8 - top) / height;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /** SVG path through `points` in order; each leg bows sideways by `amp`
   *  (alternating direction) so the rail reads as a winding road. */
  function journeyPath(points, amp) {
    if (!points.length) return '';
    var r = function (n) { return Math.round(n * 10) / 10; };
    var d = 'M' + r(points[0].x) + ' ' + r(points[0].y);
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1], b = points[i];
      var s = i % 2 ? 1 : -1, dy = b.y - a.y;
      d += ' C' + r(a.x + s * amp) + ' ' + r(a.y + dy / 3) + ' ' +
        r(b.x + s * amp) + ' ' + r(b.y - dy / 3) + ' ' + r(b.x) + ' ' + r(b.y);
    }
    return d;
  }

  /** Detail for the companion's career:hover event. */
  function careerDetail(el) {
    return { greet: el.getAttribute('data-greet') || '', accent: el.getAttribute('data-accent') || '' };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { journeyProgress: journeyProgress, journeyPath: journeyPath, careerDetail: careerDetail };
  }
  if (typeof document === 'undefined') return;

  var SVG = 'http://www.w3.org/2000/svg';
  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
  var uid = 0;

  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---- journey path: a dotted road through each card's node, drawn on scroll ---- */
  function Journey(list) {
    var id = 'tl-j' + (++uid);
    var svg = el('svg', { 'class': 'tl-journey', 'aria-hidden': 'true', focusable: 'false' });
    var defs = el('defs', {}, svg);
    var grad = el('linearGradient', { id: id + 'g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    var mask = el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse' }, defs);
    var reveal = el('path', { 'class': 'tl-journey-reveal', fill: 'none', stroke: '#fff', 'stroke-width': 12, pathLength: 1, 'stroke-dasharray': '1 1' }, mask);
    var ghost = el('path', { 'class': 'tl-journey-ghost' }, svg);
    var road = el('path', { 'class': 'tl-journey-road', stroke: 'url(#' + id + 'g)', mask: 'url(#' + id + 'm)' }, svg);
    list.insertBefore(svg, list.firstChild);
    list.classList.add('has-journey');

    var items = list.querySelectorAll('.tl-item');
    this.layout = function () {
      var box = list.getBoundingClientRect();
      var pts = [], stops = [];
      for (var i = 0; i < items.length; i++) {
        var n = items[i].querySelector('.tl-node');
        if (!n) continue;
        var r = n.getBoundingClientRect();
        pts.push({ x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top });
        stops.push(items[i].getAttribute('data-accent') || 'currentColor');
      }
      var h = Math.max(1, box.height);
      svg.setAttribute('width', Math.max(1, Math.ceil(box.width)));
      svg.setAttribute('height', Math.ceil(h));
      var amp = pts.length ? Math.min(12, Math.max(6, pts[0].x - 4)) : 0;
      var d = journeyPath(pts, amp);
      ghost.setAttribute('d', d); road.setAttribute('d', d); reveal.setAttribute('d', d);
      grad.setAttribute('y2', h);
      while (grad.firstChild) grad.removeChild(grad.firstChild);
      for (var j = 0; j < pts.length; j++) {
        el('stop', { offset: (pts[j].y / h).toFixed(4), 'stop-color': stops[j] }, grad);
      }
      this.scroll();
    };
    this.scroll = function () {
      var box = list.getBoundingClientRect();
      var p = reduced ? 1 : journeyProgress(box.top, box.height, window.innerHeight);
      reveal.setAttribute('stroke-dashoffset', (1 - p).toFixed(4));
    };
  }

  function init() {
    var lists = document.querySelectorAll('ol.timeline');
    if (!lists.length) return;

    var journeys = [];
    for (var i = 0; i < lists.length; i++) journeys.push(new Journey(lists[i]));
    var queued = false;
    function frame(fn) {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; for (var k = 0; k < journeys.length; k++) journeys[k][fn](); });
    }
    for (var k = 0; k < journeys.length; k++) journeys[k].layout();
    addEventListener('scroll', function () { frame('scroll'); }, { passive: true });
    addEventListener('resize', function () { frame('layout'); });
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { frame('layout'); });
      for (var m = 0; m < lists.length; m++) ro.observe(lists[m]);
    }

    var items = document.querySelectorAll('.tl-item');

    /* ---- landmark draws itself once as its card scrolls in ---- */
    if (!reduced && typeof IntersectionObserver !== 'undefined') {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        });
      }, { threshold: 0.35 });
      for (var a = 0; a < items.length; a++) io.observe(items[a]);
    }
    document.addEventListener('animationend', function (e) {
      if (e.animationName !== 'tl-draw') return;
      var item = e.target.closest && e.target.closest('.tl-item');
      if (item) item.classList.add('drawn');
    });

    /* ---- companion greetings ---- */
    function enter(item) { document.dispatchEvent(new CustomEvent('career:hover', { detail: careerDetail(item) })); }
    function leave() { document.dispatchEvent(new CustomEvent('career:leave')); }
    for (var b = 0; b < items.length; b++) {
      (function (item) {
        item.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') enter(item); });
        item.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') leave(); });
        item.addEventListener('focusin', function (e) {
          if (!e.relatedTarget || !item.contains(e.relatedTarget)) enter(item);
        });
        item.addEventListener('focusout', function (e) {
          if (!e.relatedTarget || !item.contains(e.relatedTarget)) leave();
        });
      })(items[b]);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
