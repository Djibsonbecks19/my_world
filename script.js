// extras is optional: if it fails to load, the rest of the site still works
var extrasReady = import("./extras.js").catch(function(e) { console.warn("extras.js failed to load", e); });
import { db, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, doc, getDoc, setDoc, increment } from "./firebaseConfig.js";

// Uses your Render backend, except when you open the site through `node server.js` on port 3000
var API = (location.port === '3000') ? '' : 'https://my-world-scfp.onrender.com';

// ── CONFIG ──
var LASTFM_API_KEY = "c4a45229f399e4a82afbd7e2d30612dc";
var LASTFM_USER = "sonbecks";
var GITHUB_USERNAME = "Djibsonbecks19";
var WEATHER_LAT = 14.6928, WEATHER_LON = -17.4467, WEATHER_LABEL = "Dakar, SN";
// Shown ONLY if the backend can't reach the Valorant API. Type your real rank e.g. 'Platinum 2' (or leave '' to show OFFLINE)
var VAL_MANUAL = { current: '', peak: '' };

// shared with extras.js (Music page)
window.HUB = { LASTFM_API_KEY: LASTFM_API_KEY, LASTFM_USER: LASTFM_USER };

var videoTrimSeconds = { default: 3 };
function getTrimFor(f) { return videoTrimSeconds[f] != null ? videoTrimSeconds[f] : videoTrimSeconds.default; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

// ── CACHE ──
function cacheGet(key, ttlMs) {
  try {
    var raw = localStorage.getItem('cache:' + key);
    if (!raw) return null;
    var p = JSON.parse(raw);
    return Date.now() - p.t > ttlMs ? null : p.v;
  } catch (e) { return null; }
}
function cacheSet(key, v) { try { localStorage.setItem('cache:' + key, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }
async function fetchJSON(url, opts) { try { var r = await fetch(url, opts); return r.ok ? await r.json() : null; } catch (e) { return null; } }
async function cachedFetchJSON(key, ttlMs, url, opts) {
  var hit = cacheGet(key, ttlMs);
  if (hit) return hit;
  var data = await fetchJSON(url, opts);
  if (data) cacheSet(key, data);
  return data;
}

// ── AUDIO VISUALIZER ──
var audioCtx = null, analyzer = null, frequencyData = null, isVisualizerSetup = false;
function setupAudioVisualizer(videoElement) {
  if (isVisualizerSetup) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 32;
    var src = audioCtx.createMediaElementSource(videoElement);
    src.connect(analyzer);
    analyzer.connect(audioCtx.destination);
    frequencyData = new Uint8Array(analyzer.frequencyBinCount);
    isVisualizerSetup = true;
    renderFrequencies();
  } catch (e) { console.warn("Visualizer waiting for a click."); }
}
function renderFrequencies() {
  if (!isVisualizerSetup || !analyzer) return;
  requestAnimationFrame(renderFrequencies);
  var video = document.getElementById('bg-video');
  var bars = document.getElementById('music-waveform').querySelectorAll('.bar');
  if (video.muted || video.paused) { bars.forEach(function(b) { b.style.height = '3px'; }); return; }
  analyzer.getByteFrequencyData(frequencyData);
  bars.forEach(function(b, i) { b.style.height = Math.min(Math.max(((frequencyData[i * 2] || 0) / 255) * 14, 3), 14) + 'px'; });
}

// ── LIVE GUESTBOOK FEED ──
function setupLiveFeed() {
  var feed = document.getElementById('gb-live-feed');
  if (!feed) return;
  var q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(50));
  onSnapshot(q, function(snapshot) {
    feed.innerHTML = '';
    snapshot.forEach(function(d) {
      var data = d.data();
      var t = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      var div = document.createElement('div');
      div.className = 'feed-item';
      div.textContent = (t ? '[' + t + '] ' : '') + '> ' + data.text;
      feed.appendChild(div);
    });
  });
}
setupLiveFeed();

// ── DISCORD STATE ──
async function loadDiscordState() {
  try {
    var json = await cachedFetchJSON('discord', 10000, 'https://api.lanyard.rest/v1/users/819598941510959175');
    if (!json || !json.success) return;
    var s = json.data.discord_status || 'offline';
    var sMap = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
    var colors = { online: '#00ff66', idle: '#f59e0b', dnd: '#ef4444', offline: '#ff3333' };
    var dot = document.getElementById('tb-dc-dot');
    if (dot) { var c = colors[s] || colors.offline; dot.style.background = c; dot.style.boxShadow = '0 0 8px ' + c; }
    var lbl = document.getElementById('tb-dc-lbl');
    if (lbl) lbl.textContent = sMap[s] || 'Discord';
    if (json.data.listening_to_spotify && json.data.spotify) {
      var sp = json.data.spotify;
      document.getElementById('np-label').textContent = 'NOW PLAYING · SPOTIFY';
      document.getElementById('np-track').textContent = sp.song + ' — ' + sp.artist;
    }
  } catch (e) {}
}

// ── ROBLOX ──
function showRblxFail() {
  document.getElementById('rblx-pres-state').textContent = 'Live System Offline';
  ['rblx-friends', 'rblx-joined', 'rblx-status', 'rblx-uid'].forEach(function(id) { document.getElementById(id).textContent = '—'; });
}
async function loadRoblox() {
  try {
    var idRes = await fetch(API + '/api/roblox/userid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tanqr_headchot' }) });
    if (!idRes.ok) { showRblxFail(); return; }
    var idData = await idRes.json();
    var uid = idData && idData.data && idData.data[0] ? idData.data[0].id : null;
    if (!uid) { showRblxFail(); return; }
    document.getElementById('rblx-uid').textContent = uid;
    document.getElementById('rblx-id-label').textContent = 'ID: ' + uid;

    fetchJSON(API + '/api/roblox/avatar/' + uid).then(function(d) {
      var u = d && d.data && d.data[0] ? d.data[0].imageUrl : null;
      if (u) { var img = document.getElementById('rblx-av-img'); img.src = u; img.style.display = 'block'; document.getElementById('rblx-av-svg').style.display = 'none'; }
    });
    fetchJSON(API + '/api/roblox/user/' + uid).then(function(d) {
      if (d && d.created) document.getElementById('rblx-joined').textContent = new Date(d.created).getFullYear();
    });
    fetchJSON(API + '/api/roblox/friends/' + uid).then(function(d) {
      if (d && d.count != null) document.getElementById('rblx-friends').textContent = d.count;
    });
    fetchJSON(API + '/api/roblox/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [uid] }) }).then(function(d) {
      var p = d && d.userPresences ? d.userPresences[0] : null;
      if (!p) return;
      var label = { 0: 'Offline', 1: 'Online', 2: 'In Game', 3: 'In Studio' }[p.userPresenceType] || 'Unknown';
      document.getElementById('rblx-pres-state').textContent = label;
      document.getElementById('rblx-status').textContent = label;
      if (p.lastLocation) document.getElementById('rblx-pres-game').textContent = p.lastLocation.slice(0, 18);
      var btn = document.getElementById('rblx-join-btn');
      if (btn) btn.classList.toggle('hidden', !(p.userPresenceType === 1 || p.userPresenceType === 2));
    });
  } catch (e) { showRblxFail(); }
}

// ── VALORANT: rank text from backend (Henrik) → rank NUMBER → icon image ──
// Valorant tier numbers: Iron 1 = 3 ... Radiant = 27 (0 = Unranked)
var TIER_NAMES = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ASCENDANT', 'IMMORTAL'];
var RANK_COLORS = { IRON: '#8a8a8a', BRONZE: '#b8814f', SILVER: '#d0d6d8', GOLD: '#ecc65a', PLATINUM: '#3fc1d3', DIAMOND: '#b98cf5', ASCENDANT: '#2fd27a', IMMORTAL: '#ee4a63', RADIANT: '#ffe58a' };
function tierIdFromName(name) {
  if (!name) return null;
  var n = String(name).toUpperCase().trim();
  if (n === 'RADIANT') return 27;
  if (n === 'UNRANKED' || n === 'UNRATED') return 0;
  var m = n.match(/^(IRON|BRONZE|SILVER|GOLD|PLATINUM|DIAMOND|ASCENDANT|IMMORTAL)\s*([1-3])$/);
  return m ? 3 + TIER_NAMES.indexOf(m[1]) * 3 + (parseInt(m[2], 10) - 1) : null;
}
function tierGroup(id) { if (id == null || id < 3) return null; return id >= 27 ? 'RADIANT' : TIER_NAMES[Math.floor((id - 3) / 3)]; }
function tierIconUrls(id) {
  var base = 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/' + id;
  return [base + '/largeicon.png', base + '/smallicon.png', 'https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/' + id + '.png'];
}
function setRankIcon(img, id) {
  var urls = tierIconUrls(id), i = 0;
  img.onerror = function() { i++; if (i < urls.length) img.src = urls[i]; else img.onerror = null; };
  img.onload = function() { img.classList.remove('rank-pop'); void img.offsetWidth; img.classList.add('rank-pop'); };
  img.src = urls[0];
}
async function loadValorantStats() {
  var cur = VAL_MANUAL.current, peak = VAL_MANUAL.peak, rr = null, curId = null, peakId = null;
  try {
    var r = await fetch(API + '/api/valorant');
    if (r.ok) {
      var j = await r.json();
      if (j && j.current) { cur = j.current.name || cur; curId = j.current.id != null ? j.current.id : null; rr = j.current.rr; }
      if (j && j.peak) { peak = j.peak.name || peak; peakId = j.peak.id != null ? j.peak.id : null; }
    }
  } catch (e) { console.warn("Valorant backend unreachable, using manual rank."); }
  if (curId == null) curId = tierIdFromName(cur);
  if (peakId == null) peakId = tierIdFromName(peak);
  var showId = peakId != null ? peakId : curId;

  var tierEl = document.getElementById('val-tier'), curEl = document.getElementById('val-current'), icon = document.getElementById('val-rank-icon');
  tierEl.textContent = peak ? peak.toUpperCase() : (cur ? cur.toUpperCase() : 'OFFLINE');
  if (curEl) curEl.textContent = cur ? cur.toUpperCase() + (rr != null ? ' · ' + rr + ' RR' : '') : '—';
  if (showId != null && icon._id !== showId) { icon._id = showId; setRankIcon(icon, showId); }
  var group = tierGroup(showId), card = document.querySelector('.val-tracker-module');
  if (card && group) card.style.setProperty('--rank-color', RANK_COLORS[group]);

  var detail = { current: cur, peak: peak, currentId: curId, peakId: peakId, currentUrls: curId != null ? tierIconUrls(curId) : null, peakUrls: peakId != null ? tierIconUrls(peakId) : null };
  window.__valData = detail;
  window.dispatchEvent(new CustomEvent('valorantdata', { detail: detail }));
}

// ── NOW PLAYING (Last.fm fallback) ──
async function loadNowPlaying() {
  if (LASTFM_API_KEY === "YOUR_LASTFM_API_KEY") return;
  try {
    var url = 'https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=' + LASTFM_USER + '&api_key=' + LASTFM_API_KEY + '&format=json&limit=1';
    var json = await cachedFetchJSON('lastfm', 20000, url);
    var track = json && json.recenttracks && json.recenttracks.track ? json.recenttracks.track[0] : null;
    if (!track) return;
    var label = document.getElementById('np-label');
    if (label.textContent.indexOf('SPOTIFY') !== -1) return;
    var playing = track['@attr'] && track['@attr'].nowplaying === 'true';
    label.textContent = playing ? 'NOW PLAYING' : 'LAST PLAYED';
    document.getElementById('np-track').textContent = track.name + ' — ' + track.artist['#text'];
  } catch (e) {}
}

// ── VISITOR COUNTER (counts once per browser session) ──
async function loadVisitorCount() {
  var el = document.getElementById('visitor-count');
  try {
    var ref = doc(db, "stats", "visitors");
    var snap = await getDoc(ref);
    var current = snap.exists() ? snap.data().count : 0;
    if (!sessionStorage.getItem('counted')) {
      await setDoc(ref, { count: increment(1) }, { merge: true });
      sessionStorage.setItem('counted', '1');
      current += 1;
    }
    el.textContent = current;
  } catch (e) { el.textContent = '—'; }
}

// ── BADGES / LAST UPDATED / CURSOR ──
var badges = [
  { icon: '🎮', label: 'Roblox since 2019' }, { icon: '💬', label: 'Discord OG' },
  { icon: '🎯', label: 'Valorant Plat+' }, { icon: '🌙', label: 'Night Owl' }
];
function renderBadges() {
  var row = document.getElementById('badges-row');
  if (!row) return;
  badges.forEach(function(b) {
    var el = document.createElement('div');
    el.className = 'badge';
    el.innerHTML = '<span>' + b.icon + '</span><span>' + b.label + '</span>';
    row.appendChild(el);
  });
}
function setLastUpdated() {
  var el = document.getElementById('last-updated');
  if (!el) return;
  el.textContent = "Last updated: " + new Date("2026-11-23T12:00:00").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function setupCursorTrail() {
  if (window.matchMedia('(max-width: 640px)').matches) return;
  var last = 0;
  window.addEventListener('mousemove', function(e) {
    var now = Date.now();
    if (now - last < 40) return;
    last = now;
    var p = document.createElement('div');
    p.className = 'cursor-particle';
    p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px';
    document.body.appendChild(p);
    requestAnimationFrame(function() {
      p.style.transform = 'translate(' + (Math.random() * 20 - 10) + 'px,' + (Math.random() * 20 - 10) + 'px) scale(0)';
      p.style.opacity = '0';
    });
    setTimeout(function() { p.remove(); }, 650);
  });
}

// ── GITHUB ──
async function loadGithubProjects() {
  var list = document.getElementById('gh-projects-list');
  if (!list) return;
  try {
    var repos = await cachedFetchJSON('gh-repos', 5 * 60 * 1000, 'https://api.github.com/users/' + GITHUB_USERNAME + '/repos?sort=updated&per_page=6');
    if (!repos || !repos.length) { list.innerHTML = '<div class="projects-empty">No public repos found.</div>'; return; }
    list.innerHTML = '';
    repos.forEach(function(repo, i) {
      var card = document.createElement('a');
      card.className = 'project-card';
      card.href = repo.html_url; card.target = '_blank'; card.rel = 'noopener noreferrer';
      card.style.animation = 'rise .5s ' + (i * 70) + 'ms both';
      card.innerHTML = '<div class="project-name">' + esc(repo.name) + '</div>' +
        '<div class="project-desc">' + esc(repo.description || 'No description yet.') + '</div>' +
        '<div class="project-meta">' + (repo.language ? '<span><span class="project-lang-dot"></span>' + esc(repo.language) + '</span>' : '') + '<span>★ ' + repo.stargazers_count + '</span></div>';
      list.appendChild(card);
    });
  } catch (e) { list.innerHTML = '<div class="projects-empty">Couldn\'t reach GitHub right now.</div>'; }
}
function loadGithubChart() {
  var img = document.getElementById('gh-chart-img'), fb = document.getElementById('gh-chart-fallback');
  if (!img) return;
  var hex = getComputedStyle(document.body).getPropertyValue('--accent').trim().replace('#', '');
  img.src = 'https://ghchart.rshah.org/' + hex + '/' + GITHUB_USERNAME;
  img.onload = function() { img.classList.add('loaded'); if (fb) fb.classList.add('hide'); };
}

// ── WEATHER ──
var WMO_MAP = {
  0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌦️', 'Dense drizzle'], 61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  80: ['🌦️', 'Rain showers'], 81: ['🌦️', 'Rain showers'], 82: ['⛈️', 'Violent showers'], 95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Severe thunderstorm']
};
async function loadWeather() {
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + WEATHER_LAT + '&longitude=' + WEATHER_LON + '&current_weather=true';
    var json = await cachedFetchJSON('weather', 15 * 60 * 1000, url);
    var cw = json && json.current_weather;
    if (!cw) return;
    var meta = WMO_MAP[cw.weathercode] || ['🌡️', 'Unknown'];
    document.getElementById('weather-icon').textContent = meta[0];
    document.getElementById('weather-temp').textContent = Math.round(cw.temperature) + '°C';
    document.getElementById('weather-desc').textContent = meta[1] + ' · ' + WEATHER_LABEL;
  } catch (e) {}
}

// ── SCREEN ROUTER ──
var SCREENS = ['home', 'stats', 'projects', 'about', 'guestbook', 'gaming', 'timeline', 'setup', 'links', 'changelog'];
var loadedOnce = {};
function goToScreen(name) {
  if (SCREENS.indexOf(name) === -1) return;
  document.querySelectorAll('.screen').forEach(function(el) { el.classList.remove('active'); });
  var target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.sn-btn').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.screen === name); });
  if (!loadedOnce[name]) {
    loadedOnce[name] = true;
    if (name === 'stats') { loadGithubChart(); loadWeather(); }
    if (name === 'projects') loadGithubProjects();
  }
  window.dispatchEvent(new CustomEvent('screenchange', { detail: name }));
}
window.goToScreen = goToScreen;
function setupScreenRouter() {
  document.querySelectorAll('.sn-btn').forEach(function(btn) { if (btn.dataset.screen) btn.addEventListener('click', function() { goToScreen(btn.dataset.screen); }); });
  document.querySelectorAll('[data-goto]').forEach(function(btn) { btn.addEventListener('click', function() { goToScreen(btn.dataset.goto); }); });
  var s = localStorage.getItem('lastScreen');
  goToScreen(SCREENS.indexOf(s) > -1 ? s : 'home');
}

// ── COMMAND PALETTE ──
function setupCommandPalette() {
  var overlay = document.getElementById('cmdk-overlay'), input = document.getElementById('cmdk-input'), listEl = document.getElementById('cmdk-list'), cmdkBtn = document.getElementById('cmdk-btn');
  if (!overlay || !input || !listEl) return;
  var click = function(id) { return function() { document.getElementById(id).click(); }; };
  var commands = [
    { tag: 'Screen', label: 'Go to Home', run: function() { goToScreen('home'); } },
    { tag: 'Screen', label: 'Go to Stats', run: function() { goToScreen('stats'); } },
    { tag: 'Screen', label: 'Go to Projects', run: function() { goToScreen('projects'); } },
    { tag: 'Screen', label: 'Go to About', run: function() { goToScreen('about'); } },
    { tag: 'Screen', label: 'Go to Guestbook', run: function() { goToScreen('guestbook'); } },
    { tag: 'Action', label: 'Toggle video / card view', run: click('toggle-video-btn') },
    { tag: 'Action', label: 'Cycle theme accent', run: click('theme-cycle-btn') },
    { tag: 'Action', label: 'Mute / unmute sound', run: click('mute-btn') },
    { tag: 'Action', label: 'Next video', run: click('next-video-btn') },
    { tag: 'Action', label: 'Previous video', run: click('prev-video-btn') }
  ].concat(window.EXTRA_COMMANDS || []);
  var activeIndex = 0;

  function highlight(items) { items.forEach(function(el, i) { el.classList.toggle('cmdk-active', i === activeIndex); }); }
  function render(filterText) {
    var f = (filterText || '').toLowerCase();
    var matches = commands.filter(function(c) { return c.label.toLowerCase().indexOf(f) !== -1; });
    listEl.innerHTML = '';
    listEl._matches = matches;
    if (!matches.length) { listEl.innerHTML = '<div class="cmdk-empty">No matches.</div>'; return; }
    activeIndex = 0;
    matches.forEach(function(c, i) {
      var item = document.createElement('div');
      item.className = 'cmdk-item' + (i === 0 ? ' cmdk-active' : '');
      item.innerHTML = '<span>' + esc(c.label) + '</span><span class="cmdk-item-tag">' + esc(c.tag) + '</span>';
      item.addEventListener('click', function() { c.run(); closePalette(); });
      item.addEventListener('mousemove', function() { activeIndex = i; highlight(listEl.querySelectorAll('.cmdk-item')); });
      listEl.appendChild(item);
    });
  }
  function openPalette() { overlay.classList.add('cmdk-open'); input.value = ''; render(''); setTimeout(function() { input.focus(); }, 30); }
  function closePalette() { overlay.classList.remove('cmdk-open'); }

  input.addEventListener('input', function() { render(input.value); });
  input.addEventListener('keydown', function(e) {
    var items = listEl.querySelectorAll('.cmdk-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); highlight(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlight(items); }
    else if (e.key === 'Enter') { var m = listEl._matches && listEl._matches[activeIndex]; if (m) { m.run(); closePalette(); } }
  });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closePalette(); });
  if (cmdkBtn) cmdkBtn.addEventListener('click', openPalette);
  window.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay.classList.contains('cmdk-open') ? closePalette() : openPalette(); }
    else if (e.key === 'Escape' && overlay.classList.contains('cmdk-open')) closePalette();
  });
}

// ── BOOT SEQUENCE ──
function setupBootSequence() {
  var overlay = document.getElementById('boot-sequence'), linesEl = document.getElementById('boot-lines');
  if (!overlay || !linesEl) return;
  if (sessionStorage.getItem('bootShown')) { overlay.classList.add('boot-done'); overlay.style.display = 'none'; return; }
  var lines = ['> initializing hub.exe', '> linking discord channel... ok', '> linking roblox framework... ok', '> loading valorant hud... ok', "> mouhamad's world ready"];
  lines.forEach(function(text, i) {
    var span = document.createElement('div');
    span.className = 'bl';
    span.style.animationDelay = (i * 0.28) + 's';
    span.textContent = text;
    if (i === lines.length - 1) { var c = document.createElement('span'); c.className = 'bl-cursor'; span.appendChild(c); }
    linesEl.appendChild(span);
  });
  setTimeout(function() {
    overlay.classList.add('boot-done');
    sessionStorage.setItem('bootShown', '1');
    setTimeout(function() { overlay.style.display = 'none'; }, 650);
  }, lines.length * 280 + 600);
}

// ── MAIN RUNTIME ──
document.addEventListener('DOMContentLoaded', async function() {
  await extrasReady;
  var video = document.getElementById('bg-video');
  var controlsBox = document.getElementById('controls-wrapper-box');
  var topbarDock = document.getElementById('topbar-controls-dock'); // optional, may not exist
  var pageContainer = document.querySelector('.page');
  var toggleVideoBtn = document.getElementById('toggle-video-btn');
  var btnText = toggleVideoBtn.querySelector('.btn-text');

  var themeBtn = document.getElementById('theme-cycle-btn'), themeLabel = document.getElementById('theme-label');
  var themes = [
    { class: 'theme-gold', label: 'Gold' }, { class: 'theme-blue', label: 'Blue' }, { class: 'theme-pink', label: 'Pink' }, { class: 'theme-mint', label: 'Mint' },
    { class: 'theme-red', label: 'Red' }, { class: 'theme-purple', label: 'Purple' }, { class: 'theme-ice', label: 'Ice' }
  ];
  var currentThemeIndex = parseInt(localStorage.getItem('themeIdx'), 10) || 0;
  if (currentThemeIndex < 0 || currentThemeIndex >= themes.length) currentThemeIndex = 0;
  document.body.classList.remove('theme-gold');
  document.body.classList.add(themes[currentThemeIndex].class);
  themeLabel.textContent = themes[currentThemeIndex].label;

  var videos = ['darkside.mp4', 'kaneki_1.mp4', 'kaneki_2.mp4', 'lock_in.mp4', 'kira.mp4', 'goku_edit.mp4'];
  for (var n = 1; n <= 21; n++) videos.push('vid' + n + '.mov');
  var currentVideoIndex = 0;

  var prevVideoBtn = document.getElementById('prev-video-btn'), nextVideoBtn = document.getElementById('next-video-btn');
  var muteBtn = document.getElementById('mute-btn'), volumeSlider = document.getElementById('volume-slider'), musicWaveform = document.getElementById('music-waveform');
  var playBtn = document.getElementById('play-btn'), videoProgress = document.getElementById('video-progress'), timelineBubble = document.getElementById('timeline-bubble');
  var iconPlay = playBtn.querySelector('.icon-play'), iconPause = playBtn.querySelector('.icon-pause');

  video.volume = 0.1; volumeSlider.value = 0.1;
  var lastVolumeValue = 0.1; video.muted = true;

  function switchVideo(index) {
    currentVideoIndex = (index + videos.length) % videos.length;
    video.pause();
    var source = video.querySelector('source');
    if (!source) return;
    source.src = videos[currentVideoIndex];
    source.type = /\.mov$/i.test(videos[currentVideoIndex]) ? 'video/quicktime' : 'video/mp4';
    video.load();
    iconPause.style.display = 'block'; iconPlay.style.display = 'none';
    video.play().then(function() { if (audioCtx) audioCtx.resume(); }).catch(function() {});
  }
  prevVideoBtn.addEventListener('click', function(e) { e.stopPropagation(); switchVideo(currentVideoIndex - 1); });
  nextVideoBtn.addEventListener('click', function(e) { e.stopPropagation(); switchVideo(currentVideoIndex + 1); });

  // ── GUESTBOOK ──
  var gbField = document.getElementById('gb-field'), gbFeedback = document.getElementById('gb-feedback'), gbBusy = false;
  if (gbField) {
    gbField.addEventListener('keydown', async function(event) {
      if (event.key !== 'Enter' || gbBusy) return;
      var text = gbField.value.trim();
      if (!text) return;
      gbBusy = true;
      gbFeedback.textContent = "BROADCASTING TO CHANNELS...";
      gbFeedback.style.color = "var(--accent)";
      var okDiscord = false, okFirebase = false;
      try { var r = await fetch(API + '/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) }); okDiscord = r.ok; if (r.status === 429) { gbFeedback.textContent = "SLOW DOWN. TRY AGAIN IN A FEW SECONDS."; gbFeedback.style.color = "#f59e0b"; gbBusy = false; return; } } catch (e) {}
      try { await addDoc(collection(db, "messages"), { text: text, timestamp: serverTimestamp() }); okFirebase = true; } catch (e) { console.error("Firestore write failed (check rules):", e); }
      if (okDiscord || okFirebase) { window.dispatchEvent(new CustomEvent('guestbooksent')); gbField.value = ''; gbFeedback.textContent = "TRANSMISSION SUCCESSFUL."; gbFeedback.style.color = "#00ff66"; }
      else { gbFeedback.textContent = "TRANSMISSION MISROUTED."; gbFeedback.style.color = "#ef4444"; }
      setTimeout(function() { gbFeedback.textContent = ''; }, 3000);
      gbBusy = false;
    });
  }

  function adjustControlsPosition(isFocused) {
    if (!topbarDock) return;
    if (isFocused) { controlsBox.classList.add('docked-top'); topbarDock.appendChild(controlsBox); }
    else { controlsBox.classList.remove('docked-top'); pageContainer.insertBefore(controlsBox, pageContainer.firstChild); }
  }
  toggleVideoBtn.addEventListener('click', function() {
    var isFocused = document.body.classList.toggle('video-focused');
    btnText.textContent = isFocused ? 'Show Card' : 'See Video';
    adjustControlsPosition(isFocused);
    if (isFocused) resetIdleTimer(); else { showAllHUD(); clearTimeout(idleTimer); }
  });

  themeBtn.addEventListener('click', function() {
    document.body.classList.remove(themes[currentThemeIndex].class);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIndex].class);
    themeLabel.textContent = themes[currentThemeIndex].label;
    try { localStorage.setItem('themeIdx', currentThemeIndex); } catch (e) {}
    loadGithubChart();
  });

  muteBtn.addEventListener('click', function() {
    setupAudioVisualizer(video);
    if (audioCtx) audioCtx.resume();
    if (video.muted) {
      video.muted = false;
      if (video.volume === 0) { video.volume = lastVolumeValue || 0.1; volumeSlider.value = video.volume; }
      musicWaveform.classList.add('playing');
    } else { video.muted = true; musicWaveform.classList.remove('playing'); }
  });
  volumeSlider.addEventListener('input', function(e) {
    setupAudioVisualizer(video);
    if (audioCtx) audioCtx.resume();
    var val = parseFloat(e.target.value); video.volume = val;
    if (val > 0) { video.muted = false; lastVolumeValue = val; musicWaveform.classList.add('playing'); }
    else { video.muted = true; musicWaveform.classList.remove('playing'); }
  });
  playBtn.addEventListener('click', function() {
    if (video.paused) { video.play(); iconPause.style.display = 'block'; iconPlay.style.display = 'none'; }
    else { video.pause(); iconPause.style.display = 'none'; iconPlay.style.display = 'block'; }
  });

  video.addEventListener('timeupdate', function() {
    if (!video.duration) return;
    videoProgress.value = (video.currentTime / video.duration) * 100;
    var trim = getTrimFor(videos[currentVideoIndex]);
    if (video.duration > trim + 1 && video.currentTime >= video.duration - trim) { video.currentTime = 0; video.play(); }
  });
  videoProgress.addEventListener('input', function(e) { if (video.duration) video.currentTime = (parseFloat(e.target.value) / 100) * video.duration; });
  videoProgress.addEventListener('mousemove', function(e) {
    if (!video.duration) return;
    var rect = videoProgress.getBoundingClientRect();
    var pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    var secs = pct * video.duration;
    timelineBubble.textContent = Math.floor(secs / 60) + ':' + ('0' + Math.floor(secs % 60)).slice(-2);
    timelineBubble.style.left = (pct * 100) + '%';
  });

  var idleTimer;
  function hideAllHUD() { document.querySelectorAll('.hud-element').forEach(function(el) { el.classList.add('hud-hidden'); }); }
  function showAllHUD() { document.querySelectorAll('.hud-element').forEach(function(el) { el.classList.remove('hud-hidden'); }); }
  function resetIdleTimer() {
    showAllHUD();
    if (!document.body.classList.contains('video-focused')) return;
    clearTimeout(idleTimer); idleTimer = setTimeout(hideAllHUD, 3000);
  }
  ['mousemove', 'keydown', 'click'].forEach(function(ev) { window.addEventListener(ev, resetIdleTimer); });

  setupScreenRouter();
  setupCommandPalette();
  setupBootSequence();
  renderBadges();
  setLastUpdated();
  setupCursorTrail();
});

// ── START ──
loadDiscordState(); loadRoblox(); loadValorantStats(); loadNowPlaying(); loadVisitorCount();
setInterval(loadDiscordState, 15000);
setInterval(loadRoblox, 60000);
setInterval(loadValorantStats, 300000);
setInterval(loadNowPlaying, 30000);