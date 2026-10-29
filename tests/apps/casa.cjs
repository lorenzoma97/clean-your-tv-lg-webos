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
assert.equal(Casa.novitaLine('new_series', 1), 'Nuova serie');
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

assert.equal(Casa.meta({first_air_date: '2024-03-01', genres: [{name: 'Crime'}, {name: 'Dramma'}],
  number_of_seasons: 2, vote_average: 7.84, vote_count: 312}), '2024 · Crime · 2 stagioni · ★ 7,8');
assert.equal(Casa.meta({first_air_date: '2025-01-09', type: 'Miniseries', number_of_seasons: 1,
  vote_average: 9.5, vote_count: 4}), '2025 · Miniserie');
assert.equal(Casa.meta({first_air_date: null, genres: []}), null);

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

// The glow colour of a picture, and the sun over Bologna.
const vivid = Casa.dominant(Uint8ClampedArray.from([20, 20, 20, 255, 200, 30, 40, 255, 30, 30, 30, 255]));
assert.ok(vivid[0] > vivid[1] && vivid[0] > vivid[2], 'the red pixel wins over the greys');
const grey = Casa.dominant(Uint8ClampedArray.from([60, 60, 60, 255, 70, 70, 70, 255]));
assert.ok(Math.max(...grey) >= 149, 'a grey picture still gives a visible glow');
const noonJune = Casa.sunElevation(new Date(Date.UTC(2026, 5, 21, 11, 15)), 44.4949, 11.3426);
assert.ok(noonJune > 65 && noonJune < 72, 'solar noon at the June solstice: about 69 degrees, got ' + noonJune);
assert.ok(Casa.sunElevation(new Date(Date.UTC(2026, 11, 21, 23, 0)), 44.4949, 11.3426) < -40, 'midnight in December');
assert.equal(Casa.skyFor(3).clouds, 0.9);
assert.equal(Casa.skyFor(95).storm, 1);
assert.equal(Casa.skyFor(0).rain, 0);

console.log('PASS Casa shelf rules');
