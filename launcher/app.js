!function () {
  "use strict";

  function tr(text, params) {
    return window.HomeI18n ? HomeI18n.t(text, params) : text.replace(/\{(\w+)\}/g, function (m, k) {
      return params && params[k] !== undefined ? params[k] : m;
    });
  }
  function ht(markup) {
    return window.HomeI18n ? HomeI18n.html(markup) : markup;
  }
  // Shared layout, focus and remote-control state.
  var GRID_LEFT = 112,
    GRID_WIDTH = 1696,
    MAX_CARD_WIDTH = 360,
    MAX_CARD_HEIGHT = 202,
    FOCUS_SCALE = 1.1,
    FOCUS_PADDING = 12,
    CARD_GAP = 24,
    ROW_GAP = 90,
    DOCK_PADDING = 28,
    DOCK_TOP = 680,
    // Fork lorenzoma97: with CONFIG.dockScroll every app stays on the one row, CONFIG.columns of them in view and the
    // row sliding under the focus (discovery+, Spotify: one step right of RaiPlay). Tiles keep the size of CONFIG.columns.
    visibleColumns = Math.max(1, CONFIG.columns || 4),
    columnCount = CONFIG.dockScroll ? 1000 : visibleColumns,
    columnWidth = GRID_WIDTH / visibleColumns,
    dockStart = 0,
    // Leave CARD_GAP between an enlarged focus frame and its idle neighbour.
    CARD_WIDTH = Math.min(MAX_CARD_WIDTH, Math.floor((columnWidth - FOCUS_PADDING - CARD_GAP) / ((FOCUS_SCALE + 1) / 2))),
    CARD_HEIGHT = Math.round(CARD_WIDTH * MAX_CARD_HEIGHT / MAX_CARD_WIDTH),
    DOCK_HEIGHT = CARD_HEIGHT + DOCK_PADDING * 2,
    TILE_BASE = DOCK_TOP + DOCK_PADDING,
    HERO_OFFSET = 176;
  var toastTimer,
    KEY_OK = 13,
    KEY_BACK = 461,
    greetings = [[5, tr("Good night")], [12, tr("Good morning")], [17, tr("Good afternoon")], [22, tr("Good evening")], [24, tr("Good night")]],
    weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    getElement = function (e) {
      return document.getElementById(e);
    },
    stage = getElement("stage"),
    tilesContainer = getElement("tiles"),
    focusGlass = getElement("glass"),
    heroTitle = getElement("hero"),
    ambientLayers = [getElement("ambientA"), getElement("ambientB")],
    ambientIndex = 0,
    ambientColor = null,
    topButtons = [getElement("btnInputs"), getElement("btnWifi"), getElement("btnSettings")],
    inputsPanel = getElement("inputsPanel"),
    tiles = [],
    focusZone = "grid",
    focusedTile = 0,
    focusedTopButton = 0,
    lastTopButton = 2,   // fork lorenzoma97: Up lands on the button used last (Settings at first)
    focusedInput = 0,
    inputRows = [],
    scrollOffset = 0,
    heroVisible = false,
    focusGlassVisible = false,
    moveState = null,
    activeBridges = [];
  // Retain service bridges until their replies arrive; subscriptions stay alive.
  function callLuna(uri, params, callback, timeout) {
    var bridge, timer, done = false;
    function finish(result) {
      if (done) return;
      if (!(params && params.subscribe)) {
        done = true;
        clearTimeout(timer);
        var index = activeBridges.indexOf(bridge);
        if (index >= 0) activeBridges.splice(index, 1);
        if (timeout && bridge) try { bridge.cancel(); } catch (_) {}
      }
      callback && callback(result);
    }
    try {
      bridge = new PalmServiceBridge();
      bridge.onservicecallback = function (e) {
        var i;
        try {
          i = JSON.parse(e);
        } catch (e) {
          i = {
            returnValue: false
          };
        }
        finish(i);
      };
      activeBridges.push(bridge);
      if (timeout) timer = setTimeout(function () { finish({returnValue: false}); }, timeout);
      bridge.call(uri, JSON.stringify(params || {}));
    } catch (e) {
      finish({
        returnValue: false,
        errorText: String(e)
      });
    }
  }
  function launchApp(appId, title, params) {
    callLuna("luna://com.webos.applicationManager/launch", {
      id: appId,
      params: params || {}
    }, function (n) {
      false === n.returnValue && showToast(tr("Can't open {app}", {
        app: title || appId
      }));
    });
  }
  function showToast(message) {
    var toast = getElement("toast");
    toast.textContent = message;
    toast.classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("shown");
    }, 2200);
  }
  function launchFirst(candidates, index, label) {
    var candidate = candidates[index];
    if (!candidate) {
      showToast(tr("Can't open {app}", {
        app: label
      }));
      return;
    }
    callLuna("luna://com.webos.applicationManager/launch", {
      id: candidate.id,
      params: candidate.params || {}
    }, function (r) {
      if (false === r.returnValue) {
        launchFirst(candidates, index + 1, label);
      }
    });
  }
  function openNetworkSettings() {
    launchFirst([{
      id: "com.webos.app.firstuse-overlay",
      params: {
        target: "network"
      }
    }, {
      id: "com.palm.app.settings",
      params: {
        target: "network"
      }
    }, {
      id: "com.palm.app.settings",
      params: {}
    }], 0, tr("Network settings"));
  }
  var legacyOrderKey = "tvhome.order";
  // App editing uses the existing grid positions and focus highlight.
  var library, hideButton, editHint, picker, pickerList, pickerStatus, pickerClose;
  var pickerOpen = false,
    pickerGeneration = 0,
    pickerIndex = 0,
    pickerButtons = [];
  var hideSelected = false,
    undoState = null,
    undoTimer = null,
    undoBar,
    undoButton,
    pointerTimer = null,
    suppressClick = false;
  function screenIds() {
    return tiles.filter(function (item) {
      return !item.add;
    }).map(function (item) {
      return item.app.id;
    });
  }
  function saveScreen(hidden) {
    try {
      library.save(screenIds(), hidden || library.hidden());
      return true;
    } catch (error) {
      showToast(tr("Couldn't save changes. Please try again."));
      return false;
    }
  }
  function rebuild(focusId) {
    tilesContainer.innerHTML = "";
    tiles = library.visible().map(createTile);
    var el = document.createElement('div');
    el.className = 'item add-app';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Altre app');
    el.innerHTML = ht('<div class="card"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 10v28M10 24h28"/></svg></div><div class="name">Add app</div>');
    var item = {
      add: true,
      app: {
        title: 'Altre app'   // fork lorenzoma97: the "+" list opens apps now (and adds them on a hold)
      },
      el: el,
      color: [100, 110, 125]
    };
    el.addEventListener('mouseover', function () {
      if (!moveState && !pickerOpen && !undoState) {
        focusTile(tiles.length - 1);
      }
    });
    el.addEventListener('click', function () {
      if (!moveState) {
        openPicker();
      }
    });
    tilesContainer.appendChild(el);
    tiles.push(item);
    layoutTiles();
    tiles.forEach(function (tile) {
      tile.el.classList.add('shown');
    });
    focusZone = 'none';
    var nextFocus = 0;
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].app.id === focusId) {
        nextFocus = i;
        break;
      }
    }
    focusTile(nextFocus);
  }
  function activateTile(item) {
    if (item.add) {
      openPicker();
    } else if (item.app.id === 'airplay') {
      callLuna('luna://airplay.service/showAirplayPage', {}, function (result) {
        if (!result || !result.returnValue) {
          launchApp(item.app.id, item.app.title);
        }
      }, 5000);
    } else {
      launchApp(item.app.id, item.app.title);
    }
  }
  function cancelHold() {
    clearTimeout(okHoldTimer);
    okHoldTimer = null;
    clearTimeout(okReleaseTimer);   // fork lorenzoma97
    okReleaseTimer = null;
    clearTimeout(pointerTimer);
    pointerTimer = null;
    okPressed = false;
  }
  function beginMoving(item) {
    if (!item || item.add || moveState || pickerOpen || undoState) {
      return;
    }
    moveState = {
      item: item,
      snapshot: tiles.slice()
    };
    item.el.classList.add('moving');
    document.body.classList.add('editing');
    hideButton.hidden = false;
    editHint.hidden = false;
    hideButton.classList.remove('focused');
    hideSelected = false;
    focusTile(tiles.indexOf(item));
  }
  function pointerMove(item) {
    if (!moveState || item.add) {
      return;
    }
    hideSelected = false;
    hideButton.classList.remove('focused');
    moveTile(tiles.indexOf(item));
  }
  function bindHold(item) {
    item.el.addEventListener('mousedown', function (event) {
      if (event.button !== 0 || moveState || pickerOpen || undoState) {
        return;
      }
      focusTile(tiles.indexOf(item));
      clearTimeout(pointerTimer);
      suppressClick = false;
      pointerTimer = setTimeout(function () {
        pointerTimer = null;
        suppressClick = true;
        beginMoving(item);
      }, 600);
    });
    item.el.addEventListener('mouseleave', function () {
      clearTimeout(pointerTimer);
      pointerTimer = null;
    });
  }
  function tileClick(item) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (pickerOpen || undoState) {
      return;
    }
    if (moveState) {
      pointerMove(item);
      finishMoving(true);
    } else {
      activateTile(item);
    }
  }
  function selectHide() {
    if (!moveState) {
      return;
    }
    hideSelected = true;
    hideButton.classList.add('focused');
    hideButton.focus();
  }
  function hideApp() {
    if (!moveState) {
      return;
    }
    var item = moveState.item,
      snapshot = moveState.snapshot.slice(),
      oldHidden = library.hidden();
    var previous = tiles.slice();
    tiles = tiles.filter(function (tile) {
      return tile !== item;
    });
    if (!saveScreen(oldHidden.concat(item.app.id))) {
      tiles = previous;
      return;
    }
    moveState = null;
    hideSelected = false;
    item.el.classList.remove('moving');
    document.body.classList.remove('editing');
    hideButton.hidden = true;
    editHint.hidden = true;
    item.el.remove();
    layoutTiles();
    focusZone = 'none';
    focusTile(Math.min(focusedTile, tiles.length - 1));
    undoState = {
      ids: snapshot.filter(function (tile) {
        return !tile.add;
      }).map(function (tile) {
        return tile.app.id;
      }),
      hidden: oldHidden,
      id: item.app.id
    };
    undoBar.hidden = false;
    undoButton.focus();
    clearTimeout(undoTimer);   // fork lorenzoma97: the bar goes by itself; an OK much later used to bring the app back
    undoTimer = setTimeout(dismissUndo, 8000);
  }
  function dismissUndo() {
    if (!undoState) {
      return;
    }
    clearTimeout(undoTimer);
    undoState = null;
    undoBar.hidden = true;
    focusTile(focusedTile);
  }
  function undoHide() {
    if (!undoState) {
      return;
    }
    try {
      var id = undoState.id;
      library.save(undoState.ids, undoState.hidden);
      dismissUndo();
      rebuild(id);
    } catch (error) {
      showToast(tr("Couldn't restore app. Please try again."));
    }
  }
  function closePicker() {
    if (!pickerOpen) {
      return;
    }
    clearTimeout(pickerHoldTimer);
    clearTimeout(pickerReleaseTimer);
    pickerHoldTimer = pickerReleaseTimer = null;
    pickerOpen = false;
    pickerGeneration++;
    picker.hidden = true;
    cancelHold();
    focusZone = 'none';
    focusTile(tiles.length - 1);
  }
  function focusPicker(index) {
    pickerIndex = Math.max(0, Math.min(index, pickerButtons.length - 1));
    pickerButtons[pickerIndex].focus();
    pickerButtons[pickerIndex].scrollIntoView({
      block: 'nearest'
    });
  }
  function renderPicker(apps) {
    pickerList.innerHTML = '';
    pickerButtons = [];
    apps.forEach(function (app) {
      var button = document.createElement('button');
      button.className = 'app-choice';
      button.dataset.appId = app.id;
      var icon = document.createElement('img');
      icon.src = app.icon || '';
      icon.alt = '';
      icon.onerror = function () {
        icon.style.visibility = 'hidden';
      };
      var title = document.createElement('span');
      title.textContent = app.title;
      button.appendChild(icon);
      button.appendChild(title);
      button.app = app;
      button.addEventListener('focus', function () {
        pickerIndex = pickerButtons.indexOf(button);
      });
      // Fork lorenzoma97: OK (or a click) opens the app; holding OK (or the pointer) adds it to Home.
      button.addEventListener('click', function () {
        if (button.added) {
          button.added = false;
          return;
        }
        closePicker();
        launchApp(app.id, app.title);
      });
      button.addEventListener('mousedown', function () {
        clearTimeout(pickerHoldTimer);
        pickerHoldTimer = setTimeout(function () {
          pickerHoldTimer = null;
          button.added = true;
          addFromPicker(app);
        }, 600);
      });
      button.addEventListener('mouseleave', function () {
        clearTimeout(pickerHoldTimer);
        pickerHoldTimer = null;
      });
      pickerList.appendChild(button);
      pickerButtons.push(button);
    });
    pickerButtons.push(pickerClose);
    focusPicker(0);
  }
  function addFromPicker(app) {
    try {
      library.add(app.id);
      closePicker();
      rebuild(app.id);
      showToast(tr('{app} added', {
        app: app.title
      }));
    } catch (error) {
      pickerStatus.textContent = tr("Couldn't save changes. Please try again.");
    }
  }
  // Fork lorenzoma97: in the "+" list (Altre app) OK opens the app and holding OK adds it to Home; it used to add only,
  // so opening the browser meant adding it, opening it and hiding it again. Held keys may repeat as keyup/keydown pairs.
  var pickerHoldTimer = null,
    pickerReleaseTimer = null;
  function pickerPress() {
    var button = pickerButtons[pickerIndex];
    if (!button || !button.app) {
      return button && button.click();
    }
    if (pickerReleaseTimer) {
      clearTimeout(pickerReleaseTimer);
      pickerReleaseTimer = null;
      return;
    }
    clearTimeout(pickerHoldTimer);
    pickerHoldTimer = setTimeout(function () {
      pickerHoldTimer = null;
      addFromPicker(button.app);
    }, 600);
  }
  function pickerRelease() {
    if (!pickerHoldTimer) {
      return;
    }
    var button = pickerButtons[pickerIndex];
    clearTimeout(pickerReleaseTimer);
    pickerReleaseTimer = setTimeout(function () {
      pickerReleaseTimer = null;
      if (!pickerHoldTimer) {
        return;
      }
      clearTimeout(pickerHoldTimer);
      pickerHoldTimer = null;
      button.click();
    }, 150);
  }
  function openPicker() {
    if (moveState || pickerOpen) {
      return;
    }
    dismissUndo();
    cancelHold();
    pickerOpen = true;
    var generation = ++pickerGeneration;
    picker.hidden = false;
    pickerStatus.textContent = tr('Checking installed apps…');
    pickerList.innerHTML = '';
    pickerButtons = [pickerClose];
    focusPicker(0);
    setFocusZone('picker');
    AppLibrary.installed(function (apps) {
      if (!pickerOpen || generation !== pickerGeneration) {
        return;
      }
      if (apps !== null) {
        library.refresh(apps);
      }
      var choices = library.available();
      pickerStatus.textContent = apps === null ? tr('Showing the saved list. Could not refresh apps from the TV.') : choices.length ? 'OK apre l\u2019app   \u00b7   Tieni premuto OK per aggiungerla a Home' : tr('All installed apps are already on Home.');
      renderPicker(choices);
    });
  }
  function initializeApps() {
    library = AppLibrary.create(localStorage, window.TV_APPS && TV_APPS.apps || [], CONFIG);
    hideButton = document.createElement('button');
    hideButton.id = 'hideApp';
    hideButton.hidden = true;
    hideButton.innerHTML = ht('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10 5.2c5.5-1 10 6.8 10 6.8a20 20 0 0 1-3 3M6 6C3.4 8 2 12 2 12s4 7 10 7c1.4 0 2.7-.4 4-1M9 9a4.2 4.2 0 0 0 6 6"/></svg><span>Hide from Home</span>');
    hideButton.addEventListener('mouseover', selectHide);
    hideButton.addEventListener('click', hideApp);
    document.body.appendChild(hideButton);
    editHint = document.createElement('div');
    editHint.id = 'editHint';
    editHint.hidden = true;
    editHint.textContent = CONFIG.dockScroll ? '\u25c0 \u25b6 Sposta   \u00b7   \u25bc Nascondi   \u00b7   OK Fissa   \u00b7   Indietro Annulla'
      : tr('← ↑ ↓ → Move   ·   OK Place   ·   Back Cancel   ·   ↓ Below last row to hide');
    document.body.appendChild(editHint);
    undoBar = document.createElement('div');
    undoBar.id = 'appUndo';
    undoBar.hidden = true;
    undoBar.setAttribute('role', 'status');
    var message = document.createElement('span');
    message.textContent = tr('App hidden. Add it back with +.');
    undoBar.appendChild(message);
    undoButton = document.createElement('button');
    undoButton.textContent = tr('Undo');
    undoButton.addEventListener('click', undoHide);
    undoBar.appendChild(undoButton);
    document.body.appendChild(undoBar);
    picker = document.createElement('section');
    picker.id = 'appPicker';
    picker.hidden = true;
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-modal', 'true');
    picker.setAttribute('aria-labelledby', 'appPickerTitle');
    picker.innerHTML = ht('<div class="app-picker-card"><h2 id="appPickerTitle">Add app</h2><p id="appPickerStatus" role="status"></p><div id="appPickerList"></div><button id="appPickerClose">Back to Home</button></div>');
    document.body.appendChild(picker);
    pickerList = getElement('appPickerList');
    pickerStatus = getElement('appPickerStatus');
    pickerClose = getElement('appPickerClose');
    getElement('appPickerTitle').textContent = 'Altre app';   // fork lorenzoma97: it opens them now, and adds on a hold
    pickerClose.addEventListener('click', closePicker);
    document.addEventListener('mouseup', function () {
      clearTimeout(pointerTimer);
      pointerTimer = null;
      setTimeout(function () {
        suppressClick = false;
      }, 0);
    });
    window.addEventListener('blur', cancelHold);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelHold();
        if (moveState) {
          finishMoving(false);
        }
      }
    });
    document.addEventListener('keydown', function (event) {
      var key = event.keyCode;
      if (pickerOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 27 || key === 461) {
          closePicker();
        } else if (key === 13 && !event.repeat) {
          pickerPress();
        } else if (key === 38 || key === 37) {
          focusPicker(pickerIndex - 1);
        } else if (key === 40 || key === 39) {
          focusPicker(pickerIndex + 1);
        } else if (key === 9) {
          focusPicker((pickerIndex + (event.shiftKey ? -1 : 1) + pickerButtons.length) % pickerButtons.length);
        }
      } else if (undoState) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 13 && !event.repeat) {
          undoHide();
        } else if (key === 27 || key === 461 || key >= 37 && key <= 40) {
          dismissUndo();
        }
      } else if (moveState && hideSelected) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 13 && !event.repeat) {
          hideApp();
        } else if (key === 27 || key === 461) {
          finishMoving(false);
        } else if (key === 38) {
          hideSelected = false;
          hideButton.classList.remove('focused');
          hideButton.blur();
          focusTile(focusedTile);
        }
      }
    }, true);
    document.addEventListener('keyup', function (event) {
      if (pickerOpen && event.keyCode === 13) {
        pickerRelease();
      }
      if (pickerOpen || undoState || hideSelected) {
        cancelHold();
        event.stopImmediatePropagation();
      }
    }, true);
    rebuild();
    AppLibrary.installed(function (apps) {
      if (apps !== null) {
        library.refresh(apps);
        // Keep inventory updates, but let the next normal rebuild render them
        // when a menu, edit or button hold already owns the interaction.
        if (focusZone === 'grid' && !moveState && !pickerOpen && !undoState &&
            !okHoldTimer && !pointerTimer && !document.hidden &&
            !(window.RenewalPanel && window.RenewalPanel.isOpen())) {
          rebuild(tiles[focusedTile] && tiles[focusedTile].app.id);
        }
      }
    });
  }
  // Tile rendering, icon colors and grid geometry.
  function createTile(app) {
    var element = document.createElement("div");
    element.className = "item";
    element.dataset.appId = app.id;
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", app.title);
    var card = document.createElement("div");
    card.className = "card";
    var image = document.createElement("img"),
      tile = {
        app: app,
        el: element,
        card: card,
        color: null
      };
    image.onload = function () {
      !function (e, t) {
        var n = null,
          a = null;
        try {
          var i = document.createElement("canvas");
          i.width = 12;
          i.height = 12;
          var o = i.getContext("2d");
          o.drawImage(t, 0, 0, 12, 12);
          n = o.getImageData(0, 0, 12, 12).data;
          a = function (e) {
            var t = e.naturalWidth,
              n = e.naturalHeight,
              a = document.createElement("canvas");
            a.width = t;
            a.height = n;
            var i = a.getContext("2d");
            i.drawImage(e, 0, 0);
            var o = i.getImageData(2, 2, 1, 1).data;
            return o[3] > 200 ? o : i.getImageData(2, Math.floor(n / 2), 1, 1).data;
          }(t);
        } catch (e) {}
        var r = null;
        a && a[3] > 200 ? e.card.style.background = "rgb(" + a[0] + "," + a[1] + "," + a[2] + ")" : (e.card.classList.add("glyph"), e.card.style.background = tileBackground(e.app.iconColor), r = "#2c2c2e" === tileBackground(e.app.iconColor) ? null : parseHexColor(e.app.iconColor));
        e.color = r || (n ? function (e) {
          for (var t = null, n = -1, a = [0, 0, 0], i = 0, o = 0; o < e.length; o += 4) if (!(e[o + 3] < 128)) {
            var r = [e[o], e[o + 1], e[o + 2]];
            a[0] += r[0];
            a[1] += r[1];
            a[2] += r[2];
            i++;
            var s = rgbToHsv(r),
              l = s[1] * Math.min(1, 1.4 * s[2]);
            l > n && (n = l, t = r);
          }
          if (!i) {
            return [68, 68, 68];
          }
          if (n < .25) {
            var c = rgbToHsv([a[0] / i, a[1] / i, a[2] / i]);
            return c[2] = Math.max(c[2], .55), hsvToRgb(c);
          }
          var u = rgbToHsv(t);
          return u[1] = Math.min(1, 1.1 * u[1]), u[2] = Math.max(.5, u[2]), hsvToRgb(u);
        }(n) : parseHexColor(e.app.iconColor));
        tiles[focusedTile] === e && updateAmbient(e.color);
      }(tile, image);
    };
    image.onerror = function () {
      image.style.display = "none";
      card.classList.add("missing-icon");
      card.setAttribute("data-initial", app.title.charAt(0));
    };
    // Fork lorenzoma97: the dock's own tiles (casa-tiles.js) in place of the apps' small icons.
    var art = window.CASA_TILES && CASA_TILES[app.id];
    if (art) card.classList.add("art");
    image.src = art || app.icon || "missing-icon";
    card.appendChild(image);
    element.appendChild(card);
    var label = document.createElement("div");
    return label.className = "name", label.textContent = app.title, element.appendChild(label), element.addEventListener("mouseover", function () {
      "inputs" === focusZone || pickerOpen || undoState || (moveState ? pointerMove(tile) : focusTile(tiles.indexOf(tile)));
    }), element.addEventListener("click", function () {
      tileClick(tile);
    }), bindHold(tile), tilesContainer.appendChild(element), tile;
  }
  function rowFor(index) {
    return Math.floor(index / columnCount);
  }
  // Fork lorenzoma97: a tile's place in the row (slotLeft) and on screen (tileLeft): with dockScroll the row slides as one
  // (#tiles translateX), instead of every tile moving its own left (a layout per tile per frame).
  function slotLeft(index) {
    return GRID_LEFT + index % columnCount * columnWidth + (columnWidth - CARD_WIDTH) / 2;
  }
  function tileLeft(index) {
    return slotLeft(index) - dockStart * columnWidth;
  }
  function tileTop(index) {
    var row = rowFor(index);
    return TILE_BASE + (CARD_HEIGHT + ROW_GAP) * row + (row > 0 ? 36 : 0);
  }
  function layoutTiles() {
    tiles.forEach(function (e, t) {
      tilesContainer.appendChild(e.el);
      e.el.style.width = CARD_WIDTH + "px";
      e.el.querySelector(".card").style.height = CARD_HEIGHT + "px";
      e.el.style.left = slotLeft(t) + "px";
      e.el.style.top = tileTop(t) + "px";
      e.el.classList.toggle("dock", 0 === rowFor(t));
    });
    var dockBand = getElement("dockBand"),
      dockCount = Math.min(visibleColumns, tiles.length);
    dockBand.style.display = dockCount ? "block" : "none";
    dockBand.style.left = tileLeft(dockStart) - DOCK_PADDING + "px";
    dockBand.style.top = DOCK_TOP + "px";
    dockBand.style.width = (dockCount - 1) * columnWidth + CARD_WIDTH + DOCK_PADDING * 2 + "px";
    dockBand.style.height = DOCK_HEIGHT + "px";
    CONFIG.dockScroll && placeDock();
  }
  // Fork lorenzoma97: CONFIG.dockScroll, the apps in view; the others wait faded at either side.
  function placeDock() {
    tilesContainer.style.transform = "translateX(" + -dockStart * columnWidth + "px)";
    tiles.forEach(function (e, t) {
      e.el.classList.toggle("off", t < dockStart || t >= dockStart + visibleColumns);
    });
    document.body.classList.toggle("dock-more-left", dockStart > 0);
    document.body.classList.toggle("dock-more-right", tiles.length > dockStart + visibleColumns);
  }
  function animateTiles() {
    tiles.forEach(function (e, t) {
      e.el.classList.remove("shown");
      setTimeout(function () {
        e.el.classList.add("shown");
      }, 60 + 40 * Math.min(t, 16));
    });
  }
  function tileBackground(hex) {
    var rgb = parseHexColor(hex);
    if (!rgb) {
      return "#2c2c2e";
    }
    var hsv = rgbToHsv(rgb);
    return hsv[1] < .15 && (hsv[2] > .85 || hsv[2] < .1) ? "#2c2c2e" : "rgb(" + rgb.join(",") + ")";
  }
  function parseHexColor(hex) {
    var match = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!match) {
      return null;
    }
    var value = parseInt(match[1], 16);
    return [value >> 16 & 255, value >> 8 & 255, 255 & value];
  }
  function rgbToHsv(rgb) {
    var red = rgb[0] / 255,
      green = rgb[1] / 255,
      blue = rgb[2] / 255,
      maximum = Math.max(red, green, blue),
      delta = maximum - Math.min(red, green, blue),
      hue = 0;
    return delta && (hue = maximum === red ? (green - blue) / delta % 6 : maximum === green ? (blue - red) / delta + 2 : (red - green) / delta + 4, (hue *= 60) < 0 && (hue += 360)), [hue, maximum ? delta / maximum : 0, maximum];
  }
  function hsvToRgb(hsv) {
    var hue = hsv[0],
      saturation = hsv[1],
      value = hsv[2],
      chroma = value * saturation,
      secondary = chroma * (1 - Math.abs(hue / 60 % 2 - 1)),
      offset = value - chroma;
    return (hue < 60 ? [chroma, secondary, 0] : hue < 120 ? [secondary, chroma, 0] : hue < 180 ? [0, chroma, secondary] : hue < 240 ? [0, secondary, chroma] : hue < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary]).map(function (e) {
      return Math.round(255 * (e + offset));
    });
  }
  // Focus follows both remote navigation and Magic Remote hover.
  function focusTile(index) {
    if (tiles.length) {
      index = Math.max(0, Math.min(index, tiles.length - 1));
      if (CONFIG.dockScroll) {   // fork lorenzoma97: the row slides so the focused app is in view
        var start = Math.max(0, Math.min(dockStart, index), index - visibleColumns + 1);
        if (start !== dockStart) {
          dockStart = start;
          placeDock();
        }
      }
      setFocusZone("grid");
      tiles[focusedTile] && tiles[focusedTile].el.classList.remove("focused");
      focusedTile = index;
      tiles[index].el.classList.add("focused");
      var top = tileTop(index),
        row = rowFor(index);
      0 === row && !moveState ? scrollOffset = 0 : (top - scrollOffset + CARD_HEIGHT + 70 > (moveState ? 850 : 1060) && (scrollOffset = top + CARD_HEIGHT + 70 - (moveState ? 850 : 1060)), top - scrollOffset - 24 < 80 && (scrollOffset = top - 24 - 80));
      stage.style.transform = "translateY(" + -scrollOffset + "px)";
      var header = document.querySelector("header"),
        headerBottom = header.offsetTop + header.offsetHeight;
      document.body.classList.toggle("scrolled", DOCK_TOP - scrollOffset < headerBottom + 24);
      var glassWidth = FOCUS_SCALE * CARD_WIDTH + FOCUS_PADDING * 2,
        glassHeight = FOCUS_SCALE * CARD_HEIGHT + FOCUS_PADDING * 2,
        glassLeft = tileLeft(index) + CARD_WIDTH / 2 - glassWidth / 2,
        glassTop = top + CARD_HEIGHT / 2 - glassHeight / 2;
      focusGlass.style.width = glassWidth + "px";
      focusGlass.style.height = glassHeight + "px";
      focusGlass.style.transform = "translate(" + glassLeft + "px," + glassTop + "px)";
      focusGlassVisible || (focusGlass.style.transition = "none", focusGlass.offsetWidth, focusGlass.style.transition = "", focusGlass.style.opacity = "1", focusGlassVisible = true);
      0 === row ? function (e) {
        var t = e.app.title;
        heroTitle.style.top = (TILE_BASE - HERO_OFFSET) + "px";
        heroVisible ? heroTitle.textContent !== t && (heroTitle.style.opacity = "0", heroTitle.style.transform = "translateX(-24px)", clearTimeout(heroTitle.swap), heroTitle.swap = setTimeout(function () {
          heroTitle.textContent = t;
          heroTitle.style.transition = "none";
          heroTitle.style.transform = "translateX(24px)";
          heroTitle.offsetWidth;
          heroTitle.style.transition = "";
          heroTitle.style.transform = "none";
          heroTitle.style.opacity = "1";
        }, 120)) : (heroTitle.textContent = t, heroTitle.style.transform = "none", heroTitle.style.opacity = "1", heroVisible = true);
        updateAmbient(e.color);
      }(tiles[index]) : heroVisible && (heroVisible = false, heroTitle.style.opacity = "0");
      updateAmbient(tiles[index].color);
      window.CasaShelf && CasaShelf.focus(tiles[index].app, row, tiles[index].el, row === rowFor(tiles.length - 1));   // fork lorenzoma97
    }
  }
  function updateAmbient(rgb) {
    if (rgb) {
      var color = rgb.join(",");
      if (color !== ambientColor) {
        ambientColor = color;
        var nextLayer = ambientLayers[1 - ambientIndex];
        nextLayer.style.background = "radial-gradient(circle 1190px at 32% 42%, rgba(" + color + ",0.36) 0%, rgba(" + color + ",0.15) 50%, rgba(" + color + ",0) 100%)";
        nextLayer.style.opacity = "1";
        ambientLayers[ambientIndex].style.opacity = "0";
        ambientIndex = 1 - ambientIndex;
      }
    }
  }
  function focusTopButton(index) {
    setFocusZone("top");
    document.body.classList.remove("scrolled");
    topButtons[focusedTopButton].classList.remove("focused");
    focusedTopButton = Math.max(0, Math.min(index, topButtons.length - 1));
    lastTopButton = focusedTopButton;
    topButtons[focusedTopButton].classList.add("focused");
  }
  function setFocusZone(zone) {
    window.CasaShelf && CasaShelf.zone(zone);   // fork lorenzoma97
    focusZone !== zone && ("top" === focusZone && topButtons[focusedTopButton].classList.remove("focused"), "grid" === focusZone && (tiles[focusedTile] && tiles[focusedTile].el.classList.remove("focused"), focusGlassVisible = false, focusGlass.style.opacity = "0"), focusZone = zone);
  }
  function updateClock() {
    var now = new Date(),
      hour = now.getHours();
    for (var idx = 0; idx < greetings.length; idx++) if (hour < greetings[idx][0]) {
      getElement("greeting").textContent = greetings[idx][1];
      break;
    }
    if (window.HomeI18n) {
      getElement("clock").textContent = HomeI18n.formatTime(now);
      getElement("ampm").textContent = "";
      getElement("date").textContent = HomeI18n.formatDate(now);
    } else {
      getElement("clock").textContent = (hour % 12 || 12) + ":" + ("0" + now.getMinutes()).slice(-2);
      getElement("ampm").textContent = hour < 12 ? "am" : "pm";
      getElement("date").textContent = weekdays[now.getDay()] + "  " + now.getDate() + " " + months[now.getMonth()];
    }
  }
  function activateTopButton(index) {
    0 === index ? function () {
      if (inputsPanel.innerHTML = "", inputRows = [], (window.TV_APPS && TV_APPS.inputs || []).forEach(function (e) {
        addInputRow("M18,7V4c0,-1.1 -0.9,-2 -2,-2H8C6.9,2 6,2.9 6,4v3H5v6l3,6v3h8v-3l3,-6V7H18zM8,4h8v3h-2V5h-1v2h-2V5h-1v2H8V4z", e.label, e.appId);
      }), CONFIG.liveTvApp && (inputRows.length && addInputSeparator(), addInputRow("M21,6h-7.59l3.29,-3.29L16,2l-4,4l-4,-4l-0.71,0.71L10.59,6H3c-1.1,0 -2,0.89 -2,2v12c0,1.1 0.9,2 2,2h18c1.1,0 2,-0.89 2,-2V8C23,6.89 22.1,6 21,6zM21,20H3V8h18V20zM9,10v8l7,-4L9,10z", tr("Live TV"), CONFIG.liveTvApp)), inputRows.length) {
        var e = topButtons[0].getBoundingClientRect();
        inputsPanel.style.left = e.left + "px";
        inputsPanel.style.top = e.bottom + 20 + "px";
        inputsPanel.style.minWidth = Math.max(e.width, 300) + "px";
        inputsPanel.classList.remove("hidden");
        topButtons[focusedTopButton].classList.remove("focused");
        focusZone = "inputs";
        focusInput(0);
      } else {
        showToast(tr("No inputs found"));
      }
    }() : 1 === index ? openNetworkSettings() : window.RenewalPanel.open();
  }
  function addInputSeparator() {
    var separator = document.createElement("div");
    separator.className = "separator";
    inputsPanel.appendChild(separator);
  }
  function addInputRow(iconPath, label, appId) {
    var element = document.createElement("div");
    element.className = "inputRow";
    element.innerHTML = ht('<svg viewBox="0 0 24 24"><path d="') + iconPath + '"/></svg>';
    element.appendChild(document.createTextNode(label));
    var index = inputRows.length;
    element.addEventListener("mouseover", function () {
      focusInput(index);
    });
    element.addEventListener("click", function () {
      closeInputs();
      launchApp(appId, label);
    });
    element.appId = appId;
    element.label = label;
    inputRows.push(element);
    inputsPanel.appendChild(element);
  }
  function focusInput(index) {
    inputRows[focusedInput] && inputRows[focusedInput].classList.remove("focused");
    focusedInput = Math.max(0, Math.min(index, inputRows.length - 1));
    inputRows[focusedInput].classList.add("focused");
  }
  function closeInputs() {
    inputsPanel.classList.add("hidden");
    focusZone = "none";
    focusTopButton(0);
  }
  function moveTile(index) {
    index < 0 || index >= tiles.length - 1 || index === focusedTile || (tiles.splice(index, 0, tiles.splice(focusedTile, 1)[0]), focusedTile = index, layoutTiles(), focusTile(index));
  }
  function finishMoving(commit) {
    var item = moveState.item;
    if (commit && !saveScreen()) {
      return;
    }
    if (!commit) {
      tiles = moveState.snapshot;
    }
    moveState = null;
    item.el.classList.remove("moving");
    document.body.classList.remove("editing");
    hideSelected = false;
    hideButton.hidden = true;
    editHint.hidden = true;
    layoutTiles();
    focusTile(tiles.indexOf(item));
  }
  // Short OK launches on release; holding OK enters tile editing instead.
  var okPressed = false,
    okHoldTimer = null,
    okReleaseTimer = null,
    okUpAt = 0;   // fork lorenzoma97: when OK was last released (see keyup)
  function restoreFocus() {
    cancelHold();
    closePicker();
    dismissUndo();
    moveState && finishMoving(false);
    updateClock();
    "inputs" === focusZone && inputsPanel.classList.add("hidden");
    topButtons.forEach(function (e) {
      e.classList.remove("focused");
    });
    focusZone = "none";
    focusTile(focusedTile);
  }
  document.addEventListener("keyup", function (event) {
    if (window.RenewalPanel && window.RenewalPanel.isOpen()) {
      okPressed = false;
      return;
    }
    if (event.keyCode === KEY_OK) okUpAt = Date.now();
    if (event.keyCode === KEY_OK && (okPressed = false, okHoldTimer)) {
      // Fork lorenzoma97: some remotes send a held OK as keyup/keydown pairs. A release counts only when no new OK
      // follows within 150 ms, so holding still reaches tile editing instead of opening the app.
      clearTimeout(okReleaseTimer);
      okReleaseTimer = setTimeout(function () {
        okReleaseTimer = null;
        if (!okHoldTimer) return;
        clearTimeout(okHoldTimer);
        okHoldTimer = null;
        var tile = tiles[focusedTile];
        "grid" === focusZone && tile && !moveState && activateTile(tile);
      }, 150);
    }
  });
  document.addEventListener("keydown", function (event) {
    var key = event.keyCode;
    if (key !== KEY_OK) okUpAt = 0;   // fork lorenzoma97: another key in between, so the next OK is a new press
    if (key !== KEY_OK && okHoldTimer) {
      cancelHold();
    }
    if (key === KEY_OK && okPressed) {
      event.preventDefault();
    } else {
      if (key === KEY_OK && (okPressed = true), moveState) {
        if (37 === key) {
          moveTile(focusedTile - 1);
        } else if (39 === key) {
          moveTile(focusedTile + 1);
        } else if (38 === key) {
          moveTile(focusedTile - columnCount);
        } else if (40 === key) {
          if (rowFor(focusedTile) >= rowFor(tiles.length - 2)) {
            selectHide();
          } else {
            moveTile(Math.min(focusedTile + columnCount, tiles.length - 2));
          }
        } else if (key === KEY_OK) {
          // Fork lorenzoma97: an OK right after a release is the held OK repeating, not the press that drops the tile.
          if (Date.now() - okUpAt < 150) return event.preventDefault();
          finishMoving(true);
        } else {
          if (key !== KEY_BACK && 27 !== key) {
            return;
          }
          finishMoving(false);
        }
      } else if ("inputs" === focusZone) {
        if (38 === key) {
          if (0 === focusedInput) {
            closeInputs();
          } else {
            focusInput(focusedInput - 1);
          }
        } else if (40 === key) {
          focusInput(focusedInput + 1);
        } else if (key === KEY_OK) {
          var input = inputRows[focusedInput];
          closeInputs();
          launchApp(input.appId, input.label);
        } else {
          if (key !== KEY_BACK && 27 !== key && 37 !== key && 39 !== key) {
            return;
          }
          closeInputs();
        }
      } else if ("top" === focusZone) {
        if (37 === key) {
          focusTopButton(focusedTopButton - 1);
        } else if (39 === key) {
          focusTopButton(focusedTopButton + 1);
        } else if (40 === key) {
          focusTile(0 === rowFor(focusedTile) ? focusedTile : 0);
        } else if (key === KEY_OK) {
          activateTopButton(focusedTopButton);
        } else if (key === KEY_BACK) {
          focusTile(focusedTile);   // fork lorenzoma97: Back goes down a level, to the app Up came from
        } else {
          return;
        }
      } else {
        var column = focusedTile % columnCount,
          lastIndex = tiles.length - 1;
        if (37 === key) {
          // Fork lorenzoma97: with dockScroll the row wraps: Left on the first app goes to the end ("+", Spotify in 2).
          CONFIG.dockScroll && focusedTile === 0 ? focusTile(lastIndex) : column > 0 && focusTile(focusedTile - 1);
        } else if (39 === key) {
          CONFIG.dockScroll && focusedTile === lastIndex ? focusTile(0) : column < columnCount - 1 && focusedTile < lastIndex && focusTile(focusedTile + 1);
        } else if (38 === key) {
          // Fork lorenzoma97: on the dock, Up goes to the top bar's last used button, wherever the tile is.
          0 === rowFor(focusedTile) ? focusTopButton(lastTopButton) : focusTile(focusedTile - columnCount);
        } else if (40 === key) {
          rowFor(focusedTile) < rowFor(lastIndex) && focusTile(Math.min(focusedTile + columnCount, lastIndex));
        } else if (key === KEY_OK) {
          if (okReleaseTimer) {   // fork lorenzoma97: the same OK, still held (see keyup)
            clearTimeout(okReleaseTimer);
            okReleaseTimer = null;
          } else okHoldTimer = setTimeout(function () {
            okHoldTimer = null;
            beginMoving(tiles[focusedTile]);
          }, 600);
        } else if (key === KEY_BACK) {
          CONFIG.dockScroll && focusTile(0);   // fork lorenzoma97: Back on the row: to its start, Netflix
        } else {
          return;
        }
      }
      var tileCenter, nearestButton, nearestDistance;
      event.preventDefault();
    }
  });
  topButtons.forEach(function (e, t) {
    e.addEventListener("mouseover", function () {
      "inputs" !== focusZone && !moveState && !pickerOpen && !undoState && focusTopButton(t);
    });
    e.addEventListener("click", function () {
      if (!moveState && !pickerOpen && !undoState) {
        activateTopButton(t);
      }
    });
  });
  document.addEventListener("webOSRelaunch", restoreFocus);
  document.addEventListener("visibilitychange", function () {
    document.hidden || restoreFocus();
  });
  initializeApps();
  layoutTiles();
  updateClock();
  setInterval(updateClock, 1e4);
  callLuna("luna://com.palm.connectionmanager/getStatus", {
    subscribe: true
  }, function (e) {
    if (false !== e.returnValue || e.wifi || e.wired) {
      var t = "Wi-Fi";
      e.wired && "connected" === e.wired.state ? t = tr("Ethernet") : e.wifi && "connected" === e.wifi.state ? t = e.wifi.ssid || "Wi-Fi" : false === e.isInternetConnectionAvailable && (t = tr("Offline"));
      getElement("wifiLabel").textContent = t;
    }
  });
  animateTiles();
  focusZone = "none";
  focusTile(0);
  window.HomeApp = {launch: launchApp, focusTop: function () { focusTopButton(lastTopButton); }};   // fork lorenzoma97: casa-shelf.js plays a title with the same launch
  window.RootLauncherRendered = true;
}();
