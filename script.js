import { db, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, doc, getDoc, setDoc, increment } from "./firebaseConfig.js";

var API = 'https://my-world-scfp.onrender.com';

// ── CONFIG: fill these in ──
var LASTFM_API_KEY = "c4a45229f399e4a82afbd7e2d30612dc"; // https://www.last.fm/api/account/create
var LASTFM_USER = "sonbecks";
var GITHUB_USERNAME = "Djibsonbecks19"; // public repos + contribution chart, no key needed
var WEATHER_LAT = 14.6928;  // defaults to Dakar — change to wherever you want the widget to report
var WEATHER_LON = -17.4467;
var WEATHER_LABEL = "Dakar, SN";

// ── VIDEO TRIM CONFIG (skip TikTok outro without editing video files) ──
var videoTrimSeconds = {
  default: 3,
  // 'vid7.mov': 2,
  // 'vid14.mov': 4,
};
function getTrimFor(filename) {
  return videoTrimSeconds[filename] != null ? videoTrimSeconds[filename] : videoTrimSeconds.default;
}

// ── SIMPLE LOCALSTORAGE CACHE (cuts down repeat calls to rate-limited APIs) ──
function cacheGet(key, ttlMs) {
  try {
    var raw = localStorage.getItem('cache:' + key);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > ttlMs) return null;
    return parsed.v;
  } catch (e) { return null; }
}
function cacheSet(key, value) {
  try { localStorage.setItem('cache:' + key, JSON.stringify({ t: Date.now(), v: value })); } catch (e) {}
}
async function cachedFetchJSON(key, ttlMs, url, opts) {
  var hit = cacheGet(key, ttlMs);
  if (hit) return hit;
  var data = await fetchJSON(url, opts);
  if (data) cacheSet(key, data);
  return data;
}

// ── AUDIO HARDWARE CONNECTOR (DYNAMIC RECONSTRUCTED MATRIX VISUALIZER) ──
var audioCtx = null;
var analyzer = null;
var sourceNode = null;
var frequencyData = null;
var isVisualizerSetup = false;

function setupAudioVisualizer(videoElement) {
  if (isVisualizerSetup) return;
  try {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 32;

    sourceNode = audioCtx.createMediaElementSource(videoElement);
    sourceNode.connect(analyzer);
    analyzer.connect(audioCtx.destination);

    frequencyData = new Uint8Array(analyzer.frequencyBinCount);
    isVisualizerSetup = true;
    renderFrequencies();
  } catch (e) {
    console.warn("Visualizer processing thread waiting for security interaction click.");
  }
}

function renderFrequencies() {
  if (!isVisualizerSetup || !analyzer) return;
  requestAnimationFrame(renderFrequencies);

  var video = document.getElementById('bg-video');
  var waveform = document.getElementById('music-waveform');
  var bars = waveform.querySelectorAll('.bar');

  if (video.muted || video.paused) {
    bars.forEach(function(bar) { bar.style.height = '3px'; });
    return;
  }

  analyzer.getByteFrequencyData(frequencyData);

  bars.forEach(function(bar, idx) {
    var rawVal = frequencyData[idx * 2] || 0;
    var heightPercentage = Math.min(Math.max((rawVal / 255) * 14, 3), 14);
    bar.style.height = heightPercentage + 'px';
  });
}

// ── LIVE GUESTBOOK FEED ENGINE ──
function setupLiveFeed() {
  const feedContainer = document.getElementById('gb-live-feed');
  if (!feedContainer) return;

  const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(50));

  onSnapshot(q, (snapshot) => {
    feedContainer.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement('div');
      div.className = 'feed-item';
      div.textContent = `> ${data.text}`;
      feedContainer.appendChild(div);
    });
  });
}
setupLiveFeed();

// ── GENERAL LOG HUB ENDPOINTS ──
async function loadDiscordState() {
  try {
    var json = await cachedFetchJSON('discord', 10000, 'https://api.lanyard.rest/v1/users/819598941510959175');
    if (!json || !json.success) return;

    var s = json.data.discord_status || 'offline';
    var sMap = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };

    var dot = document.getElementById('tb-dc-dot');
    if (dot) {
      if (s === 'online') { dot.style.background = '#00ff66'; dot.style.boxShadow = '0 0 8px #00ff66, 0 0 15px #00ff66'; }
      else if (s === 'idle') { dot.style.background = '#f59e0b'; dot.style.boxShadow = '0 0 6px #f59e0b'; }
      else if (s === 'dnd') { dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 6px #ef4444'; }
      else { dot.style.background = '#ff3333'; dot.style.boxShadow = '0 0 6px #ff3333'; }
    }

    var lbl = document.getElementById('tb-dc-lbl');
    if (lbl) lbl.textContent = sMap[s] || 'Discord';

    // Spotify status piggybacks on Lanyard — no separate API needed
    if (json.data.listening_to_spotify && json.data.spotify) {
      var sp = json.data.spotify;
      document.getElementById('np-label').textContent = 'NOW PLAYING · SPOTIFY';
      document.getElementById('np-track').textContent = sp.song + ' — ' + sp.artist;
    }
  } catch (e) {
    console.log("Status bar check bypass.");
  }
}

async function loadRoblox() {
  try {
    var idRes = await fetch(API + '/api/roblox/userid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tanqr_headchot' })
    });
    if (!idRes.ok) { showRblxFail(); return; }
    var idData = await idRes.json();
    var uid = idData && idData.data && idData.data[0] ? idData.data[0].id : null;
    if (!uid) { showRblxFail(); return; }

    document.getElementById('rblx-uid').textContent = uid;
    document.getElementById('rblx-id-label').textContent = 'ID: ' + uid;

    fetchJSON(API + '/api/roblox/avatar/' + uid).then(function(d) {
      var imgUrl = d && d.data && d.data[0] ? d.data[0].imageUrl : null;
      if (imgUrl) {
        var img = document.getElementById('rblx-av-img');
        img.src = imgUrl; img.style.display = 'block';
        document.getElementById('rblx-av-svg').style.display = 'none';
      }
    });

    fetchJSON(API + '/api/roblox/user/' + uid).then(function(d) {
      if (d && d.created) document.getElementById('rblx-joined').textContent = new Date(d.created).getFullYear();
    });

    fetchJSON(API + '/api/roblox/friends/' + uid).then(function(d) {
      if (d && d.count != null) document.getElementById('rblx-friends').textContent = d.count;
    });

    fetch(API + '/api/roblox/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [uid] })
    }).then(function(r) { return r.json(); }).then(function(d) {
      var p = d && d.userPresences ? d.userPresences[0] : null;
      var shortcutBtn = document.getElementById('rblx-join-btn');
      if (p) {
        var presMap = { 0: 'Offline', 1: 'Online', 2: 'In Game', 3: 'In Studio' };
        var label = presMap[p.userPresenceType] || 'Unknown';
        document.getElementById('rblx-pres-state').textContent = label;
        document.getElementById('rblx-status').textContent = label;
        if (p.lastLocation) {
          document.getElementById('rblx-pres-game').textContent = p.lastLocation.slice(0, 18);
        }
        if (shortcutBtn) {
          if (p.userPresenceType === 1 || p.userPresenceType === 2) { shortcutBtn.classList.remove('hidden'); }
          else { shortcutBtn.classList.add('hidden'); }
        }
      }
    });
  } catch (e) { showRblxFail(); }
}

async function fetchJSON(url, opts) { try { var r = await fetch(url, opts); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function showRblxFail() {
  document.getElementById('rblx-pres-state').textContent = 'Live System Offline';
  ['rblx-friends', 'rblx-joined', 'rblx-status', 'rblx-uid'].forEach(function(id) { document.getElementById(id).textContent = '—'; });
}

// ── VALORANT LIVE PARSE SCROLLER CONNECTION (routed through backend, no exposed key) ──
async function loadValorantStats() {
  try {
    var response = await fetch(API + '/api/valorant');
    if (!response.ok) { console.warn("Parser gateway route rejected or busy."); return; }
    var json = await response.json();
    if (json && json.data && json.data.segments && json.data.segments[1]) {
      var peakSegment = json.data.segments[1];
      if (peakSegment.type === "peak-rating" && peakSegment.stats && peakSegment.stats.peakRating) {
        var ratingData = peakSegment.stats.peakRating;
        if (ratingData.displayValue) {
          document.getElementById('val-tier').textContent = ratingData.displayValue.toUpperCase();
        }
        if (ratingData.metadata && ratingData.metadata.iconUrl) {
          document.getElementById('val-rank-icon').src = ratingData.metadata.iconUrl;
        }
      }
    }
  } catch(e) {
    console.log("Scraper interface parsing exception occurred.", e);
  }
}

// ── NOW PLAYING (LAST.FM fallback — Spotify-via-Lanyard takes priority when active) ──
async function loadNowPlaying() {
  if (LASTFM_API_KEY === "YOUR_LASTFM_API_KEY") return;
  try {
    var url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;
    var json = await cachedFetchJSON('lastfm', 20000, url);
    var track = json && json.recenttracks && json.recenttracks.track ? json.recenttracks.track[0] : null;
    if (!track) return;
    var label = document.getElementById('np-label');
    if (label.textContent.indexOf('SPOTIFY') !== -1) return; // Spotify status already showing, don't overwrite
    var isPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
    label.textContent = isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';
    document.getElementById('np-track').textContent = track.name + ' — ' + track.artist['#text'];
  } catch (e) { console.log("Now playing fetch skipped."); }
}

// ── VISITOR COUNTER (FIRESTORE) ──
async function loadVisitorCount() {
  try {
    var ref = doc(db, "stats", "visitors");
    var snap = await getDoc(ref);
    var current = snap.exists() ? snap.data().count : 0;
    await setDoc(ref, { count: increment(1) }, { merge: true });
    document.getElementById('visitor-count').textContent = current + 1;
  } catch (e) {
    console.log("Visitor counter unavailable.");
    document.getElementById('visitor-count').textContent = '—';
  }
}

// ── ACHIEVEMENTS / BADGES ──
var badges = [
  { icon: '🎮', label: 'Roblox since 2019' },
  { icon: '💬', label: 'Discord OG' },
  { icon: '🎯', label: 'Valorant Plat+' },
  { icon: '🌙', label: 'Night Owl' }
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

// ── LAST UPDATED ──
function setLastUpdated() {
  var el = document.getElementById('last-updated');
  if (!el) return;
  var lastUpdateDate = "2026-08-27"; // change manually whenever you edit the site
  var d = new Date(lastUpdateDate);
  el.textContent = "Last updated: " + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── CURSOR TRAIL PARTICLES (desktop only) ──
function setupCursorTrail() {
  if (window.matchMedia('(max-width: 640px)').matches) return;
  var lastTime = 0;
  window.addEventListener('mousemove', function(e) {
    var now = Date.now();
    if (now - lastTime < 40) return;
    lastTime = now;
    var p = document.createElement('div');
    p.className = 'cursor-particle';
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    document.body.appendChild(p);
    requestAnimationFrame(function() {
      p.style.transform = 'translate(' + (Math.random() * 20 - 10) + 'px,' + (Math.random() * 20 - 10) + 'px) scale(0)';
      p.style.opacity = '0';
    });
    setTimeout(function() { p.remove(); }, 650);
  });
}

// ── GITHUB PROJECTS + CONTRIBUTION CHART (no API key needed) ──
async function loadGithubProjects() {
  var list = document.getElementById('gh-projects-list');
  if (!list) return;

  if (GITHUB_USERNAME === "YOUR_GITHUB_USERNAME") {
    list.innerHTML = '<div class="projects-empty">Set GITHUB_USERNAME to pull in your repos.</div>';
    return;
  }

  try {
    var repos = await cachedFetchJSON(
      'gh-repos',
      5 * 60 * 1000,
      'https://api.github.com/users/' + GITHUB_USERNAME + '/repos?sort=updated&per_page=6'
    );
    if (!repos || !repos.length) {
      list.innerHTML = '<div class="projects-empty">No public repos found.</div>';
      return;
    }
    list.innerHTML = '';
    repos.forEach(function(repo) {
      var card = document.createElement('a');
      card.className = 'project-card';
      card.href = repo.html_url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.innerHTML =
        '<div class="project-name">' + repo.name + '</div>' +
        '<div class="project-desc">' + (repo.description || 'No description yet.') + '</div>' +
        '<div class="project-meta">' +
          (repo.language ? '<span><span class="project-lang-dot"></span>' + repo.language + '</span>' : '') +
          '<span>★ ' + repo.stargazers_count + '</span>' +
        '</div>';
      list.appendChild(card);
    });
  } catch (e) {
    list.innerHTML = '<div class="projects-empty">Couldn\'t reach GitHub right now.</div>';
  }
}

function loadGithubChart() {
  var img = document.getElementById('gh-chart-img');
  var fallback = document.getElementById('gh-chart-fallback');
  if (!img) return;
  if (GITHUB_USERNAME === "YOUR_GITHUB_USERNAME") return;

  var accentHex = getComputedStyle(document.body).getPropertyValue('--accent').trim().replace('#', '');
  img.src = 'https://ghchart.rshah.org/' + accentHex + '/' + GITHUB_USERNAME;
  img.onload = function() { img.classList.add('loaded'); if (fallback) fallback.classList.add('hide'); };
}

// ── WEATHER (Open-Meteo, no API key needed) ──
var WMO_MAP = {
  0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'],
  51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌦️', 'Dense drizzle'],
  61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['🌨️', 'Heavy snow'],
  80: ['🌦️', 'Rain showers'], 81: ['🌦️', 'Rain showers'], 82: ['⛈️', 'Violent showers'],
  95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Severe thunderstorm']
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
  } catch (e) {
    console.log("Weather fetch skipped.");
  }
}

// ── SCREEN ROUTER ──
var SCREENS = ['home', 'stats', 'projects', 'about', 'guestbook'];
var loadedOnce = {};
function goToScreen(name) {
  if (SCREENS.indexOf(name) === -1) return;
  document.querySelectorAll('.screen').forEach(function(el) { el.classList.remove('active'); });
  var target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.sn-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });

  // lazy-load screen-specific data the first time it's opened
  if (!loadedOnce[name]) {
    loadedOnce[name] = true;
    if (name === 'stats') loadGithubChart();
    if (name === 'stats') loadWeather();
    if (name === 'projects') loadGithubProjects();
  }
}
function setupScreenRouter() {
  document.querySelectorAll('.sn-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { goToScreen(btn.dataset.screen); });
  });
  document.querySelectorAll('[data-goto]').forEach(function(btn) {
    btn.addEventListener('click', function() { goToScreen(btn.dataset.goto); });
  });
  goToScreen('home');
}

// ── COMMAND PALETTE ──
function setupCommandPalette() {
  var overlay = document.getElementById('cmdk-overlay');
  var input = document.getElementById('cmdk-input');
  var listEl = document.getElementById('cmdk-list');
  var cmdkBtn = document.getElementById('cmdk-btn');
  if (!overlay || !input || !listEl) return;

  var commands = [
    { tag: 'Screen', label: 'Go to Home', run: function() { goToScreen('home'); } },
    { tag: 'Screen', label: 'Go to Stats', run: function() { goToScreen('stats'); } },
    { tag: 'Screen', label: 'Go to Projects', run: function() { goToScreen('projects'); } },
    { tag: 'Screen', label: 'Go to About', run: function() { goToScreen('about'); } },
    { tag: 'Screen', label: 'Go to Guestbook', run: function() { goToScreen('guestbook'); } },
    { tag: 'Action', label: 'Toggle video / card view', run: function() { document.getElementById('toggle-video-btn').click(); } },
    { tag: 'Action', label: 'Cycle theme accent', run: function() { document.getElementById('theme-cycle-btn').click(); } },
    { tag: 'Action', label: 'Mute / unmute sound', run: function() { document.getElementById('mute-btn').click(); } },
    { tag: 'Action', label: 'Next video', run: function() { document.getElementById('next-video-btn').click(); } },
    { tag: 'Action', label: 'Previous video', run: function() { document.getElementById('prev-video-btn').click(); } }
  ];

  var activeIndex = 0;

  function render(filterText) {
    var f = (filterText || '').toLowerCase();
    var matches = commands.filter(function(c) { return c.label.toLowerCase().indexOf(f) !== -1; });
    listEl.innerHTML = '';
    if (!matches.length) {
      listEl.innerHTML = '<div class="cmdk-empty">No matches.</div>';
      return;
    }
    activeIndex = 0;
    matches.forEach(function(c, i) {
      var item = document.createElement('div');
      item.className = 'cmdk-item' + (i === 0 ? ' cmdk-active' : '');
      item.innerHTML = '<span>' + c.label + '</span><span class="cmdk-item-tag">' + c.tag + '</span>';
      item.addEventListener('click', function() { c.run(); closePalette(); });
      item.addEventListener('mousemove', function() {
        listEl.querySelectorAll('.cmdk-item').forEach(function(el) { el.classList.remove('cmdk-active'); });
        item.classList.add('cmdk-active');
        activeIndex = i;
      });
      listEl.appendChild(item);
    });
    listEl._matches = matches;
  }

  function openPalette() {
    overlay.classList.add('cmdk-open');
    input.value = '';
    render('');
    setTimeout(function() { input.focus(); }, 30);
  }
  function closePalette() { overlay.classList.remove('cmdk-open'); }

  input.addEventListener('input', function() { render(input.value); });
  input.addEventListener('keydown', function(e) {
    var items = listEl.querySelectorAll('.cmdk-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); items.forEach(function(el, i) { el.classList.toggle('cmdk-active', i === activeIndex); }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); items.forEach(function(el, i) { el.classList.toggle('cmdk-active', i === activeIndex); }); }
    else if (e.key === 'Enter') { var m = listEl._matches && listEl._matches[activeIndex]; if (m) { m.run(); closePalette(); } }
  });

  overlay.addEventListener('click', function(e) { if (e.target === overlay) closePalette(); });
  if (cmdkBtn) cmdkBtn.addEventListener('click', openPalette);

  window.addEventListener('keydown', function(e) {
    var isK = e.key === 'k' || e.key === 'K';
    if ((e.metaKey || e.ctrlKey) && isK) { e.preventDefault(); overlay.classList.contains('cmdk-open') ? closePalette() : openPalette(); }
    else if (e.key === 'Escape' && overlay.classList.contains('cmdk-open')) { closePalette(); }
  });
}

// ── BOOT SEQUENCE (plays once per browser session) ──
function setupBootSequence() {
  var overlay = document.getElementById('boot-sequence');
  var linesEl = document.getElementById('boot-lines');
  if (!overlay || !linesEl) return;

  if (sessionStorage.getItem('bootShown')) {
    overlay.classList.add('boot-done');
    overlay.style.display = 'none';
    return;
  }

  var lines = [
    '> initializing hub.exe',
    '> linking discord channel... ok',
    '> linking roblox framework... ok',
    '> loading valorant hud... ok',
    '> mouhamad\'s world ready'
  ];

  lines.forEach(function(text, i) {
    var span = document.createElement('div');
    span.className = 'bl';
    span.style.animationDelay = (i * 0.28) + 's';
    span.textContent = text;
    if (i === lines.length - 1) {
      var cursor = document.createElement('span');
      cursor.className = 'bl-cursor';
      span.appendChild(cursor);
    }
    linesEl.appendChild(span);
  });

  var totalDelay = lines.length * 280 + 600;
  setTimeout(function() {
    overlay.classList.add('boot-done');
    sessionStorage.setItem('bootShown', '1');
    setTimeout(function() { overlay.style.display = 'none'; }, 650);
  }, totalDelay);
}

// ── MAIN APPLICATION RUNTIME ──
document.addEventListener('DOMContentLoaded', function() {
  var video = document.getElementById('bg-video');
  var controlsBox = document.getElementById('controls-wrapper-box');
  var topbarDock = document.getElementById('topbar-controls-dock');
  var pageContainer = document.querySelector('.page');
  var toggleVideoBtn = document.getElementById('toggle-video-btn');
  var btnText = toggleVideoBtn.querySelector('.btn-text');

  var themeBtn = document.getElementById('theme-cycle-btn');
  var themeLabel = document.getElementById('theme-label');
  var themes = [
    { class: 'theme-gold', label: 'Gold' },
    { class: 'theme-blue', label: 'Blue' },
    { class: 'theme-pink', label: 'Pink' },
    { class: 'theme-mint', label: 'Mint' }
  ];
  var currentThemeIndex = 0;

  var videos = [
    'darkside.mp4',
    'kaneki_1.mp4',
    'kaneki_2.mp4',
    'lock_in.mp4',
    'kira.mp4',
    'goku_edit.mp4',
    'vid1.mov', 'vid2.mov', 'vid3.mov', 'vid4.mov', 'vid5.mov', 'vid6.mov',
    'vid7.mov', 'vid8.mov', 'vid9.mov', 'vid10.mov', 'vid11.mov', 'vid12.mov',
    'vid13.mov', 'vid14.mov', 'vid15.mov', 'vid16.mov', 'vid17.mov', 'vid18.mov',
    'vid19.mov', 'vid20.mov', 'vid21.mov'
  ];

  var currentVideoIndex = 0;
  var prevVideoBtn = document.getElementById('prev-video-btn');
  var nextVideoBtn = document.getElementById('next-video-btn');

  var muteBtn = document.getElementById('mute-btn');
  var volumeSlider = document.getElementById('volume-slider');
  var musicWaveform = document.getElementById('music-waveform');
  var playBtn = document.getElementById('play-btn');
  var videoProgress = document.getElementById('video-progress');
  var timelineBubble = document.getElementById('timeline-bubble');
  var iconPlay = playBtn.querySelector('.icon-play');
  var iconPause = playBtn.querySelector('.icon-pause');

  video.volume = 0.1; volumeSlider.value = 0.1;
  var lastVolumeValue = 0.1; video.muted = true;

  function switchVideo(index) {
    currentVideoIndex = (index + videos.length) % videos.length;
    video.pause();
    var source = video.querySelector('source');
    if (source) {
      source.src = videos[currentVideoIndex];
      video.load();
      video.setAttribute('crossorigin', 'anonymous');

      if (!video.paused) {
        iconPause.style.display = 'block';
        iconPlay.style.display = 'none';
      }
      video.play().then(function() {
        if (audioCtx) audioCtx.resume();
      }).catch(function(e) { console.log("Unlock state interaction trigger required."); });
    }
  }

  prevVideoBtn.addEventListener('click', function(e) { e.stopPropagation(); switchVideo(currentVideoIndex - 1); });
  nextVideoBtn.addEventListener('click', function(e) { e.stopPropagation(); switchVideo(currentVideoIndex + 1); });

  // ── GUESTBOOK: DUAL BROADCAST via BACKEND (secrets no longer exposed client-side) ──
  const guestbookField = document.getElementById('gb-field');
  const guestbookFeedback = document.getElementById('gb-feedback');

  if (guestbookField) {
    guestbookField.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        const messageText = guestbookField.value.trim();
        if (!messageText) return;

        try {
          guestbookFeedback.textContent = "BROADCASTING TO CHANNELS...";
          guestbookFeedback.style.color = "var(--accent-color, #f59e0b)";

          try {
            await fetch(API + '/api/guestbook', {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: messageText })
            });
          } catch (discordError) {
            console.warn("Discord broadcast pipeline issue:", discordError);
          }

          try {
            await addDoc(collection(db, "messages"), {
              text: messageText,
              timestamp: serverTimestamp()
            });
          } catch (firebaseError) {
            console.error("Firebase cloud backup paused (Check your Firestore Rules):", firebaseError);
          }

          guestbookField.value = '';
          guestbookFeedback.textContent = "TRANSMISSION SUCCESSFUL.";
          guestbookFeedback.style.color = "#00ff66";

          setTimeout(() => { guestbookFeedback.textContent = ''; }, 3000);

        } catch (error) {
          console.error("Critical stream routing breakdown:", error);
          guestbookFeedback.textContent = "TRANSMISSION MISROUTED.";
          guestbookFeedback.style.color = "#ef4444";
        }
      }
    });
  }

  function adjustControlsPosition(isFocused) {
    if (isFocused) {
      controlsBox.classList.add('docked-top');
      topbarDock.appendChild(controlsBox);
    } else {
      controlsBox.classList.remove('docked-top');
      pageContainer.insertBefore(controlsBox, pageContainer.firstChild);
    }
  }

  toggleVideoBtn.addEventListener('click', function() {
    var isFocused = document.body.classList.toggle('video-focused');
    if (isFocused) {
      btnText.textContent = 'Show Card';
      adjustControlsPosition(true);
      resetIdleTimer();
    } else {
      btnText.textContent = 'See Video';
      adjustControlsPosition(false);
      showAllHUD();
      clearTimeout(idleTimer);
    }
  });

  themeBtn.addEventListener('click', function() {
    document.body.classList.remove(themes[currentThemeIndex].class);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIndex].class);
    themeLabel.textContent = themes[currentThemeIndex].label;
    loadGithubChart(); // re-tint the contribution chart to match the new accent
  });

  muteBtn.addEventListener('click', function() {
    setupAudioVisualizer(video);
    if (audioCtx) audioCtx.resume();

    if (video.muted) {
      video.muted = false;
      if (video.volume === 0) { video.volume = lastVolumeValue || 0.1; volumeSlider.value = video.volume; }
      musicWaveform.classList.add('playing');
    } else {
      video.muted = true; musicWaveform.classList.remove('playing');
    }
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
    if (video.currentTime >= video.duration - trim) {
      video.currentTime = 0;
      video.play();
    }
  });

  videoProgress.addEventListener('input', function(e) { if (video.duration) video.currentTime = (parseFloat(e.target.value) / 100) * video.duration; });

  videoProgress.addEventListener('mousemove', function(e) {
    if (!video.duration) return;
    var rect = videoProgress.getBoundingClientRect();
    var percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    var targetSecs = percent * video.duration;
    var mins = Math.floor(targetSecs / 60), secs = Math.floor(targetSecs % 60);
    timelineBubble.textContent = mins + ':' + (secs < 10 ? '0' + secs : secs);
    timelineBubble.style.left = (percent * 100) + '%';
  });

  var idleTimer;
  function resetIdleTimer() {
    if (!document.body.classList.contains('video-focused')) { showAllHUD(); return; }
    showAllHUD(); clearTimeout(idleTimer); idleTimer = setTimeout(hideAllHUD, 3000);
  }
  function hideAllHUD() { document.querySelectorAll('.hud-element').forEach(function(el) { el.classList.add('hud-hidden'); }); }
  function showAllHUD() { document.querySelectorAll('.hud-element').forEach(function(el) { el.classList.remove('hud-hidden'); }); }

  ['mousemove', 'keydown', 'click'].forEach(function(ev) { window.addEventListener(ev, resetIdleTimer); });

  setupScreenRouter();
  setupCommandPalette();
  setupBootSequence();
  renderBadges();
  setLastUpdated();
  setupCursorTrail();
});

// INITIALIZATION LOG
loadDiscordState(); loadRoblox(); loadValorantStats(); loadNowPlaying(); loadVisitorCount();
setInterval(loadDiscordState, 15000);
setInterval(loadRoblox, 60000);
setInterval(loadValorantStats, 120000);
setInterval(loadNowPlaying, 30000);