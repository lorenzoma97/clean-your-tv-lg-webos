// Fork lorenzoma97: the Casa shelf rules, the same cases as the Metz add-on's ShelfTest.
const assert = require('node:assert/strict');
const Casa = require('../../launcher/casa-core');

assert.equal(Casa.seasonLabel('Real Men: Season 2'), 'Stagione 2');
assert.equal(Casa.seasonLabel('Below: Limited Series'), 'Miniserie');
assert.equal(Casa.seasonLabel('Money Heist: Part 3'), 'Parte 3');
assert.equal(Casa.seasonLabel('Stranger Things: Volume 2'), 'Volume 2');
assert.equal(Casa.seasonLabel(null), null);
assert.equal(Casa.seasonLabel('null'), null);
assert.equal(Casa.seasonLabel('Some Show'), null);

assert.equal(Casa.topLine(1, 'Below: Limited Series'), 'Top 10 in Italia · n. 1 · Miniserie');
assert.equal(Casa.topLine(7, null), 'Top 10 in Italia · n. 7');
assert.equal(Casa.novitaLine('new_series', 1), 'Novità');
assert.equal(Casa.novitaLine('new_season', 4), 'Nuova stagione 4');

assert.deepEqual(Casa.netflixParams('81652677'), {contentTarget: 'm=https://www.netflix.com/title/81652677&source_type=4'});
assert.equal(Casa.netflixParams(null), null);
assert.equal(Casa.netflixParams('81652677&source_type=0'), null, 'never splice anything but digits');

// Plan: rank 8 is the same series as rank 2 (Maschi veri S1 and S2), and 101 is in both the Top 10 and Novita.
const top = [];
for (let i = 1; i <= 10; i++) top.push({rank: i, tmdb: i === 8 ? 102 : 100 + i, season: null, netflix_id: '5' + i});
const plan = Casa.plan({
  services: {netflix: {name: 'Netflix'}, prime: {name: 'Prime Video'}, infinity: {name: 'Mediaset Infinity'}},
  top10_netflix: {items: top},
  novita: {
    netflix: [{tmdb: 101, kind: 'new_series', season: 1}, {tmdb: 900, kind: 'new_season', season: 3, nf: '77'},
      {tmdb: 901, kind: 'new_series', season: 1}, {tmdb: 902, kind: 'new_series', season: 1},
      {tmdb: 903, kind: 'new_series', season: 1}, {tmdb: 904, kind: 'new_series', season: 1}],
    prime: [{tmdb: 300, kind: 'new_season', season: 2}], infinity: []
  }
});
const nf = plan.netflix;
assert.equal(nf.length, Casa.NETFLIX_TOP + Casa.NETFLIX_NEW);
assert.equal(nf[0].tmdb, 101);
assert.equal(nf[0].netflixId, '51');
assert.equal(new Set(nf.map(e => e.tmdb)).size, nf.length, 'one entry per series');
assert.equal(nf[Casa.NETFLIX_TOP].tmdb, 900, '101 is already in the Top 10: Novita starts at 900');
assert.equal(nf[Casa.NETFLIX_TOP].line, 'Nuova stagione 3');
assert.equal(nf[Casa.NETFLIX_TOP].netflixId, '77');
assert.equal(nf[Casa.NETFLIX_TOP].tag, 'Nuova stagione 3');
assert.equal(nf[0].top, 1);
assert.equal(nf[0].tag, null);
assert.equal(plan.prime.length, 1);
assert.equal(plan.infinity, undefined, 'nothing to show: no entry, the tile keeps its own look');
assert.equal(Casa.serviceOf('netflix'), 'netflix');
assert.equal(Casa.serviceOf('amazon'), 'prime');
assert.equal(Casa.serviceOf('youtube.leanback.v4'), null);

// Logo: Italian first, never SVG; textless backdrop; plot cut at a sentence or a word.
const d = {images: {logos: [
  {file_path: '/en.png', iso_639_1: 'en', vote_average: 5.4},
  {file_path: '/it.svg', iso_639_1: 'it', vote_average: 9},
  {file_path: '/it.png', iso_639_1: 'it', vote_average: 5.1}],
  backdrops: [{file_path: '/text.jpg', iso_639_1: 'en', vote_average: 9}, {file_path: '/clean.jpg', iso_639_1: null, vote_average: 5}]}};
assert.equal(Casa.logo(d), '/it.png');
assert.equal(Casa.logo({images: {logos: []}}), null);
assert.equal(Casa.backdrop(d), '/clean.jpg');
assert.equal(Casa.backdrop({backdrop_path: '/default.jpg'}), '/default.jpg');
assert.equal(Casa.shortPlot('Breve.', 170), 'Breve.');
assert.equal(Casa.shortPlot('Prima frase abbastanza lunga da contare. Seconda frase che non entra nel limite dei caratteri.', 60),
  'Prima frase abbastanza lunga da contare.');
assert.ok(Casa.shortPlot('parola '.repeat(40), 50).endsWith('…'));
assert.equal(Casa.shortPlot('La famiglia McClusky è l’intermediario tra polizia, criminali e detenuti della città.', 52),
  'La famiglia McClusky è l’intermediario tra polizia…', 'no comma before the ellipsis');

assert.equal(Casa.meta({first_air_date: '2024-03-01', genres: [{name: 'Crime'}, {name: 'Dramma'}],
  number_of_seasons: 2, vote_average: 7.84, vote_count: 312}), '2024 · Crime · 2 stagioni · ★ 7,8');
assert.equal(Casa.meta({first_air_date: '2025-01-09', type: 'Miniseries', number_of_seasons: 1,
  vote_average: 9.5, vote_count: 4}), '2025 · Miniserie');
assert.equal(Casa.meta({first_air_date: null, genres: []}), null);
assert.equal(Casa.meta({first_air_date: '2022-11-13', genres: [{name: 'Crime'}], number_of_seasons: 4, vote_average: 8.3, vote_count: 900}, true),
  'Crime · ★ 8,3', 'with a season badge: no year, no seasons');
assert.equal(Casa.genreIt('Action & Adventure'), 'Azione e avventura');
assert.equal(Casa.genreIt('Crime'), 'Crime');

// When: the Novità badge's date, the next episode within two weeks, the chart's week.
const oct30 = new Date(2026, 9, 30);
assert.equal(Casa.whenTag({tag: 'Nuova stagione 3'}, {seasonsAir: {3: '2026-10-09'}}, oct30), 'Nuova stagione 3 · dal 9 ottobre');
assert.equal(Casa.whenTag({tag: 'Novità'}, {seasonsAir: {1: '2025-12-01'}}, oct30), 'Novità · dal 1 dicembre 2025');
assert.equal(Casa.whenTag({tag: 'Novità'}, {seasonsAir: {}}, oct30), 'Novità');
assert.equal(Casa.whenTag({tag: null}, {}, oct30), null);
assert.equal(Casa.nextEpisode({next: '2026-11-06'}, oct30), 'Nuovo episodio ven 6 nov');
assert.equal(Casa.nextEpisode({next: '2026-10-31'}, oct30), 'Nuovo episodio domani');
assert.equal(Casa.nextEpisode({next: '2026-12-25'}, oct30), null);
assert.equal(Casa.nextEpisode({next: null}, oct30), null);
assert.equal(Casa.weekIt('2026-10-18'), '12–18 ottobre');
assert.equal(Casa.weekIt('2026-10-04'), '28 settembre – 4 ottobre');
assert.equal(Casa.staleWeek('2026-10-18', oct30), false);
assert.equal(Casa.staleWeek('2026-10-04', oct30), true);
const sum = Casa.summary({name: 'Treasure Island', original_name: 'Treasure Island', overview: 'x', seasons: [{season_number: 0, air_date: '2020-01-01'},
  {season_number: 1, air_date: '2026-10-02'}], next_episode_to_air: {air_date: '2026-11-06'},
  images: {logos: [{file_path: '/en.png', iso_639_1: 'en'}], backdrops: []}});
assert.deepEqual([sum.seasonsAir, sum.next, sum.logoLang], [{1: '2026-10-02'}, '2026-11-06', 'en']);

// Dark logos: black lettering turns white; a dark plate with light text, and red or yellow logos, stay.
function px(list) { return Uint8ClampedArray.from(list.flatMap(p => [(p >> 16) & 255, (p >> 8) & 255, p & 255, (p >>> 24) & 255])); }
const clear = 0x00000000, black = 0xFF101010, red = 0xFFE50914, yellow = 0xFFF5C518;
assert.ok(Casa.darkLogo(px([black, black, black, yellow, clear, clear, clear, clear, clear, clear])));
assert.ok(!Casa.darkLogo(px([red, red, red, clear, clear, clear, clear, clear, clear, clear])));
assert.ok(!Casa.darkLogo(px([black, black, black, black, black, black, black, black, black, clear])), 'a plate');
assert.ok(!Casa.darkLogo(px([clear, clear])));

// Scopri: tonight's five never repeat a watched title, and stay the same for the day.
const pool = {all: [1, 2, 3, 4, 5, 6, 7], items: [{tmdb: 3, s: ['prime', 'netflix'], nf: '9'}, {tmdb: 4, s: ['raiplay']}]};
let calls = 0;
const random = () => (calls++ % 10) / 10;
const five = Casa.pick(pool, null, {2: true}, {}, 5, random);
assert.equal(five.length, 5);
assert.ok(!five.includes(2), 'a watched title never comes back');
assert.equal(new Set(five).size, 5);
assert.deepEqual(Casa.tonight(pool, {day: '2026-10-29', ids: [1, 3, 4, 5, 6]}, '2026-10-29', {}, 5, random), [1, 3, 4, 5, 6]);
assert.notDeepEqual(Casa.tonight(pool, {day: '2026-10-28', ids: [1, 3, 4, 5, 6]}, '2026-10-29', {1: true}, 5, random), [1, 3, 4, 5, 6]);
assert.equal(Casa.poolService(Casa.poolItem(pool, 3)), 'netflix', 'Netflix first: it opens the title itself');
assert.equal(Casa.poolService(Casa.poolItem(pool, 4)), 'raiplay');
assert.equal(Casa.appOf('prime'), 'amazon');
assert.equal(Casa.appOf('hbomax'), 'com.wbd.stream');
assert.equal(Casa.serviceOf('com.wbd.stream'), 'hbomax');
// Shown lately: not again today while the pool has others (7 titles, 5 avoided: only 2 and 7 are left, then the rest).
assert.deepEqual(Casa.tonight(pool, null, '2026-10-29', {}, 2, random, {1: true, 3: true, 4: true, 5: true, 6: true}).sort(), [2, 7]);
assert.equal(Casa.describe(66, true)[0], 'Pioggia gelata');
assert.equal(Casa.describe(65, true)[0], 'Pioggia forte');

// Films: their own keys (TMDB numbers series and films apart), their line, their place on Netflix's shelf.
assert.equal(Casa.keyOf(1399, false), 1399);
assert.equal(Casa.keyOf(1399, true), 'm1399');
assert.deepEqual([Casa.isMovie('m1399'), Casa.isMovie(1399), Casa.isMovie('1399')], [true, false, false]);
assert.deepEqual([Casa.rawId('m1399'), Casa.rawId('1399'), Casa.rawId(1399)], [1399, 1399, 1399]);
assert.equal(Casa.metaFilm({release_date: '2024-05-01', genres: [{name: 'Thriller'}], runtime: 112, vote_average: 7.12, vote_count: 900}),
  '2024 · Thriller · 1 h 52 min · ★ 7,1');
assert.equal(Casa.metaFilm({release_date: '2021-01-01', genres: [], runtime: 120, vote_count: 3}), '2021 · 2 h');
assert.equal(Casa.metaFilm({runtime: 45}), '45 min');
assert.equal(Casa.metaFilm({}), null);
const videos = [
  {site: 'YouTube', type: 'Teaser', key: 'teaser00001', iso_639_1: 'it', official: true},
  {site: 'YouTube', type: 'Trailer', key: 'trailerEN01', iso_639_1: 'en', official: true},
  {site: 'YouTube', type: 'Trailer', key: 'trailerIT01', iso_639_1: 'it', official: false},
  {site: 'Vimeo', type: 'Trailer', key: 'vimeo000001', iso_639_1: 'it', official: true},
  {site: 'YouTube', type: 'Featurette', key: 'feature0001', iso_639_1: 'it', official: true}];
assert.equal(Casa.trailer({videos: {results: videos}}), 'trailerIT01', 'a trailer before a teaser, Italian before official English');
assert.equal(Casa.trailer({videos: {results: videos.slice(0, 1)}}), 'teaser00001');
assert.equal(Casa.trailer({videos: {results: [{site: 'YouTube', type: 'Trailer', key: 'bad key&x=1'}]}}), null);
assert.equal(Casa.trailer({}), null);
assert.deepEqual(Casa.youtubeParams('g2vsb6Id7fE'), {contentTarget: 'https://www.youtube.com/tv?v=g2vsb6Id7fE'});
assert.equal(Casa.youtubeParams('a&b=c'), null, 'never splice anything but a video key');
const film = Casa.summary({title: 'Io capitano', original_title: 'Io Capitano', release_date: '2023-09-07', runtime: 121, overview: 'x',
  genres: [{name: 'Avventura'}], vote_average: 7.8, vote_count: 500, images: {logos: [], backdrops: []},
  videos: {results: videos}}, true);
assert.deepEqual([film.title, film.original, film.meta, film.metaShort, film.trailer],
  ['Io capitano', 'Io Capitano', '2023 · Avventura · 2 h 1 min · ★ 7,8', '2023 · Avventura · 2 h 1 min · ★ 7,8', 'trailerIT01']);
assert.equal(sum.trailer, null);
const films = [];
for (let i = 1; i <= 8; i++) films.push({rank: i, tmdb: i === 2 ? null : 100 + i, netflix_id: i === 1 ? '9' : null});
const withFilms = Casa.plan({services: {netflix: {name: 'Netflix'}}, top10_netflix: {items: top},
  top10_netflix_film: {items: films}, novita: {netflix: [{tmdb: 900, kind: 'new_series', season: 1}]}}).netflix;
assert.equal(withFilms.length, Casa.NETFLIX_TOP + Casa.NETFLIX_FILM + 1);
assert.deepEqual(withFilms[Casa.NETFLIX_TOP], {tmdb: 101, movie: true, line: 'Top 10 film in Italia · n. 1', netflixId: '9', top: 1, tag: null, season: null},
  'film 101 stays though series 101 is in the chart: another title');
assert.equal(withFilms[Casa.NETFLIX_TOP + 1].tmdb, 103, 'a film the chart could not match is skipped');
assert.equal(withFilms[Casa.NETFLIX_TOP + Casa.NETFLIX_FILM].tmdb, 900, 'Novita after the films');
assert.ok(!withFilms[0].movie);

// Sport: what is on, when (in the viewer's time), and which events a place shows.
const at = (d, h, m) => new Date(2026, 10, d, h, m).toISOString();
const sport = {broadcast: {seriea: {name: 'Serie A', where: 'DAZN', app: 'dazn'}, champions: {name: 'Champions League', where: 'Sky · NOW', app: null},
  f1: {name: 'Formula 1', where: 'Sky · NOW', app: null}},
  events: [{comp: 'f1', start: at(23, 5, 0), title: 'GP di Las Vegas', session: 'Gara'},
    {comp: 'seriea', start: at(22, 20, 45), home: 'Inter', away: 'Milan', it: true},
    {comp: 'champions', start: at(22, 21, 0), home: 'Lille', away: 'Bayern Monaco', it: false},
    {comp: 'seriea', start: at(21, 15, 0), home: 'Parma', away: 'Roma', it: true},
    {comp: 'champions', start: at(22, 18, 45), home: 'Como', away: 'AEK Athens', it: true},
    {comp: 'champions', start: 'not a date', home: 'x', away: 'y'}]};
const sunday = new Date(2026, 10, 22, 21, 30);
assert.equal(Casa.eventTitle(sport.events[1]), 'Inter – Milan');
assert.equal(Casa.eventTitle(sport.events[0]), 'GP di Las Vegas');
assert.equal(Casa.eventWhen(sport.events[1], sunday), 'In corso', 'started 45 minutes ago');
assert.equal(Casa.eventWhen(sport.events[2], new Date(2026, 10, 22, 12, 0)), 'Oggi · 21:00');
assert.equal(Casa.eventWhen(sport.events[0], sunday), 'Domani · 05:00');
assert.equal(Casa.eventWhen(sport.events[0], new Date(2026, 10, 20, 9, 0)), 'lun 23 nov · 05:00');
const names = list => list.map(Casa.eventTitle);
assert.deepEqual(names(Casa.events(sport, sunday)), ['Inter – Milan', 'Lille – Bayern Monaco', 'GP di Las Vegas'],
  'over two hours after its start a match is gone (Como at 18:45, Parma the day before); a bad date never shows');
assert.deepEqual(names(Casa.events(sport, sunday, {today: true})), ['Inter – Milan', 'Lille – Bayern Monaco']);
assert.deepEqual(names(Casa.events(sport, sunday, {app: 'dazn'})), ['Inter – Milan']);
assert.deepEqual(names(Casa.events(sport, new Date(2026, 10, 22, 12, 0), {today: true, max: 2})), ['Como – AEK Athens', 'Inter – Milan'],
  'no room for all: the Italian clubs first, then in order of time');
assert.deepEqual(Casa.events(null, sunday), []);
assert.equal(Casa.sportOf('dazn'), 'dazn');
assert.equal(Casa.sportOf('netflix'), null);
assert.equal(Casa.appOf('dazn'), 'dazn');

// The marks (seen, Da vedere) of two TVs: the newer wins title by title, whichever way round they merge.
const tvA = {seen: {10: 100, 20: 200, m5: 50, 60: 300}, later: {30: {t: 100, on: 1, s: 'netflix', nf: '8'}, 70: {t: 5, on: 1}}};
const tvB = {seen: {10: -150, 20: 150, 40: 70, 60: -300}, later: {30: {t: 90, on: 0}, m7: {t: 10, on: 1, s: 'prime'}, 70: {t: 5, on: 0}}};
const both = Casa.mergeState(tvA, tvB);
assert.deepEqual(both.seen, {10: -150, 20: 200, 40: 70, 60: -300, m5: 50}, 'taken back later: not seen; at the same instant too');
assert.deepEqual([both.later[30].on, both.later[30].nf, both.later.m7.s, both.later[70].on], [1, '8', 'prime', 0]);
assert.equal(Casa.stateText(Casa.mergeState(tvB, tvA)), Casa.stateText(both), 'the same on both TVs');
assert.equal(Casa.stateText(Casa.mergeState(both, tvA)), Casa.stateText(both), 'merging again changes nothing');
assert.equal(Casa.stateText(Casa.mergeState(tvA, null)), Casa.stateText(tvA));
assert.equal(Casa.stateText({}), '{"seen":{},"later":{}}');
assert.equal(Casa.stateText({seen: {m5: 50, 20: 200, 3: -1}, later: {m7: {t: 10, on: true, s: 'prime'}}}),
  '{"seen":{"3":-1,"20":200,"m5":50},"later":{"m7":{"t":10,"on":1,"s":"prime","nf":null}}}');
assert.deepEqual(Casa.mergeState({seen: {1: 'x', 2: 0, 3: 5}, later: {4: null, 5: {on: 1}}}, null), {seen: {3: 5}, later: {}}, 'junk is dropped');

// What is read from the shared file (or from this TV's own copy) is cleaned first: a bad line must not stop the sharing.
const dirty = {seen: {5: 100, m7: -200.4, abc: 300, '05': 400, 8: 'x', 9: 0, 10: 1e18, 11: NaN, __proto__: 5},
  later: {5: {t: 100, on: 1, s: 'netflix', nf: 81234}, 6: null, 7: {t: 0, on: 1}, m8: {t: 50, on: 'yes', s: 'Prime Video', nf: '12&x=1'},
    9: {t: 1e18, on: 1}, x: {t: 1, on: 1}}, extra: 1};
assert.deepEqual(Casa.cleanState(dirty), {seen: {5: 100, m7: -200}, later: {5: {t: 100, on: 1, s: 'netflix', nf: '81234'},
  m8: {t: 50, on: 1, s: null, nf: null}}}, 'title keys, whole sane times, plain services and ids; the rest is dropped');
assert.deepEqual(Casa.cleanState(null), {seen: {}, later: {}});
assert.deepEqual(Casa.cleanState({seen: 'x', later: [1]}), {seen: {}, later: {}});
assert.equal(Casa.stateText(Casa.cleanState(dirty)), '{"seen":{"5":100,"m7":-200},"later":{"5":{"t":100,"on":1,"s":"netflix","nf":"81234"},"m8":{"t":50,"on":1,"s":null,"nf":null}}}');
const ahead = Date.now() + 365 * 86400000;
assert.deepEqual(Casa.cleanState({seen: {5: ahead}, later: {}}).seen, {5: ahead}, 'a date ahead of this clock is kept: the clock may be the wrong one');

// Developer Mode: a warning under three days, when it ran out, after four failed renewals; none when the owner turned it off.
const hour = 3600, state = last => ({enabled: true, last: last});
assert.equal(Casa.devWarning(state({status: 'healthy', remainingSeconds: 900 * hour, checkedAt: 1000}), 1000), null);
assert.equal(Casa.devWarning(state({status: 'healthy', remainingSeconds: 50 * hour, checkedAt: 0}), 20 * hour * 1000)[0], 'Developer Mode: 30 ore');
assert.equal(Casa.devWarning(state({status: 'renewed', remainingSeconds: 60 * hour, checkedAt: 0}), 0)[0], 'Developer Mode: 2 giorni');
assert.equal(Casa.devWarning(state({status: 'healthy', remainingSeconds: 2 * hour, checkedAt: 0}), 0.5 * hour * 1000)[0], 'Developer Mode: 1 ora');
assert.equal(Casa.devWarning(state({status: 'expired'}), 0)[0], 'Developer Mode scaduta');
assert.equal(Casa.devWarning(state({status: 'retry', failures: 4}), 0)[0], 'Developer Mode: non rinnovata');
assert.equal(Casa.devWarning(state({status: 'retry', failures: 2}), 0), null);
assert.equal(Casa.devWarning({enabled: false, last: {status: 'expired'}}, 0), null);
assert.equal(Casa.devWarning(null, 0), null);

// Weather words, as on the Metz.
assert.deepEqual(Casa.describe(0, true), ['Sereno', 'sun']);
assert.equal(Casa.describe(0, false)[1], 'moon');
assert.equal(Casa.describe(2, true)[0], 'Poco nuvoloso');
assert.equal(Casa.describe(45, true)[1], 'fog');
assert.equal(Casa.describe(65, true)[0], 'Pioggia forte');
assert.equal(Casa.describe(95, true)[1], 'storm');
assert.equal(Casa.air(18), 'Aria buona');
assert.equal(Casa.air(40), 'Aria discreta');
assert.equal(Casa.air(61), 'Aria scadente');
assert.equal(Casa.air(-1), null);

// The glow colour of a picture.
const vivid = Casa.dominant(Uint8ClampedArray.from([20, 20, 20, 255, 200, 30, 40, 255, 30, 30, 30, 255]));
assert.ok(vivid[0] > vivid[1] && vivid[0] > vivid[2], 'the red pixel wins over the greys');
const grey = Casa.dominant(Uint8ClampedArray.from([60, 60, 60, 255, 70, 70, 70, 255]));
assert.ok(Math.max(...grey) >= 149, 'a grey picture still gives a visible glow');

// Every dock app has its own tile (casa-tiles.js), an SVG.
const vm = require('node:vm');
const fs = require('node:fs');
const box = {window: {}};
vm.runInNewContext(fs.readFileSync(require.resolve('../../launcher/config.js'), 'utf8'), box);
vm.runInNewContext(fs.readFileSync(require.resolve('../../launcher/casa-tiles.js'), 'utf8'), box);
for (const id of box.window.CONFIG.dockApps) {
  const art = box.window.CASA_TILES[id];
  assert.ok(art && art.startsWith('data:image/svg+xml;base64,'), 'tile for ' + id);
  assert.ok(Buffer.from(art.split(',')[1], 'base64').toString('utf8').startsWith('<svg'), 'an SVG for ' + id);
}

console.log('PASS Casa shelf rules');
