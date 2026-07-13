/* UtmZ GoTag — tracking leve de landing pages.
   Instalação: <script async src="https://utmz.vercel.app/t.js" data-site="SITE_ID"></script> */
(function () {
  'use strict';
  try {
    var script = document.currentScript;
    var SITE = script && script.getAttribute('data-site');
    if (!SITE) return;
    var API = (script.getAttribute('data-api') || script.src.replace(/\/t\.js.*$/, '')) + '/api/t';
    var SESSION_TTL = 30 * 60 * 1000;

    function uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }
    function store(get, key, val) {
      try { return get ? localStorage.getItem(key) : localStorage.setItem(key, val); } catch (e) { return null; }
    }

    // ---- identidade ----
    var visitor = store(true, '_uz_vid');
    var newVisitor = false;
    if (!visitor) { visitor = uuid(); newVisitor = true; store(false, '_uz_vid', visitor); }

    var session = store(true, '_uz_sid');
    var lastSeen = Number(store(true, '_uz_slast') || 0);
    if (!session || Date.now() - lastSeen > SESSION_TTL) session = uuid();
    store(false, '_uz_sid', session);

    function touch() { store(false, '_uz_slast', String(Date.now())); }
    touch();

    // ---- params da URL (utms, click ids) ----
    var PARAM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid', 'wbraid', 'uzclid'];
    var params = {};
    try {
      var qs = new URLSearchParams(location.search);
      PARAM_KEYS.forEach(function (k) { var v = qs.get(k); if (v) params[k] = v.slice(0, 200); });
    } catch (e) { /* noop */ }

    var meta = {
      landing: location.href.slice(0, 500),
      referrer: document.referrer ? document.referrer.slice(0, 500) : null,
      params: params,
      newVisitor: newVisitor,
    };

    // ---- fila + envio ----
    var queue = [];
    function push(type, data) {
      queue.push({ type: type, page: location.pathname.slice(0, 300), data: data || null, ts: Date.now() });
      touch();
      mirror(type, data);
      if (queue.length >= 10) flush(false);
    }
    function flush(unload) {
      if (queue.length === 0) return;
      var body = JSON.stringify({ site: SITE, visitor: visitor, session: session, meta: meta, events: queue.splice(0, 50) });
      try {
        if (unload && navigator.sendBeacon) {
          navigator.sendBeacon(API, new Blob([body], { type: 'application/json' }));
        } else {
          fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
        }
      } catch (e) { /* noop */ }
    }
    setInterval(function () { flush(false); }, 5000);

    // ---- integrações (GTM / Meta Pixel), se existirem na página ----
    function mirror(type, data) {
      try {
        if (window.dataLayer && window.dataLayer.push) window.dataLayer.push({ event: 'uz_' + type, uz_data: data || {} });
        if (typeof window.fbq === 'function' && type === 'form_submit') window.fbq('trackCustom', 'UzLead', data || {});
      } catch (e) { /* noop */ }
    }

    // ---- pageview (inclui SPA) ----
    function pageview() { push('pageview', { title: document.title.slice(0, 120) }); resetScroll(); }
    pageview();
    ['pushState', 'replaceState'].forEach(function (fn) {
      var orig = history[fn];
      if (!orig) return;
      history[fn] = function () { var r = orig.apply(this, arguments); setTimeout(pageview, 0); return r; };
    });
    window.addEventListener('popstate', function () { setTimeout(pageview, 0); });

    // ---- cliques ----
    document.addEventListener('click', function (e) {
      try {
        var el = e.target && e.target.closest && e.target.closest('a,button,[role="button"],input[type="submit"]');
        if (!el) return;
        var href = (el.getAttribute && el.getAttribute('href')) || '';
        var type = 'click';
        if (/wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(href)) type = 'whatsapp_click';
        else if (/^tel:/i.test(href)) type = 'call_click';
        else if (href && /^https?:/i.test(href) && href.indexOf(location.host) === -1) type = 'link_click';
        var text = (el.innerText || el.value || '').trim().slice(0, 60);
        push(type, {
          text: text || null,
          href: href ? href.slice(0, 300) : null,
          x: Math.round((e.pageX / Math.max(1, document.documentElement.scrollWidth)) * 100),
          y: Math.round((e.pageY / Math.max(1, document.documentElement.scrollHeight)) * 100),
        });
      } catch (err) { /* noop */ }
    }, true);

    // ---- scroll 25/50/75/90/100 ----
    var scrollHit = {};
    function resetScroll() { scrollHit = {}; }
    window.addEventListener('scroll', function () {
      try {
        var doc = document.documentElement;
        var pct = ((window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight)) * 100;
        [25, 50, 75, 90, 100].forEach(function (m) {
          if (pct >= m && !scrollHit[m]) { scrollHit[m] = true; push('scroll', { pct: m }); }
        });
      } catch (err) { /* noop */ }
    }, { passive: true });

    // ---- formulários ----
    var formStarted = {};
    document.addEventListener('focusin', function (e) {
      try {
        var form = e.target && e.target.form;
        if (!form) return;
        var fid = form.getAttribute('id') || form.getAttribute('name') || 'form';
        if (!formStarted[fid]) { formStarted[fid] = true; push('form_start', { form: fid }); }
      } catch (err) { /* noop */ }
    });
    document.addEventListener('focusout', function (e) {
      try {
        var t = e.target;
        if (!t || !t.form || !t.value) return;
        // só o NOME do campo — nunca o valor digitado
        push('form_field', { field: (t.name || t.id || t.type || 'campo').slice(0, 60) });
      } catch (err) { /* noop */ }
    });
    document.addEventListener('submit', function (e) {
      try {
        var form = e.target;
        var fid = (form && (form.getAttribute('id') || form.getAttribute('name'))) || 'form';
        push('form_submit', { form: fid });
        flush(true);
      } catch (err) { /* noop */ }
    }, true);

    // ---- vídeo HTML5 ----
    var videoHit = new WeakMap();
    function watchVideos() {
      try {
        var vids = document.querySelectorAll('video');
        for (var i = 0; i < vids.length; i++) {
          (function (v) {
            if (videoHit.has(v)) return;
            videoHit.set(v, {});
            var marks = videoHit.get(v);
            v.addEventListener('play', function () {
              if (!marks.start) { marks.start = true; push('video_start', { src: (v.currentSrc || '').slice(0, 200) }); }
            });
            v.addEventListener('timeupdate', function () {
              if (!v.duration) return;
              var pct = (v.currentTime / v.duration) * 100;
              [25, 50, 75].forEach(function (m) {
                if (pct >= m && !marks[m]) { marks[m] = true; push('video_' + m, null); }
              });
            });
            v.addEventListener('ended', function () {
              if (!marks.done) { marks.done = true; push('video_complete', null); }
            });
          })(vids[i]);
        }
      } catch (err) { /* noop */ }
    }
    watchVideos();
    setInterval(watchVideos, 4000);

    // ---- tempo de permanência ----
    setInterval(function () {
      if (document.visibilityState === 'visible') push('ping', null);
    }, 15000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('beforeunload', function () { flush(true); });
  } catch (e) { /* nunca quebrar o site do cliente */ }
})();
