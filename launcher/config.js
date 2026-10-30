// Fork lorenzoma97 (C3, 55"): one row that slides (dockScroll), nine tiles in view, each about 9 cm wide; discovery+ and
// Spotify one step right of RaiPlay, "+" at the end. The order is a proposal, rearranged on the TV by holding OK; the
// other apps stay one "+" away.
window.CONFIG = {columns: 9, dockScroll: true,
  dockApps: ["netflix", "amazon", "com.disney.disneyplus-prod", "com.wbd.stream", "youtube.leanback.v4", "dazn", "com.atlas.tv",
    "it.rainet.raiplay", "com.discovery.dplus.emea", "spotify-beehive"],
  hiddenApps: ["com.gathin.tvhome", "com.local.nativehome", "com.5412449.198417", "ui30",
    "com.twin.app.audiochannel", "webos.day", "com.miniclip.eightballpool", "com.palmdts.devmode",
    // LG's own apps seen on the TV: one "+" away like the rest.
    "com.webos.app.discovery", "com.webos.app.browser", "com.webos.app.livetv", "com.webos.app.lglink-full",
    "com.webos.app.storagemanager", "com.webos.app.sportsteamsettings"]};
