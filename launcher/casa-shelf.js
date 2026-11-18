/* Fork lorenzoma97, "Casa": the cinematic shelf. On a dock app with titles (Netflix: Top 10 series, Top 10 films, then
   Novita; Prime, RaiPlay, Infinity, HBO Max: Novita; DAZN: the next Serie A matches) a full-screen backdrop, the title's
   logo, badges and plot rotate every 8 s. Under the plot a row of grey buttons that light up: "Guarda su Netflix",
   "Trailer", "Da vedere", "Tutti i titoli". Up from the dock lights the first; Left/Right move, OK acts, Down returns.
   "Tutti i titoli" opens the detail, a row of title cards (Left/Right, OK plays, Up the buttons, Down/Back returns).
   The rows under the apps (casa-home.js) show their focused title here with their own buttons (feature()).
   app.js calls focus() and zone().
   Data: content.json (tv-casa-data) and TMDB details with the owner's key, kept in localStorage (only what is shown).
   The browser preview passes window.CASA_DEMO {content, details: {tmdb id: TMDB reply}} instead of the network. */
(function() {
  'use strict';
  var CONTENT_URL = window.CASA_CONTENT_URL || 'https://lorenzoma97.github.io/tv-casa-data/content.json';
  var TMDB = 'https://api.themoviedb.org/3/';
  var IMG = 'https://image.tmdb.org/t/p/';
  var ROTATE_MS = 8000, CONTENT_TTL = 6 * 3600 * 1000, DETAILS_TTL = 3 * 24 * 3600 * 1000, HOME_PLOT = 112, DETAIL_PLOT = 220;   // two lines of the 880 px plot, four in the detail
  var KEEP_MS = 30 * 24 * 3600 * 1000;   // details and colours not looked at for a month are dropped
  var KEY_STORE = 'casa.tmdbKey';
  var Core = window.CasaCore, State = window.CasaState || null;
  var demo = window.CASA_DEMO || null;

  var art, layers, scrim, hero, logoEl, subEl, nameEl, chipsEl, plotEl, actionsEl, dotsEl, cardsLabel, cardsEl, eventEl;
  var layerIndex = 0, timer = null, swapTimer = null, pickTimer = null, enterFlip = false, paused = false;
  var app = null, row = -1, zone = 'none', items = [], index = -1, token = 0, detail = false, swallow = {};
  /* The hero's buttons: the ones on show ([{id, text, cls}]), the lit one's id (null: the dock, the cards or a row under
     the apps has the focus), and who asked for them (null: the dock app's own titles; else casa-home.js's row, which
     names the buttons and gets the presses). */
  var bar = [], barSig = '', lit = null, context = null;
  var ICONS = {
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4.6v14.8l12.2-7.4z"/></svg>',
    all: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8z"/></svg>',
    trailer: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path fill="currentColor" d="M10 8.8v6.4l5.4-3.2z"/></svg>',
    later: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>',
    saved: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h12v18l-6-4.4L6 21z"/></svg>',
    seen: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l5 5 10-11"/></svg>',
    skip: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 7.5V12l3 2"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 5L4 10l5 5M4 10h9.5a5 5 0 0 1 0 10H10"/></svg>',
    die: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
      + '<g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.6"/><circle cx="15.5" cy="15.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="15.5" cy="8.5" r="1.6"/><circle cx="8.5" cy="15.5" r="1.6"/></g></svg>'
  };
  /* The glow of a match or a race, which has no picture: its competition's colour. */
  var COMP_COLORS = {seriea: [0, 122, 255], champions: [44, 70, 220], f1: [225, 30, 20]};
  var tileEl = null, lastRow = false, week = null, weekFilm = null;
  var shelves = {}, shelvesAt = 0;   // service -> resolved items, kept as long as content.json is (CONTENT_TTL)
  var picSeq = 0, okAt = 0, upAt = {}, levelKey = 0;   // the last picture asked for; the last OK; keyup times; the key that changed level
  var cardRows = {};  // app id -> {items, nodes}: the detail's cards, built once per app
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
    eventEl = el('div', 'casaEvent');
    art.appendChild(eventEl);
    scrim = el('div', 'casaScrim');
    hero = el('div', 'casaHero');
    logoEl = el('img', 'casaLogo');
    subEl = el('div', 'casaSub');
    nameEl = el('div', 'casaName');
    chipsEl = el('div', 'casaChips');
    plotEl = el('div', 'casaPlot');
    actionsEl = el('div', 'casaActions');
    dotsEl = el('span', 'casaDots');
    actionsEl.appendChild(dotsEl);
    // The pointer: a click on a button is its OK.
    actionsEl.addEventListener('click', function(event) {
      for (var n = event.target; n && n !== actionsEl; n = n.parentNode) {
        var id = n.getAttribute && n.getAttribute('data-a');
        if (id) return press(id);
      }
    });
    cardsLabel = el('div', 'casaCardsLabel');
    cardsEl = el('div', 'casaCards');
    [logoEl, subEl, nameEl, chipsEl, plotEl, actionsEl, cardsLabel, cardsEl].forEach(function(c) { hero.appendChild(c); });
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
  /* Once a day: the details of the versions before this one (casa.d.*, without trailers and films), and the details and
     colours kept for more than a month (the pool changes; nothing ever removed them). */
  function prune() {
    try {
      if (load('casa.pruned', 24 * 3600 * 1000)) return;
      var drop = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf('casa.d.') === 0 || k === 'casa.content') drop.push(k);
        else if (k.indexOf('casa.e.') === 0 || k.indexOf('casa.c.') === 0) {
          if (!load(k, KEEP_MS)) drop.push(k);
        }
      }
      drop.forEach(function(key) { localStorage.removeItem(key); });
      keep('casa.pruned', 1);
    } catch (_) { /* next time */ }
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
    // "casa.content2": the copy kept by the builds before films and sport has neither, and would be served for six hours.
    var kept = load('casa.content2', CONTENT_TTL);
    if (kept) return done(kept);
    getJSON(CONTENT_URL, function(c) {
      if (c && c.services) keep('casa.content2', c);
      done(c || load('casa.content2', Infinity));
    });
  }

  /* What is shown of a title, by its key (a series' TMDB id; a film's with an "m" in front). */
  function details(key, done) {
    var movie = Core.isMovie(key);
    if (demo) return done(demo.details[key] ? Core.summary(demo.details[key], movie) : null);
    var kept = load('casa.e.' + key, DETAILS_TTL);
    if (kept) return done(kept);
    var api = tmdbKey();
    if (!api) return done(null);
    getJSON(TMDB + (movie ? 'movie/' : 'tv/') + Core.rawId(key) + '?language=it-IT&append_to_response=images,videos'
        + '&include_image_language=it,en,null&include_video_language=it,en&api_key=' + api, function(d) {
      if (!d || !d.id) return done(load('casa.e.' + key, Infinity));
      var s = Core.summary(d, movie);
      keep('casa.e.' + key, s);
      done(s);
    });
  }

  /* The titles of one service in shelf order; the first that resolves shows at once, the others join in order. */
  function resolve(svc, ready) {
    // Kept six hours, as content.json is: the app stays open for days, and kept showing the week it was started in.
    if (Date.now() - shelvesAt > CONTENT_TTL) { shelves = {}; shelvesAt = Date.now(); }
    if (shelves[svc]) return ready(shelves[svc]);
    content(function(c) {
      var entries = c ? Core.plan(c)[svc] || [] : [];
      var out = [], pending = entries.length;
      week = c && c.top10_netflix && c.top10_netflix.week || null;
      weekFilm = c && c.top10_netflix_film && c.top10_netflix_film.week || null;
      if (!pending) return ready(out);
      entries.forEach(function(entry, i) {
        var key = Core.keyOf(entry.tmdb, entry.movie);
        details(key, function(s) {
          // A Novità with no Italian plot (a foreign local production) says nothing to us: not on the shelf.
          if (s && s.backdrop && (entry.top || s.plot)) out.push({order: i, key: key, movie: !!entry.movie, svc: svc, entry: entry,
            title: s.title, backdrop: s.backdrop, logo: s.logo, logoLang: s.logoLang, original: s.original, plot: s.plot,
            meta: s.meta, metaShort: s.metaShort, seasonsAir: s.seasonsAir, next: s.next, trailer: s.trailer});
          out.sort(function(a, b) { return a.order - b.order; });
          if (--pending === 0 && out.length) shelves[svc] = out;   // nothing yet (no key, offline): try again next time
          ready(out.slice());   // a copy: focus() compares it with what is on screen, and out keeps growing
        });
      });
    });
  }

  function installed(appId) {
    return (window.TV_APPS && TV_APPS.apps || []).some(function(a) { return a.id === appId; });
  }
  /* A match or a race ready to show: no picture, its teams' crests, where it is broadcast and the app that opens it
     (when the TV has it). */
  function eventItem(ev, sport) {
    var b = sport && sport.broadcast && sport.broadcast[ev.comp] || {}, appId = b.app ? Core.appOf(b.app) : null;
    var has = !!appId && installed(appId);
    return {event: ev, key: null, title: Core.eventTitle(ev), comp: b.name || ev.comp, where: b.where || '',
      svc: has ? b.app : null, cta: has ? 'Apri ' + b.where : null, backdrop: null, logo: null, entry: {},
      plot: b.where ? 'In diretta su ' + b.where + '.' : ''};
  }
  /* The next matches a sport app shows (DAZN: Serie A), for its dock tile. */
  function resolveSport(name, ready) {
    content(function(c) {
      var sport = c && c.sport;
      ready(Core.events(sport, new Date(), {app: name, max: 10}).map(function(ev) { return eventItem(ev, sport); }));
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

  function crest(url, cls) {
    var i = el('img', null, cls);
    i.onerror = function() { i.style.visibility = 'hidden'; };   // a crest that does not load leaves its place empty
    i.src = url;
    return i;
  }

  /* A match's or a race's card: the crests (or the competition's name), the time, who plays, where it is shown. */
  function eventCard(item) {
    var ev = item.event, c = el('div', null, 'casa-card casa-event ' + ev.comp);
    var top = el('div', null, 'ev-top');
    if (ev.home_logo && ev.away_logo) {
      top.appendChild(crest(ev.home_logo, 'ev-crest'));
      top.appendChild(crest(ev.away_logo, 'ev-crest'));
    } else {
      var mark = el('span', null, 'ev-mark');
      mark.textContent = item.comp;
      top.appendChild(mark);
    }
    c.appendChild(top);
    var when = el('span', null, 'ev-when'), name = el('span', null, 'ev-name');
    when.textContent = Core.eventWhen(ev, new Date());
    if (when.textContent === 'In corso') when.className += ' live';
    name.textContent = item.title + (ev.session ? ' · ' + ev.session : '');
    c.appendChild(when);
    c.appendChild(name);
    if (item.where) {
      var b = el('span', null, 'casa-card-badge');
      b.textContent = item.where;
      c.appendChild(b);
    }
    return c;
  }

  /* A title card: the backdrop, its logo (or its name) at the foot, and optionally a service badge. */
  function card(item, badge) {
    if (item.event) return eventCard(item);
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
    var known = colors[path] || load('casa.c.' + path, Infinity), seq = picSeq;
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
        if (seq === picSeq && window.CasaHome) CasaHome.tint(colors[path]);   // not the colour of a picture passed over
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

  /* What OK does on this title, in the same words on both TVs; null when nothing opens it (a match on a channel the TV
     has no app for). */
  function verb(item) {
    if (item.cta !== undefined) return item.cta;
    var svc = Core.serviceOf(app && app.id);
    if (svc === 'netflix' && Core.netflixParams(item.entry.netflixId)) return 'Guarda su Netflix';
    return 'Apri ' + (app ? app.title : '');
  }

  // ---- the buttons ---------------------------------------------------------------------------------

  /* The buttons for the title on screen. The dock app's own titles: Guarda, Trailer, Da vedere, Tutti i titoli. A title
     of a row under the apps: the ones casa-home.js names. A button that could do nothing is not shown. */
  function buttons(item) {
    var out = [], ids = context ? context.buttons : ['play', 'trailer', 'later', 'all'];
    if (!item) return out;
    ids.forEach(function(id) {
      if (id === 'play') { if (verb(item)) out.push({id: id, icon: 'play', text: verb(item)}); }
      else if (id === 'trailer') { if (item.trailer && installed(Core.YOUTUBE)) out.push({id: id, icon: 'trailer', text: 'Trailer'}); }
      else if (id === 'later') {
        if (State && item.key !== null && item.key !== undefined) {
          var on = State.later(item.key);
          out.push({id: id, icon: on ? 'saved' : 'later', text: on ? 'In lista' : 'Da vedere', cls: on ? 'on' : ''});
        }
      }
      else if (id === 'all') { if (!detail && items.length > 1) out.push({id: id, icon: 'all', text: item.event ? 'Tutte le partite' : 'Tutti i titoli'}); }
      else if (id === 'seen') out.push({id: id, icon: 'seen', text: item.movie ? 'Già visto' : 'Già vista'});
      else if (id === 'skip') out.push({id: id, icon: 'skip', text: 'Non oggi'});
      else if (id === 'drop') out.push({id: id, icon: 'drop', text: 'Togli dalla lista'});
      else if (id === 'redraw') out.push({id: id, icon: 'die', text: item.movie ? 'Altri cinque' : 'Altre cinque'});
      else if (id === 'undo') { if (context.undo) out.push({id: id, icon: 'undo', text: context.undo, cls: 'casa-undo'}); }
    });
    return out;
  }
  /* Draws the buttons again only when they changed (a button rebuilt under the focus would start its ring again). */
  function drawBar() {
    bar = buttons(items[index]);
    var sig = bar.map(function(b) { return b.id + '\u0001' + b.text + '\u0001' + (b.cls || ''); }).join('\u0002');
    if (sig !== barSig) {
      barSig = sig;
      while (actionsEl.firstChild !== dotsEl) actionsEl.removeChild(actionsEl.firstChild);
      bar.forEach(function(b) {
        var n = el('span', null, 'casa-action');
        n.setAttribute('data-a', b.id);
        n.innerHTML = ICONS[b.icon] + '<span></span>';
        n.lastChild.textContent = b.text;
        actionsEl.insertBefore(n, dotsEl);
      });
    }
    // The lit button is gone (the Annulla that ran out, a trailer the next title has not): the first one.
    if (lit !== null && !bar.some(function(b) { return b.id === lit; })) {
      lit = bar.length ? bar[0].id : null;
      if (lit === null) schedule();
    }
    markBar();
  }
  function markBar() {
    var nodes = actionsEl.children;
    for (var i = 0; i < bar.length; i++) {
      nodes[i].className = 'casa-action' + (bar[i].cls ? ' ' + bar[i].cls : '') + (bar[i].id === lit ? ' focused' : '');
    }
    document.body.classList.toggle('casa-btns', lit !== null);
  }
  /* The hero's buttons: grey until lit, then white with a spring and a ring that opens out twice (casa.css). The dock
     keeps app.js's focus underneath; body.casa-btns hides its highlight meanwhile. id: a button's, 'first', or null. */
  function light(id) {
    if (id === 'first') id = bar.length ? bar[0].id : null;
    if (id !== null && !bar.some(function(b) { return b.id === id; })) id = null;
    if (id === lit) return;
    lit = id;
    markBar();
    if (lit === null) schedule(); else clearTimeout(timer);
  }
  function step(by) {
    for (var i = 0; i < bar.length; i++) {
      if (bar[i].id === lit) return light(bar[Math.max(0, Math.min(bar.length - 1, i + by))].id);
    }
  }
  /* A button's action. Trailer and Da vedere are the same everywhere; the rest is the dock title's (play, the cards) or
     the row's (casa-home.js). */
  function press(id) {
    var item = items[index];
    if (!item || !bar.some(function(b) { return b.id === id; })) return;
    if (id === 'trailer') {
      if (context && context.on) context.on('away', item);   // back from YouTube: this title again
      if (window.HomeApp) HomeApp.launch(Core.YOUTUBE, 'YouTube', Core.youtubeParams(item.trailer));
    } else if (id === 'later') {
      // casa-state.js tells everyone (the button's words here, the "Da vedere" row in casa-home.js).
      State.setLater(item.key, !State.later(item.key), {s: item.svc || Core.serviceOf(app && app.id), nf: item.entry && item.entry.netflixId});
    } else if (context) {
      if (context.on) context.on(id, item);
    } else if (id === 'play') play();
    else if (id === 'all') { light(null); enterDetail(); }
  }

  function text(item) {
    var e = item.entry, now = new Date(), ev = item.event;
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
      // No logo: the name in letters, smaller the longer it is ("Livatino - Il giudice e i suoi ragazzi" was cut mid-word).
      var n = (item.title || '').length;
      nameEl.style.fontSize = n > 30 ? '58px' : n > 18 ? '72px' : '';
    }
    // An English logo over an Italian title ("TREASURE ISLAND" / "L'isola del tesoro"): the name to look for in the app.
    var other = item.logo && item.logoLang && item.logoLang !== 'it' && item.title && item.title !== item.original;
    subEl.textContent = other ? item.title : '';
    subEl.style.display = other ? '' : 'none';
    chipsEl.innerHTML = '';
    var fresh = !Core.staleWeek(e.movie ? weekFilm : week, now);
    if (ev) {   // a match or a race: the competition, when, the session of a Grand Prix
      chip(item.comp, 'tag');
      var when = Core.eventWhen(ev, now);
      chip(when, when === 'In corso' ? 'live' : 'next');
      if (ev.session) chip(ev.session);
    } else if (e.top && fresh) {
      var top = el('span', null, 'casa-top');
      top.innerHTML = '<i>TOP</i><b>10</b>';
      chipsEl.appendChild(top);
      chip('N. ' + e.top + (e.movie ? ' tra i film' : ' in Italia'), 'rank');
    }
    var tag = ev ? null : Core.whenTag(e, item, now), next = ev ? null : Core.nextEpisode(item, now);
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
    drawBar();
    dots();
    if (detail) {
      cardsLabel.textContent = ev ? item.comp + ' · le prossime partite'
        : e.top && fresh ? 'Top 10 ' + (e.movie ? 'film' : 'serie') + ' in Italia · ' + Core.weekIt(e.movie ? weekFilm : week) : 'Novità';
    }
    // The new title rises in: logo, badges, plot and button one after the other (casa.css). Two classes in turn restart
    // the animation without forcing a layout (offsetWidth did, on every title).
    hero.classList.remove(enterFlip ? 'enter' : 'enter2');
    hero.classList.add(enterFlip ? 'enter2' : 'enter');
    enterFlip = !enterFlip;
  }

  /* A dot per title; past twelve (Netflix with its films) the place in the row, in digits. */
  function dots() {
    dotsEl.innerHTML = '';
    dotsEl.className = items.length > 12 ? 'count' : '';
    if (items.length > 12) { dotsEl.textContent = (index + 1) + ' / ' + items.length; return; }
    for (var i = 0; i < items.length; i++) dotsEl.appendChild(el('span', null, 'casa-dot' + (i === index ? ' on' : '')));
  }

  /* A match has no picture: the two crests, large, where the picture's subject would be, and its competition's glow. */
  function eventArt(item) {
    var ev = item.event;
    ++picSeq;   // a picture still loading must not land over this
    layers[0].style.opacity = layers[1].style.opacity = '0';
    eventEl.innerHTML = '';
    if (ev.home_logo && ev.away_logo) {
      eventEl.appendChild(crest(ev.home_logo, 'ev-big'));
      eventEl.appendChild(crest(ev.away_logo, 'ev-big'));
    }
    eventEl.style.opacity = '1';
    if (window.CasaHome) CasaHome.tint(COMP_COLORS[ev.comp] || null);
  }

  function picture(item) {
    if (item.event) return eventArt(item);
    eventEl.style.opacity = '0';
    var img = new Image(), mine = token, seq = ++picSeq;
    if (!demo) img.crossOrigin = 'anonymous';   // TMDB allows it: the glow colour needs the pixels
    img.onload = function() {
      // Pictures come back in any order: only the last one asked for is shown (moving along the cards left the
      // picture of one title under the words of another).
      if (mine !== token || seq !== picSeq) return;
      var next = layers[1 - layerIndex], current = layers[layerIndex];
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
    hero.classList.remove('swapping');
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
    // A lit button stops the rotation: OK plays the title on screen, not the next one.
    if (!detail && !paused && lit === null && items.length > 1) timer = setTimeout(function() {
      if (editing()) return schedule();   // moving an app: the titles wait
      show(index + 1);
    }, ROTATE_MS);
  }

  function hide() {
    token++;
    clearTimeout(timer);
    clearTimeout(swapTimer);
    hero.classList.remove('swapping');
    items = [];
    light(null);
    index = -1;
    document.body.classList.remove('casa-on');
    layers[0].style.opacity = layers[1].style.opacity = '0';
    eventEl.style.opacity = '0';
  }

  // ---- detail ----------------------------------------------------------------------------------

  /* The detail's row, built once per app: rebuilding twelve cards on every Up cost 130-200 ms on the TV. */
  function buildCards() {
    var id = app && app.id || '', kept = cardRows[id];
    if (!kept || kept.items.length !== items.length || kept.items.some(function(x, i) { return x !== items[i]; })) {
      kept = cardRows[id] = {items: items.slice(), nodes: items.map(function(item) { return card(item); })};
    }
    cardsEl.innerHTML = '';
    kept.nodes.forEach(function(n) { cardsEl.appendChild(n); });
    markCard();
  }
  function markCard() {
    var cards = cardsEl.children;
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('focused', i === index);
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
  /* A key that is still down: the browser's repeat, or (this remote, for a held key) a new press right after its
     release. casa-home.js asks too. */
  function repeated(event) {
    return !!event.repeat || Date.now() - (upAt[event.keyCode] || 0) < 120;
  }
  /* One OK, one action: a held OK played the title twice, and opened the cards and their first title at once. */
  function okOnce(event) {
    if (repeated(event) || Date.now() - okAt < 500) return false;
    okAt = Date.now();
    return true;
  }
  function play() {
    var item = items[index], params = item && item.entry && Core.netflixParams(item.entry.netflixId);
    var svc = Core.serviceOf(app && app.id);
    if (window.HomeApp && app) HomeApp.launch(app.id, app.title, svc === 'netflix' ? params : null);
  }

  /* The keys while a button is lit. */
  function onButtonKey(event, key) {
    if (key === 37 || key === 39) {
      step(key === 39 ? 1 : -1);
    } else if (key === 13) {
      if (!okOnce(event)) return true;   // held: once, and not a hold on the dock app underneath
      press(lit);
    } else if (key === 40 || key === 461 || key === 27) {
      light(null);   // down a level: the cards in the detail, the dock in Home, the card of a row under the apps
    } else if (key === 38) {
      if (context) return true;   // a title of the rows under the apps: nothing above its buttons
      light(null);
      if (detail) exitDetail();
      if (window.HomeApp && HomeApp.focusTop) HomeApp.focusTop();
    } else {
      return false;   // volume and the rest pass through
    }
    return true;
  }
  function move(by) {
    var next = index + by;
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

  // Ahead of app.js (capture): on a lit button or in the detail every key is ours; on the dock, Up lights the button.
  function onKey(event) {
    var key = event.keyCode, mine = false, was = lit + '|' + detail;
    if (event.type === 'keyup') upAt[key] = Date.now();
    // levelKey lasts as long as that press does: another key, or the same one pressed anew, ends it (left standing, it
    // ate the repeats of a later hold: no moving an app with a held OK, one step for a held Right).
    else if (key !== levelKey || !repeated(event)) levelKey = 0;
    if (document.body.classList.contains('casa-rest') || document.body.classList.contains('casa-list')) {   // theirs
      if (event.type === 'keyup') swallow[key] = false;
      return;
    }
    if (event.type === 'keydown' && levelKey) {
      // Still the press that changed level (Up: the dock, then the button): held a moment longer it went on to the top
      // bar, and a held Down from the button fell through the dock into Scopri.
      mine = true;
    } else if (lit !== null) {
      mine = event.type === 'keydown' ? onButtonKey(event, key) : !!swallow[key];
    } else if (detail) {
      mine = true;
      if (event.type === 'keydown') {
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) { if (okOnce(event)) play(); }
        else if (key === 40) exitDetail();
        else if (key === 461 || key === 27) {   // Back: to the first title, then out
          if (index > 0) { move(-index); } else exitDetail();
        } else if (key === 38) {   // Up: the buttons over the cards ("Guarda su ..." first); from there on to the top bar
          light('first');
        } else mine = false;   // volume and the rest pass through
      }
    } else if (event.type === 'keydown' && key === 38 && zone === 'grid' && row === 0 && items.length && bar.length && !editing()
        && !repeated(event)   // not the Up, still down, that has just left the rows under the apps
        && !document.body.classList.contains('casa-scopri') && !document.body.classList.contains('casa-rest')) {
      mine = true;
      light('first');
    } else if (event.type === 'keyup' && swallow[key]) {
      mine = true;
    }
    if (event.type === 'keydown' && was !== lit + '|' + detail) levelKey = key;
    if (mine) {
      swallow[key] = event.type === 'keydown';
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.type === 'keydown') {
      // Not ours, so its release is not ours either: a release lost when a title opened (the app took the keys) left
      // the flag up, and the next OK on the dock never ended: the app was picked up to be moved.
      swallow[key] = false;
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
    var id = tile && tile.id, svc = tileRow === 0 ? Core.serviceOf(id) : null, sport = tileRow === 0 && !svc ? Core.sportOf(id) : null;
    // Same app, its own titles on screen: keep rotating. (Not a title a row or the whole list left there: HOME with the
    // list open found it still on the shelf, with a button that did nothing.)
    if (app && tile && app.id === id && items.length && !context) return;
    app = tile;
    context = null;
    if (detail) exitDetail();
    hide();
    if (!svc && !sport) {
      if (window.CasaHome) CasaHome.tint(null);   // YouTube: not the colour of the last title
      return;
    }
    var mine = ++token;
    (svc ? resolve : resolveSport)(svc || sport, function(list) {
      if (mine !== token) return;
      if (!list.length) {
        if (window.CasaHome) CasaHome.tint(null);
        return;
      }
      var shown = items[index];
      items = list;
      if (!shown) return show(0, true);
      // The others join the one on screen (a title earlier in the order may arrive later): its words stay as they are
      // (they used to rise in again for every title that arrived), the buttons, the dots and the cards follow.
      index = items.indexOf(shown);
      drawBar();
      dots();
      if (detail) buildCards();
      schedule();   // the first title came alone: rotate now that there are others
    });
  }

  function setZone(z) {
    zone = z;
    if (z !== 'grid') light(null);
    if (z !== 'grid' && detail) exitDetail();
    if (window.CasaHome) CasaHome.zone(z);
  }

  /* One title on the shelf, not rotating: the focused card of a row under the apps (casa-home.js) or of the whole list.
     ctx: {buttons: [ids], on: function(id, item), undo: the Annulla button's words or null}; refocus() brings the
     dock app's titles back. A lit button stays lit when the next title has it too (Già vista, then the next one). */
  function feature(item, ctx) {
    token++;
    clearTimeout(timer);
    context = ctx || {buttons: ['play']};
    items = [item];
    index = 0;
    show(0, true);
  }
  function refocus() {
    var t = app;
    app = null;
    light(null);
    focus(t, row, tileEl, lastRow);
  }
  /* HOME and the rest screen: back to the base state. */
  function reset() {
    light(null);
    if (detail) exitDetail();
  }
  /* Back in front (HOME, the return from an app) once the titles are six hours old: again, from a fresh content.json.
     A sport app's matches at every look (casa-home.js asks every half hour too): one that is over leaves the tile. */
  function refresh() {
    var body = document.body.classList;
    if (!app || detail || lit !== null || body.contains('casa-scopri') || body.contains('casa-list') || body.contains('casa-rest')) return;
    if (Date.now() - shelvesAt > CONTENT_TTL || Core.sportOf(app.id)) refocus();
  }
  /* The rest screen: no rotation (and no decoding) under it. */
  function pause(on) {
    paused = !!on;
    if (paused) clearTimeout(timer); else schedule();
  }

  if (!Core) return;
  build();
  takeKey(window.PalmSystem && window.PalmSystem.launchParams);
  setTimeout(prune, 8000);
  if (State) State.onChange(function() { if (items.length) drawBar(); });   // "Da vedere" / "In lista"
  document.addEventListener('webOSRelaunch', function(e) { takeKey(e && e.detail); reset(); refresh(); });
  document.addEventListener('visibilitychange', function() { if (!document.hidden) refresh(); });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  window.CasaShelf = {focus: focus, zone: setZone, feature: feature, refocus: refocus, reset: reset, pause: pause,
    editing: editing,
    // For casa-home.js (OK on a card lights its title's first button): the next OK counts once 150 ms have passed.
    light: function(id) { light(id); if (lit !== null) okAt = Date.now() - 350; return lit; },
    redraw: function() { if (items.length) drawBar(); }, refresh: refresh,
    state: function() { return {zone: zone, row: row, lastRow: lastRow, detail: detail, lit: lit}; },
    util: {load: load, keep: keep, getJSON: getJSON, content: content, details: details, image: image, card: card,
      repeated: repeated, eventItem: eventItem, installed: installed, icon: function(name) { return ICONS[name] || ''; }}};
}());
