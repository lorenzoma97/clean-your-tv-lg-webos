/* Fork lorenzoma97, "Casa": Home at rest and the live sky.
   - The sky over Bologna, drawn live (WebGL, at a third of the screen and stretched: soft and cheap), from the real
     weather and the sun's height now: behind an app that has no titles to show.
   - After three minutes without a key: the Art Mode, public-domain paintings (Wikimedia Commons copies) drifting
     slowly, the time, the weather and tonight's five. Left/Right and OK on the cards, any other key wakes Home.
     The caption and the clock move a little every minute and the night is dimmer, for the OLED panel.
   The LG screensaver can still start on its own after a few minutes; an app cannot stop it (to be checked on the TV). */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf, demo = window.CASA_DEMO || null;
  if (!Core || !Shelf) return;
  var IDLE_MS = 3 * 60 * 1000, ART_MS = 45 * 1000, LAT = 44.4949, LON = 11.3426;
  /* [1920 px copy on Wikimedia Commons, artist, title, date]: public-domain paintings, landscape first. */
  var ART = [
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/1920px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg", "Georges Seurat", "Una domenica pomeriggio sull'isola della Grande Jatte", "1884–86"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1920px-Tsunami_by_hokusai_19th_century.jpg", "Katsushika Hokusai", "La grande onda di Kanagawa", "1830–31"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Vincent_van_Gogh_-_Van_Gogh%27s_Bedroom_in_Arles_-_Google_Art_Project.jpg/1920px-Vincent_van_Gogh_-_Van_Gogh%27s_Bedroom_in_Arles_-_Google_Art_Project.jpg", "Vincent van Gogh", "La camera da letto ad Arles", "1889"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Winslow_Homer_-_The_Herring_Net_-_Google_Art_Project.jpg/1920px-Winslow_Homer_-_The_Herring_Net_-_Google_Art_Project.jpg", "Winslow Homer", "La rete per aringhe", "1885"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Claude_Monet_-_Cliff_Walk_at_Pourville_-_Google_Art_Project.jpg/1920px-Claude_Monet_-_Cliff_Walk_at_Pourville_-_Google_Art_Project.jpg", "Claude Monet", "Passeggiata sulla scogliera a Pourville", "1882"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Claude_Monet_-_Arrival_of_the_Normandy_Train%2C_Gare_Saint-Lazare_-_Google_Art_Project.jpg/1920px-Claude_Monet_-_Arrival_of_the_Normandy_Train%2C_Gare_Saint-Lazare_-_Google_Art_Project.jpg", "Claude Monet", "Arrivo del treno di Normandia, Gare Saint-Lazare", "1877"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Joseph_Mallord_William_Turner_-_Fishing_Boats_with_Hucksters_Bargaining_for_Fish_-_1922.4472_-_Art_Institute_of_Chicago.jpg/1920px-Joseph_Mallord_William_Turner_-_Fishing_Boats_with_Hucksters_Bargaining_for_Fish_-_1922.4472_-_Art_Institute_of_Chicago.jpg", "J. M. W. Turner", "Pescherecci con venditori che contrattano il pesce", "1837–38"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Paul_c%C3%A9zanne%2C_il_cesto_di_mele%2C_1893_ca.jpg/1920px-Paul_c%C3%A9zanne%2C_il_cesto_di_mele%2C_1893_ca.jpg", "Paul Cézanne", "Il cesto di mele", "1893 ca."],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Henri_de_Toulouse-Lautrec_-_At_the_Moulin_Rouge_-_Google_Art_Project.jpg/1920px-Henri_de_Toulouse-Lautrec_-_At_the_Moulin_Rouge_-_Google_Art_Project.jpg", "Henri de Toulouse-Lautrec", "Al Moulin Rouge", "1892–95"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Claude_Monet_-_Waterlilies_-_Google_Art_Project.jpg/1920px-Claude_Monet_-_Waterlilies_-_Google_Art_Project.jpg", "Claude Monet", "Ninfee", ""],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Gustave_Caillebotte_-_Paris_Street%3B_Rainy_Day_-_Google_Art_Project.jpg/1920px-Gustave_Caillebotte_-_Paris_Street%3B_Rainy_Day_-_Google_Art_Project.jpg", "Gustave Caillebotte", "Via di Parigi, giornata di pioggia", "1877"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_%28Winter%29_-_Google_Art_Project.jpg/1920px-Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_%28Winter%29_-_Google_Art_Project.jpg", "Pieter Bruegel il Vecchio", "Cacciatori nella neve", "1565"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/The_Fighting_Temeraire%2C_JMW_Turner%2C_National_Gallery.jpg/1920px-The_Fighting_Temeraire%2C_JMW_Turner%2C_National_Gallery.jpg", "J. M. W. Turner", "Il valoroso Téméraire", "1839"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/View_of_Delft%2C_by_Johannes_Vermeer.jpg/1920px-View_of_Delft%2C_by_Johannes_Vermeer.jpg", "Johannes Vermeer", "Veduta di Delft", "1660–61"],
    ["https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1920px-Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg", "Vincent van Gogh", "Notte stellata", "1889"]
  ];

  // ---- the live sky ----------------------------------------------------------------------------

  var SHADER = [
    'precision mediump float;',
    'uniform vec2 res; uniform float t, sun, clouds, rain, storm, fog;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / res;',
    '  float day = smoothstep(-6.0, 8.0, sun), low = 1.0 - smoothstep(0.0, 14.0, abs(sun - 2.0));',
    '  vec3 zen = mix(vec3(0.012, 0.02, 0.06), vec3(0.14, 0.34, 0.72), day);',
    '  vec3 hor = mix(vec3(0.05, 0.07, 0.15), vec3(0.6, 0.76, 0.94), day);',
    '  hor = mix(hor, vec3(1.0, 0.52, 0.28), low * (0.75 * day + 0.35));',
    '  vec3 sky = mix(hor, zen, pow(uv.y, 0.8));',
    '  sky = mix(sky, mix(vec3(0.07, 0.08, 0.1), vec3(0.52, 0.55, 0.6), day), clouds * 0.5 + storm * 0.3);',
    '  vec2 cell = floor(gl_FragCoord.xy);',
    '  sky += step(0.9975, hash(cell)) * (1.0 - day) * (1.0 - clouds) * (0.55 + 0.45 * sin(t * 1.7 + hash(cell + 3.0) * 40.0)) * uv.y;',
    '  vec2 p = vec2(uv.x * 3.0 + t * 0.006, uv.y * 1.6);',
    '  float c = fbm(p * 1.8 + fbm(p * 1.1 + t * 0.003));',
    '  float cover = smoothstep(0.95 - clouds * 0.75, 1.25 - clouds * 0.6, c * 1.3) * smoothstep(0.0, 0.3, uv.y);',
    '  vec3 cloud = mix(vec3(0.1, 0.11, 0.14), vec3(0.95, 0.95, 0.97), day * 0.9 + 0.05);',
    '  cloud = mix(cloud, vec3(1.0, 0.66, 0.46), low * 0.55) * (1.0 - storm * 0.55);',
    '  sky = mix(sky, cloud, cover * 0.92);',
    '  sky = mix(sky, mix(vec3(0.09), vec3(0.74, 0.76, 0.79), day), fog * smoothstep(0.65, 0.0, uv.y) * 0.8);',
    '  if (rain > 0.0) { vec2 r = vec2(uv.x * 140.0 + uv.y * 20.0, uv.y * 16.0 + t * 10.0);',
    '    sky += step(0.988, hash(floor(r))) * fract(r.y) * rain * 0.22; }',
    '  gl_FragColor = vec4(sky, 1.0);',
    '}'
  ].join('\n');

  var skyCanvas, gl, uni = {}, skyOn = false, skyFrame = null, weatherNow = null, start = Date.now();

  function makeSky() {
    skyCanvas = document.createElement('canvas');
    skyCanvas.id = 'casaSky';
    skyCanvas.width = 640;
    skyCanvas.height = 360;
    try {
      gl = skyCanvas.getContext('webgl') || skyCanvas.getContext('experimental-webgl');
    } catch (_) { gl = null; }
    if (!gl) return;   // no WebGL: the plain black background stays
    var vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER), prog = gl.createProgram();
    gl.shaderSource(vs, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }');
    gl.shaderSource(fs, SHADER);
    gl.compileShader(vs);
    gl.compileShader(fs);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
    gl.useProgram(prog);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ['res', 't', 'sun', 'clouds', 'rain', 'storm', 'fog'].forEach(function(n) { uni[n] = gl.getUniformLocation(prog, n); });
    var art = document.getElementById('casaArt');
    document.body.insertBefore(skyCanvas, art || document.getElementById('hero'));
  }

  var lastDraw = 0;
  function drawSky(now) {
    skyFrame = null;
    if (!gl || !skyOn) return;
    if (now - lastDraw > 33) {   // about 30 frames a second is plenty for clouds
      lastDraw = now;
      var s = Core.skyFor(weatherNow ? weatherNow.code : 1);
      gl.viewport(0, 0, skyCanvas.width, skyCanvas.height);
      gl.uniform2f(uni.res, skyCanvas.width, skyCanvas.height);
      gl.uniform1f(uni.t, (Date.now() - start) / 1000);
      gl.uniform1f(uni.sun, Core.sunElevation(new Date(), LAT, LON));
      gl.uniform1f(uni.clouds, s.clouds);
      gl.uniform1f(uni.rain, s.rain);
      gl.uniform1f(uni.storm, s.storm);
      gl.uniform1f(uni.fog, s.fog);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    skyFrame = requestAnimationFrame(drawSky);
  }

  function sky(on) {
    skyOn = !!on && !!gl;
    document.body.classList.toggle('casa-sky', skyOn);
    if (skyOn && !skyFrame) skyFrame = requestAnimationFrame(drawSky);
  }

  // ---- Home at rest: the Art Mode --------------------------------------------------------------

  var rest, artLayers, artIndex = Math.floor(Math.random() * ART.length), artLayer = 0, artTimer = null;
  var clockEl, dateEl, wxEl, captionEl, cardsEl, idleTimer = null, resting = false, cardIndex = -1, picks = [], swallow = {};

  function el(tag, id, cls) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    return e;
  }

  function artUrl(a) {
    return demo && demo.artBase ? demo.artBase + ART.indexOf(a) + '.jpg' : a[0];
  }

  function nextArt() {
    var a = ART[artIndex = (artIndex + 1) % ART.length], next = artLayers[1 - artLayer], img = new Image();
    img.onload = function() {
      if (!resting) return;
      next.style.transition = 'none';
      next.style.transform = 'scale(1.02) translate(0, 0)';
      next.style.backgroundImage = 'url("' + img.src + '")';
      next.offsetWidth;
      next.style.transition = '';
      next.style.opacity = '1';
      next.style.transform = 'scale(1.1) translate(' + (artIndex % 2 ? -1.5 : 1.5) + '%, -1%)';   // the slow drift
      artLayers[artLayer].style.opacity = '0';
      artLayer = 1 - artLayer;
      captionEl.innerHTML = '<b></b><span></span><i>Pubblico dominio · Wikimedia Commons</i>';
      captionEl.firstChild.textContent = a[1];
      captionEl.childNodes[1].textContent = a[2] + (a[3] ? ', ' + a[3] : '');
    };
    img.src = artUrl(a);
    artTimer = setTimeout(nextArt, ART_MS);
  }

  function clock() {
    if (!resting) return;
    var now = new Date();
    clockEl.textContent = window.HomeI18n ? HomeI18n.formatTime(now) : now.getHours() + ':' + ('0' + now.getMinutes()).slice(-2);
    dateEl.textContent = window.HomeI18n ? HomeI18n.formatDate(now) : now.toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long'});
    var night = now.getHours() >= 23 || now.getHours() < 7;
    rest.classList.toggle('night', night);
    // A few pixels every minute, so nothing sits on the same OLED pixels for hours.
    var dx = Math.round(Math.sin(now.getMinutes() / 9) * 18), dy = Math.round(Math.cos(now.getMinutes() / 7) * 12);
    rest.querySelector('.rest-top').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    captionEl.style.transform = 'translate(' + -dx + 'px,' + -dy + 'px)';
  }

  function drawWeather(w) {
    weatherNow = w || weatherNow;
    if (!wxEl || !weatherNow) return;
    var d = Core.describe(weatherNow.code, weatherNow.day !== 0);
    wxEl.textContent = Math.round(weatherNow.temp) + '°  ' + (d[0] ? d[0] + '  ·  ' : '') + 'Bologna';
  }

  function drawCards() {
    if (!cardsEl) return;
    cardsEl.innerHTML = '';
    picks.forEach(function(p) { cardsEl.appendChild(Shelf.util.card(p)); });
    markCards();
    rest.querySelector('.rest-scopri').style.display = picks.length ? '' : 'none';
  }
  function markCards() {
    var cards = cardsEl.children;
    for (var i = 0; i < cards.length; i++) cards[i].className = 'casa-card' + (i === cardIndex ? ' focused' : '');
  }

  function open() {
    if (resting) return;
    resting = true;
    cardIndex = -1;
    document.body.classList.add('casa-rest');
    rest.style.display = '';
    rest.offsetWidth;
    rest.classList.add('shown');
    drawWeather();
    drawCards();
    clock();
    nextArt();
  }
  function close() {
    if (!resting) return;
    resting = false;
    clearTimeout(artTimer);
    rest.classList.remove('shown');
    document.body.classList.remove('casa-rest');
    setTimeout(function() { if (!resting) rest.style.display = 'none'; }, 700);
    wake();
  }
  function wake() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(open, IDLE_MS);
  }

  function onKey(event) {
    if (!resting) {
      if (event.type === 'keydown') wake();
      if (event.type === 'keyup' && swallow[event.keyCode]) {
        swallow[event.keyCode] = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    var key = event.keyCode;
    if (key === 447 || key === 448 || key === 449 || key === 175 || key === 174 || key === 173) return;   // volume
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'keydown') return;
    swallow[key] = true;
    if ((key === 37 || key === 39) && picks.length) {
      cardIndex = cardIndex < 0 ? 0 : Math.max(0, Math.min(picks.length - 1, cardIndex + (key === 39 ? 1 : -1)));
      markCards();
    } else if (key === 13 && cardIndex >= 0) {
      var i = cardIndex;
      close();
      if (window.CasaHome) CasaHome.open(i);
    } else {
      close();   // any other key: back to Home, and only that
    }
  }

  function build() {
    rest = el('div', 'casaRest');
    rest.style.display = 'none';
    artLayers = [el('div', null, 'rest-art'), el('div', null, 'rest-art')];
    rest.appendChild(artLayers[0]);
    rest.appendChild(artLayers[1]);
    rest.appendChild(el('div', null, 'rest-shade'));
    var top = el('div', null, 'rest-top');
    clockEl = el('div', null, 'rest-clock');
    dateEl = el('div', null, 'rest-date');
    wxEl = el('div', null, 'rest-weather');
    top.appendChild(clockEl);
    top.appendChild(dateEl);
    top.appendChild(wxEl);
    rest.appendChild(top);
    var scopri = el('div', null, 'rest-scopri');
    var title = el('div', null, 'rest-scopri-title');
    title.textContent = 'Stasera per te';
    cardsEl = el('div', null, 'rest-cards');
    scopri.appendChild(title);
    scopri.appendChild(cardsEl);
    rest.appendChild(scopri);
    captionEl = el('div', null, 'rest-caption');
    rest.appendChild(captionEl);
    document.body.appendChild(rest);
  }

  build();
  makeSky();
  setInterval(clock, 20000);
  ['mousemove', 'wheel'].forEach(function(type) { document.addEventListener(type, function() { if (resting) close(); else wake(); }, true); });
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  wake();
  window.CasaRest = {
    sky: sky,
    weather: function(w) { drawWeather(w); },
    picks: function(list) { picks = list || []; if (resting) drawCards(); },
    open: open,
    close: close
  };
  if (window.CasaHome) {   // casa-home.js may have loaded its data first
    drawWeather(CasaHome.weather());
    picks = CasaHome.picks() || [];
  }
}());
