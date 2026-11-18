/* Fork lorenzoma97, "Casa": what the owner marked, on this TV and shared with the other one.
   - "Già vista" and the "Da vedere" list are kept here (localStorage 'casa.state'; the rules are CasaCore.mergeState).
   - Once the installer has handed over a place to share them (a private GitHub repository and a token for that
     repository alone, as a launch parameter, like the TMDB key), the state is read from there at every start and return
     to Home, merged with this TV's, and written back when this TV has something new: the marks survive a
     reinstallation and are the same on the bedroom TV.
   Without the token everything works on this TV alone. */
(function() {
  'use strict';
  var Core = window.CasaCore;
  if (!Core) return;
  var STORE = 'casa.state', SYNC = 'casa.sync', FILE = 'stato.json';
  var API = window.CASA_STATE_API || 'https://api.github.com/repos/';   // the tests point it at strumenti/stato_mock.py
  var SYNC_MS = 30 * 60 * 1000, AFTER_MS = 4000, TRIES = 3;
  var listeners = [], sha = null, busy = false, again = false, tries = 0, timer = null, last = {ok: 0, error: null};
  var state = read();

  function read() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (_) { s = null; }
    if (s && s.seen && s.later) return Core.cleanState(s);
    s = {seen: {}, later: {}};
    try {   // the marks of the versions before this one ({id: true}): older than any mark with a time
      var old = JSON.parse(localStorage.getItem('casa.seen')) || {};
      for (var id in old) if (old[id]) s.seen[id] = 1;
    } catch (_) { /* none */ }
    return s;
  }
  function write() {
    try { localStorage.setItem(STORE, Core.stateText(state)); } catch (_) { /* full: the marks last until Home closes */ }
  }
  function notify() {
    listeners.forEach(function(fn) { try { fn(); } catch (_) { /* one listener does not stop the others */ } });
  }
  function changed() {
    write();
    notify();
    clearTimeout(timer);
    timer = setTimeout(sync, AFTER_MS);   // a few marks in a row go up together
  }

  function seen(key) { return state.seen[key] > 0; }
  function later(key) { return !!(state.later[key] && state.later[key].on); }
  /* Watched means no longer to watch: marking a title seen takes it off "Da vedere" (wherever it is marked: a row, the
     whole list, the other TV's copy of this code). */
  function setSeen(key, on) {
    var now = stamp(state.seen[key]), x = state.later[key];
    state.seen[key] = on ? now : -now;
    if (on && x && x.on) state.later[key] = {t: stamp(x.t), on: 0, s: x.s || null, nf: x.nf || null};
    changed();
  }
  /* The time of a new mark: now, and always after the mark it replaces. With the clock alone, a TV a few seconds behind
     the other could not take back a mark the other had just made: at the next merge the older-looking undo lost. */
  function stamp(old) { return Math.max(Date.now(), Math.abs(old || 0) + 1); }
  /* info: {s: the service that has it, nf: its Netflix id}, what opening it later needs. */
  function setLater(key, on, info) {
    var old = state.later[key] || {};
    // Through cleanState: a service or a Netflix id that is not what it should be is not kept (nor shared).
    var probe = {};
    probe[key] = {t: stamp(old.t), on: on, s: info && info.s || old.s, nf: info && info.nf || old.nf};
    var one = Core.cleanState({later: probe}).later[key];
    if (!one) return;
    state.later[key] = one;
    changed();
  }
  /* The list, the last saved first. */
  function list() {
    var out = [];
    for (var k in state.later) if (state.later[k].on) out.push({key: Core.isMovie(k) ? k : +k, s: state.later[k].s, nf: state.later[k].nf, t: state.later[k].t});
    return out.sort(function(a, b) { return b.t - a.t; });
  }
  /* {TMDB id: true} of the series (or of the films) seen, or saved: what the pool's rules take. */
  function ids(which, movie) {
    var out = {};
    for (var k in state[which]) {
      var on = which === 'seen' ? state.seen[k] > 0 : state.later[k].on;
      if (on && Core.isMovie(k) === !!movie) out[Core.rawId(k)] = true;
    }
    return out;
  }

  // ---- the shared copy ---------------------------------------------------------------------------

  function config() {
    try {
      var c = JSON.parse(localStorage.getItem(SYNC));
      return c && c.repo && c.token ? c : null;
    } catch (_) { return null; }
  }
  /* {"sync": {"repo": "owner/name", "token": "..."}} arrives once as a launch parameter. */
  function take(raw) {
    try {
      var p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (p && p.params) p = p.params;
      var c = p && p.sync;
      if (!c || !/^[\w.-]+\/[\w.-]+$/.test(c.repo || '') || !/^[A-Za-z0-9_]{20,300}$/.test(c.token || '')) return;
      localStorage.setItem(SYNC, JSON.stringify({repo: c.repo, token: c.token}));
      tries = 0;
      sync();
    } catch (_) { /* not ours */ }
  }
  function request(method, body, done) {
    var c = config(), xhr = new XMLHttpRequest();
    // GET with a changing query: the browser kept the last reply for a minute, and a mark from the other TV waited.
    xhr.open(method, API + c.repo + '/contents/' + FILE + (method === 'GET' ? '?t=' + Date.now() : ''));
    xhr.timeout = 15000;
    xhr.setRequestHeader('Authorization', 'Bearer ' + c.token);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      var r = null;
      try { r = JSON.parse(xhr.responseText); } catch (_) { r = null; }
      done(xhr.status, r);
    };
    xhr.onerror = xhr.ontimeout = function() { done(0, null); };
    xhr.send(body ? JSON.stringify(body) : null);
  }
  /* Read the shared copy, merge, and write it back only when this TV knows something it does not. */
  function sync() {
    clearTimeout(timer);
    if (!config() || window.CASA_DEMO) return;
    if (busy) { again = true; return; }
    busy = true;
    request('GET', null, guarded(function(status, r) {
      var remote = null;
      if (status === 200 && r && typeof r.content === 'string') {
        sha = r.sha || null;
        // Unreadable: rewritten. Readable: only what can be trusted of it (Core.cleanState).
        try { remote = Core.cleanState(JSON.parse(atob(r.content.replace(/\s/g, '')))); } catch (_) { remote = null; }
      } else if (status === 404 && r) {
        sha = null;   // no file yet: this TV writes the first
      } else return finish('read ' + status);
      var merged = Core.mergeState(state, remote), text = Core.stateText(merged);
      if (text !== Core.stateText(state)) {
        state = merged;
        write();
        notify();
      }
      if (remote && text === Core.stateText(remote)) return finish(null);
      var body = {message: 'stato', content: btoa(text)};
      if (sha) body.sha = sha;
      request('PUT', body, guarded(function(code, w) {
        if (code === 200 || code === 201) {
          sha = w && w.content && w.content.sha || null;
          return finish(null);
        }
        if (code === 409 || code === 422) again = true;   // the other TV wrote meanwhile: read again, merge again
        finish('write ' + code);
      }));
    }));
  }
  /* A reply's handler that cannot leave a round open: whatever it throws ends the round (busy stayed up for good, and
     nothing was shared again until Home restarted). */
  function guarded(fn) {
    return function(a, b) {
      try { fn(a, b); } catch (_) { finish('error'); }
    };
  }
  function finish(error) {
    busy = false;
    last = {ok: error ? last.ok : Date.now(), error: error};
    tries = error ? tries + 1 : 0;
    if (again && tries < TRIES) setTimeout(sync, 1500);
    again = false;
  }

  window.CasaState = {seen: seen, setSeen: setSeen, later: later, setLater: setLater, list: list,
    seenIds: function(movie) { return ids('seen', movie); }, laterIds: function(movie) { return ids('later', movie); },
    onChange: function(fn) { listeners.push(fn); }, sync: function() { tries = 0; sync(); },
    status: function() { return {shared: !!config(), ok: last.ok, error: last.error}; }};
  take(window.PalmSystem && window.PalmSystem.launchParams);
  document.addEventListener('webOSRelaunch', function(e) { take(e && e.detail); tries = 0; sync(); });
  document.addEventListener('visibilitychange', function() { if (!document.hidden) { tries = 0; sync(); } });
  setInterval(function() { tries = 0; sync(); }, SYNC_MS);
  sync();
}());
