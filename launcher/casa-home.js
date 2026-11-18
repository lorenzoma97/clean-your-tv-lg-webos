/* Fork lorenzoma97, "Casa": the rest of Home around the shelf.
   - One glass capsule in the top bar: Bologna's weather (Open-Meteo, no key) and the Inputs, Wi-Fi and Settings buttons
     as icons whose name opens out on focus.
   - "Scopri una nuova serie" under the apps: today's five as cards with their logos and service, then "Tutte le serie"
     (the whole list, casa-list.js). Down from the apps; the series fills the screen; OK opens it (Netflix on the title
     itself); Down again: Già vista, Non oggi, Pesca altre cinque, and for a few seconds after Già vista its Annulla.
   - Developer Mode auto-renewal (the original project's Beta, off there by default) is turned on once per installation.
   - The colour of the picture on screen tints the glow, the dock band and the focus; a pool of light under the focused
     app, the apps beside it dimmer, and the focus that tilts with the Magic Remote pointer.
   Blur and other effects the legacy CSS gate cannot check are set from here, only where the TV supports them. */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf, demo = window.CASA_DEMO || null;
  if (!Core || !Shelf) return;
  var U = Shelf.util;
  var WEATHER = 'https://api.open-meteo.com/v1/forecast?latitude=44.4949&longitude=11.3426'
    + '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=1';
  var AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.4949&longitude=11.3426&current=european_aqi&timezone=Europe%2FRome';
  var PICKS = 5, WEATHER_TTL = 30 * 60 * 1000, WEATHER_OLD = 3 * 3600 * 1000, UNDO_MS = 8000, RECENT = 60;
  var SKIP = 1, UNDO = 3;   // the actions under the cards: Già vista, Non oggi, Pesca altre cinque and, for a while, Annulla
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
  var BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M9 5L4 10l5 5M4 10h9.5a5 5 0 0 1 0 10H10"/></svg>';

  var light, glows, glowIndex = 0, weatherEl, scopri, cardsEl, allCard, actionsEl, actionEls = [];
  var picks = [], pickIndex = -1, actionIndex = -1, active = false, zone = 'none', focusedEl = null, color = null;
  var pool = null, services = {}, skipped = {}, lastWeather = null, undo = null, undoTimer = null, actedAt = 0, resume = null;
  var day = null, loading = false;   // the day the five are from; a load under way
  var glass = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)')));

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
    if (!c) {   // an app without titles (YouTube, DAZN): its own look, not the colour of the last picture
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
    markPicks();
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

  // ---- Scopri ----------------------------------------------------------------------------------

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function seen() {
    try { return JSON.parse(localStorage.getItem('casa.seen')) || {}; } catch (_) { return {}; }
  }
  function markSeen(id) {
    var s = seen();
    s[id] = true;
    try { localStorage.setItem('casa.seen', JSON.stringify(s)); } catch (_) { /* shown again next time, no harm */ }
  }

  /* One pool title ready to show: details from TMDB, its service and the button text. */
  function resolvePick(id, done) {
    U.details(id, function(s) {
      var item = Core.poolItem(pool, id), svc = Core.poolService(item);
      if (!s || !s.backdrop) return done(null);
      var direct = svc === 'netflix' && item && item.nf;
      done({id: id, title: s.title, backdrop: s.backdrop, logo: s.logo, plot: s.plot, meta: s.meta, svc: svc,
        entry: {top: 0, tag: null, season: null, netflixId: item && item.nf},
        cta: direct ? 'Guarda su Netflix' : 'Apri ' + (services[svc] ? services[svc].name : svc)});
    });
  }

  function resolveAll(ids, done) {
    var out = [], pending = ids.length;
    if (!pending) return done(out);
    ids.forEach(function(id, i) {
      resolvePick(id, function(p) {
        if (p) { p.order = i; out.push(p); }
        if (--pending === 0) done(out.sort(function(a, b) { return a.order - b.order; }));
      });
    });
  }

  /* The titles shown lately (the last RECENT, newest last): tomorrow's five, a replacement and "Pesca altre cinque" are
     others while the pool has them. It kept proposing the same ones. */
  function recent() {
    var out = {};
    (U.load('casa.recent', Infinity) || []).forEach(function(id) { out[id] = true; });
    return out;
  }
  function save() {
    var ids = picks.map(function(p) { return p.id; });
    if (demo) return;
    U.keep('casa.tonight', {day: today(), ids: ids});
    var list = (U.load('casa.recent', Infinity) || []).filter(function(id) { return ids.indexOf(id) < 0; }).concat(ids);
    U.keep('casa.recent', list.slice(-RECENT));
  }
  function union() {
    var out = {};
    for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) out[k] = true;
    return out;
  }
  function row() {
    var out = {};
    picks.forEach(function(x) { out[x.id] = true; });
    return out;
  }

  function loadPicks() {
    if (loading) return;
    loading = true;
    U.content(function(c) {
      pool = c && c.pool;
      services = c && c.services || {};
      if (!pool) { loading = false; return; }
      var ids = demo && demo.tonight ? demo.tonight
        : Core.tonight(pool, U.load('casa.tonight', Infinity), today(), seen(), PICKS, Math.random, recent());
      resolveAll(ids, function(list) {
        loading = false;
        if (active) return;   // Scopri was opened meanwhile: not under the viewer's hands, the next refresh will do
        picks = list;
        day = today();
        save();
        drawPicks();
      });
    });
  }
  /* Another day (the app stays open for days), or nothing to show yet (no network or no key at the start): the five
     again. Not under the viewer's hands, nor when a return to one of them is due. */
  function refreshPicks() {
    if (!active && resume === null && (!picks.length || day !== today())) loadPicks();
  }

  function drawPicks() {
    cardsEl.innerHTML = '';
    picks.forEach(function(p) {
      var b = BADGES[p.svc];
      cardsEl.appendChild(U.card(p, b ? {text: b[0], cls: b[1]} : null));
    });
    // After the five, the whole list (casa-list.js).
    if (pool) {   // casa-list.js loads after this file: it is there by the time the card is used
      allCard.querySelector('.casa-all-s').textContent = (pool.items || []).length + ' serie sui tuoi servizi';
      cardsEl.appendChild(allCard);
    }
    scopri.style.display = picks.length ? '' : 'none';
    markPicks();
    place();
    if (window.CasaRest) CasaRest.picks(picks);
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

  function onAll() { return active && actionIndex < 0 && pickIndex === picks.length; }

  function markPicks() {
    var cards = cardsEl ? cardsEl.children : [];
    for (var i = 0; i < cards.length; i++) {
      var on = active && actionIndex < 0 && i === pickIndex, base = cards[i] === allCard ? 'casa-card casa-all' : 'casa-card';
      cards[i].className = base + (on ? ' focused' : i === pickIndex && active ? ' chosen' : '');
    }
    for (var j = 0; j < actionEls.length; j++) {
      actionEls[j].className = 'casa-action' + (j === UNDO ? ' casa-undo' : '') + (active && j === actionIndex ? ' focused' : '');
    }
    if (actionEls[UNDO]) actionEls[UNDO].style.display = undo ? '' : 'none';
    actionsEl.style.visibility = onAll() ? 'hidden' : '';   // the list card has no Già vista
    document.body.classList.toggle('casa-scopri-all', onAll());   // and the title above is not what OK opens
  }

  function enter(at) {
    if (!picks.length) return;
    active = true;
    pickIndex = Math.max(0, Math.min(at || 0, pool ? picks.length : picks.length - 1));
    actionIndex = -1;
    document.body.classList.add('casa-scopri');
    Shelf.feature(picks[Math.min(pickIndex, picks.length - 1)]);
    markPicks();
    dim();
    follow();
  }
  function leave() {
    if (!active) return;
    active = false;
    pickIndex = actionIndex = -1;
    hideUndo();
    document.body.classList.remove('casa-scopri');
    document.body.classList.remove('casa-scopri-all');
    markPicks();
    Shelf.refocus();
    dim();
    follow();
    setTimeout(place, 480);   // after the apps are back in place
  }
  function move(step) {
    if (actionIndex >= 0) {
      actionIndex = Math.max(0, Math.min(undo ? UNDO : UNDO - 1, actionIndex + step));
      return markPicks();
    }
    var last = pool ? picks.length : picks.length - 1, next = pickIndex + step;
    if (next < 0 || next > last) return;
    pickIndex = next;
    markPicks();
    if (picks[pickIndex]) Shelf.feature(picks[pickIndex]);
  }

  /* Opens a pool title (the five here, the whole list in casa-list.js); coming back to Home returns to it. */
  function launch(p) {
    if (!p || !window.HomeApp) return;
    var params = p.svc === 'netflix' ? Core.netflixParams(p.entry.netflixId) : null;
    HomeApp.launch(Core.appOf(p.svc), services[p.svc] ? services[p.svc].name : p.svc, params);
  }
  function open(i) {
    var p = picks[i];
    if (!p) return;
    resume = i;
    launch(p);
  }

  /* A pool title to take a card's place: never one of the row; not one sent away today or shown lately while the pool
     has others (Core.pick falls back on any unseen title: that put the same series twice in the row). */
  function another() {
    var inRow = row(), tiers = [union(inRow, skipped, recent()), union(inRow, skipped), inRow];
    for (var t = 0; t < tiers.length; t++) {
      var id = Core.pick(pool, null, seen(), tiers[t], 1, Math.random)[0];
      if (id !== undefined && !tiers[t][id]) return id;
    }
    return null;
  }
  /* Già vista: never again (its Annulla stays a few seconds). Non oggi: not today. Either way a new title takes the
     card's place, and the focus stays on the button for the next one. */
  function replace(i, never) {
    var p = picks[i];
    if (!p || !pool) return;
    if (never) {
      markSeen(p.id);
      showUndo(i, p);
    } else skipped[p.id] = true;
    var next = another();
    var done = function(q) {
      var at = picks.indexOf(p);   // the details take a moment: the row may have changed, or Annulla brought it back
      if (at < 0 || never && !seen()[p.id]) return;
      var here = pickIndex === at;   // the focus is still on that card (or on its actions)
      if (q) picks[at] = q; else picks.splice(at, 1);
      if (never && undo && undo.p === p) undo.q = q ? q.id : null;   // what Annulla has to put it back in place of
      save();
      if (!q) {
        if (pickIndex > at) pickIndex--;   // the cards after it moved one place left
        else if (here && at >= picks.length) pickIndex = picks.length - 1;   // it was the last: the one before it
      }
      drawPicks();
      if (!active) return;   // left Scopri meanwhile: the dock app keeps its own titles on screen
      if (!picks.length) return leave();
      if (here && picks[pickIndex]) Shelf.feature(picks[pickIndex]);
    };
    if (next !== null) resolvePick(next, done); else done(null);
  }
  /* Five others: not the ones on screen, sent away today or shown lately, while the pool has others. The focus stays on
     the button, to draw again. */
  function redraw() {
    hideUndo();
    resolveAll(Core.pick(pool, null, seen(), union(row(), skipped, recent()), PICKS, Math.random), function(list) {
      if (!list.length) return;
      picks = list;
      save();
      if (active) pickIndex = 0;
      drawPicks();
      if (active) Shelf.feature(picks[0]);
    });
  }
  /* "Annulla" is a button of its own, at the end of the row: OK used to undo wherever the focus was, so marking a second
     series brought the first one back. */
  function showUndo(i, p) {
    undo = {i: i, p: p};
    actionEls[UNDO].lastChild.textContent = 'Annulla «' + p.title + '»';
    clearTimeout(undoTimer);
    undoTimer = setTimeout(expireUndo, UNDO_MS);
  }
  function expireUndo() {
    if (active && actionIndex === UNDO) { undoTimer = setTimeout(expireUndo, 3000); return; }   // not from under the focus
    hideUndo();
  }
  function hideUndo() {
    undo = null;
    clearTimeout(undoTimer);
    if (actionIndex === UNDO) actionIndex = -1;
    if (actionEls.length) markPicks();
  }
  function undoSeen() {
    var u = undo, s = seen();
    if (!u) return;
    hideUndo();
    delete s[u.p.id];
    try { localStorage.setItem('casa.seen', JSON.stringify(s)); } catch (_) { /* stays seen */ }
    // Back where it was: in place of the title that took its card, or in the gap when none did. (Still in the row when
    // its replacement has not come yet: replace() drops that one.)
    var at = picks.indexOf(u.p);
    if (at < 0) {
      for (var n = 0; n < picks.length; n++) if (picks[n].id === u.q) at = n;
      if (at >= 0) picks[at] = u.p;
      else if (picks.length >= PICKS) picks[at = Math.min(u.i, picks.length - 1)] = u.p;
      else picks.splice(at = Math.min(u.i, picks.length), 0, u.p);
    }
    pickIndex = at;
    actionIndex = -1;
    save();
    drawPicks();
    Shelf.feature(picks[pickIndex]);
  }
  function act(event) {
    // A held OK repeats: one action per press, and none in the half second after one (it marked five series as seen).
    if (U.repeated(event) || Date.now() - actedAt < 500) return;
    actedAt = Date.now();
    if (actionIndex < 0) return onAll() ? openList() : open(pickIndex);
    var what = actionEls[actionIndex].getAttribute('data-a');
    if (what === 'undo') undoSeen();
    else if (what === 'seen') replace(pickIndex, true);
    else if (what === 'skip') replace(pickIndex, false);
    else redraw();
  }
  function openList() {
    if (window.CasaList) CasaList.open({pool: pool, services: services, seen: seen, launch: launch,
      badge: function(svc) { var b = BADGES[svc]; return b ? {text: b[0], cls: b[1]} : null; },
      back: function() { enter(picks.length); }});
  }

  var swallow = {};
  function onKey(event) {
    var key = event.keyCode, mine = false, s = Shelf.state();
    var body = document.body.classList;
    if (body.contains('casa-rest') || body.contains('casa-list')) {   // the rest screen and the list own the keys
      if (event.type === 'keyup') swallow[key] = false;
      return;
    }
    if (active) {
      mine = true;
      if (event.type === 'keydown') {
        // Still here, at the keys: no return from an app is due (a title that did not open left one). Not for the OK that
        // opened it, still down.
        if (!U.repeated(event) && Date.now() - actedAt >= 500) resume = null;
        // Up, Down and Back change level: held a moment too long, a key counts once (Down went on to the actions).
        if (U.repeated(event) && (key === 38 || key === 40 || key === 461 || key === 27)) return hold(event);
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) act(event);
        // Down lands on "Non oggi", which does no harm; "Già vista" is one step left.
        else if (key === 40) { if (actionIndex < 0 && !onAll()) { actionIndex = SKIP; markPicks(); } }
        else if (key === 38) { if (actionIndex >= 0) { actionIndex = -1; markPicks(); } else leave(); }
        else if (key === 461 || key === 27) leave();
        else mine = false;
      }
    } else if (event.type === 'keydown' && key === 40 && s.zone === 'grid' && s.lastRow && !s.detail && picks.length
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

  scopri = el('div', 'casaScopri');
  scopri.style.display = 'none';
  var head = el('div', 'casaScopriHead');
  head.innerHTML = DIE + '<span class="t">Scopri una nuova serie</span><span class="s">Cinque per oggi, tra le migliori sui tuoi servizi</span><b>▼</b>';
  cardsEl = el('div', 'casaScopriCards');
  allCard = el('div', null, 'casa-card casa-all');
  allCard.innerHTML = '<span class="casa-all-t">Tutte le serie</span><span class="casa-all-s"></span><span class="casa-all-go">›</span>';
  actionsEl = el('div', 'casaScopriActions');
  [['seen', '✓  Già vista'], ['skip', 'Non oggi'], ['redraw', 'Pesca altre cinque'], ['undo', '']].forEach(function(a) {
    var b = el('span', null, 'casa-action');
    b.setAttribute('data-a', a[0]);
    b.innerHTML = (a[0] === 'redraw' ? DIE : a[0] === 'undo' ? BACK : '') + '<span></span>';
    b.lastChild.textContent = a[1];
    actionsEl.appendChild(b);
    actionEls.push(b);
  });
  actionEls[UNDO].style.display = 'none';
  scopri.appendChild(head);
  scopri.appendChild(cardsEl);
  scopri.appendChild(actionsEl);
  // Beside the apps, not inside them: in Scopri the apps fade away and the row moves up into their place.
  var viewport = document.getElementById('viewport');
  document.body.insertBefore(scopri, viewport ? viewport.nextSibling : null);

  frost(document.getElementById('leftBlock'), 14);
  frost(buttons, 14);
  frost(document.getElementById('dockBand'), 16);
  window.addEventListener('resize', follow);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  // HOME: back to the base state. Back from a title opened here: Scopri again, on that card (app.js put focus on the dock).
  // Either way the weather and the five are looked at again: hours may have passed.
  document.addEventListener('webOSRelaunch', function() { resume = null; leave(); weather(); refreshPicks(); });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) return;
    weather();
    refreshPicks();
    if (resume === null) return;
    var at = resume;
    setTimeout(function() { if (resume === at) { resume = null; enter(at); } }, 300);
  });

  /* Developer Mode auto-renewal: the original project's Beta (Home settings), off by default there. The owner asked for
     it on, so Home turns it on once per installation: a reinstallation (LG wiped the apps once) starts with it off
     again. Turned off by hand in Home settings later, it stays off. */
  function renewal() {
    var done = false;
    try { done = !!localStorage.getItem('casa.renewal'); } catch (_) { done = true; }
    if (done || !window.PalmServiceBridge) return;
    var call = function(method, then) {
      try {
        var bridge = new PalmServiceBridge();
        bridge.onservicecallback = function(raw) {
          var r = null;
          try { r = JSON.parse(raw); } catch (_) { /* no answer worth reading */ }
          then(r && r.returnValue === true && r.state ? r.state : null);
        };
        bridge.call('luna://com.gathin.tvhome.renewal/' + method, '{}');
      } catch (_) { then(null); }
    };
    var mark = function() { try { localStorage.setItem('casa.renewal', '1'); } catch (_) { /* asked again next start */ } };
    call('status', function(state) {
      if (!state) return;   // no service yet: at the next start
      if (state.enabled) return mark();
      call('enable', function(after) { if (after && after.enabled) mark(); });
    });
  }
  window.CasaHome = {focus: focus, zone: setZone, tint: tint, open: open, reset: function() { resume = null; leave(); },
    picks: function() { return picks; }, weather: function() { return lastWeather; }};
  weather();
  setInterval(function() { weather(true); refreshPicks(); }, WEATHER_TTL);
  loadPicks();
  renewal();
}());
