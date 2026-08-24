import { db, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, doc, getDoc, setDoc, increment } from "./firebaseConfig.js";

var API = 'https://my-world-scfp.onrender.com';

// ── VIDEO TRIM CONFIG (skip TikTok outro without editing video files) ──
// "default" applies to any video not listed individually.
// Adjust the number per-file once you see where each outro starts.
var videoTrimSeconds = {
  default: 3,
  // 'vid7.mov': 2,
  // 'vid14.mov': 4,
};

function getTrimFor(filename) {
  return videoTrimSeconds[filename] != null ? videoTrimSeconds[filename] : videoTrimSeconds.default;
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

  const q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(10));

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
    var res = await fetch('https://api.lanyard.rest/v1/users/819598941510959175');
    var json = await res.json();
    if (!json || !json.success) return;
    
    var s = json.data.discord_status || 'offline';
    var sMap = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
    
    var dot = document.getElementById('tb-dc-dot');
    if (dot) {
      if (s === 'online') { 
        dot.style.background = '#00ff66'; 
        dot.style.boxShadow = '0 0 8px #00ff66, 0 0 15px #00ff66'; 
      }
      else if (s === 'idle') { 
        dot.style.background = '#f59e0b'; 
        dot.style.boxShadow = '0 0 6px #f59e0b'; 
      }
      else if (s === 'dnd') { 
        dot.style.background = '#ef4444'; 
        dot.style.boxShadow = '0 0 6px #ef4444'; 
      }
      else { 
        dot.style.background = '#ff3333'; 
        dot.style.boxShadow = '0 0 6px #ff3333'; 
      }
    }
    
    var lbl = document.getElementById('tb-dc-lbl');
    if (lbl) lbl.textContent = sMap[s] || 'Discord';
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

async function fetchJSON(url) { try { var r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function showRblxFail() {
  document.getElementById('rblx-pres-state').textContent = 'Live System Offline';
  ['rblx-friends', 'rblx-joined', 'rblx-status', 'rblx-uid'].forEach(function(id) { document.getElementById(id).textContent = '—'; });
}

// ── VALORANT LIVE PARSE SCROLLER CONNECTION (now routed through backend, no exposed key) ──
async function loadValorantStats() {
  try {
    var response = await fetch(API + '/api/valorant');
    if (!response.ok) {
      console.warn("Parser gateway route rejected or busy.");
      return;
    }
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

// ── NOW PLAYING (LAST.FM) ──
// Get a free API key at https://www.last.fm/api/account/create
var LASTFM_API_KEY = "YOUR_LASTFM_API_KEY";
var LASTFM_USER = "YOUR_LASTFM_USERNAME";

async function loadNowPlaying() {
  try {
    var url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;
    var res = await fetch(url);
    var json = await res.json();
    var track = json && json.recenttracks && json.recenttracks.track ? json.recenttracks.track[0] : null;
    if (!track) return;
    var isPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
    document.getElementById('np-label').textContent = isPlaying ? 'NOW PLAYING' : 'LAST PLAYED';
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
  var lastUpdateDate = "2026-08-24"; // change manually whenever you edit the site
  var d = new Date(lastUpdateDate);
  el.textContent = "Last updated: " + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── CURSOR TRAIL PARTICLES (desktop only) ──
function setupCursorTrail() {
  if (window.matchMedia('(max-width: 640px)').matches) return;
  var lastTime = 0;
  window.addEventListener('mousemove', function(e) {
    var now = Date.now();
    if (now - lastTime < 40) return; // throttle
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

// ── AMBIENT CLICK SOUND ──
function setupClickSound() {
  var sfx = document.getElementById('click-sfx');
  if (!sfx) return;
  document.querySelectorAll('.video-btn, .edge-arrow-btn, .video-control-btn, .audio-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      sfx.currentTime = 0;
      sfx.play().catch(function() {});
    });
  });
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
    'vid1.mov',
    'vid2.mov',
    'vid3.mov',
    'vid4.mov',
    'vid5.mov',
    'vid6.mov',
    'vid7.mov',
    'vid8.mov',
    'vid9.mov',
    'vid10.mov',
    'vid11.mov',
    'vid12.mov',
    'vid13.mov',
    'vid14.mov',
    'vid15.mov',
    'vid16.mov',
    'vid17.mov',
    'vid18.mov',
    'vid19.mov',
    'vid20.mov',
    'vid21.mov'
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
        if(audioCtx) audioCtx.resume();
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

          // PIPELINE 1: Discord webhook via backend (key hidden server-side)
          try {
            await fetch(API + '/api/guestbook', {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: messageText })
            });
          } catch (discordError) {
            console.warn("Discord broadcast pipeline issue:", discordError);
          }

          // PIPELINE 2: Cloud Firestore Backup (isolated so it won't crash the broadcast)
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
      pageContainer.insertBefore(controlsBox, document.getElementById('main-panel'));
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
  });

  muteBtn.addEventListener('click', function() {
    setupAudioVisualizer(video);
    if(audioCtx) audioCtx.resume();

    if (video.muted) {
      video.muted = false;
      if(video.volume === 0) { video.volume = lastVolumeValue || 0.1; volumeSlider.value = video.volume; }
      musicWaveform.classList.add('playing');
    } else {
      video.muted = true; musicWaveform.classList.remove('playing');
    }
  });

  volumeSlider.addEventListener('input', function(e) {
    setupAudioVisualizer(video);
    if(audioCtx) audioCtx.resume();
    var val = parseFloat(e.target.value); video.volume = val;
    if (val > 0) { video.muted = false; lastVolumeValue = val; musicWaveform.classList.add('playing'); }
    else { video.muted = true; musicWaveform.classList.remove('playing'); }
  });

  playBtn.addEventListener('click', function() {
    if (video.paused) { video.play(); iconPause.style.display = 'block'; iconPlay.style.display = 'none'; }
    else { video.pause(); iconPause.style.display = 'none'; iconPlay.style.display = 'block'; }
  });

  // Progress bar + outro-skip logic merged into one timeupdate listener
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

  renderBadges();
  setLastUpdated();
  setupCursorTrail();
  setupClickSound();
});

// INITIALIZATION LOG
loadDiscordState(); loadRoblox(); loadValorantStats(); loadNowPlaying(); loadVisitorCount();
setInterval(loadDiscordState, 15000); 
setInterval(loadRoblox, 60000);
setInterval(loadValorantStats, 120000);
setInterval(loadNowPlaying, 30000);