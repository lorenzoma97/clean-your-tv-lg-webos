/* Fork lorenzoma97, "Casa": the opening card. The TV's own splash (splash.png in appinfo.json) can only be one still
   picture, so it is plain black and the cards take turns here, one per start of the app: a cold start, not HOME (the
   app is running by then). At least 1.8 s on screen, then it fades; the first key ends it and is spent on that, so an OK
   meant for the card does not open the app under it. Only on the TV, or in a browser with ?intro. */
(function() {
  'use strict';
  var CARDS = ['intro-arcade.png', 'intro-nero.png'], MIN_MS = 1800, MAX_MS = 5000;
  if (!/Web0S|webOS/.test(navigator.userAgent) && !/[?&]intro\b/.test(location.search)) return;
  var turn = 0;
  try {
    turn = +localStorage.getItem('casa.intro') || 0;
    localStorage.setItem('casa.intro', String((turn + 1) % CARDS.length));
  } catch (_) { /* no storage: always the first */ }
  var card = document.createElement('div'), shownAt = Date.now(), gone = false, held = {};
  card.id = 'casaIntro';
  card.style.backgroundImage = 'url("' + CARDS[turn % CARDS.length] + '")';
  document.body.appendChild(card);

  function end() {
    if (gone) return;
    gone = true;
    card.className = 'out';
    setTimeout(function() { if (card.parentNode) card.parentNode.removeChild(card); }, 500);
  }
  function onKey(event) {
    var key = event.keyCode;
    if (event.type === 'keydown') {
      if (!gone) { held[key] = true; end(); } else if (!held[key]) return;
    } else if (held[key]) {
      delete held[key];
    } else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(end, Math.max(0, MIN_MS - (Date.now() - shownAt)));
  });
  setTimeout(end, MAX_MS);
}());
