/* Fork lorenzoma97, "Casa": the whole Scopri list, from the "Tutte le serie" (or "Tutti i film") card after the five.
   Every title of the pool on the owner's services (content.json pool or pool_film: the best hundred first, then the
   others), all or by genre: the genres on top, a grid of five a row under the focused title's picture and words. Arrows
   move, OK on a genre shows it, OK on a title lights its buttons under the plot, as in the rows of Home: Guarda (Netflix
   on the title itself), Da vedere, Già vista, Trailer (Left/Right, OK acts, Down or Back returns to the grid). Back on
   the grid returns to the five. Details and pictures only for the rows on screen (TMDB, kept by casa-shelf.js); coming
   back from a title opened here returns to it, HOME closes the list. */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf, State = window.CasaState;
  if (!Core || !Shelf || !State) return;
  var U = Shelf.util, COLS = 5, CELL_W = 290, ROW_H = 196, FEATURE_MS = 260;

  var root, infoEl, labelEl, logoEl, nameEl, metaEl, plotEl, barEl, chipsEl, gridEl, countEl;
  var bar = [], lit = -1, litAt = 0;   // the focused title's buttons, the lit one (-1: the grid has the focus), since when
  var opts = null, genres = [], genre = 0, shown = 0, ids = [], cells = [], items = {}, zone = 'grid', index = 0, scrollRow = 0;
  var featureTimer = null, resumeAt = null, openedAt = 0;

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }

  /* [{key, label, count}]: "Tutte" first, then the genres with the most series. */
  function genreList(pool) {
    var out = [{key: null, label: opts.movie ? 'Tutti' : 'Tutte', count: allIds(pool).length}], g = pool.genres || {};
    Object.keys(g).sort(function(a, b) { return (g[b].count || 0) - (g[a].count || 0); }).forEach(function(k) {
      if ((pool.by_genre && pool.by_genre[k] || []).length) out.push({key: k, label: g[k].label || k, count: pool.by_genre[k].length});
    });
    return out;
  }
  function allIds(pool) {
    var seen = {}, out = [];
    (pool.all || []).concat((pool.items || []).map(function(x) { return x.tmdb; })).forEach(function(id) {
      if (id > 0 && !seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
  }

  function drawChips() {
    chipsEl.innerHTML = '';
    genres.forEach(function(g, i) {
      // "on": the genre the grid shows; "focused": the chip the arrows are on (they used to move together).
      var c = el('span', null, 'casa-list-chip' + (i === shown ? ' on' : '') + (zone === 'chips' && i === genre ? ' focused' : ''));
      c.textContent = g.label + '  ' + g.count;
      chipsEl.appendChild(c);
    });
    // The chosen genre stays in view: the row slides under a fixed left edge.
    var chip = chipsEl.children[genre], shift = chip ? Math.max(0, chip.offsetLeft + chip.offsetWidth - 1500) : 0;
    chipsEl.style.transform = 'translateX(' + -shift + 'px)';
  }

  function showGenre(i) {
    genre = shown = i;
    var key = genres[i].key;
    ids = key === null ? allIds(opts.pool) : (opts.pool.by_genre[key] || []).slice();
    gridEl.innerHTML = '';
    cells = ids.map(function(id, n) {
      var c = el('div', null, 'casa-card casa-ph');
      c.style.left = (n % COLS) * CELL_W + 'px';
      c.style.top = Math.floor(n / COLS) * ROW_H + 'px';
      gridEl.appendChild(c);
      return c;
    });
    countEl.textContent = ids.length + (opts.movie ? ' film' : ' serie');
    index = 0;
    scrollRow = 0;
    drawChips();
    fill();
  }

  /* A pool title ready to show and to open: TMDB details, its service, the button text. Kept by its key: the same
     number is one series and another film. */
  function resolve(id, done) {
    var key = Core.keyOf(id, opts.movie), o = opts;
    if (items[key]) return done(items[key]);
    U.details(key, function(s) {
      var p = Core.poolItem(o.pool, id), svc = Core.poolService(p);
      if (!s || !s.backdrop) return done(null);
      var direct = svc === 'netflix' && p && p.nf;
      items[key] = {key: key, id: id, movie: !!o.movie, title: s.title, backdrop: s.backdrop, logo: s.logo, logoLang: s.logoLang,
        original: s.original, plot: s.plot, meta: s.meta, metaShort: s.metaShort, trailer: s.trailer, svc: svc,
        entry: {top: 0, tag: null, season: null, netflixId: p && p.nf},
        cta: direct ? 'Guarda su Netflix' : 'Apri ' + (o.services[svc] ? o.services[svc].name : svc)};
      done(items[key]);
    });
  }
  function itemAt(n) { return opts ? items[Core.keyOf(ids[n], opts.movie)] : null; }

  /* "✓ Vista" on the card of a watched title: the list shows them all, watched or not. */
  function seenBadge(cell, item) {
    var old = cell.querySelector('.casa-card-seen'), on = State.seen(item.key);
    if (old && !on) cell.removeChild(old);
    if (!old && on) {
      var v = el('span', null, 'casa-card-seen');
      v.textContent = item.movie ? '✓ Visto' : '✓ Vista';
      cell.appendChild(v);
    }
  }

  /* Cards for the rows on screen and the next one; the others wait as placeholders. */
  function fill() {
    var first = scrollRow * COLS, last = Math.min(ids.length, (scrollRow + 4) * COLS);
    for (var n = first; n < last; n++) (function(n) {
      if (!cells[n] || !cells[n].classList.contains('casa-ph') || cells[n].loading) return;
      cells[n].loading = true;
      var mine = ids, o = opts;
      resolve(ids[n], function(item) {
        if (mine !== ids || o !== opts || !cells[n]) return;   // another genre, or the list closed while the details came
        var b = item && o.badge(item.svc), c = item ? U.card(item, b) : el('div', null, 'casa-card casa-gone');
        if (!item) c.textContent = 'Non disponibile';
        if (item) seenBadge(c, item);
        c.style.left = cells[n].style.left;
        c.style.top = cells[n].style.top;
        gridEl.replaceChild(c, cells[n]);
        cells[n] = c;
        mark();
        if (n === index) feature();
      });
    })(n);
    mark();
  }

  function mark() {
    for (var n = 0; n < cells.length; n++) cells[n].classList.toggle('focused', zone === 'grid' && n === index);
    gridEl.style.transform = 'translateY(' + -scrollRow * ROW_H + 'px)';
  }

  /* The focused title's buttons, under its plot: grey until OK lights the first (the same buttons as Home's). */
  function drawBar() {
    var item = zone === 'grid' ? itemAt(index) : null, later = item && State.later(item.key), seen = item && State.seen(item.key);
    bar = !item ? [] : [{id: 'play', icon: 'play', text: item.cta},
      {id: 'later', icon: later ? 'saved' : 'later', text: later ? 'In lista' : 'Da vedere', on: later},
      {id: 'seen', icon: 'seen', text: item.movie ? 'Già visto' : 'Già vista', on: seen}];
    if (item && item.trailer && U.installed(Core.YOUTUBE)) bar.push({id: 'trailer', icon: 'trailer', text: 'Trailer'});
    lit = Math.min(lit, bar.length - 1);
    barEl.innerHTML = '';
    bar.forEach(function(b, i) {
      var n = el('span', null, 'casa-action' + (b.on ? ' on' : '') + (i === lit ? ' focused' : ''));
      n.innerHTML = U.icon(b.icon) + '<span></span>';
      n.lastChild.textContent = b.text;
      barEl.appendChild(n);
    });
    root.className = lit >= 0 ? 'lit' : '';   // the card whose buttons are lit is marked, not focused
  }
  function press(b) {
    var item = itemAt(index);
    if (!item || !b) return;
    if (b.id === 'later') return State.setLater(item.key, !State.later(item.key), {s: item.svc, nf: item.entry.netflixId});
    if (b.id === 'seen') return State.setSeen(item.key, !State.seen(item.key));   // casa-state.js tells: the button and the card follow
    resumeAt = {genre: shown, index: index, opts: opts};   // back from the app: the list again, on this title
    if (b.id === 'trailer') { if (window.HomeApp) HomeApp.launch(Core.YOUTUBE, 'YouTube', Core.youtubeParams(item.trailer)); }
    else opts.launch(item);
  }

  /* The focused series in the top half: its words here, its picture behind the list (casa-shelf.js, which tints Home). */
  function feature() {
    clearTimeout(featureTimer);
    var item = itemAt(index);
    drawBar();
    if (zone !== 'grid') return;
    if (!item) { infoEl.className = ''; return; }   // not loaded yet, or "Non disponibile": not the title before
    if (item.logo) {
      logoEl.src = U.image('logo', item.logo);
      logoEl.style.display = '';
      nameEl.style.display = 'none';
    } else {
      logoEl.style.display = 'none';
      nameEl.style.display = '';
      nameEl.textContent = item.title;
    }
    var b = opts.badge(item.svc);
    metaEl.innerHTML = '';
    if (b) {
      var badge = el('span', null, 'casa-card-badge ' + b.cls);
      badge.textContent = b.text;
      metaEl.appendChild(badge);
    }
    var other = item.logo && item.logoLang && item.logoLang !== 'it' && item.title !== item.original;   // the name to look for
    metaEl.appendChild(document.createTextNode((item.meta || '') + (other ? '   ·   ' + item.title : '')));
    plotEl.textContent = Core.shortPlot(item.plot, 130);   // two lines
    infoEl.className = 'on';
    featureTimer = setTimeout(function() { Shelf.feature(item); }, FEATURE_MS);   // not every card passed over loads its picture
  }

  function move(step) {
    var next = index + step;
    if (next < 0 || next >= ids.length) return;
    index = next;
    var row = Math.floor(index / COLS);
    if (row < scrollRow) scrollRow = row;
    if (row > scrollRow + 1) scrollRow = row - 1;   // the focused row stays first or second
    fill();
    feature();
  }

  function open(o, at) {
    opts = o;
    lit = -1;
    openedAt = Date.now();
    labelEl.textContent = o.movie ? 'Tutti i film' : 'Tutte le serie';
    genres = genreList(o.pool);
    document.body.classList.add('casa-list');
    root.style.display = '';
    zone = 'grid';
    showGenre(at ? at.genre : 0);
    if (at) {
      index = at.index;
      scrollRow = Math.max(0, Math.floor(index / COLS) - 1);
      fill();
    }
    feature();
  }
  function close(back) {
    if (!opts) return;
    clearTimeout(featureTimer);
    document.body.classList.remove('casa-list');
    root.style.display = 'none';
    infoEl.className = '';
    var o = opts;
    opts = null;
    if (back) resumeAt = null;   // left by hand: a later return from another app does not reopen the list
    if (back && o.back) o.back();
  }

  function onKey(event) {
    if (!opts || document.body.classList.contains('casa-rest')) return;
    var key = event.keyCode;
    if (key === 447 || key === 448 || key === 449 || key === 175 || key === 174 || key === 173) return;   // volume
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'keydown' || event.repeat && key === 13) return;
    if (zone === 'grid' && lit >= 0) {   // a button of the focused title is lit: the keys are the buttons'
      if (key === 37 || key === 39) { lit = Math.max(0, Math.min(bar.length - 1, lit + (key === 39 ? 1 : -1))); drawBar(); }
      // One OK, one action; not the OK that lit the button, still down (this remote repeats a held key as new presses).
      else if (key === 13) { if (!U.repeated(event) && Date.now() - litAt >= 150) { litAt = Date.now(); press(bar[lit]); } }
      else if (key === 40 || key === 461 || key === 27) { lit = -1; drawBar(); }
      return;
    }
    if (key === 461 || key === 27) return close(true);
    if (zone === 'chips') {
      if (key === 37 && genre > 0) { genre--; drawChips(); }
      else if (key === 39 && genre < genres.length - 1) { genre++; drawChips(); }
      else if (key === 13 || key === 40) { zone = 'grid'; showGenre(genre); feature(); }
      return;
    }
    if (key === 37) move(-1);
    else if (key === 39) move(1);
    else if (key === 40) {   // only where a lower row exists: on the last one Down used to slide sideways
      if (Math.floor(index / COLS) < Math.floor((ids.length - 1) / COLS)) move(Math.min(COLS, ids.length - 1 - index));
    }
    else if (key === 38) {
      if (index < COLS) { zone = 'chips'; infoEl.className = ''; drawChips(); mark(); drawBar(); }
      else move(-COLS);
    } else if (key === 13) {
      // Remotes repeat a held OK as new presses: the one that opened the list does not also light a button.
      if (!bar.length || U.repeated(event) || Date.now() - openedAt < 500) return;
      lit = 0;
      litAt = Date.now();
      drawBar();
    }
  }

  function build() {
    root = el('div', 'casaList');
    root.style.display = 'none';
    infoEl = el('div', 'casaListInfo');
    var label = el('div', null, 'casa-list-label');
    labelEl = el('span');
    countEl = el('span', null, 'casa-list-count');
    label.appendChild(labelEl);
    label.appendChild(countEl);
    logoEl = el('img', null, 'casa-list-logo');
    logoEl.crossOrigin = 'anonymous';
    nameEl = el('div', null, 'casa-list-name');
    metaEl = el('div', null, 'casa-list-meta');
    plotEl = el('div', null, 'casa-list-plot');
    barEl = el('div', 'casaListActions');
    [label, logoEl, nameEl, metaEl, plotEl, barEl].forEach(function(n) { infoEl.appendChild(n); });
    chipsEl = el('div', 'casaListChips');
    var viewport = el('div', 'casaListGrid');
    gridEl = el('div', null, 'casa-list-cells');
    viewport.appendChild(gridEl);
    root.appendChild(infoEl);
    root.appendChild(chipsEl);
    root.appendChild(viewport);
    document.body.appendChild(root);
  }

  build();
  // The marks changed (a button here, or the other TV): the buttons' words and the cards' "✓ Vista".
  State.onChange(function() {
    if (!opts) return;
    drawBar();
    for (var n = 0; n < cells.length; n++) { var item = itemAt(n); if (item && !cells[n].classList.contains('casa-ph')) seenBadge(cells[n], item); }
  });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', function(event) {
    if (!opts || document.body.classList.contains('casa-rest')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  // HOME: the list closes. Back from a series opened here: the list again, on that series.
  document.addEventListener('webOSRelaunch', function() { resumeAt = null; close(false); });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden || !resumeAt) return;
    var at = resumeAt;
    setTimeout(function() {
      if (resumeAt !== at) return;
      resumeAt = null;
      // Still open: app.js has put the focus back on the dock, whose titles took the picture behind the list.
      if (!opts) open(at.opts, at); else feature();
    }, 300);
  });
  window.CasaList = {open: function(o) { resumeAt = null; open(o); }, close: function() { resumeAt = null; close(false); },
    isOpen: function() { return !!opts; }};
}());
