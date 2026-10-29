/* Fork lorenzoma97, "Casa": the rest of Home around the shelf, as decided for the Metz and the C3.
   - Bologna's weather in the top bar (Open-Meteo, no key), smaller clock and pills on frosted glass.
   - "Scopri una nuova serie" under the apps: tonight's five from the pool as titled cards. Down from the last row of
     apps, Left/Right, OK opens the series (Netflix on the title itself), Up or Back returns.
   - A soft light under the focused app, the apps beside it a little dimmer, and the focus that tilts with the Magic
     Remote pointer (liquid glass).
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

  var light, weatherEl, scopri, cardsEl, picks = [], pickIndex = -1, active = false, zone = 'none', focusedEl = null;
  var glass = !!(window.CSS && CSS.supports && (CSS.supports('backdrop-filter', 'blur(2px)') || CSS.supports('-webkit-backdrop-filter', 'blur(2px)')));

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }
  function frost(node, blur) {
    if (!glass || !node) return;
    node.style.backdropFilter = node.style.webkitBackdropFilter = 'blur(' + blur + 'px) saturate(150%)';
    node.className += ' casa-frosted';
  }

  // ---- weather ---------------------------------------------------------------------------------

  function drawWeather(w) {
    if (!w || typeof w.temp !== 'number') return;
    var d = Core.describe(w.code, w.day !== 0), a = Core.air(w.aqi);
    weatherEl.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">' + (ICONS[d[1]] || ICONS.cloud) + '</svg>'
      + '<span class="wx-temp"></span><span class="wx-lines"><span class="wx-city">Bologna</span><span class="wx-desc"></span>'
      + (a ? '<span class="wx-air"></span>' : '') + '</span>';
    weatherEl.querySelector('.wx-temp').textContent = Math.round(w.temp) + '°';
    weatherEl.querySelector('.wx-desc').textContent = (d[0] ? d[0] + '  ·  ' : '') + '↑' + Math.round(w.max) + '°  ↓' + Math.round(w.min) + '°';
    if (a) {
      var air = weatherEl.querySelector('.wx-air');
      air.textContent = a + '  ·  AQI ' + w.aqi;
      air.className = 'wx-air ' + (w.aqi <= 40 ? 'good' : w.aqi <= 60 ? 'fair' : 'poor');
    }
    weatherEl.style.display = '';
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

  function loadPicks() {
    U.content(function(c) {
      var pool = c && c.pool;
      if (!pool) return;
      var saved = U.load('casa.tonight', Infinity);
      var ids = demo && demo.tonight ? demo.tonight : Core.tonight(pool, saved, today(), seen(), PICKS, Math.random);
      if (!demo) U.keep('casa.tonight', {day: today(), ids: ids});
      picks = [];
      var pending = ids.length;
      ids.forEach(function(id, i) {
        U.details(id, function(s) {
          var item = Core.poolItem(pool, id), svc = Core.poolService(item);
          if (s && s.backdrop) {
            picks.push({order: i, id: id, title: s.title, backdrop: s.backdrop, logo: s.logo, plot: s.plot, meta: s.meta,
              showMeta: true, svc: svc, entry: {top: 0, tag: null, season: null, netflixId: item && item.nf},
              cta: svc === 'netflix' && item && item.nf ? 'Guarda su Netflix' : 'Apri ' + (c.services && c.services[svc] ? c.services[svc].name : svc)});
          }
          if (--pending === 0) {
            picks.sort(function(a, b) { return a.order - b.order; });
            drawPicks();
          }
        });
      });
    });
  }

  function drawPicks() {
    cardsEl.innerHTML = '';
    picks.forEach(function(p) {
      var card = el('div', null, 'casa-card'), name = el('span');
      card.style.backgroundImage = 'url("' + U.image('w780', p.backdrop) + '")';
      name.textContent = p.title;
      card.appendChild(name);
      cardsEl.appendChild(card);
    });
    scopri.style.display = picks.length ? '' : 'none';
    place();
  }

  /* Under the dock band, wherever app.js put it. */
  function place() {
    var band = document.getElementById('dockBand');
    if (band && band.offsetHeight) scopri.style.top = (band.offsetTop + band.offsetHeight + 30) + 'px';
  }

  function mark() {
    var cards = cardsEl.children;
    for (var i = 0; i < cards.length; i++) cards[i].className = 'casa-card' + (i === pickIndex ? ' focused' : '');
  }
  function enter() {
    if (!picks.length) return;
    active = true;
    pickIndex = 0;
    document.body.classList.add('casa-scopri');
    mark();
    Shelf.feature(picks[0]);
    dim();
  }
  function leave() {
    active = false;
    pickIndex = -1;
    document.body.classList.remove('casa-scopri');
    mark();
    Shelf.refocus();
    dim();
  }
  function move(step) {
    var next = pickIndex + step;
    if (next < 0 || next >= picks.length) return;
    pickIndex = next;
    mark();
    Shelf.feature(picks[pickIndex]);
  }
  function open() {
    var p = picks[pickIndex];
    if (!p || !window.HomeApp) return;
    var params = p.svc === 'netflix' ? Core.netflixParams(p.entry.netflixId) : null;
    HomeApp.launch(Core.appOf(p.svc), p.cta.replace(/^(Guarda su|Apri) /, ''), params);
  }

  var swallow = {};
  function onKey(event) {
    var key = event.keyCode, mine = false, s = Shelf.state();
    if (active) {
      mine = true;
      if (event.type === 'keydown') {
        if (key === 37) move(-1);
        else if (key === 39) move(1);
        else if (key === 13) open();
        else if (key === 38 || key === 461 || key === 27) leave();
        else if (key !== 40) mine = false;
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
    card.style.transform = 'perspective(700px) scale(1.12) rotateX(' + (-y * 7).toFixed(1) + 'deg) rotateY(' + (x * 9).toFixed(1) + 'deg)';
    var sheen = card.querySelector('.casa-sheen');
    if (sheen) sheen.style.background = 'radial-gradient(circle at ' + Math.round((x + 1) * 50) + '% ' + Math.round((y + 1) * 50)
      + '%, rgba(255,255,255,0.34), rgba(255,255,255,0) 58%)';
  }
  function untilt(node) {
    var card = node && node.querySelector('.card');
    if (!card) return;
    card.style.transform = '';
    var sheen = card.querySelector('.casa-sheen');
    if (sheen) sheen.parentNode.removeChild(sheen);
  }

  // ---- what casa-shelf.js calls -----------------------------------------------------------------

  function focus(node, row, last) {
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

  light = el('div', 'casaLight');
  document.body.insertBefore(light, document.getElementById('hero'));
  weatherEl = el('div', 'casaWeather');
  weatherEl.style.display = 'none';
  var buttons = document.getElementById('topButtons');
  if (buttons) buttons.insertBefore(weatherEl, buttons.firstChild);
  scopri = el('div', 'casaScopri');
  scopri.style.display = 'none';
  var label = el('div', 'casaScopriLabel');
  label.innerHTML = '<span>Scopri una nuova serie</span><b>▼</b>';
  cardsEl = el('div', 'casaScopriCards');
  scopri.appendChild(label);
  scopri.appendChild(cardsEl);
  var stage = document.getElementById('stage');
  (stage || document.body).appendChild(scopri);
  frost(document.getElementById('leftBlock'), 28);
  frost(weatherEl, 28);
  frost(document.getElementById('dockBand'), 34);
  var pills = document.querySelectorAll('.pill');
  for (var i = 0; i < pills.length; i++) frost(pills[i], 24);
  window.addEventListener('resize', follow);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  window.CasaHome = {focus: focus, zone: setZone};
  weather();
  setInterval(weather, WEATHER_TTL);
  loadPicks();
}());
