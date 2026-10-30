/* Fork lorenzoma97, "Casa": Home at rest.
   - After three minutes without a key: the Art Mode, public-domain paintings (Wikimedia Commons copies) drifting
     slowly, the time, the weather and tonight's five. Left/Right and OK on the cards, any other key wakes Home.
     The caption and the clock move a little every minute and the night is dimmer, for the OLED panel.
   The LG screensaver can still start on its own after a few minutes; an app cannot stop it (to be checked on the TV). */
(function() {
  'use strict';
  var Core = window.CasaCore, Shelf = window.CasaShelf, demo = window.CASA_DEMO || null;
  if (!Core || !Shelf) return;
  var IDLE_MS = 3 * 60 * 1000, ART_MS = 45 * 1000;
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

  var weatherNow = null;

  // ---- Home at rest: the Art Mode --------------------------------------------------------------

  var rest, artLayers, artIndex = Math.floor(Math.random() * ART.length), artLayer = 0, artTimer = null;
  var clockEl, dateEl, wxEl, captionEl, cardsEl, idleTimer = null, asleepTimer = null, resting = false, cardIndex = -1;
  var picks = [], swallow = {};

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

  /* null: no reading worth showing (offline for hours, casa-home.js). */
  function drawWeather(w) {
    weatherNow = w === undefined ? weatherNow : w;
    if (!wxEl) return;
    if (!weatherNow) { wxEl.textContent = ''; return; }
    var d = Core.describe(weatherNow.code, weatherNow.day !== 0);
    wxEl.textContent = Math.round(weatherNow.temp) + '°' + (d[0] ? '  ·  ' + d[0] : '');
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

  /* What was open (the detail, Scopri, the whole list) closes first: under the paintings its keys used to stay live, and
     the OK that woke Home opened a title. Once the paintings cover it, Home sleeps: no rotation, no drawing. */
  function open() {
    if (resting) return;
    resting = true;
    cardIndex = -1;
    if (window.CasaList) CasaList.close();
    if (window.CasaHome) CasaHome.reset();
    Shelf.reset();
    Shelf.pause(true);
    document.body.classList.add('casa-rest');
    rest.style.display = '';
    rest.offsetWidth;
    rest.classList.add('shown');
    clearTimeout(asleepTimer);
    asleepTimer = setTimeout(function() { if (resting) document.body.classList.add('casa-asleep'); }, 800);
    drawWeather();
    drawCards();
    clock();
    nextArt();
  }
  function close() {
    if (!resting) return;
    resting = false;
    clearTimeout(artTimer);
    clearTimeout(asleepTimer);
    document.body.classList.remove('casa-asleep');
    Shelf.pause(false);
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
    if (event.type !== 'keydown' || event.repeat) return;
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
    title.textContent = 'Scopri una nuova serie';
    var hint = el('span', null, 'rest-hint');
    hint.textContent = '◀ ▶ scegli   ·   OK apri   ·   altri tasti: Home';
    title.appendChild(hint);
    cardsEl = el('div', null, 'rest-cards');
    scopri.appendChild(title);
    scopri.appendChild(cardsEl);
    rest.appendChild(scopri);
    captionEl = el('div', null, 'rest-caption');
    rest.appendChild(captionEl);
    document.body.appendChild(rest);
  }

  build();
  setInterval(clock, 20000);
  ['mousemove', 'wheel'].forEach(function(type) { document.addEventListener(type, function() { if (resting) close(); else wake(); }, true); });
  // Every key is activity, whoever handles it: on window in capture, before the shelf, Scopri and the list stop it.
  window.addEventListener('keydown', function() { if (!resting) wake(); }, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  document.addEventListener('webOSRelaunch', close);   // HOME: Home itself
  wake();
  window.CasaRest = {
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
