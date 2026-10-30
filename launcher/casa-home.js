/* Fork lorenzoma97, "Casa": the rest of Home around the shelf.
   - One glass capsule in the top bar: Bologna's weather (Open-Meteo, no key) and the Inputs, Wi-Fi and Settings buttons
     as icons whose name opens out on focus.
   - "Scopri una nuova serie" under the apps: today's five as cards with their logos and service, then "Tutte le serie"
     (the whole list, casa-list.js). Down from the apps; the series fills the screen; OK opens it (Netflix on the title
     itself); Down again: Già vista (with Annulla), Non oggi, Pesca altre cinque.
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
  var PICKS = 5, WEATHER_TTL = 30 * 60 * 1000, WEATHER_OLD = 3 * 3600 * 1000, UNDO_MS = 5000;
  var BADGES = {netflix: ['Netflix', 'netflix'], prime: ['Prime Video', 'prime'], raiplay: ['RaiPlay', 'raiplay'], infinity: ['Infinity', 'infinity']};
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

  var light, glows, glowIndex = 0, weatherEl, scopri, cardsEl, allCard, actionsEl, actionEls = [], undoEl;
  var picks = [], pickIndex = -1, actionIndex = -1, active = false, zone = 'none', focusedEl = null, color = null;
  var pool = null, services = {}, skipped = {}, lastWeather = null, undo = null, undoTimer = null, actedAt = 0, resume = null;
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

  function weather() {
    if (demo && demo.weather) return drawWeather(demo.weather);
    var kept = U.load('casa.weather', WEATHER_TTL);
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

  function save() {
    if (!demo) U.keep('casa.tonight', {day: today(), ids: picks.map(function(p) { return p.id; })});
  }

  function loadPicks() {
    U.content(function(c) {
      pool = c && c.pool;
      services = c && c.services || {};
      if (!pool) return;
      var ids = demo && demo.tonight ? demo.tonight : Core.tonight(pool, U.load('casa.tonight', Infinity), today(), seen(), PICKS, Math.random);
      resolveAll(ids, function(list) {
        picks = list;
        save();
        drawPicks();
      });
    });
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
    for (var j = 0; j < actionEls.length; j++) actionEls[j].className = 'casa-action' + (active && j === actionIndex ? ' focused' : '');
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
      actionIndex = Math.max(0, Math.min(actionEls.length - 1, actionIndex + step));
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

  /* Già vista: never again (Annulla for five seconds). Non oggi: not today. Either way a new title takes the card's place. */
  function replace(i, never) {
    var p = picks[i];
    if (!p || !pool) return;
    if (never) {
      markSeen(p.id);
      showUndo(i, p);
    } else skipped[p.id] = true;
    var avoid = {};
    picks.forEach(function(x) { avoid[x.id] = true; });
    for (var k in skipped) avoid[k] = true;
    var next = Core.pick(pool, null, seen(), avoid, 1, Math.random)[0];
    var done = function(q) {
      if (q) picks[i] = q; else picks.splice(i, 1);
      pickIndex = Math.min(i, picks.length - 1);
      save();
      drawPicks();
      if (picks[pickIndex]) Shelf.feature(picks[pickIndex]);
      if (!picks.length) leave();
    };
    if (next) resolvePick(next, done); else done(null);
  }
  function redraw() {
    var avoid = {};
    picks.forEach(function(x) { avoid[x.id] = true; });
    resolveAll(Core.pick(pool, null, seen(), avoid, PICKS, Math.random), function(list) {
      if (!list.length) return;
      picks = list;
      pickIndex = 0;
      actionIndex = -1;
      save();
      drawPicks();
      Shelf.feature(picks[0]);
    });
  }
  function showUndo(i, p) {
    undo = {i: i, p: p};
    undoEl.style.display = '';
    clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, UNDO_MS);
  }
  function hideUndo() {
    undo = null;
    clearTimeout(undoTimer);
    if (undoEl) undoEl.style.display = 'none';
  }
  function undoSeen() {
    var u = undo, s = seen();
    hideUndo();
    delete s[u.p.id];
    try { localStorage.setItem('casa.seen', JSON.stringify(s)); } catch (_) { /* stays seen */ }
    picks[Math.min(u.i, picks.length)] = u.p;
    pickIndex = Math.min(u.i, picks.length - 1);
    save();
    drawPicks();
    Shelf.feature(picks[pickIndex]);
  }
  function act(event) {
    // A held OK repeats: one action per press, and none in the half second after one (it marked five series as seen).
    if (event.repeat || Date.now() - actedAt < 500) return;
    actedAt = Date.now();
    if (undo) return undoSeen();   // "Segnata come vista · OK per annullare"
    if (actionIndex < 0) return onAll() ? openList() : open(pickIndex);
    var what = actionEls[actionIndex].getAttribute('data-a');
    if (what === 'seen') replace(pickIndex, true);
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
    if (body.contains('casa-rest') || body.contains('casa-list')) return;   // the rest screen and the list own the keys
    if (active) {
      mine = true;
      if (event.type === 'keydown') {
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) act(event);
        // Down lands on "Non oggi", which does no harm; "Già vista" is one step left.
        else if (key === 40) { if (actionIndex < 0 && !onAll()) { actionIndex = 1; markPicks(); } }
        else if (key === 38) { if (actionIndex >= 0) { actionIndex = -1; markPicks(); } else leave(); }
        else if (key === 461 || key === 27) leave();
        else mine = false;
      }
    } else if (event.type === 'keydown' && key === 40 && s.zone === 'grid' && s.lastRow && !s.detail && picks.length
        && !Shelf.editing()) {
      mine = true;
      enter();
    } else if (event.type === 'keyup' && swallow[key]) {
      mine = true;
    }
    if (mine) {
      swallow[key] = event.type === 'keydown';
      event.preventDefault();
      event.stopImmediatePropagation();
    }
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
  [['seen', '✓  Già vista'], ['skip', 'Non oggi'], ['redraw', 'Pesca altre cinque']].forEach(function(a) {
    var b = el('span', null, 'casa-action');
    b.setAttribute('data-a', a[0]);
    b.innerHTML = a[0] === 'redraw' ? DIE + '<span></span>' : '<span></span>';
    b.lastChild.textContent = a[1];
    actionsEl.appendChild(b);
    actionEls.push(b);
  });
  undoEl = el('div', 'casaUndo');
  undoEl.style.display = 'none';
  undoEl.textContent = 'Segnata come vista   ·   OK per annullare';
  scopri.appendChild(head);
  scopri.appendChild(cardsEl);
  scopri.appendChild(actionsEl);
  scopri.appendChild(undoEl);
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
  document.addEventListener('webOSRelaunch', function() { resume = null; leave(); });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden || resume === null) return;
    var at = resume;
    setTimeout(function() { if (resume === at) { resume = null; enter(at); } }, 300);
  });
  window.CasaHome = {focus: focus, zone: setZone, tint: tint, open: open, reset: function() { resume = null; leave(); },
    picks: function() { return picks; }, weather: function() { return lastWeather; }};
  weather();
  setInterval(weather, WEATHER_TTL);
  loadPicks();
}());
