/* Fork lorenzoma97, "Casa": the cinematic shelf. On a dock app with titles (Netflix: Top 10 Italia then Novita; Prime,
   RaiPlay, Infinity: Novita) a full-screen backdrop, the title's logo, badges and plot rotate every 8 s; Up opens the
   detail, a row of title cards (Left/Right, OK plays, Down/Back returns). app.js calls focus() and zone().
   Data: content.json (tv-casa-data) and TMDB details with the owner's key, kept in localStorage (only what is shown).
   The browser preview passes window.CASA_DEMO {content, details: {tmdb id: TMDB reply}} instead of the network. */
(function() {
  'use strict';
  var CONTENT_URL = 'https://lorenzoma97.github.io/tv-casa-data/content.json';
  var TMDB = 'https://api.themoviedb.org/3/tv/';
  var IMG = 'https://image.tmdb.org/t/p/';
  var ROTATE_MS = 8000, CONTENT_TTL = 6 * 3600 * 1000, DETAILS_TTL = 7 * 24 * 3600 * 1000, HOME_PLOT = 150;
  var KEY_STORE = 'casa.tmdbKey';
  var Core = window.CasaCore;
  var demo = window.CASA_DEMO || null;

  var art, layers, scrim, hero, logoEl, nameEl, chipsEl, plotEl, watchEl, dotsEl, cardsEl;
  var layerIndex = 0, timer = null, swapTimer = null, pickTimer = null;
  var app = null, row = -1, zone = 'none', items = [], index = -1, token = 0, detail = false, swallow = {};
  var tileEl = null, lastRow = false;
  var shelves = {};   // service -> resolved items, kept for the session

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }

  function build() {
    art = el('div', 'casaArt');
    layers = [el('div', null, 'casa-layer'), el('div', null, 'casa-layer')];
    art.appendChild(layers[0]);
    art.appendChild(layers[1]);
    scrim = el('div', 'casaScrim');
    hero = el('div', 'casaHero');
    logoEl = el('img', 'casaLogo');
    nameEl = el('div', 'casaName');
    chipsEl = el('div', 'casaChips');
    plotEl = el('div', 'casaPlot');
    var actions = el('div', 'casaActions');
    watchEl = el('span', 'casaWatch');
    dotsEl = el('span', 'casaDots');
    actions.appendChild(watchEl);
    actions.appendChild(dotsEl);
    cardsEl = el('div', 'casaCards');
    [logoEl, nameEl, chipsEl, plotEl, actions, cardsEl].forEach(function(c) { hero.appendChild(c); });
    var anchor = document.getElementById('hero');
    document.body.insertBefore(art, anchor);
    document.body.insertBefore(scrim, anchor);
    document.body.insertBefore(hero, anchor);
  }

  // ---- data ------------------------------------------------------------------------------------

  function load(key, ttl) {
    try {
      var x = JSON.parse(localStorage.getItem(key));
      return x && Date.now() - x.t < ttl ? x.v : null;
    } catch (_) { return null; }
  }
  function keep(key, value) {
    try { localStorage.setItem(key, JSON.stringify({t: Date.now(), v: value})); } catch (_) { /* full: show without caching */ }
  }
  function getJSON(url, done) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = 15000;
    xhr.onload = function() {
      var data = null;
      try { data = xhr.status === 200 ? JSON.parse(xhr.responseText) : null; } catch (_) { data = null; }
      done(data);
    };
    xhr.onerror = xhr.ontimeout = function() { done(null); };
    xhr.send();
  }
  function tmdbKey() {
    try { return localStorage.getItem(KEY_STORE); } catch (_) { return null; }
  }
  /* The key arrives once as a launch parameter ({"tmdbKey": "..."}, sent over the TV's own network by the installer). */
  function takeKey(raw) {
    try {
      var params = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (params && params.params) params = params.params;
      if (params && /^[0-9a-f]{32}$/.test(params.tmdbKey || '')) {
        localStorage.setItem(KEY_STORE, params.tmdbKey);
        shelves = {};   // titles asked for before the key came back empty
      }
    } catch (_) { /* not ours */ }
  }

  function content(done) {
    if (demo) return done(demo.content);
    var kept = load('casa.content', CONTENT_TTL);
    if (kept) return done(kept);
    getJSON(CONTENT_URL, function(c) {
      if (c && c.services) keep('casa.content', c);
      done(c || load('casa.content', Infinity));
    });
  }

  function details(id, done) {
    if (demo) return done(demo.details[id] ? Core.summary(demo.details[id]) : null);
    var kept = load('casa.d.' + id, DETAILS_TTL);
    if (kept) return done(kept);
    var key = tmdbKey();
    if (!key) return done(null);
    getJSON(TMDB + id + '?language=it-IT&append_to_response=images&include_image_language=it,en,null&api_key=' + key, function(d) {
      if (!d || !d.id) return done(load('casa.d.' + id, Infinity));
      var s = Core.summary(d);
      keep('casa.d.' + id, s);
      done(s);
    });
  }

  /* The titles of one service in shelf order; the first that resolves shows at once, the others join in order. */
  function resolve(svc, ready) {
    if (shelves[svc]) return ready(shelves[svc]);
    content(function(c) {
      var entries = c ? Core.plan(c)[svc] || [] : [];
      var out = [], pending = entries.length;
      if (!pending) return ready(out);
      entries.forEach(function(entry, i) {
        details(entry.tmdb, function(s) {
          if (s && s.backdrop) out.push({order: i, entry: entry, title: s.title, backdrop: s.backdrop, logo: s.logo, plot: s.plot, meta: s.meta});
          out.sort(function(a, b) { return a.order - b.order; });
          if (--pending === 0 && out.length) shelves[svc] = out;   // nothing yet (no key, offline): try again next time
          ready(out);
        });
      });
    });
  }

  // ---- drawing ---------------------------------------------------------------------------------

  /* TMDB's CDN in the size each place needs; the preview ships its own copies (demo.imageBase: backdrop/, logo/). */
  function image(kind, path, size) {
    if (demo && demo.imageBase) return demo.imageBase + kind + path;
    return IMG + (size || (kind === 'logo' ? 'w500' : 'original')) + path;
  }

  /* Black lettering on a light-background logo is drawn white (alpha kept), as on the Metz. Needs CORS: TMDB allows it. */
  function whitenIfDark(img) {
    img.style.filter = img.style.webkitFilter = '';
    try {
      var w = 160, h = Math.max(1, Math.round(img.naturalHeight * w / Math.max(1, img.naturalWidth)));
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var g = canvas.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      if (Core.darkLogo(g.getImageData(0, 0, w, h).data)) img.style.filter = img.style.webkitFilter = 'brightness(0) invert(1)';
    } catch (_) { /* tainted canvas or no canvas: keep the logo as it is */ }
  }

  /* A title card: the backdrop, its logo (or its name) at the foot, and optionally a service badge. */
  function card(item, badge) {
    var c = el('div', null, 'casa-card');
    c.style.backgroundImage = 'url("' + image('backdrop', item.backdrop, 'w780') + '")';
    if (item.logo) {
      var logo = el('img', null, 'casa-card-logo');
      logo.crossOrigin = 'anonymous';
      logo.onload = function() { whitenIfDark(logo); };
      logo.src = image('logo', item.logo, 'w300');
      c.appendChild(logo);
    } else {
      var name = el('span', null, 'casa-card-name');
      name.textContent = item.title;
      c.appendChild(name);
    }
    if (badge) {
      var b = el('span', null, 'casa-card-badge ' + badge.cls);
      b.textContent = badge.text;
      c.appendChild(b);
    }
    return c;
  }

  /* The picture's glow colour for the rest of Home (casa-home.js). Same-origin or CORS pictures only. */
  function sampleColor(img) {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 14;
      var g = canvas.getContext('2d');
      g.drawImage(img, 0, 0, 24, 14);
      return Core.dominant(g.getImageData(0, 0, 24, 14).data);
    } catch (_) { return null; }
  }

  function chip(text, cls) {
    var c = el('span', null, 'casa-chip' + (cls ? ' ' + cls : ''));
    c.textContent = text;
    chipsEl.appendChild(c);
    return c;
  }

  function text(item) {
    var e = item.entry;
    if (item.logo) {
      logoEl.crossOrigin = 'anonymous';
      logoEl.onload = function() { whitenIfDark(logoEl); };
      logoEl.src = image('logo', item.logo);
      logoEl.style.display = '';
      nameEl.style.display = 'none';
    } else {
      logoEl.style.display = 'none';
      nameEl.style.display = '';
      nameEl.textContent = item.title;
    }
    chipsEl.innerHTML = '';
    if (e.top) {
      var top = el('span', null, 'casa-top');
      top.innerHTML = '<i>TOP</i><b>10</b>';
      chipsEl.appendChild(top);
      chip('N. ' + e.top + ' in Italia', 'rank');
    }
    if (e.tag) chip(e.tag, 'tag');
    if (e.season) chip(e.season);
    if (item.meta) {
      var m = el('span', null, 'casa-meta');
      // "Miniserie" once: the badge already says it.
      m.textContent = item.meta.split(' · ').filter(function(part) { return part !== e.season; }).join(' · ');
      chipsEl.appendChild(m);
    }
    plotEl.textContent = detail ? item.plot || '' : Core.shortPlot(item.plot, HOME_PLOT);
    var svc = Core.serviceOf(app && app.id);
    watchEl.textContent = '▶  ' + (item.cta || (svc === 'netflix' && Core.netflixParams(e.netflixId) ? 'Guarda il titolo' : 'Apri ' + (app ? app.title : '')));
    dotsEl.innerHTML = '';
    for (var i = 0; i < Math.min(items.length, 12); i++) dotsEl.appendChild(el('span', null, 'casa-dot' + (i === index ? ' on' : '')));
    // The new title rises in: logo, badges, plot and button one after the other (casa.css).
    hero.classList.remove('enter');
    hero.offsetWidth;
    hero.classList.add('enter');
  }

  function picture(item) {
    var next = layers[1 - layerIndex], current = layers[layerIndex], img = new Image(), mine = token;
    if (!demo) img.crossOrigin = 'anonymous';   // TMDB allows it: the glow colour needs the pixels
    img.onload = function() {
      if (mine !== token) return;
      next.style.transition = 'none';
      next.style.transform = 'scale(1)';
      next.style.backgroundImage = 'url("' + img.src + '")';
      next.offsetWidth;
      next.style.transition = '';
      next.style.opacity = '1';
      next.style.transform = 'scale(1.06)';   // the slow push-in, over the 9.5 s transition
      current.style.opacity = '0';
      layerIndex = 1 - layerIndex;
      var rgb = sampleColor(img);
      if (rgb && window.CasaHome) CasaHome.tint(rgb);
    };
    img.src = image('backdrop', item.backdrop);
  }

  function show(i, first) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    var item = items[index];
    document.body.classList.add('casa-on');
    if (window.CasaRest) CasaRest.sky(false);
    picture(item);
    clearTimeout(swapTimer);
    if (first || detail) {
      text(item);
    } else {
      hero.classList.add('swapping');
      swapTimer = setTimeout(function() { text(item); hero.classList.remove('swapping'); }, 260);
    }
    if (detail) markCard();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (!detail && items.length > 1) timer = setTimeout(function() { show(index + 1); }, ROTATE_MS);
  }

  function hide() {
    token++;
    clearTimeout(timer);
    items = [];
    index = -1;
    document.body.classList.remove('casa-on');
    layers[0].style.opacity = layers[1].style.opacity = '0';
    if (window.CasaRest) CasaRest.sky(true);   // an app without titles: the live sky over Bologna
  }

  // ---- detail ----------------------------------------------------------------------------------

  function buildCards() {
    cardsEl.innerHTML = '';
    items.forEach(function(item) { cardsEl.appendChild(card(item)); });
    markCard();
  }
  function markCard() {
    var cards = cardsEl.children;
    for (var i = 0; i < cards.length; i++) cards[i].className = 'casa-card' + (i === index ? ' focused' : '');
    // Keep the focused card in view: the row scrolls under a fixed left edge.
    var shift = Math.max(0, index - 3) * 290;
    cardsEl.style.transform = 'translateX(' + -shift + 'px)';
  }
  function enterDetail() {
    detail = true;
    clearTimeout(timer);
    document.body.classList.add('casa-detail');
    buildCards();
    text(items[index]);
  }
  function exitDetail() {
    detail = false;
    clearTimeout(pickTimer);
    document.body.classList.remove('casa-detail');
    text(items[index]);
    schedule();
  }
  function play() {
    var item = items[index], params = item && Core.netflixParams(item.entry.netflixId);
    var svc = Core.serviceOf(app && app.id);
    if (window.HomeApp) HomeApp.launch(app.id, app.title, svc === 'netflix' ? params : null);
  }
  function move(step) {
    var next = index + step;
    if (next < 0 || next >= items.length) return;
    index = next;
    markCard();
    clearTimeout(pickTimer);
    pickTimer = setTimeout(function() { show(index); }, 180);   // not every card passed over loads its picture
  }

  function editing() {
    var picker = document.getElementById('appPicker');
    return document.body.classList.contains('editing') || !!(picker && !picker.hidden);
  }

  // Ahead of app.js (capture): in the detail every key is ours; on the dock, Up opens the detail.
  function onKey(event) {
    var key = event.keyCode, mine = false;
    if (detail) {
      mine = true;
      if (event.type === 'keydown') {
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) play();
        else if (key === 40 || key === 461 || key === 27) exitDetail();
        else if (key !== 38) mine = false;   // volume and the rest pass through
      }
    } else if (event.type === 'keydown' && key === 38 && zone === 'grid' && row === 0 && items.length && !editing()
        && !document.body.classList.contains('casa-scopri') && !document.body.classList.contains('casa-rest')) {
      mine = true;
      enterDetail();
    } else if (event.type === 'keyup' && swallow[key]) {
      mine = true;
    }
    if (mine) {
      swallow[key] = event.type === 'keydown';
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  // ---- what app.js calls -----------------------------------------------------------------------

  /* Focus on a tile (row 0 is the dock; el its element; last: on the last row of apps). Leaving the dock or an app
     without titles shows the app's own look. */
  function focus(tile, tileRow, node, last) {
    row = tileRow;
    tileEl = node || null;
    lastRow = !!last;
    if (window.CasaHome) CasaHome.focus(tileEl, row, lastRow);
    var id = tile && tile.id, svc = tileRow === 0 ? Core.serviceOf(id) : null;
    if (app && tile && app.id === id && items.length) return;   // same app: keep rotating
    app = tile;
    if (detail) exitDetail();
    hide();
    if (!svc) return;
    var mine = ++token;
    resolve(svc, function(list) {
      if (mine !== token || !list.length) return;
      var shown = items[index];
      items = list;
      if (!shown) return show(0, true);
      index = items.indexOf(shown);   // a title earlier in the order arrived later: the one on screen stays
      text(shown);
    });
  }

  function setZone(z) {
    zone = z;
    if (z !== 'grid' && detail) exitDetail();
    if (window.CasaHome) CasaHome.zone(z);
  }

  /* One title on the shelf, not rotating (the Scopri row's focused card); refocus() brings the app's titles back. */
  function feature(item) {
    token++;
    clearTimeout(timer);
    items = [item];
    index = 0;
    show(0, true);
  }
  function refocus() {
    var t = app;
    app = null;
    focus(t, row, tileEl, lastRow);
  }

  if (!Core) return;
  build();
  takeKey(window.PalmSystem && window.PalmSystem.launchParams);
  document.addEventListener('webOSRelaunch', function(e) { takeKey(e && e.detail); });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  window.CasaShelf = {focus: focus, zone: setZone, feature: feature, refocus: refocus,
    state: function() { return {zone: zone, row: row, lastRow: lastRow, detail: detail}; },
    util: {load: load, keep: keep, getJSON: getJSON, content: content, details: details, image: image, card: card}};
}());
