/* Fork lorenzoma97, "Casa": the rest of Home around the shelf.
   - One glass capsule in the top bar: Bologna's weather (Open-Meteo, no key) and the Inputs, Wi-Fi and Settings buttons
     as icons whose name opens out on focus. Between the clock and the capsule, a note: today's sport (Serie A,
     Champions League, Formula 1: when and where), or a warning when the Developer Mode session is about to run out.
   - Under the apps, rows of title cards: "Da vedere" (the owner's list, when it has titles), "Scopri una nuova serie"
     and "Scopri un film" (five a day each from the pool, then the whole list, casa-list.js). Down from the apps enters
     the first row; Left/Right move along it, Down/Up change row, Back returns to the apps. The focused title fills the
     screen; OK lights its buttons under the plot (casa-shelf.js): Guarda, Già vista, Non oggi, Da vedere, Trailer,
     Altre cinque, and for a few seconds after Già vista its Annulla.
   - Developer Mode auto-renewal (the original project's Beta, off there by default) is turned on once per installation.
   - The colour of the picture on screen tints the glow, the dock band and the focus; a pool of light under the focused
     app, the apps beside it dimmer, and the focus that tilts with the Magic Remote pointer.
   Blur and other effects the legacy CSS gate cannot check are set from here, only where the TV supports them. */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf, State = window.CasaState, demo = window.CASA_DEMO || null;
  if (!Core || !Shelf || !State) return;
  var U = Shelf.util;
  var WEATHER = 'https://api.open-meteo.com/v1/forecast?latitude=44.4949&longitude=11.3426'
    + '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=1';
  var AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.4949&longitude=11.3426&current=european_aqi&timezone=Europe%2FRome';
  var PICKS = 5, ROW_MAX = 12, WEATHER_TTL = 30 * 60 * 1000, WEATHER_OLD = 3 * 3600 * 1000, UNDO_MS = 8000, RECENT = 60;
  var LIFT = 160, CARD_W = 290, NOTE_MS = 7000;   // how far the rows rise into the apps' place; a card's pitch; a sport note's turn
  var BADGES = {netflix: ['Netflix', 'netflix'], prime: ['Prime Video', 'prime'], raiplay: ['RaiPlay', 'raiplay'],
    infinity: ['Infinity', 'infinity'], hbomax: ['HBO Max', 'hbomax']};
  var ICONS = {
    sun: '<circle cx="24" cy="24" r="8" fill="#ffd24a"/><g stroke="#ffd24a" stroke-width="3" stroke-linecap="round"><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2"/></g>',
    moon: '<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z" fill="#dfe6ff"/>',
    partly: '<circle cx="18" cy="18" r="7" fill="#ffd24a"/><path d="M14 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19 3 6 6 0 0 0-1 11z" fill="#e7eaf0"/>',
    cloud: '<path d="M12 36h24a8 8 0 0 0 0-16 11 11 0 0 0-21 3 7 7 0 0 0-3 13z" fill="#d8dce4"/>',
    fog: '<path d="M12 28h24a8 8 0 0 0 0-14 11 11 0 0 0-21 3 7 7 0 0 0-3 11z" fill="#c9ced8"/><g stroke="#aab1bd" stroke-width="3" stroke-linecap="round"><path d="M9 34h30M13 40h22"/></g>',
    rain: '<path d="M12 28h24a8 8 0 0 0 0-14 11 11 0 0 0-21 3 7 7 0 0 0-3 11z" fill="#d8dce4"/><g stroke="#7cc4ff" stroke-width="3" stroke-linecap="round"><path d="M17 33l-2 6M25 33l-2 6M33 33l-2 6"/></g>',
    snow: '<path d="M12 28h24a8 8 0 0 0 0-14 11 11 0 0 0-21 3 7 7 0 0 0-3 11z" fill="#e3e7ee"/><g fill="#ffffff"><circle cx="16" cy="36" r="2.4"/><circle cx="24" cy="39" r="2.4"/><circle cx="32" cy="36" r="2.4"/></g>',
    storm: '<path d="M12 28h24a8 8 0 0 0 0-14 11 11 0 0 0-21 3 7 7 0 0 0-3 11z" fill="#b9bfca"/><path d="M25 28l-6 9h5l-3 8 9-11h-5l3-6z" fill="#ffd24a"/>'
  };
  var DIE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'
    + '<g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.6"/><circle cx="15.5" cy="15.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="15.5" cy="8.5" r="1.6"/><circle cx="8.5" cy="15.5" r="1.6"/></g></svg>';
  var MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h12v18l-6-4.4L6 21z"/></svg>';

  var light, glows, glowIndex = 0, weatherEl, noteEl, scopri;
  var rows = [], rowIndex = -1, active = false, zone = 'none', focusedEl = null, color = null;
  var services = {}, lastWeather = null, undo = null, undoTimer = null, resume = null, laterSeq = 0;
  var laterFocus = null, dropped = null, leftKey = 0;   // the title Annulla is bringing back; the one taken off here; the key that left the rows
  var notes = [], noteIndex = 0, noteTimer = null, devNote = null;
  var glass = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)')));
  /* What the hero's buttons do for the title of a row (casa-shelf.js draws them and hands the presses back). */
  var ctx = {buttons: [], on: onButton, undo: null};

  /* Scopri's two decks: five a day from a pool of content.json, each with its own "shown lately". */
  function deck(movie) {
    return {movie: movie, key: movie ? 'movie' : 'tv', pool: null, picks: [], day: null, loading: false, skipped: {},
      store: movie ? 'casa.tonight.m' : 'casa.tonight', recent: movie ? 'casa.recent.m' : 'casa.recent'};
  }
  var decks = {tv: deck(false), movie: deck(true)};
  /* The rows under the apps, top to bottom; only those with titles are on show (rows). */
  var ROWS = [
    {key: 'later', icon: MARK, title: 'Da vedere', sub: '', deck: null, buttons: ['play', 'trailer', 'seen', 'drop']},
    {key: 'tv', icon: DIE, title: 'Scopri una nuova serie', sub: 'Cinque per oggi, tra le migliori sui tuoi servizi', deck: decks.tv,
      buttons: ['play', 'seen', 'skip', 'later', 'trailer']},
    {key: 'movie', icon: DIE, title: 'Scopri un film', sub: 'Cinque per stasera, tra i migliori sui tuoi servizi', deck: decks.movie,
      buttons: ['play', 'seen', 'skip', 'later', 'trailer']}
  ];
  var byKey = {};

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }
  /* Lighter than it was (36 px with saturate): three panels were re-blurred on every frame of a crossfade. */
  function frost(node, blur) {
    if (!glass || !node) return;
    node.style.backdropFilter = node.style.webkitBackdropFilter = 'blur(' + blur + 'px)';
    node.className += ' casa-frosted';
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // ---- colour of the picture on screen -----------------------------------------------------------

  /* The glow, the dock band and the focus take the colour of the picture on screen. */
  function tint(c) {
    color = c;
    if (!c) {   // an app without titles (YouTube): its own look, not the colour of the last picture
      glows[0].style.opacity = glows[1].style.opacity = '0';
      var b = document.getElementById('dockBand'), f = document.getElementById('glass');
      if (b) b.style.borderColor = '';
      if (f) f.style.boxShadow = '';
      return;
    }
    var next = glows[1 - glowIndex];
    next.style.background = 'radial-gradient(ellipse 1500px 820px at 16% 100%, ' + rgba(c, 0.42) + ' 0%, ' + rgba(c, 0.14) + ' 46%, ' + rgba(c, 0) + ' 76%)';
    next.style.opacity = '1';
    glows[glowIndex].style.opacity = '0';
    glowIndex = 1 - glowIndex;
    var band = document.getElementById('dockBand');
    if (band) band.style.borderColor = rgba(c, 0.32);
    var frame = document.getElementById('glass');
    if (frame) frame.style.boxShadow = '0 0 0 1px ' + rgba(c, 0.5) + ', 0 0 34px 6px ' + rgba(c, 0.38);
  }

  // ---- weather ---------------------------------------------------------------------------------

  function drawWeather(w) {
    // Offline for hours: an old reading would pass for now. No box rather than a wrong one.
    if (!w || typeof w.temp !== 'number' || w.at && Date.now() - w.at > WEATHER_OLD) {
      weatherEl.style.display = 'none';
      if (window.CasaRest) CasaRest.weather(null);
      return;
    }
    lastWeather = w;
    // The air only when it is worth a look (moderata and worse): "Aria discreta" every day was noise.
    var d = Core.describe(w.code, w.day !== 0), a = w.aqi > 40 ? Core.air(w.aqi) : null;
    weatherEl.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">' + (ICONS[d[1]] || ICONS.cloud) + '</svg>'
      + '<span class="wx-temp"></span><span class="wx-lines"><span class="wx-desc"></span><span class="wx-more"></span></span>';
    weatherEl.querySelector('.wx-temp').textContent = Math.round(w.temp) + '°';
    weatherEl.querySelector('.wx-desc').textContent = d[0] || 'Bologna';
    var more = weatherEl.querySelector('.wx-more');
    more.textContent = '↑' + Math.round(w.max) + '°  ↓' + Math.round(w.min) + '°';
    if (a) {
      var dot = el('i', null, 'wx-dot ' + (w.aqi <= 60 ? 'fair' : 'poor'));
      more.appendChild(dot);
      more.appendChild(document.createTextNode(a));
    }
    weatherEl.style.display = '';
    if (window.CasaRest) CasaRest.weather(w);
  }

  /* tick: from the half-hour timer, whose last reading is a few seconds short of half an hour old: it counted as fresh,
     and the weather was read every hour. */
  function weather(tick) {
    if (demo && demo.weather) return drawWeather(demo.weather);
    var kept = U.load('casa.weather', tick === true ? WEATHER_TTL - 120000 : WEATHER_TTL);
    if (kept) return drawWeather(kept);
    U.getJSON(WEATHER, function(f) {
      if (!f || !f.current || !f.daily) return drawWeather(U.load('casa.weather', Infinity));
      var w = {temp: f.current.temperature_2m, code: f.current.weather_code, day: f.current.is_day,
        max: f.daily.temperature_2m_max[0], min: f.daily.temperature_2m_min[0], aqi: null, at: Date.now()};
      U.getJSON(AIR, function(q) {
        if (q && q.current && typeof q.current.european_aqi === 'number') w.aqi = q.current.european_aqi;
        U.keep('casa.weather', w);
        drawWeather(w);
      });
    });
  }

  // ---- the note in the top bar: today's sport, or the Developer Mode warning ------------------------

  /* One note at a time: the warning when there is one, else today's matches and races in turn. */
  function drawNote() {
    clearTimeout(noteTimer);
    var n = devNote || notes[noteIndex % Math.max(1, notes.length)];
    if (!n) { noteEl.style.display = 'none'; return; }
    noteEl.className = devNote ? 'warn' : n.live ? 'live' : '';
    noteEl.innerHTML = '<span class="note-art"></span><span class="note-lines"><span class="note-t"></span><span class="note-s"></span></span>';
    var artEl = noteEl.firstChild;
    (n.logos || []).forEach(function(url) {
      var i = el('img');
      i.onerror = function() { i.style.display = 'none'; };
      i.src = url;
      artEl.appendChild(i);
    });
    noteEl.querySelector('.note-t').textContent = n.title;
    noteEl.querySelector('.note-s').textContent = n.text;
    noteEl.style.display = '';
    if (!devNote && notes.length > 1) noteTimer = setTimeout(function() { noteIndex++; drawNote(); }, NOTE_MS);
  }
  /* Today's Serie A, Champions League and Formula 1 (content.json sport): when and on which service. */
  function sportNotes() {
    U.content(function(c) {
      var sport = c && c.sport, now = new Date();
      notes = Core.events(sport, now, {today: true, max: 6}).map(function(ev) {
        var item = U.eventItem(ev, sport), when = Core.eventWhen(ev, now);
        // All of today: the time alone ("Oggi · 20:45" is the cards' wording). No competition's name: the note has
        // room for some 25 letters, and the crests and the service say it.
        return {title: item.title + (ev.session ? ' · ' + ev.session : ''), live: when === 'In corso',
          text: [when.replace('Oggi · ', ''), item.where].filter(function(x) { return x; }).join(' · '),
          logos: ev.home_logo && ev.away_logo ? [ev.home_logo, ev.away_logo] : []};
      });
      drawNote();
    });
  }

  function renewalCall(method, then) {
    if (!window.PalmServiceBridge) return then(null);
    try {
      var bridge = new PalmServiceBridge();
      bridge.onservicecallback = function(raw) {
        var r = null;
        try { r = JSON.parse(raw); } catch (_) { /* no answer worth reading */ }
        then(r && r.returnValue === true && r.state ? r.state : null);
      };
      bridge.call('luna://com.gathin.tvhome.renewal/' + method, '{}');
    } catch (_) { then(null); }
  }
  /* Developer Mode auto-renewal: the original project's Beta (Home settings), off by default there. The owner asked for
     it on, so Home turns it on once per installation: a reinstallation (LG wiped the apps once) starts with it off
     again. Turned off by hand in Home settings later, it stays off. Then, at every look: is the session about to end? */
  function renewal() {
    var done = false;
    try { done = !!localStorage.getItem('casa.renewal'); } catch (_) { done = true; }
    var mark = function() { try { localStorage.setItem('casa.renewal', '1'); } catch (_) { /* asked again next start */ } };
    renewalCall('status', function(state) {
      if (!state) return;   // no service (the browser preview), or not yet: at the next look
      var w = Core.devWarning(state, Date.now());
      devNote = w ? {title: w[0], text: w[1]} : null;
      drawNote();
      if (done) return;
      if (state.enabled) return mark();
      renewalCall('enable', function(after) { if (after && after.enabled) mark(); });
    });
  }

  // ---- the rows under the apps: Da vedere, Scopri una nuova serie, Scopri un film -------------------

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function union() {
    var out = {};
    for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) out[k] = true;
    return out;
  }

  /* A title ready to show and to open: TMDB details by its key, the service that has it, the button's words. */
  function resolveTitle(key, info, done) {
    U.details(key, function(s) {
      if (!s || !s.backdrop) return done(null);
      var svc = info && info.s || null, nf = info && info.nf || null, direct = svc === 'netflix' && Core.netflixParams(nf);
      done({key: key, id: Core.rawId(key), movie: Core.isMovie(key), title: s.title, backdrop: s.backdrop, logo: s.logo,
        logoLang: s.logoLang, original: s.original, plot: s.plot, meta: s.meta, metaShort: s.metaShort, trailer: s.trailer,
        svc: svc, entry: {top: 0, tag: null, season: null, netflixId: nf},
        cta: !svc ? null : direct ? 'Guarda su Netflix' : 'Apri ' + (services[svc] ? services[svc].name : svc)});
    });
  }
  /* One pool title (d: its deck). */
  function resolvePick(d, id, done) {
    var item = Core.poolItem(d.pool, id);
    resolveTitle(Core.keyOf(id, d.movie), {s: Core.poolService(item), nf: item && item.nf}, done);
  }
  function resolveAll(d, ids, done) {
    var out = [], pending = ids.length;
    if (!pending) return done(out);
    ids.forEach(function(id, i) {
      resolvePick(d, id, function(p) {
        if (p) { p.order = i; out.push(p); }
        if (--pending === 0) done(out.sort(function(a, b) { return a.order - b.order; }));
      });
    });
  }

  /* The titles shown lately (the last RECENT, newest last): tomorrow's five, a replacement and "Altre cinque" are others
     while the pool has them. It kept proposing the same ones. */
  function recent(d) {
    var out = {};
    (U.load(d.recent, Infinity) || []).forEach(function(id) { out[id] = true; });
    return out;
  }
  function save(d) {
    var ids = d.picks.map(function(p) { return p.id; });
    if (demo) return;
    U.keep(d.store, {day: today(), ids: ids});
    var list = (U.load(d.recent, Infinity) || []).filter(function(id) { return ids.indexOf(id) < 0; }).concat(ids);
    U.keep(d.recent, list.slice(-RECENT));
  }
  function inRow(d) {
    var out = {};
    d.picks.forEach(function(x) { out[x.id] = true; });
    return out;
  }

  function loadPicks(d) {
    if (d.loading) return;
    d.loading = true;
    U.content(function(c) {
      d.pool = c && (d.movie ? c.pool_film : c.pool) || null;
      if (c && c.services) services = c.services;
      if (!d.pool) { d.loading = false; return; }
      // The saved five stay while none was watched since; new ones are not among those shown lately or already saved.
      var ids = demo && demo.tonight && !d.movie ? demo.tonight
        : Core.tonight(d.pool, U.load(d.store, Infinity), today(), State.seenIds(d.movie), PICKS, Math.random,
          union(recent(d), State.laterIds(d.movie)));
      resolveAll(d, ids, function(list) {
        d.loading = false;
        if (active) return;   // the rows were entered meanwhile: not under the viewer's hands, the next refresh will do
        d.picks = list;
        d.day = today();
        save(d);
        drawRow(byKey[d.key]);
      });
    });
  }
  /* Another day (the app stays open for days), or nothing to show yet (no network or no key at the start): the five
     again. Not under the viewer's hands, nor when a return to one of them is due. */
  function refreshPicks() {
    [decks.tv, decks.movie].forEach(function(d) {
      if (!active && resume === null && (!d.picks.length || d.day !== today())) loadPicks(d);
    });
  }

  /* "Da vedere": the owner's list (casa-state.js), the last saved first. Read again whenever the marks change, on this
     TV or on the other one. */
  function loadLater() {
    var list = State.list().slice(0, ROW_MAX), out = [], pending = list.length, seq = ++laterSeq, r = byKey.later;
    var finish = function() {
      if (seq !== laterSeq) return;
      var was = active && rows[rowIndex] === r && r.items[r.at] ? r.items[r.at].key : null;
      r.items = out.sort(function(a, b) { return a.order - b.order; });
      drawRow(r);
      var mine = dropped;
      dropped = null;
      if (!active) return;
      var find = function(key) {
        for (var i = 0; i < r.items.length; i++) if (r.items[i].key === key) return i;
        return -1;
      };
      // The title Annulla is bringing back: on it, once it is there (its two marks, seen and saved, come one at a time:
      // the first reading does not have it yet). Not waited for longer than a few seconds.
      var back = laterFocus && Date.now() < laterFocus.until ? find(laterFocus.key) : -1;
      if (laterFocus && (back >= 0 || Date.now() >= laterFocus.until)) laterFocus = null;
      if (back >= 0) {
        rowIndex = rows.indexOf(r);
        r.at = back;
        return show();
      }
      if (rows[rowIndex] !== r) {
        if (was === null) return;   // on another row all along: nothing of it changed
        Shelf.light(null);   // the list emptied under the focus: on the next row's card, not on one of its buttons
        return show();
      }
      // In the list: the focus follows its title wherever the list moved it (the other TV added or took off one before
      // it: the same card index was another title, with "Guarda" still lit on it).
      var now = find(was);
      if (now >= 0) {
        if (now !== r.at) { r.at = now; mark(); }
        return;
      }
      // Its title left the list. Taken off here: the next one, its button still lit. By the other TV: back on the card.
      if (was !== mine) Shelf.light(null);
      show();
    };
    if (!pending) return finish();
    list.forEach(function(x, i) {
      resolveTitle(x.key, x, function(p) {
        if (p) { p.order = i; out.push(p); }
        if (--pending === 0) finish();
      });
    });
  }

  function size(r) { return r.items.length + (r.all ? 1 : 0); }
  function onAll() {
    var r = active ? rows[rowIndex] : null;
    return !!r && r.all && r.at === r.items.length;
  }

  /* One row's cards again, then which rows are on show. */
  function drawRow(r) {
    var d = r.deck;
    if (d) r.items = d.picks;
    r.cardsEl.innerHTML = '';
    r.items.forEach(function(p) {
      var b = BADGES[p.svc], c = U.card(p, b ? {text: b[0], cls: b[1]} : null);
      var mark = el('span', null, 'casa-card-later');   // shown on a Scopri title that is in "Da vedere" (casa.css)
      mark.innerHTML = MARK;
      c.appendChild(mark);
      r.cardsEl.appendChild(c);
    });
    // After the five, the whole list (casa-list.js).
    r.all = !!(d && d.pool && r.items.length);
    if (r.all) {
      r.allCard.querySelector('.casa-all-s').textContent = (d.pool.items || []).length + (d.movie ? ' film' : ' serie') + ' sui tuoi servizi';
      r.cardsEl.appendChild(r.allCard);
    }
    if (!d) r.subEl.textContent = r.items.length === 1 ? '1 titolo' : r.items.length + ' titoli';
    layout();
  }
  function layout() {
    var was = active ? rows[rowIndex] : null;
    rows = ROWS.filter(function(r) { return r.items.length > 0; });
    ROWS.forEach(function(r) { r.node.style.display = r.items.length ? '' : 'none'; });
    scopri.style.display = rows.length ? '' : 'none';
    if (active) {
      if (!rows.length) return leave();
      var i = rows.indexOf(was);
      rowIndex = i >= 0 ? i : Math.min(Math.max(0, rowIndex), rows.length - 1);   // its row emptied: the one that took its place
      rows[rowIndex].at = Math.max(0, Math.min(rows[rowIndex].at, size(rows[rowIndex]) - 1));
    }
    mark(true);
    place();
    if (window.CasaRest) CasaRest.picks(decks.tv.picks);
  }

  /* Under the dock band, from the layout (offsets ignore transforms): measured on screen while the apps slid away in
     Scopri, the row landed 90 px low and stayed there. */
  function place() {
    var band = document.getElementById('dockBand');
    if (!band || !band.offsetHeight || active) return;
    var top = band.offsetHeight;
    for (var n = band; n; n = n.offsetParent) top += n.offsetTop;
    scopri.style.top = Math.round(top + 18) + 'px';
  }

  /* The focus, the saved marks, and where the rows stand: at rest only the first, under the apps; entered, the focused
     row in the apps' place, the ones before it gone, the next one showing below. instant: no slide (a row came or
     went above the focused one: sliding, the whole stack jumped and came back). */
  function mark(instant) {
    rows.forEach(function(r, n) {
      var cards = r.cardsEl.children, here = active && n === rowIndex;
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.toggle('focused', here && i === r.at);
        cards[i].classList.toggle('saved', !!(r.deck && r.items[i] && State.later(r.items[i].key)));
      }
      r.node.className = 'casa-row' + (active ? n < rowIndex ? ' gone' : '' : n > 0 ? ' gone' : '');
      // The focused card stays in view: the row slides under a fixed left edge.
      r.cardsEl.style.transform = here && r.at > 4 ? 'translateX(' + -(r.at - 4) * CARD_W + 'px)' : '';
    });
    document.body.classList.toggle('casa-scopri-all', onAll());   // the list card: the title above is not what OK opens
    if (instant) scopri.style.transition = 'none';
    scopri.style.transform = active && rows[rowIndex] ? 'translateY(' + -(LIFT + rows[rowIndex].node.offsetTop) + 'px)' : '';
    if (instant) {
      scopri.offsetWidth;
      scopri.style.transition = '';
    }
  }

  /* The focused card's title on the shelf, with its row's buttons. On the list card: the row's last title stays. */
  function show() {
    var r = rows[rowIndex];
    if (!r) return;
    var p = r.items[Math.min(r.at, r.items.length - 1)];
    setButtons(r);
    if (p) Shelf.feature(p, ctx);
    mark();
  }
  function setButtons(r) {
    r = r || rows[rowIndex];
    if (!r) return;
    // Annulla takes the place of "Altre cinque" for its few seconds; "Da vedere" has no draw.
    ctx.buttons = r.buttons.concat(undo ? ['undo'] : r.deck ? ['redraw'] : []);
    ctx.undo = undo ? 'Annulla «' + undo.p.title + '»' : null;
  }

  /* at: {row: a row's key, index: a card} (the return from a title); none: the first row's first card. */
  function enter(at) {
    if (!rows.length) return;
    active = true;
    var n = -1;
    for (var i = 0; i < rows.length; i++) if (at && rows[i].key === at.row) n = i;
    rowIndex = Math.max(0, n);
    rows[rowIndex].at = Math.max(0, Math.min(n >= 0 ? at.index : 0, size(rows[rowIndex]) - 1));
    document.body.classList.add('casa-scopri');
    show();
    dim();
    follow();
  }
  function leave() {
    if (!active) return;
    active = false;
    rowIndex = -1;
    hideUndo();
    ROWS.forEach(function(r) { r.at = 0; });
    document.body.classList.remove('casa-scopri');
    document.body.classList.remove('casa-scopri-all');
    mark();
    Shelf.refocus();
    dim();
    follow();
    setTimeout(place, 480);   // after the apps are back in place
  }
  function move(step) {
    var r = rows[rowIndex], next = r.at + step;
    if (next < 0 || next >= size(r)) return;
    r.at = next;
    show();
  }
  function changeRow(step) {
    var next = rowIndex + step;
    if (next < 0) return leave();
    if (next >= rows.length) return;
    rowIndex = next;
    show();
  }

  /* Opens a title of the rows (and of the whole list in casa-list.js); coming back to Home returns to it. */
  function launch(p) {
    if (!p || !p.svc || !window.HomeApp) return;
    var params = p.svc === 'netflix' ? Core.netflixParams(p.entry.netflixId) : null;
    HomeApp.launch(Core.appOf(p.svc), services[p.svc] ? services[p.svc].name : p.svc, params);
  }
  function open(r, i) {
    var p = r && r.items[i];
    if (!p) return;
    resume = {row: r.key, index: i, lit: null};
    launch(p);
  }

  /* A pool title to take a card's place: never one of the row; not one sent away today, shown lately or already in "Da
     vedere" while the pool has others (Core.pick falls back on any unseen title: that put the same series twice in the
     row). */
  function another(d) {
    var row = inRow(d), saved = State.laterIds(d.movie);
    var tiers = [union(row, d.skipped, recent(d), saved), union(row, d.skipped, saved), union(row, saved), row];
    for (var t = 0; t < tiers.length; t++) {
      var id = Core.pick(d.pool, null, State.seenIds(d.movie), tiers[t], 1, Math.random)[0];
      if (id !== undefined && !tiers[t][id]) return id;
    }
    return null;
  }
  /* Già vista: never again (its Annulla stays a few seconds). Non oggi: not today. Either way a new title takes the
     card's place, and the lit button stays lit for the next one. */
  function replace(d, i, never) {
    var p = d.picks[i], r = byKey[d.key];
    if (!p || !d.pool || p.leaving) return;   // already on its way out (the next title takes a moment to arrive)
    p.leaving = true;
    if (never) {
      // Watched: casa-state.js takes it off "Da vedere" too; Annulla puts it back on the list as well.
      showUndo({row: d.key, i: i, p: p, q: undefined, later: State.later(p.key)});
      State.setSeen(p.key, true);
    } else d.skipped[p.id] = true;
    var next = another(d);
    var done = function(q) {
      var at = d.picks.indexOf(p);   // the details take a moment: the row may have changed, or Annulla brought it back
      if (at < 0 || never && !State.seen(p.key)) return;
      var here = active && rows[rowIndex] === r && r.at === at;   // the focus is still on that card
      if (q) d.picks[at] = q; else d.picks.splice(at, 1);
      if (never && undo && undo.p === p) undo.q = q ? q.id : null;   // what Annulla has to put it back in place of
      save(d);
      if (!q) {
        if (r.at > at) r.at--;   // the cards after it moved one place left
        else if (r.at === at && at >= d.picks.length) r.at = Math.max(0, d.picks.length - 1);   // it was the last: the one before it
      }
      drawRow(r);
      if (active && here) show();   // (left the rows meanwhile: the dock app keeps its own titles on screen)
    };
    if (next !== null) resolvePick(d, next, done); else done(null);
  }
  /* Five others: not the ones on screen, sent away today, shown lately or saved, while the pool has others. The lit
     button stays lit, to draw again. */
  function redraw(d) {
    var r = byKey[d.key];
    if (d.drawing) return;   // one draw at a time: a second press while the five loaded showed two fives in a row
    d.drawing = true;
    hideUndo();
    var avoid = union(inRow(d), d.skipped, recent(d), State.laterIds(d.movie));
    resolveAll(d, Core.pick(d.pool, null, State.seenIds(d.movie), avoid, PICKS, Math.random), function(list) {
      d.drawing = false;
      if (!list.length) return;
      d.picks = list;
      save(d);
      r.at = 0;
      drawRow(r);
      if (active && rows[rowIndex] === r) show();
    });
  }

  /* "Da vedere": off the list (Togli dalla lista), or watched (Già vista: off the list and never proposed again). */
  function unsave(i, seenToo) {
    var r = byKey.later, p = r.items[i];
    if (!p) return;
    showUndo({row: 'later', p: p, seen: seenToo && !State.seen(p.key)});
    dropped = p.key;
    // casa-state.js tells loadLater(), which draws the row again (a title marked seen leaves the list by itself).
    if (seenToo) State.setSeen(p.key, true); else State.setLater(p.key, false);
  }

  /* "Annulla" is a button of its own, at the end of the buttons: OK used to undo wherever the focus was, so marking a
     second series brought the first one back. */
  function showUndo(u) {
    undo = u;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(expireUndo, UNDO_MS);
    setButtons();
    Shelf.redraw();
  }
  function expireUndo() {
    if (active && Shelf.state().lit === 'undo') { undoTimer = setTimeout(expireUndo, 3000); return; }   // not from under the focus
    hideUndo();
  }
  function hideUndo() {
    if (!undo) return;
    undo = null;
    clearTimeout(undoTimer);
    setButtons();
    Shelf.redraw();
  }
  function undoLast() {
    var u = undo;
    if (!u) return;
    Shelf.light(null);   // back on the card
    hideUndo();
    if (u.row === 'later') {
      laterFocus = {key: u.p.key, until: Date.now() + 4000};
      if (u.seen) State.setSeen(u.p.key, false);
      State.setLater(u.p.key, true, {s: u.p.svc, nf: u.p.entry.netflixId});
      return;
    }
    var d = decks[u.row], r = byKey[u.row];
    u.p.leaving = false;
    State.setSeen(u.p.key, false);
    if (u.later) State.setLater(u.p.key, true, {s: u.p.svc, nf: u.p.entry.netflixId});
    // Back where it was: in place of the title that took its card, or in the gap when none did. (Still in the row when
    // its replacement has not come yet: replace() drops that one.)
    var at = d.picks.indexOf(u.p);
    if (at < 0) {
      for (var n = 0; n < d.picks.length; n++) if (d.picks[n].id === u.q) at = n;
      if (at >= 0) d.picks[at] = u.p;
      else if (d.picks.length >= PICKS) d.picks[at = Math.min(u.i, d.picks.length - 1)] = u.p;
      else d.picks.splice(at = Math.min(u.i, d.picks.length), 0, u.p);
    }
    r.at = at;
    save(d);
    drawRow(r);
    if (!active) return;
    rowIndex = Math.max(0, rows.indexOf(r));
    show();
  }

  /* A press on one of the hero's buttons while a row's title is on the shelf (casa-shelf.js: one press, one call). */
  function onButton(id) {
    var r = rows[rowIndex];
    if (!active || !r) return;
    if (id === 'away') resume = {row: r.key, index: r.at, lit: 'trailer'};   // the trailer opens YouTube: back to this title, on its button
    else if (id === 'play') open(r, r.at);
    else if (id === 'undo') undoLast();
    else if (id === 'redraw') { if (r.deck) redraw(r.deck); }
    else if (id === 'seen' || id === 'skip') { if (r.deck) replace(r.deck, r.at, id === 'seen'); else if (id === 'seen') unsave(r.at, true); }
    else if (id === 'drop') { if (!r.deck) unsave(r.at, false); }
  }
  function openList(r) {
    var d = r.deck;
    if (!window.CasaList || !d) return;
    CasaList.open({pool: d.pool, services: services, movie: d.movie, launch: launch, badge: function(svc) { var b = BADGES[svc]; return b ? {text: b[0], cls: b[1]} : null; },
      back: function() { enter({row: r.key, index: r.items.length}); }});
  }

  var swallow = {};
  function onKey(event) {
    var key = event.keyCode, mine = false, s = Shelf.state();
    var body = document.body.classList;
    if (body.contains('casa-rest') || body.contains('casa-list')) {   // the rest screen and the list own the keys
      if (event.type === 'keyup') swallow[key] = false;
      return;
    }
    // leftKey lasts as long as that press does: another key, or the same one pressed anew, ends it.
    if (event.type === 'keydown' && (key !== leftKey || !U.repeated(event))) leftKey = 0;
    if (active) {
      mine = true;
      if (event.type === 'keydown') {
        // Still here, at the keys: no return from an app is due (a title that did not open left one).
        if (!U.repeated(event)) resume = null;
        // Up, Down, Back and OK change level: held a moment too long, a key counts once (Down went on to the next row).
        if (U.repeated(event) && (key === 38 || key === 40 || key === 461 || key === 27 || key === 13)) return hold(event);
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) { if (onAll()) openList(rows[rowIndex]); else Shelf.light('first'); }   // the title's buttons: the first lit
        else if (key === 40) changeRow(1);
        else if (key === 38) changeRow(-1);
        else if (key === 461 || key === 27) leave();
        else mine = false;
        if (!active) leftKey = key;   // this press left the rows: held, it stops at the apps
      }
    } else if (event.type === 'keydown' && leftKey) {
      // Still the press that left the rows (Back, or Up from the first row): on the dock Back went to the first app and
      // Up on to the top bar.
      mine = true;
    } else if (event.type === 'keydown' && key === 40 && s.zone === 'grid' && s.lastRow && !s.detail && rows.length
        && !Shelf.editing() && !U.repeated(event)) {
      mine = true;
      enter();
    } else if (event.type === 'keyup' && swallow[key]) {
      mine = true;
    }
    if (mine) hold(event);
    // Not ours, so its release is not ours either: a release that never came (the list or an app took the keys) left the
    // flag up, and the next OK on an app never ended: the app was picked up to be moved instead of opened.
    else if (event.type === 'keydown') {
      swallow[key] = false;
      if (!U.repeated(event)) resume = null;   // at the keys on the dock: the title opened from the rest screen did not open
    }
  }
  function hold(event) {
    swallow[event.keyCode] = event.type === 'keydown';
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  // ---- light, dimming, tilt ----------------------------------------------------------------------

  function dim() {
    document.body.classList.toggle('casa-dim', zone === 'grid' && !active);
  }

  /* With a transform, not left/top: those re-laid out the page on every frame of the move (-71% layouts). */
  function follow() {
    if (!focusedEl || zone !== 'grid' || active) { light.style.opacity = '0'; return; }
    var r = focusedEl.getBoundingClientRect();
    light.style.transform = 'translate3d(' + Math.round(r.left + r.width / 2 - 450) + 'px,' + Math.round(r.top + r.height / 2 - 260) + 'px,0)';
    light.style.opacity = '1';
  }

  /* The focused tile leans towards the pointer and its sheen follows, like a sheet of glass catching the light. */
  function tilt(event) {
    var card = focusedEl && focusedEl.querySelector('.card');
    if (!card) return;
    var r = focusedEl.getBoundingClientRect();
    var x = Math.max(-1, Math.min(1, (event.clientX - r.left) / r.width * 2 - 1));
    var y = Math.max(-1, Math.min(1, (event.clientY - r.top) / r.height * 2 - 1));
    card.style.transform = 'perspective(500px) scale(1.12) rotateX(' + (-y * 8).toFixed(1) + 'deg) rotateY(' + (x * 10).toFixed(1) + 'deg)';
    var sheen = card.querySelector('.casa-sheen');
    if (sheen) sheen.style.background = 'radial-gradient(circle at ' + Math.round((x + 1) * 50) + '% ' + Math.round((y + 1) * 50)
      + '%, rgba(255,255,255,0.4), rgba(255,255,255,0) 60%)';
  }
  function untilt(node) {
    var card = node && node.querySelector('.card');
    if (!card) return;
    card.style.transform = '';
    var sheen = card.querySelector('.casa-sheen');
    if (sheen) sheen.parentNode.removeChild(sheen);
  }

  // ---- what casa-shelf.js and casa-rest.js call ----------------------------------------------------

  function focus(node) {
    if (focusedEl !== node) {
      untilt(focusedEl);
      if (focusedEl) focusedEl.removeEventListener('mousemove', tilt);
      focusedEl = node;
      var card = node && node.querySelector('.card');
      if (card && !card.querySelector('.casa-sheen')) card.appendChild(el('div', null, 'casa-sheen'));
      if (node) node.addEventListener('mousemove', tilt);
    }
    if (active) leave();
    follow();
    setTimeout(follow, 340);   // the row may still be sliding (dockScroll)
    place();
  }
  function setZone(z) {
    zone = z;
    if (z !== 'grid' && active) leave();
    dim();
    follow();
  }

  glows = [el('div', null, 'casa-glow'), el('div', null, 'casa-glow')];
  light = el('div', 'casaLight');
  var anchor = document.getElementById('casaHero') || document.getElementById('hero');   // under the title's text
  document.body.insertBefore(glows[0], anchor);
  document.body.insertBefore(glows[1], anchor);
  document.body.insertBefore(light, anchor);

  weatherEl = el('div', 'casaWeather');
  weatherEl.style.display = 'none';
  var buttons = document.getElementById('topButtons');
  if (buttons) buttons.insertBefore(weatherEl, buttons.firstChild);
  noteEl = el('div', 'casaNote');
  noteEl.style.display = 'none';
  if (buttons) buttons.parentNode.insertBefore(noteEl, buttons);   // between the clock and the capsule

  scopri = el('div', 'casaScopri');
  scopri.style.display = 'none';
  ROWS.forEach(function(r) {
    byKey[r.key] = r;
    r.items = [];
    r.at = 0;
    r.all = false;
    r.node = el('div', null, 'casa-row');
    r.node.style.display = 'none';
    var head = el('div', null, 'casa-row-head');
    head.innerHTML = r.icon + '<span class="t"></span><span class="s"></span><b>▼</b>';
    head.querySelector('.t').textContent = r.title;
    r.subEl = head.querySelector('.s');
    r.subEl.textContent = r.sub;
    r.cardsEl = el('div', null, 'casa-row-cards');
    if (r.deck) {
      r.allCard = el('div', null, 'casa-card casa-all');
      r.allCard.innerHTML = '<span class="casa-all-t"></span><span class="casa-all-s"></span><span class="casa-all-go">›</span>';
      r.allCard.firstChild.textContent = r.deck.movie ? 'Tutti i film' : 'Tutte le serie';
    }
    r.node.appendChild(head);
    r.node.appendChild(r.cardsEl);
    scopri.appendChild(r.node);
  });
  // Beside the apps, not inside them: in the rows the apps fade away and the rows move up into their place.
  var viewport = document.getElementById('viewport');
  document.body.insertBefore(scopri, viewport ? viewport.nextSibling : null);

  frost(document.getElementById('leftBlock'), 14);
  frost(buttons, 14);
  frost(document.getElementById('dockBand'), 16);
  window.addEventListener('resize', follow);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  // The marks changed (here, or on the other TV): the list again, and the saved marks on the Scopri cards.
  State.onChange(function() { loadLater(); mark(); });
  /* What a look at Home refreshes: hours may have passed. */
  function look() {
    weather();
    sportNotes();
    renewal();
    refreshPicks();
  }
  // HOME: back to the base state. Back from a title opened here: its row again, on that card (app.js put focus on the dock).
  document.addEventListener('webOSRelaunch', function() { resume = null; leave(); look(); });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) return;
    look();
    if (resume === null) return;
    var at = resume;
    setTimeout(function() {
      if (resume !== at) return;
      resume = null;
      enter(at);
      if (at.lit && active) Shelf.light(at.lit);
    }, 300);
  });

  window.CasaHome = {focus: focus, zone: setZone, tint: tint,
    open: function(i) { open(byKey.tv, i); },   // the rest screen's cards: today's five series
    reset: function() { resume = null; leave(); },
    picks: function() { return decks.tv.picks; }, weather: function() { return lastWeather; }};
  weather();
  sportNotes();
  setInterval(function() { weather(true); sportNotes(); renewal(); refreshPicks(); Shelf.refresh(); }, WEATHER_TTL);
  loadPicks(decks.tv);
  loadPicks(decks.movie);
  // The list's buttons name the service ("Apri Prime Video", not "Apri prime"): drawn once content.json has said the names.
  U.content(function(c) {
    if (c && c.services) services = c.services;
    loadLater();
  });
  renewal();
}());
