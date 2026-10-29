/* Fork lorenzoma97, "Casa": the rest of Home around the shelf.
   - One glass capsule in the top bar: Bologna's weather (Open-Meteo, no key) and the Inputs, Wi-Fi and Settings buttons
     as icons whose name opens out on focus.
   - "Scopri una nuova serie" under the apps: tonight's five as cards with their logos and service. Down from the last row
     of apps; the series fills the screen; OK opens it (Netflix on the title itself); Down again: Gia vista, Un'altra,
     Pesca altre cinque.
   - The colour of the picture on screen tints the glow, the dock band and the focus; a pool of light under the focused
     app, the apps beside it dimmer, a film grain and the focus that tilts with the Magic Remote pointer.
   Blur and other effects the legacy CSS gate cannot check are set from here, only where the TV supports them. */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf, demo = window.CASA_DEMO || null;
  if (!Core || !Shelf) return;
  var U = Shelf.util;
  var WEATHER = 'https://api.open-meteo.com/v1/forecast?latitude=44.4949&longitude=11.3426'
    + '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome&forecast_days=1';
  var AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.4949&longitude=11.3426&current=european_aqi&timezone=Europe%2FRome';
  var PICKS = 5, WEATHER_TTL = 30 * 60 * 1000;
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

  var light, glows, glowIndex = 0, weatherEl, scopri, cardsEl, actionsEl, actionEls = [];
  var picks = [], pickIndex = -1, actionIndex = -1, active = false, zone = 'none', focusedEl = null, color = null;
  var pool = null, services = {}, skipped = {}, lastWeather = null;
  var glass = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)')));

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }
  function frost(node, blur) {
    if (!glass || !node) return;
    node.style.backdropFilter = node.style.webkitBackdropFilter = 'blur(' + blur + 'px) saturate(160%)';
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

  /* A fine film grain over everything: OLED black stays black, flat areas stop looking like plastic. */
  function grain() {
    var g = el('div', 'casaGrain');
    try {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      var ctx = canvas.getContext('2d'), data = ctx.createImageData(160, 160);
      for (var i = 0; i < data.data.length; i += 4) {
        var v = Math.floor(Math.random() * 255);
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
        data.data[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      g.style.backgroundImage = 'url(' + canvas.toDataURL('image/png') + ')';
    } catch (_) { return; }
    document.body.appendChild(g);
  }

  // ---- weather ---------------------------------------------------------------------------------

  function drawWeather(w) {
    if (!w || typeof w.temp !== 'number') return;
    lastWeather = w;
    var d = Core.describe(w.code, w.day !== 0), a = Core.air(w.aqi);
    weatherEl.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">' + (ICONS[d[1]] || ICONS.cloud) + '</svg>'
      + '<span class="wx-temp"></span><span class="wx-lines"><span class="wx-desc"></span><span class="wx-more"></span></span>';
    weatherEl.querySelector('.wx-temp').textContent = Math.round(w.temp) + '°';
    weatherEl.querySelector('.wx-desc').textContent = d[0] || 'Bologna';
    var more = weatherEl.querySelector('.wx-more');
    more.textContent = '↑' + Math.round(w.max) + '°  ↓' + Math.round(w.min) + '°';
    if (a) {
      var dot = el('i', null, 'wx-dot ' + (w.aqi <= 40 ? 'good' : w.aqi <= 60 ? 'fair' : 'poor'));
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
        max: f.daily.temperature_2m_max[0], min: f.daily.temperature_2m_min[0], aqi: null};
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
    scopri.style.display = picks.length ? '' : 'none';
    markPicks();
    place();
    if (window.CasaRest) CasaRest.picks(picks);
  }

  /* Under the dock band, wherever app.js put it (the band scrolls with the grid: its place on screen counts). */
  function place() {
    var band = document.getElementById('dockBand');
    if (!band || !band.offsetHeight) return;
    var r = band.getBoundingClientRect();
    scopri.style.top = Math.round(r.top + r.height + 18) + 'px';
  }

  function markPicks() {
    var cards = cardsEl ? cardsEl.children : [];
    for (var i = 0; i < cards.length; i++) {
      var on = active && actionIndex < 0 && i === pickIndex;
      cards[i].className = 'casa-card' + (on ? ' focused' : i === pickIndex && active ? ' chosen' : '');
      cards[i].style.boxShadow = on && color ? '0 0 0 4px #fff, 0 18px 46px ' + rgba(color, 0.55) : '';
    }
    for (var j = 0; j < actionEls.length; j++) actionEls[j].className = 'casa-action' + (active && j === actionIndex ? ' focused' : '');
  }

  function enter() {
    if (!picks.length) return;
    active = true;
    pickIndex = 0;
    actionIndex = -1;
    document.body.classList.add('casa-scopri');
    Shelf.feature(picks[0]);
    markPicks();
    dim();
    follow();
  }
  function leave() {
    active = false;
    pickIndex = actionIndex = -1;
    document.body.classList.remove('casa-scopri');
    markPicks();
    Shelf.refocus();
    dim();
    follow();
  }
  function move(step) {
    if (actionIndex >= 0) {
      actionIndex = Math.max(0, Math.min(actionEls.length - 1, actionIndex + step));
      return markPicks();
    }
    var next = pickIndex + step;
    if (next < 0 || next >= picks.length) return;
    pickIndex = next;
    markPicks();
    Shelf.feature(picks[pickIndex]);
  }
  function open(i) {
    var p = picks[i];
    if (!p || !window.HomeApp) return;
    var params = p.svc === 'netflix' ? Core.netflixParams(p.entry.netflixId) : null;
    HomeApp.launch(Core.appOf(p.svc), services[p.svc] ? services[p.svc].name : p.svc, params);
  }

  /* Gia vista: never again. Un'altra: not tonight. Either way a new title takes the card's place. */
  function replace(i, never) {
    var p = picks[i];
    if (!p || !pool) return;
    if (never) markSeen(p.id); else skipped[p.id] = true;
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
  function act() {
    if (actionIndex < 0) return open(pickIndex);
    var what = actionEls[actionIndex].getAttribute('data-a');
    if (what === 'seen') replace(pickIndex, true);
    else if (what === 'skip') replace(pickIndex, false);
    else redraw();
  }

  var swallow = {};
  function onKey(event) {
    var key = event.keyCode, mine = false, s = Shelf.state();
    if (document.body.classList.contains('casa-rest')) return;   // the rest screen owns the keys (casa-rest.js)
    if (active) {
      mine = true;
      if (event.type === 'keydown') {
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) act();
        else if (key === 40) { if (actionIndex < 0) { actionIndex = 0; markPicks(); } }
        else if (key === 38) { if (actionIndex >= 0) { actionIndex = -1; markPicks(); } else leave(); }
        else if (key === 461 || key === 27) leave();
        else mine = false;
      }
    } else if (event.type === 'keydown' && key === 40 && s.zone === 'grid' && s.lastRow && !s.detail && picks.length
        && !document.body.classList.contains('editing')) {
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

  function follow() {
    if (!focusedEl || zone !== 'grid' || active) { light.style.opacity = '0'; return; }
    var r = focusedEl.getBoundingClientRect();
    light.style.left = (r.left + r.width / 2 - 450) + 'px';
    light.style.top = (r.top + r.height / 2 - 260) + 'px';
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
  document.body.appendChild(el('div', 'casaVignette'));
  grain();

  weatherEl = el('div', 'casaWeather');
  weatherEl.style.display = 'none';
  var buttons = document.getElementById('topButtons');
  if (buttons) buttons.insertBefore(weatherEl, buttons.firstChild);

  scopri = el('div', 'casaScopri');
  scopri.style.display = 'none';
  var head = el('div', 'casaScopriHead');
  head.innerHTML = DIE + '<span class="t">Scopri una nuova serie</span><span class="s">Le cinque di stasera, tra le migliori sui tuoi servizi</span><b>▼</b>';
  cardsEl = el('div', 'casaScopriCards');
  actionsEl = el('div', 'casaScopriActions');
  [['seen', '✓  Già vista'], ['skip', '↻  Un\'altra'], ['redraw', 'Pesca altre cinque']].forEach(function(a) {
    var b = el('span', null, 'casa-action');
    b.setAttribute('data-a', a[0]);
    b.innerHTML = a[0] === 'redraw' ? DIE + '<span></span>' : '<span></span>';
    b.lastChild.textContent = a[1];
    actionsEl.appendChild(b);
    actionEls.push(b);
  });
  scopri.appendChild(head);
  scopri.appendChild(cardsEl);
  scopri.appendChild(actionsEl);
  // Beside the apps, not inside them: in Scopri the apps fade away and the row moves up into their place.
  var viewport = document.getElementById('viewport');
  document.body.insertBefore(scopri, viewport ? viewport.nextSibling : null);

  frost(document.getElementById('leftBlock'), 30);
  frost(buttons, 30);
  frost(document.getElementById('dockBand'), 36);
  window.addEventListener('resize', follow);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  window.CasaHome = {focus: focus, zone: setZone, tint: tint, open: open,
    picks: function() { return picks; }, weather: function() { return lastWeather; }};
  weather();
  setInterval(weather, WEATHER_TTL);
  loadPicks();
}());
