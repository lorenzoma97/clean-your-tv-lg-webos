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
  var ROTATE_MS = 8000, CONTENT_TTL = 6 * 3600 * 1000, DETAILS_TTL = 3 * 24 * 3600 * 1000, HOME_PLOT = 112, DETAIL_PLOT = 220;   // two lines of the 880 px plot, four in the detail
  var KEY_STORE = 'casa.tmdbKey';
  var Core = window.CasaCore;
  var demo = window.CASA_DEMO || null;

  var art, layers, scrim, hero, logoEl, subEl, nameEl, chipsEl, plotEl, watchEl, dotsEl, cardsLabel, cardsEl;
  var layerIndex = 0, timer = null, swapTimer = null, pickTimer = null, enterFlip = false, paused = false;
  var app = null, row = -1, zone = 'none', items = [], index = -1, token = 0, detail = false, swallow = {};
  var tileEl = null, lastRow = false, week = null;
  var shelves = {};   // service -> resolved items, kept for the session
  var cardRows = {};  // service -> {items, nodes}: the detail's cards, built once per app
  var colors = {}, darkLogos = {};   // picture path -> glow colour, logo path -> drawn white: worked out once

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
    subEl = el('div', 'casaSub');
    nameEl = el('div', 'casaName');
    chipsEl = el('div', 'casaChips');
    plotEl = el('div', 'casaPlot');
    var actions = el('div', 'casaActions');
    watchEl = el('span', 'casaWatch');
    dotsEl = el('span', 'casaDots');
    actions.appendChild(watchEl);
    actions.appendChild(dotsEl);
    cardsLabel = el('div', 'casaCardsLabel');
    cardsEl = el('div', 'casaCards');
    [logoEl, subEl, nameEl, chipsEl, plotEl, actions, cardsLabel, cardsEl].forEach(function(c) { hero.appendChild(c); });
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
      week = c && c.top10_netflix && c.top10_netflix.week || null;
      if (!pending) return ready(out);
      entries.forEach(function(entry, i) {
        details(entry.tmdb, function(s) {
          // A Novità with no Italian plot (a foreign local production) says nothing to us: not on the shelf.
          if (s && s.backdrop && (entry.top || s.plot)) out.push({order: i, entry: entry, title: s.title, backdrop: s.backdrop,
            logo: s.logo, logoLang: s.logoLang, original: s.original, plot: s.plot, meta: s.meta, metaShort: s.metaShort,
            seasonsAir: s.seasonsAir, next: s.next});
          out.sort(function(a, b) { return a.order - b.order; });
          if (--pending === 0 && out.length) shelves[svc] = out;   // nothing yet (no key, offline): try again next time
          ready(out.slice());   // a copy: focus() compares it with what is on screen, and out keeps growing
        });
      });
    });
  }

  // ---- drawing ---------------------------------------------------------------------------------

  /* TMDB's CDN in the size each place needs; the preview ships its own copies (demo.imageBase: backdrop/, logo/).
     Backdrops at 1280 px: 'original' (2560-3840 px) cost 55-140 ms of decoding per picture on the TV for a 1.5x gain. */
  function image(kind, path, size) {
    if (demo && demo.imageBase) return demo.imageBase + kind + path;
    return IMG + (size || (kind === 'logo' ? 'w500' : 'w1280')) + path;
  }

  /* Black lettering on a light-background logo is drawn white (alpha kept), as on the Metz. Needs CORS: TMDB allows it.
     Worked out once per logo. */
  function whitenIfDark(img, path) {
    var known = darkLogos[path];
    if (known === undefined) {
      known = false;
      try {
        var w = 160, h = Math.max(1, Math.round(img.naturalHeight * w / Math.max(1, img.naturalWidth)));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var g = canvas.getContext('2d');
        g.drawImage(img, 0, 0, w, h);
        known = Core.darkLogo(g.getImageData(0, 0, w, h).data);
      } catch (_) { /* tainted canvas or no canvas: keep the logo as it is */ }
      darkLogos[path] = known;
    }
    img.style.filter = img.style.webkitFilter = known ? 'brightness(0) invert(1)' : '';
  }

  /* A title card: the backdrop, its logo (or its name) at the foot, and optionally a service badge. */
  function card(item, badge) {
    var c = el('div', null, 'casa-card');
    c.style.backgroundImage = 'url("' + image('backdrop', item.backdrop, 'w780') + '")';
    if (item.logo) {
      var logo = el('img', null, 'casa-card-logo');
      logo.crossOrigin = 'anonymous';
      logo.onload = function() { whitenIfDark(logo, item.logo); };
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

  /* The picture's glow colour for the rest of Home (casa-home.js), from a 300 px copy: sampling the full picture decoded
     it on the main thread (155 ms on the TV). Worked out once per picture, kept across restarts. */
  function tintFrom(path) {
    var known = colors[path] || load('casa.c.' + path, Infinity);
    if (known) {
      colors[path] = known;
      if (window.CasaHome) CasaHome.tint(known);
      return;
    }
    var img = new Image();
    if (!demo) img.crossOrigin = 'anonymous';   // TMDB allows it: the glow colour needs the pixels
    img.onload = function() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 14;
        var g = canvas.getContext('2d');
        g.drawImage(img, 0, 0, 24, 14);
        colors[path] = Core.dominant(g.getImageData(0, 0, 24, 14).data);
        keep('casa.c.' + path, colors[path]);
        if (window.CasaHome) CasaHome.tint(colors[path]);
      } catch (_) { /* tainted canvas: the glow keeps its colour */ }
    };
    img.src = image('backdrop', path, 'w300');
  }

  function chip(text, cls) {
    var c = el('span', null, 'casa-chip' + (cls ? ' ' + cls : ''));
    c.textContent = text;
    chipsEl.appendChild(c);
    return c;
  }

  /* What OK does on this title, in the same words on both TVs. */
  function verb(item) {
    if (item.cta) return item.cta;
    var svc = Core.serviceOf(app && app.id);
    if (svc === 'netflix' && Core.netflixParams(item.entry.netflixId)) return 'Guarda su Netflix';
    return 'Apri ' + (app ? app.title : '');
  }

  function text(item) {
    var e = item.entry, now = new Date();
    if (item.logo) {
      logoEl.crossOrigin = 'anonymous';
      logoEl.onload = function() { whitenIfDark(logoEl, item.logo); };
      logoEl.src = image('logo', item.logo);
      logoEl.style.display = '';
      nameEl.style.display = 'none';
    } else {
      logoEl.style.display = 'none';
      nameEl.style.display = '';
      nameEl.textContent = item.title;
    }
    // An English logo over an Italian title ("TREASURE ISLAND" / "L'isola del tesoro"): the name to look for in the app.
    var other = item.logo && item.logoLang && item.logoLang !== 'it' && item.title && item.title !== item.original;
    subEl.textContent = other ? item.title : '';
    subEl.style.display = other ? '' : 'none';
    chipsEl.innerHTML = '';
    if (e.top && !Core.staleWeek(week, now)) {
      var top = el('span', null, 'casa-top');
      top.innerHTML = '<i>TOP</i><b>10</b>';
      chipsEl.appendChild(top);
      chip('N. ' + e.top + ' in Italia', 'rank');
    }
    var tag = Core.whenTag(e, item, now), next = Core.nextEpisode(item, now);
    if (tag) chip(tag, 'tag');
    if (e.season) chip(e.season);
    if (next) chip(next, 'next');
    var meta = e.top || e.tag || e.season ? item.metaShort || item.meta : item.meta;
    if (meta) {
      var m = el('span', null, 'casa-meta');
      // "Miniserie" once: the badge already says it.
      m.textContent = meta.split(' · ').filter(function(part) { return part !== e.season; }).join(' · ');
      chipsEl.appendChild(m);
    }
    plotEl.textContent = Core.shortPlot(item.plot, detail ? DETAIL_PLOT : HOME_PLOT);
    // In Home OK opens the app and Up the titles: the line says so; in the detail and in Scopri OK plays this title.
    var home = !detail && !document.body.classList.contains('casa-scopri');
    watchEl.className = home ? 'hint' : '';
    watchEl.textContent = home ? '▲  Scegli il titolo   ·   OK apre ' + (app ? app.title : '') : '▶  ' + verb(item);
    dotsEl.innerHTML = '';
    for (var i = 0; i < Math.min(items.length, 12); i++) dotsEl.appendChild(el('span', null, 'casa-dot' + (i === index ? ' on' : '')));
    if (detail) cardsLabel.textContent = e.top && !Core.staleWeek(week, now) ? 'Top 10 serie in Italia · ' + Core.weekIt(week) : 'Novità';
    // The new title rises in: logo, badges, plot and button one after the other (casa.css). Two classes in turn restart
    // the animation without forcing a layout (offsetWidth did, on every title).
    hero.classList.remove(enterFlip ? 'enter' : 'enter2');
    hero.classList.add(enterFlip ? 'enter2' : 'enter');
    enterFlip = !enterFlip;
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
      // A short push-in that ends (1.5 s, casa.css): a 9.5 s one never stopped and kept the TV redrawing every frame.
      next.style.transform = 'scale(1.03)';
      current.style.opacity = '0';
      layerIndex = 1 - layerIndex;
      tintFrom(item.backdrop);
    };
    img.src = image('backdrop', item.backdrop);
  }

  function show(i, first) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    var item = items[index];
    document.body.classList.add('casa-on');
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
    if (!detail && !paused && items.length > 1) timer = setTimeout(function() {
      if (editing()) return schedule();   // moving an app: the titles wait
      show(index + 1);
    }, ROTATE_MS);
  }

  function hide() {
    token++;
    clearTimeout(timer);
    items = [];
    index = -1;
    document.body.classList.remove('casa-on');
    layers[0].style.opacity = layers[1].style.opacity = '0';
  }

  // ---- detail ----------------------------------------------------------------------------------

  /* The detail's row, built once per app: rebuilding twelve cards on every Up cost 130-200 ms on the TV. */
  function buildCards() {
    var svc = Core.serviceOf(app && app.id) || '', kept = cardRows[svc];
    if (!kept || kept.items.length !== items.length || kept.items.some(function(x, i) { return x !== items[i]; })) {
      kept = cardRows[svc] = {items: items.slice(), nodes: items.map(function(item) { return card(item); })};
    }
    cardsEl.innerHTML = '';
    kept.nodes.forEach(function(n) { cardsEl.appendChild(n); });
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
  function play(event) {
    if (event && event.repeat) return;   // a held OK opens it once
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

  /* Moving an app, the "+" list or the "App hidden · Undo" bar: their keys, not ours. */
  function editing() {
    var picker = document.getElementById('appPicker'), undo = document.getElementById('appUndo');
    return document.body.classList.contains('editing') || !!(picker && !picker.hidden) || !!(undo && !undo.hidden);
  }

  // Ahead of app.js (capture): in the detail every key is ours; on the dock, Up opens the detail.
  function onKey(event) {
    var key = event.keyCode, mine = false;
    if (document.body.classList.contains('casa-rest') || document.body.classList.contains('casa-list')) return;   // theirs
    if (detail) {
      mine = true;
      if (event.type === 'keydown') {
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) play(event);
        else if (key === 40) exitDetail();
        else if (key === 461 || key === 27) {   // Back: to the first title, then out
          if (index > 0) { move(-index); } else exitDetail();
        } else if (key === 38) {   // Up: on to the top bar, one column from the top (app.js)
          exitDetail();
          if (window.HomeApp && HomeApp.focusTop) HomeApp.focusTop();
        } else mine = false;   // volume and the rest pass through
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
      schedule();   // the first title came alone: rotate now that there are others
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
  /* HOME and the rest screen: back to the base state. */
  function reset() {
    if (detail) exitDetail();
  }
  /* The rest screen: no rotation (and no decoding) under it. */
  function pause(on) {
    paused = !!on;
    if (paused) clearTimeout(timer); else schedule();
  }

  if (!Core) return;
  build();
  takeKey(window.PalmSystem && window.PalmSystem.launchParams);
  document.addEventListener('webOSRelaunch', function(e) { takeKey(e && e.detail); reset(); });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  window.CasaShelf = {focus: focus, zone: setZone, feature: feature, refocus: refocus, reset: reset, pause: pause,
    editing: editing, state: function() { return {zone: zone, row: row, lastRow: lastRow, detail: detail}; },
    util: {load: load, keep: keep, getJSON: getJSON, content: content, details: details, image: image, card: card}};
}());
