/* Fork lorenzoma97, "Casa": the whole Scopri list, from the "Tutte le serie" card after the five. Every series of the
   pool on the owner's services (content.json pool: the best hundred first, then the others), all or by genre: the genres
   on top, a grid of five a row under the focused series' picture and words. Arrows move, OK opens a series (Netflix on
   the title itself) or a genre, Back returns to the five. Details and pictures only for the rows on screen (TMDB, kept by
   casa-shelf.js); coming back from a series opened here returns to it, HOME closes the list. */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf;
  if (!Core || !Shelf) return;
  var U = Shelf.util, COLS = 5, CELL_W = 290, ROW_H = 196, FEATURE_MS = 260;

  var root, infoEl, logoEl, nameEl, metaEl, plotEl, chipsEl, gridEl, countEl;
  var opts = null, genres = [], genre = 0, ids = [], cells = [], items = {}, zone = 'grid', index = 0, scrollRow = 0;
  var featureTimer = null, resumeAt = null;

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }

  /* [{key, label, count}]: "Tutte" first, then the genres with the most series. */
  function genreList(pool) {
    var out = [{key: null, label: 'Tutte', count: allIds(pool).length}], g = pool.genres || {};
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
      var c = el('span', null, 'casa-list-chip' + (i === genre ? ' on' : '') + (zone === 'chips' && i === genre ? ' focused' : ''));
      c.textContent = g.label + '  ' + g.count;
      chipsEl.appendChild(c);
    });
    // The chosen genre stays in view: the row slides under a fixed left edge.
    var chip = chipsEl.children[genre], shift = chip ? Math.max(0, chip.offsetLeft + chip.offsetWidth - 1500) : 0;
    chipsEl.style.transform = 'translateX(' + -shift + 'px)';
  }

  function showGenre(i) {
    genre = i;
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
    countEl.textContent = ids.length === 1 ? '1 serie' : ids.length + ' serie';
    index = 0;
    scrollRow = 0;
    drawChips();
    fill();
  }

  /* A pool series ready to show and to open: TMDB details, its service, the button text. */
  function resolve(id, done) {
    if (items[id]) return done(items[id]);
    U.details(id, function(s) {
      var p = Core.poolItem(opts.pool, id), svc = Core.poolService(p);
      if (!s || !s.backdrop) return done(null);
      var direct = svc === 'netflix' && p && p.nf;
      items[id] = {id: id, title: s.title, backdrop: s.backdrop, logo: s.logo, logoLang: s.logoLang, original: s.original,
        plot: s.plot, meta: s.meta, metaShort: s.metaShort, svc: svc, entry: {top: 0, tag: null, season: null, netflixId: p && p.nf},
        cta: direct ? 'Guarda su Netflix' : 'Apri ' + (opts.services[svc] ? opts.services[svc].name : svc)};
      done(items[id]);
    });
  }

  /* Cards for the rows on screen and the next one; the others wait as placeholders. */
  function fill() {
    var first = scrollRow * COLS, last = Math.min(ids.length, (scrollRow + 4) * COLS), seen = opts.seen();
    for (var n = first; n < last; n++) (function(n) {
      if (!cells[n] || !cells[n].classList.contains('casa-ph') || cells[n].loading) return;
      cells[n].loading = true;
      var mine = ids;
      resolve(ids[n], function(item) {
        if (mine !== ids || !cells[n]) return;
        var b = item && opts.badge(item.svc), c = item ? U.card(item, b) : el('div', null, 'casa-card casa-gone');
        if (!item) c.textContent = 'Non disponibile';
        if (item && seen[item.id]) {
          var v = el('span', null, 'casa-card-seen');
          v.textContent = '✓ Vista';
          c.appendChild(v);
        }
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

  /* The focused series in the top half: its words here, its picture behind the list (casa-shelf.js, which tints Home). */
  function feature() {
    clearTimeout(featureTimer);
    var item = items[ids[index]];
    if (!item || zone !== 'grid') return;
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
    if (back && o.back) o.back();
  }

  function onKey(event) {
    if (!opts || document.body.classList.contains('casa-rest')) return;
    var key = event.keyCode;
    if (key === 447 || key === 448 || key === 449 || key === 175 || key === 174 || key === 173) return;   // volume
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'keydown' || event.repeat && key === 13) return;
    if (key === 461 || key === 27) return close(true);
    if (zone === 'chips') {
      if (key === 37 && genre > 0) { genre--; drawChips(); }
      else if (key === 39 && genre < genres.length - 1) { genre++; drawChips(); }
      else if (key === 13 || key === 40) { zone = 'grid'; showGenre(genre); feature(); }
      return;
    }
    if (key === 37) move(-1);
    else if (key === 39) move(1);
    else if (key === 40) move(Math.min(COLS, ids.length - 1 - index));
    else if (key === 38) {
      if (index < COLS) { zone = 'chips'; infoEl.className = ''; drawChips(); mark(); }
      else move(-COLS);
    } else if (key === 13) {
      var item = items[ids[index]];
      if (!item) return;
      resumeAt = {genre: genre, index: index, opts: opts};
      opts.launch(item);
    }
  }

  function build() {
    root = el('div', 'casaList');
    root.style.display = 'none';
    infoEl = el('div', 'casaListInfo');
    var label = el('div', null, 'casa-list-label');
    label.textContent = 'Tutte le serie';
    countEl = el('span', null, 'casa-list-count');
    label.appendChild(countEl);
    logoEl = el('img', null, 'casa-list-logo');
    logoEl.crossOrigin = 'anonymous';
    nameEl = el('div', null, 'casa-list-name');
    metaEl = el('div', null, 'casa-list-meta');
    plotEl = el('div', null, 'casa-list-plot');
    [label, logoEl, nameEl, metaEl, plotEl].forEach(function(n) { infoEl.appendChild(n); });
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
      if (!opts) open(at.opts, at);
    }, 300);
  });
  window.CasaList = {open: function(o) { resumeAt = null; open(o); }, close: function() { resumeAt = null; close(false); },
    isOpen: function() { return !!opts; }};
}());
