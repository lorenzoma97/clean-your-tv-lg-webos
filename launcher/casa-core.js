/* Fork lorenzoma97, "Casa": what the shelf shows for each streaming app, ported from the Metz add-on (Shelf, Tmdb).
   Data: content.json from lorenzoma97/tv-casa-data (Netflix Top 10 Italia, Novita per service: TMDB ids only) plus
   TMDB details fetched on the TV with the owner's key. Pure rules, no DOM: tests/apps/casa.cjs. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CasaCore = factory();
}(this, function() {
  'use strict';
  var NETFLIX_TOP = 8, NETFLIX_NEW = 4, OTHER_NEW = 10;
  var SEASON = /^.*?:\s*(season|stagione|part|parte|volume)\s+(\d+)\s*$/i;
  /* content.json service -> the webOS app ids that open it (and the browser preview's demo tiles). */
  var APPS = {
    netflix: ['netflix', 'preview.netflix'],
    prime: ['amazon', 'preview.prime'],
    raiplay: ['it.rainet.raiplay'],
    infinity: ['com.5412449.198417']
  };

  function blank(s) { return s === null || s === undefined || String(s).replace(/\s+/g, '') === ''; }
  function opt(x, key) { return x[key] === null || x[key] === undefined ? null : String(x[key]); }

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

  function novitaLine(kind, season) {
    return kind === 'new_series' ? 'Nuova serie' : 'Nuova stagione ' + season;
  }

  /* service -> entries in shelf order, one per series: Netflix Top 10 then its Novita; other services their Novita. */
  function plan(content) {
    var out = {}, services = content && content.services, novita = content && content.novita;
    if (!services) return out;
    ['netflix', 'prime', 'raiplay', 'infinity'].forEach(function(svc) {
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

  /* The plot cut at a sentence, else a word, near max characters. */
  function shortPlot(overview, max) {
    if (overview === null || overview === undefined) return '';
    var s = String(overview).replace(/\s+/g, ' ').replace(/^ | $/g, '');
    if (s.length <= max) return s;
    var cut = s.lastIndexOf('. ', max);
    if (cut > Math.floor(max / 2)) return s.substring(0, cut + 1);
    cut = s.lastIndexOf(' ', max);
    return (cut > 0 ? s.substring(0, cut) : s.substring(0, max)) + '…';
  }

  /* "2024 · Crime · 2 stagioni · ★ 7,8": first year, first genre, seasons or Miniserie, rating once 20 voted. */
  function meta(d) {
    var parts = [], date = d && d.first_air_date;
    if (/^\d{4}/.test(date || '')) parts.push(date.substring(0, 4));
    var genre = d && d.genres && d.genres[0];
    if (genre && !blank(genre.name)) parts.push(String(genre.name).replace(/^\s+|\s+$/g, ''));
    if (d && d.type === 'Miniseries') parts.push('Miniserie');
    else if (d && d.number_of_seasons > 0) parts.push(d.number_of_seasons === 1 ? '1 stagione' : d.number_of_seasons + ' stagioni');
    if (d && d.vote_count >= 20 && d.vote_average > 0) parts.push('★ ' + d.vote_average.toFixed(1).replace('.', ','));
    return parts.length ? parts.join(' · ') : null;
  }

  /* What the shelf keeps of a TMDB details reply (the rest is never stored). */
  function summary(d) {
    return {title: d.name || d.original_name || '', backdrop: backdrop(d), logo: logo(d),
      plot: shortPlot(d.overview, 220), meta: meta(d)};
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

  /* The saved five while they are from today and none was watched since; else five new. */
  function tonight(pool, saved, today, seen, n, random) {
    var ok = saved && saved.day === today && saved.ids && saved.ids.length === n;
    for (var i = 0; ok && i < saved.ids.length; i++) ok = !seen[saved.ids[i]];
    return ok ? saved.ids.slice() : pick(pool, null, seen, {}, n, random);
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

  /* The first webOS app id of a service (the one the TV has). */
  function appOf(svc) { return APPS[svc] ? APPS[svc][0] : null; }

  // ---- weather (Open-Meteo, Bologna; Metz: Weather.java) --------------------------------------

  /* WMO weather code -> Italian words and an icon name (sun, moon, partly, cloud, fog, rain, snow, storm). */
  function describe(code, day) {
    if (code === 0) return ['Sereno', day ? 'sun' : 'moon'];
    if (code === 1) return ['Prevalentemente sereno', day ? 'partly' : 'moon'];
    if (code === 2) return ['Poco nuvoloso', 'partly'];
    if (code === 3) return ['Nuvoloso', 'cloud'];
    if (code === 45 || code === 48) return ['Nebbia', 'fog'];
    if (code >= 51 && code <= 57) return ['Pioviggine', 'rain'];
    if (code >= 61 && code <= 67) return [code >= 65 ? 'Pioggia forte' : 'Pioggia', 'rain'];
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

  return {dominant: dominant,
    plan: plan, serviceOf: serviceOf, appOf: appOf, pick: pick, tonight: tonight, poolItem: poolItem,
    poolService: poolService, describe: describe, air: air, seasonLabel: seasonLabel, topLine: topLine, novitaLine: novitaLine,
    netflixParams: netflixParams, logo: logo, backdrop: backdrop, shortPlot: shortPlot, meta: meta, summary: summary,
    darkLogo: darkLogo, NETFLIX_TOP: NETFLIX_TOP, NETFLIX_NEW: NETFLIX_NEW};
}));
