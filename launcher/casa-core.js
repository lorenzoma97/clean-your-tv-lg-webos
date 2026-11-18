/* Fork lorenzoma97, "Casa": what the shelf shows for each streaming app, ported from the Metz add-on (Shelf, Tmdb).
   Data: content.json from lorenzoma97/tv-casa-data (Netflix Top 10 Italia, Novita per service: TMDB ids only) plus
   TMDB details fetched on the TV with the owner's key. Pure rules, no DOM: tests/apps/casa.cjs. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CasaCore = factory();
}(this, function() {
  'use strict';
  var NETFLIX_TOP = 8, NETFLIX_FILM = 5, NETFLIX_NEW = 4, OTHER_NEW = 10;
  var SEASON = /^.*?:\s*(season|stagione|part|parte|volume)\s+(\d+)\s*$/i;
  /* content.json service -> the webOS app ids that open it (and the browser preview's demo tiles). */
  var APPS = {
    netflix: ['netflix', 'preview.netflix'],
    prime: ['amazon', 'preview.prime'],
    raiplay: ['it.rainet.raiplay'],
    infinity: ['com.5412449.198417'],
    hbomax: ['com.wbd.stream', 'preview.hbomax']
  };
  /* Apps that show sport (content.json sport.broadcast[...].app), and the one that plays trailers. */
  var SPORT_APPS = {dazn: ['dazn']};
  var YOUTUBE = 'youtube.leanback.v4';

  function blank(s) { return s === null || s === undefined || String(s).replace(/\s+/g, '') === ''; }
  function opt(x, key) { return x[key] === null || x[key] === undefined ? null : String(x[key]); }

  /* A title's key wherever it is remembered (seen, Da vedere, the details kept): a series' TMDB id as it is, a film's
     with an "m" in front (TMDB numbers series and films apart: 1399 is a series and another film). */
  function keyOf(id, movie) { return movie ? 'm' + id : +id; }
  function isMovie(key) { return typeof key === 'string' && key.charAt(0) === 'm'; }
  function rawId(key) { return isMovie(key) ? +key.substring(1) : +key; }

  /* "Real Men: Season 2" -> "Stagione 2"; "Below: Limited Series" -> "Miniserie"; anything else -> null. */
  function seasonLabel(name) {
    if (blank(name)) return null;
    var s = String(name).replace(/^\s+|\s+$/g, '');
    if (/limited series$/i.test(s)) return 'Miniserie';
    var m = SEASON.exec(s);
    if (!m) return null;
    var kind = m[1].toLowerCase();
    if (kind === 'season' || kind === 'stagione') return 'Stagione ' + m[2];
    if (kind === 'part' || kind === 'parte') return 'Parte ' + m[2];
    return 'Volume ' + m[2];
  }

  function topLine(rank, season) {
    var s = seasonLabel(season);
    return 'Top 10 in Italia · n. ' + rank + (s ? ' · ' + s : '');
  }

  /* "Novità": out in the last 30 days (the Scopri row, "Scopri una nuova serie", is something else: older, unseen). */
  function novitaLine(kind, season) {
    return kind === 'new_series' ? 'Novità' : 'Nuova stagione ' + season;
  }

  /* service -> entries in shelf order, one per title: Netflix its Top 10 series, its Top 10 films (movie: true), then its
     Novita; the other services their Novita. */
  function plan(content) {
    var out = {}, services = content && content.services, novita = content && content.novita;
    if (!services) return out;
    ['netflix', 'prime', 'raiplay', 'infinity', 'hbomax'].forEach(function(svc) {
      if (!services[svc]) return;
      var list = [], seen = {};
      if (svc === 'netflix') {
        var items = content.top10_netflix && content.top10_netflix.items || [];
        for (var i = 0; i < items.length && list.length < NETFLIX_TOP; i++) {
          var x = items[i] || {}, id = +x.tmdb || 0;
          if (id <= 0 || seen[id]) continue;   // the same series twice in the chart (S1 and S2): once
          seen[id] = true;
          list.push({tmdb: id, line: topLine(x.rank, opt(x, 'season')), netflixId: opt(x, 'netflix_id'),
            top: +x.rank || 0, tag: null, season: seasonLabel(opt(x, 'season'))});
        }
        var films = content.top10_netflix_film && content.top10_netflix_film.items || [], shown = 0;
        for (var f = 0; f < films.length && shown < NETFLIX_FILM; f++) {
          var y = films[f] || {}, fid = +y.tmdb || 0;
          if (fid <= 0 || seen['m' + fid]) continue;
          seen['m' + fid] = true;
          shown++;
          list.push({tmdb: fid, movie: true, line: 'Top 10 film in Italia · n. ' + y.rank, netflixId: opt(y, 'netflix_id'),
            top: +y.rank || 0, tag: null, season: null});
        }
      }
      var news = novita && novita[svc] || [], cap = svc === 'netflix' ? list.length + NETFLIX_NEW : OTHER_NEW;
      for (var j = 0; j < news.length && list.length < cap; j++) {
        var n = news[j] || {}, nid = +n.tmdb || 0;
        if (nid <= 0 || seen[nid]) continue;
        seen[nid] = true;
        var line = novitaLine(n.kind, n.season === null || n.season === undefined ? 1 : n.season);
        list.push({tmdb: nid, line: line, netflixId: opt(n, 'nf'), top: 0, tag: line, season: null});
      }
      if (list.length) out[svc] = list;
    });
    return out;
  }

  function serviceOf(appId) {
    for (var svc in APPS) if (APPS[svc].indexOf(appId) >= 0) return svc;
    return null;
  }
  /* The sport app behind a dock tile ("dazn"), or null. */
  function sportOf(appId) {
    for (var name in SPORT_APPS) if (SPORT_APPS[name].indexOf(appId) >= 0) return name;
    return null;
  }

  /* YouTube opens on a video with this launch parameter (the trailer's key from TMDB: letters, digits, - and _ only). */
  function youtubeParams(key) {
    if (!/^[\w-]{6,20}$/.test(key || '')) return null;
    return {contentTarget: 'https://www.youtube.com/tv?v=' + key};
  }

  /* The Netflix app opens the title itself with this launch parameter (tested on the C3, webOS 26, 2026-10-28). */
  function netflixParams(netflixId) {
    if (!/^\d+$/.test(netflixId || '')) return null;
    return {contentTarget: 'm=https://www.netflix.com/title/' + netflixId + '&source_type=4'};
  }

  /* The title's logo (transparent PNG): Italian, then English, then language-free; best voted; never SVG. */
  function logo(d) {
    var logos = d && d.images && d.images.logos || [];
    var langs = ['it', 'en', null];
    for (var l = 0; l < langs.length; l++) {
      var best = null, score = -1;
      for (var i = 0; i < logos.length; i++) {
        var x = logos[i] || {}, lang = x.iso_639_1 === undefined ? null : x.iso_639_1;
        if (lang !== langs[l] || !/\.png$/.test(x.file_path || '')) continue;
        var v = (x.vote_average || 0) + (x.vote_count || 0) / 1000;
        if (v > score) { score = v; best = x.file_path; }
      }
      if (best) return best;
    }
    return null;
  }

  /* A textless backdrop (the shelf puts its own title on it), the best voted; else the default one. */
  function backdrop(d) {
    var list = d && d.images && d.images.backdrops || [], best = null, score = -1;
    for (var i = 0; i < list.length; i++) {
      var x = list[i] || {};
      if (x.iso_639_1 !== null && x.iso_639_1 !== undefined) continue;
      var v = (x.vote_average || 0) + (x.vote_count || 0) / 1000;
      if (v > score && x.file_path) { score = v; best = x.file_path; }
    }
    if (!best) best = d && d.backdrop_path;
    return blank(best) || best === 'null' ? null : best;
  }

  /* The plot cut at a sentence (when one ends after 60 characters, or half of max for short cuts), else at a word, near
     max characters; no comma or colon left before the ellipsis ("…tra polizia,…" read badly). Same rule as the Metz. */
  function shortPlot(overview, max) {
    if (overview === null || overview === undefined) return '';
    var s = String(overview).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    if (s.length <= max) return s;
    var cut = Math.max(s.lastIndexOf('. ', max), s.lastIndexOf('! ', max), s.lastIndexOf('? ', max));
    if (cut >= Math.min(60, Math.floor(max / 2))) return s.substring(0, cut + 1);
    cut = s.lastIndexOf(' ', max);
    return (cut > 0 ? s.substring(0, cut) : s.substring(0, max)).replace(/[\s,;:\u2013\u2014-]+$/, '') + '…';
  }

  /* TMDB in it-IT leaves some genres in English. */
  var GENRES = {'Action & Adventure': 'Azione e avventura', 'Sci-Fi & Fantasy': 'Fantascienza e fantasy',
    'War & Politics': 'Guerra e politica', 'Kids': 'Per ragazzi', 'News': 'Attualità', 'Talk': 'Talk show',
    'Soap': 'Soap opera', 'Reality': 'Reality', 'Drama': 'Dramma', 'Comedy': 'Commedia', 'Mystery': 'Mistero'};
  function genreIt(name) {
    var s = String(name).replace(/^\s+|\s+$/g, '');
    return GENRES[s] || s;
  }

  /* "2024 · Crime · 2 stagioni · ★ 7,8": first year, first genre, seasons or Miniserie, rating once 20 voted.
     short: genre and rating only, for a title whose badge already says the season (the year made Tulsa King look old). */
  function meta(d, short) {
    var parts = [], date = d && d.first_air_date;
    if (!short && /^\d{4}/.test(date || '')) parts.push(date.substring(0, 4));
    var genre = d && d.genres && d.genres[0];
    if (genre && !blank(genre.name)) parts.push(genreIt(genre.name));
    if (!short && d && d.type === 'Miniseries') parts.push('Miniserie');
    else if (!short && d && d.number_of_seasons > 0) parts.push(d.number_of_seasons === 1 ? '1 stagione' : d.number_of_seasons + ' stagioni');
    if (d && d.vote_count >= 20 && d.vote_average > 0) parts.push('★ ' + d.vote_average.toFixed(1).replace('.', ','));
    return parts.length ? parts.join(' · ') : null;
  }

  /* A film's line: "2024 · Thriller · 1 h 52 min · ★ 7,1". */
  function metaFilm(d) {
    var parts = [], date = d && d.release_date, min = d && +d.runtime || 0;
    if (/^\d{4}/.test(date || '')) parts.push(date.substring(0, 4));
    var genre = d && d.genres && d.genres[0];
    if (genre && !blank(genre.name)) parts.push(genreIt(genre.name));
    if (min > 0) parts.push((min >= 60 ? Math.floor(min / 60) + ' h' : '') + (min >= 60 && min % 60 ? ' ' : '') + (min % 60 ? min % 60 + ' min' : ''));
    if (d && d.vote_count >= 20 && d.vote_average > 0) parts.push('★ ' + d.vote_average.toFixed(1).replace('.', ','));
    return parts.length ? parts.join(' · ') : null;
  }

  /* The trailer to play on YouTube: a trailer before a teaser, Italian before English, the official one first. */
  function trailer(d) {
    var list = d && d.videos && d.videos.results || [], best = null, score = -1;
    for (var i = 0; i < list.length; i++) {
      var x = list[i] || {};
      if (x.site !== 'YouTube' || !youtubeParams(x.key) || (x.type !== 'Trailer' && x.type !== 'Teaser')) continue;
      var v = (x.type === 'Trailer' ? 4 : 0) + (x.iso_639_1 === 'it' ? 2 : 0) + (x.official ? 1 : 0);
      if (v > score) { score = v; best = x.key; }
    }
    return best;
  }

  // ---- when: a season's start, the next episode, the chart's week -----------------------------------

  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre',
    'novembre', 'dicembre'];
  var DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function days(from, to) { return Math.round((to - new Date(from.getFullYear(), from.getMonth(), from.getDate())) / 864e5); }

  /* "9 ottobre" ("9 ottobre 2025" in another year). */
  function dateIt(iso, now) {
    var d = day(iso);
    if (!d) return null;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
  }

  /* The Novità badge with its date: "Nuova stagione 3 · dal 9 ottobre", "Novità · dal 2 ottobre". */
  function whenTag(entry, s, now) {
    if (!entry || !entry.tag) return entry ? entry.tag : null;
    var n = /(\d+)$/.exec(entry.tag), start = s && s.seasonsAir && s.seasonsAir[n ? n[1] : 1];
    var label = start ? dateIt(start, now) : null;
    return label ? entry.tag + ' · dal ' + label : entry.tag;
  }

  /* "Nuovo episodio ven 6 nov" when the next one airs within two weeks, else null. */
  function nextEpisode(s, now) {
    var d = day(s && s.next);
    if (!d) return null;
    var gap = days(now, d);
    if (gap < 0 || gap > 14) return null;
    if (gap === 0) return 'Nuovo episodio oggi';
    if (gap === 1) return 'Nuovo episodio domani';
    return 'Nuovo episodio ' + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].substring(0, 3);
  }

  /* The chart's week, from its last day: "12–18 ottobre" (or "28 settembre – 4 ottobre"). */
  function weekIt(end) {
    var e = day(end);
    if (!e) return null;
    var s = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 6);
    return s.getMonth() === e.getMonth() ? s.getDate() + '–' + e.getDate() + ' ' + MONTHS[e.getMonth()]
      : s.getDate() + ' ' + MONTHS[s.getMonth()] + ' – ' + e.getDate() + ' ' + MONTHS[e.getMonth()];
  }

  /* A chart more than 16 days past its week says nothing about now: no "N. 1 in Italia" then. */
  function staleWeek(end, now) {
    var e = day(end);
    return !e || days(e, now) > 16;
  }

  /* What the shelf keeps of a TMDB details reply (the rest is never stored): the plot long enough for the detail, the
     seasons' first days and the next episode (the "when"), the logo's language (an English logo gets the Italian title),
     the trailer's YouTube key. movie: the reply is a film's (title and release_date where a series has name and
     first_air_date). */
  function summary(d, movie) {
    var seasons = {}, list = d.seasons || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].season_number > 0 && list[i].air_date) seasons[list[i].season_number] = list[i].air_date;
    var lg = logo(d), lang = null, logos = d.images && d.images.logos || [];
    for (var j = 0; j < logos.length; j++) if (logos[j] && logos[j].file_path === lg) lang = logos[j].iso_639_1 || null;
    var name = movie ? d.title || d.original_title : d.name || d.original_name, first = movie ? d.original_title : d.original_name;
    return {title: name || '', backdrop: backdrop(d), logo: lg, logoLang: lang,
      original: first || '', plot: shortPlot(d.overview, 400), meta: movie ? metaFilm(d) : meta(d),
      metaShort: movie ? metaFilm(d) : meta(d, true), seasonsAir: seasons,
      next: d.next_episode_to_air && d.next_episode_to_air.air_date || null, trailer: trailer(d)};
  }

  /* A logo drawn for light backgrounds (black lettering): most solid pixels dark, and not a solid plate.
     rgba: the RGBA bytes of the logo (canvas getImageData). Same rule as the Metz (ContentShelf.darkLogo). */
  function darkLogo(rgba) {
    var solid = 0, dark = 0, pixels = Math.floor(rgba.length / 4);
    for (var i = 0; i < pixels * 4; i += 4) {
      if (rgba[i + 3] < 128) continue;
      solid++;
      if (Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < 100) dark++;
    }
    return solid > 0 && solid < pixels * 0.7 && dark >= solid * 0.65;
  }

  // ---- Scopri: tonight's five from the pool (Metz: Pool.java) ------------------------------------

  /* Pool ids for a genre (null: all), best first, without the watched and the skipped. */
  function candidates(pool, genre, seen, skipped) {
    var ids = (genre === null ? pool && pool.all : pool && pool.by_genre && pool.by_genre[genre]) || [];
    return ids.filter(function(id) { return id > 0 && !seen[id] && !skipped[id]; });
  }

  /* n different titles in random order (random: a function returning [0, 1)); repeats rather than a short row. */
  function pick(pool, genre, seen, avoid, n, random) {
    var c = candidates(pool, genre, seen, avoid);
    if (c.length < n) c = candidates(pool, genre, seen, {});
    for (var i = c.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1)), t = c[i];
      c[i] = c[j];
      c[j] = t;
    }
    return c.slice(0, n);
  }

  /* The saved five while they are from today and none was watched since; else five new, not among the ones shown lately
     (avoid: {id: true}) while the pool has others. */
  function tonight(pool, saved, today, seen, n, random, avoid) {
    var ok = saved && saved.day === today && saved.ids && saved.ids.length === n;
    for (var i = 0; ok && i < saved.ids.length; i++) ok = !seen[saved.ids[i]];
    return ok ? saved.ids.slice() : pick(pool, null, seen, avoid || {}, n, random);
  }

  function poolItem(pool, id) {
    var items = pool && pool.items || [];
    for (var i = 0; i < items.length; i++) if (items[i].tmdb === id) return items[i];
    return null;
  }

  /* The service OK opens for a pool title: Netflix first when it has it (the one with a direct link). */
  function poolService(item) {
    var s = item && item.s || [];
    return s.indexOf('netflix') >= 0 ? 'netflix' : s[0] || null;
  }

  /* The first webOS app id of a service or of a sport app (the one the TV has). */
  function appOf(svc) { return APPS[svc] ? APPS[svc][0] : SPORT_APPS[svc] ? SPORT_APPS[svc][0] : null; }

  // ---- sport (content.json "sport": football and Formula 1 of the next days) ----------------------

  var LIVE_MS = 2 * 3600 * 1000;   // a match or a race counts as under way for two hours from its start
  function two(n) { return (n < 10 ? '0' : '') + n; }

  /* "Inter – Milan"; for a Grand Prix its name ("GP di Las Vegas": the session goes in the badges). */
  function eventTitle(ev) {
    return ev.home && ev.away ? ev.home + ' – ' + ev.away : ev.title || '';
  }

  /* When, in the viewer's time: "In corso", "Oggi · 20:45", "Domani · 18:00", "sab 22 nov · 20:45". */
  function eventWhen(ev, now) {
    var t = new Date(ev.start), hm = two(t.getHours()) + ':' + two(t.getMinutes());
    if (now >= t && now - t < LIVE_MS) return 'In corso';
    var gap = days(now, new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    if (gap === 0) return 'Oggi · ' + hm;
    if (gap === 1) return 'Domani · ' + hm;
    return DAYS[t.getDay()] + ' ' + t.getDate() + ' ' + MONTHS[t.getMonth()].substring(0, 3) + ' · ' + hm;
  }

  /* The events not over yet, soonest first. opts.today: only this calendar day's; opts.app: only those the app shows
     (sport.broadcast[comp].app); opts.max: at most that many, the Italian clubs' and Formula 1 before the others. */
  function events(sport, now, opts) {
    var list = sport && sport.events || [], where = sport && sport.broadcast || {}, out = [];
    opts = opts || {};
    for (var i = 0; i < list.length; i++) {
      var ev = list[i] || {}, t = new Date(ev.start);
      if (!ev.comp || isNaN(t) || now - t >= LIVE_MS) continue;
      if (opts.today && days(now, new Date(t.getFullYear(), t.getMonth(), t.getDate())) !== 0) continue;
      if (opts.app && (!where[ev.comp] || where[ev.comp].app !== opts.app)) continue;
      out.push(ev);
    }
    var byTime = function(a, b) { return new Date(a.start) - new Date(b.start); };
    out.sort(byTime);
    if (opts.max && out.length > opts.max) {
      var first = out.filter(function(e) { return e.it || !e.home; }), rest = out.filter(function(e) { return !e.it && e.home; });
      out = first.concat(rest).slice(0, opts.max).sort(byTime);
    }
    return out;
  }

  // ---- what the owner marked: seen titles and "Da vedere", the same on every TV ---------------------

  /* state: {seen: {key: ±ms}, later: {key: {t: ms, on: 0|1, s: service, nf: Netflix id}}}; key as keyOf() gives it.
     A negative time in seen is a mark taken back. Two copies (this TV's and the shared one) merge title by title: the
     newer mark wins, so a title marked on one TV and unmarked later on the other ends up unmarked on both. At the very
     same time the mark taken back wins, whichever copy comes first: both TVs must reach the same state. */
  function mergeState(a, b) {
    var out = {seen: {}, later: {}};
    [a, b].forEach(function(s) {
      var seen = s && s.seen || {}, later = s && s.later || {}, k;
      for (k in seen) {
        var v = seen[k], w = out.seen[k];
        if (typeof v !== 'number' || !v) continue;
        if (w === undefined || Math.abs(v) > Math.abs(w) || Math.abs(v) === Math.abs(w) && v < w) out.seen[k] = v;
      }
      for (k in later) {
        var x = later[k], y = out.later[k];
        if (!x || typeof x.t !== 'number') continue;
        if (!y || x.t > y.t || x.t === y.t && !x.on && y.on) out.later[k] = x;
      }
    });
    return out;
  }

  /* A copy of a state with only what can be trusted: keys that are a title's (digits, or "m" and digits), times that
     are whole numbers, not zero and not absurd, services in small letters and Netflix ids in digits. The shared file and
     this TV's own copy are read through this: a line written by hand, or by a bug, must not stop the two TVs sharing (a
     null entry threw, and a letter outside Latin-1 made the file impossible to write).
     Not judged against this TV's clock: a TV that starts with a wrong date would throw every mark away, here and, at
     its next write, on the other TV. A mark dated ahead can still be taken back (casa-state.js stamps a new mark after
     the one it replaces). */
  var STATE_KEY = /^m?[1-9]\d{0,14}$/, STATE_TIME = 1e14;   // year 5138: beyond it a time is a mistake
  function cleanState(s) {
    var out = {seen: {}, later: {}}, seen = s && s.seen, later = s && s.later, k;
    if (seen && typeof seen === 'object') {
      for (k in seen) {
        var v = seen[k];
        if (STATE_KEY.test(k) && typeof v === 'number' && Math.round(v) && Math.abs(v) <= STATE_TIME) out.seen[k] = Math.round(v);
      }
    }
    if (later && typeof later === 'object') {
      for (k in later) {
        var x = later[k];
        if (!STATE_KEY.test(k) || !x || typeof x !== 'object' || typeof x.t !== 'number' || !(x.t >= 1) || x.t > STATE_TIME) continue;
        out.later[k] = {t: Math.round(x.t), on: x.on ? 1 : 0, s: /^[a-z]{1,20}$/.test(x.s || '') ? x.s : null,
          nf: /^\d{1,20}$/.test(x.nf || '') ? String(x.nf) : null};
      }
    }
    return out;
  }

  /* The state as text, always the same for the same marks (keys in order): what is saved, shared and compared. */
  function stateText(s) {
    var out = {seen: {}, later: {}};
    Object.keys(s && s.seen || {}).sort().forEach(function(k) { out.seen[k] = s.seen[k]; });
    Object.keys(s && s.later || {}).sort().forEach(function(k) {
      var x = s.later[k];
      out.later[k] = {t: x.t, on: x.on ? 1 : 0, s: x.s || null, nf: x.nf || null};
    });
    return JSON.stringify(out);
  }

  // ---- weather (Open-Meteo, Bologna; Metz: Weather.java) --------------------------------------

  /* WMO weather code -> Italian words and an icon name (sun, moon, partly, cloud, fog, rain, snow, storm). */
  function describe(code, day) {
    if (code === 0) return ['Sereno', day ? 'sun' : 'moon'];
    if (code === 1) return ['Prevalentemente sereno', day ? 'partly' : 'moon'];
    if (code === 2) return ['Poco nuvoloso', 'partly'];
    if (code === 3) return ['Nuvoloso', 'cloud'];
    if (code === 45 || code === 48) return ['Nebbia', 'fog'];
    if (code >= 51 && code <= 57) return ['Pioviggine', 'rain'];
    if (code === 66 || code === 67) return ['Pioggia gelata', 'rain'];
    if (code >= 61 && code <= 65) return [code === 65 ? 'Pioggia forte' : 'Pioggia', 'rain'];
    if (code >= 71 && code <= 77) return ['Neve', 'snow'];
    if (code >= 80 && code <= 82) return ['Rovesci', 'rain'];
    if (code === 85 || code === 86) return ['Rovesci di neve', 'snow'];
    if (code >= 95) return ['Temporale', 'storm'];
    return ['', 'cloud'];
  }

  /* European AQI bands (EEA). */
  function air(aqi) {
    if (aqi === null || aqi === undefined || aqi < 0) return null;
    if (aqi <= 20) return 'Aria buona';
    if (aqi <= 40) return 'Aria discreta';
    if (aqi <= 60) return 'Aria moderata';
    if (aqi <= 80) return 'Aria scadente';
    if (aqi <= 100) return 'Aria molto scadente';
    return 'Aria pessima';
  }

  // ---- Developer Mode -------------------------------------------------------------------------

  /* The Developer Mode session as the renewal service last saw it (its status reply's state): [title, what to do] when
     it has run out, when under three days are left, or when the renewal has failed four times running (seven hours and
     more); null while all is well, and when the owner turned the renewal off (their choice: no nagging). Short: the
     note in the top bar has room for some 25 letters a line. */
  function devWarning(state, now) {
    var last = state && state.last || {}, todo = 'Apri l’app e premi EXTEND';
    if (!state || !state.enabled) return null;
    if (last.status === 'expired') return ['Developer Mode scaduta', 'Dal PC: Ripristina Home LG'];
    if (typeof last.remainingSeconds === 'number' && typeof last.checkedAt === 'number') {
      var hours = Math.floor(Math.max(0, last.remainingSeconds - (now - last.checkedAt) / 1000) / 3600);
      if (hours < 72) return ['Developer Mode: ' + (hours < 48 ? hours === 1 ? '1 ora' : hours + ' ore' : Math.floor(hours / 24) + ' giorni'), todo];
      return null;
    }
    if (last.status && last.status !== 'healthy' && last.status !== 'renewed' && last.failures >= 4) return ['Developer Mode: non rinnovata', todo];
    return null;
  }

  // ---- colour and light ------------------------------------------------------------------------

  /* The picture's most vivid colour, lifted for a glow; a nearly grey picture gives its average. rgba: canvas bytes. */
  function dominant(rgba) {
    var best = null, bestScore = -1, sum = [0, 0, 0], n = 0;
    for (var i = 0; i + 3 < rgba.length; i += 4) {
      var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], max = Math.max(r, g, b), min = Math.min(r, g, b);
      sum[0] += r; sum[1] += g; sum[2] += b; n++;
      var score = (max ? (max - min) / max : 0) * Math.min(1, max / 255 * 1.4);
      if (score > bestScore) { bestScore = score; best = [r, g, b]; }
    }
    if (!n) return [68, 68, 68];
    var c = bestScore < 0.25 ? [sum[0] / n, sum[1] / n, sum[2] / n] : best;
    var top = Math.max(c[0], c[1], c[2]) || 1, lift = Math.max(1, 150 / top);   // at least 150 on its brightest channel
    return [Math.min(255, Math.round(c[0] * lift)), Math.min(255, Math.round(c[1] * lift)), Math.min(255, Math.round(c[2] * lift))];
  }

  return {dominant: dominant, keyOf: keyOf, isMovie: isMovie, rawId: rawId, sportOf: sportOf, youtubeParams: youtubeParams,
    YOUTUBE: YOUTUBE, metaFilm: metaFilm, trailer: trailer, eventTitle: eventTitle, eventWhen: eventWhen, events: events,
    mergeState: mergeState, stateText: stateText, cleanState: cleanState, devWarning: devWarning, NETFLIX_FILM: NETFLIX_FILM,
    plan: plan, serviceOf: serviceOf, appOf: appOf, pick: pick, tonight: tonight, poolItem: poolItem,
    poolService: poolService, describe: describe, air: air, seasonLabel: seasonLabel, topLine: topLine, novitaLine: novitaLine,
    genreIt: genreIt, dateIt: dateIt, whenTag: whenTag, nextEpisode: nextEpisode, weekIt: weekIt, staleWeek: staleWeek,
    netflixParams: netflixParams, logo: logo, backdrop: backdrop, shortPlot: shortPlot, meta: meta, summary: summary,
    darkLogo: darkLogo, NETFLIX_TOP: NETFLIX_TOP, NETFLIX_NEW: NETFLIX_NEW};
}));
