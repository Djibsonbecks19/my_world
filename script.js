var API = window.location.port === '3000' ? '' : 'http://localhost:3000';

// Webhook for Anonymous Guestbook Endpoint 
var DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1516672212705218581/D9Y-gxXunyaWh00R0ForIJ5_yJqL4PRZz_8teGpW36pYPmP-eBvUdBLHhXKfwBC1L1IO";

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

// ── VALORANT LIVE PARSE SCROLLER CONNECTION (PEAK RATING MAP EXTRACTOR) ──
async function loadValorantStats() {
  try {
    var targetPlayer = encodeURIComponent('SN SonBecks#GameB');
    var apiKey = "pmx_bee4a5a1f5ead9cc1cb9243a8512a4cd"; 

    var response = await fetch(`https://api.parse.bot/scraper/6517942a-644e-4cbc-9349-6e6d5ddaa622/get_player_profile?player_id=${targetPlayer}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });
    
    if (!response.ok) {
      console.warn("Parser gateway route rejected or busy.");
      return;
    }
    
    var json = await response.json();
    
    // Drill straight down into the validated API segments data object matrix
    if (json && json.data && json.data.segments && json.data.segments[1]) {
      var peakSegment = json.data.segments[1];
      
      if (peakSegment.type === "peak-rating" && peakSegment.stats && peakSegment.stats.peakRating) {
        var ratingData = peakSegment.stats.peakRating;
        
        // Inject the verified textual string ("Platinum 2")
        if (ratingData.displayValue) {
          document.getElementById('val-tier').textContent = ratingData.displayValue.toUpperCase();
        }
        
        // Inject the verified tracking badge asset link from the nested metadata cluster
        if (ratingData.metadata && ratingData.metadata.iconUrl) {
          document.getElementById('val-rank-icon').src = ratingData.metadata.iconUrl;
        }
      }
    }
  } catch(e) {
    console.log("Scraper interface parsing exception occurred.", e);
  }
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

  var videos = ['lock_in.mp4', 'kira.mp4', 'goku_edit.mp4', 'darkside.mp4'];
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

  // ANONYMOUS GUESTBOOK DISCORD INTEGRATION HOOK
  var gbField = document.getElementById('gb-field');
  var gbFeedback = document.getElementById('gb-feedback');
  
  if (gbField) {
    gbField.addEventListener('keydown', async function(e) {
      if (e.key === 'Enter') {
        var msg = gbField.value.trim();
        if (!msg) return;
        
        gbField.disabled = true;
        gbFeedback.textContent = "TRANSMITTING TO DISCORD CORE...";
        
        try {
          var payload = {
            embeds: [{
              title: "📡 New Website Guestbook Entry",
              description: "```\n" + msg + "\n```",
              color: 13216110, 
              timestamp: new Date().toISOString(),
              footer: { text: "Terminal Broadcast System" }
            }]
          };
          
          var response = await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (response.ok) {
            gbFeedback.textContent = "TRANSMISSION SUCCESSFUL.";
            gbField.value = "";
          } else {
            gbFeedback.textContent = "TRANSMISSION FAILED. SERVER DROPPED.";
          }
        } catch (err) {
          gbFeedback.textContent = "NET ERROR. WEBHOOK CONNECTION TIMEOUT.";
        }
        
        setTimeout(function() {
          gbField.disabled = false;
          gbFeedback.textContent = "";
          gbField.focus();
        }, 3000);
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

  video.addEventListener('timeupdate', function() { if (video.duration) videoProgress.value = (video.currentTime / video.duration) * 100; });
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
});

// INITIALIZATION LOG
// INITIALIZATION LOG
loadDiscordState(); loadRoblox(); loadValorantStats();
setInterval(loadDiscordState, 15000); 
setInterval(loadRoblox, 60000);
setInterval(loadValorantStats, 120000); // Check the parser for updates every 2 minutes!