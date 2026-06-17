var API = window.location.port === '3000' ? '' : 'http://localhost:3000';

// ── DATA FETCH RUNNERS ──
async function loadDiscord() {
  try {
    var res = await fetch('https://api.lanyard.rest/v1/users/819598941510959175');
    var json = await res.json();
    if (!json.success) return;
    var data = json.data;
    var u = data.discord_user;

    document.getElementById('dc-user').textContent = u.global_name || u.username || 'tanqr_headchot';
    var s = data.discord_status || 'offline';
    var sMap = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
    document.getElementById('dc-dot').className = 's-dot ' + s;
    document.getElementById('dc-status').textContent = sMap[s] || s;

    var acts = data.activities || [];
    var custom = acts.find(function(a) { return a.type === 4; });
    if (custom && custom.state) {
      document.getElementById('dc-custom').textContent = custom.state.slice(0, 32);
    }

    var playing = acts.find(function(a) { return a.type === 0 || a.type === 2; });
    if (playing) {
      document.getElementById('dc-activity').style.display = 'block';
      document.getElementById('dc-act-name').textContent = playing.name;
    }

    var dot = document.getElementById('tb-dc-dot');
    if (s === 'online')  { dot.style.background = '#4ade80'; dot.style.boxShadow = '0 0 4px rgba(74,222,128,0.45)'; }
    if (s === 'idle')    { dot.style.background = '#f59e0b'; dot.style.boxShadow = 'none'; }
    if (s === 'dnd')     { dot.style.background = '#ef4444'; dot.style.boxShadow = 'none'; }
    if (s === 'offline') { dot.style.background = 'rgba(255,255,255,0.15)'; dot.style.boxShadow = 'none'; }
    document.getElementById('tb-dc-lbl').textContent = sMap[s] || 'Discord';
  } catch (e) {
    document.getElementById('dc-user').textContent = 'tanqr_headchot';
    document.getElementById('dc-status').textContent = 'Unavailable';
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
      if (p) {
        var presMap = { 0: 'Offline', 1: 'Online', 2: 'In Game', 3: 'In Studio' };
        var label = presMap[p.userPresenceType] || 'Unknown';
        document.getElementById('rblx-pres-state').textContent = label;
        document.getElementById('rblx-status').textContent = label;
        if (p.lastLocation && p.userPresenceType === 2) {
          document.getElementById('rblx-pres-game').textContent = p.lastLocation.slice(0, 18);
        }
      }
    });
  } catch (e) { showRblxFail(); }
}

async function fetchJSON(url) { try { var r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function showRblxFail() {
  document.getElementById('rblx-pres-state').textContent = 'Api not running';
  ['rblx-friends', 'rblx-joined', 'rblx-status', 'rblx-uid'].forEach(function(id) { document.getElementById(id).textContent = '—'; });
}

// ── MAIN RUNTIME ARCHITECTURE ──
document.addEventListener('DOMContentLoaded', function() {
  var video = document.getElementById('bg-video');
  
  // Controls Position Anchors
  var controlsBox = document.getElementById('controls-wrapper-box');
  var topbarDock = document.getElementById('topbar-controls-dock');
  var pageContainer = document.querySelector('.page');
  var toggleVideoBtn = document.getElementById('toggle-video-btn');
  var btnText = toggleVideoBtn.querySelector('.btn-text');

  // Built-in Accent Variations
  var themeBtn = document.getElementById('theme-cycle-btn');
  var themeLabel = document.getElementById('theme-label');
  var themes = [
    { class: 'theme-gold', label: 'Gold' },
    { class: 'theme-blue', label: 'Blue' },
    { class: 'theme-pink', label: 'Pink' },
    { class: 'theme-mint', label: 'Mint' }
  ];
  var currentThemeIndex = 0;

  // NEW: VIDEO PLAYLIST MANAGEMENT ENGINE
  var videos = ['lock_in.mp4', 'kira.mp4', 'goku_edit.mp4', 'darkside.mp4'];
  var currentVideoIndex = 0;
  var prevVideoBtn = document.getElementById('prev-video-btn');
  var nextVideoBtn = document.getElementById('next-video-btn');

  // Media Interface Elements
  var muteBtn = document.getElementById('mute-btn');
  var volumeSlider = document.getElementById('volume-slider');
  var musicWaveform = document.getElementById('music-waveform');
  var playBtn = document.getElementById('play-btn');
  var videoProgress = document.getElementById('video-progress');
  var timelineBubble = document.getElementById('timeline-bubble');
  var iconPlay = playBtn.querySelector('.icon-play');
  var iconPause = playBtn.querySelector('.icon-pause');

  // Default Fallbacks
  video.volume = 0.1; volumeSlider.value = 0.1;
  var lastVolumeValue = 0.1; video.muted = true;

  // RE-INDEX VIDEO METHOD
  function switchVideo(index) {
    currentVideoIndex = (index + videos.length) % videos.length;
    
    // Smooth transition trick: pause, switch track source, update and reload
    video.pause();
    var source = video.querySelector('source');
    if (source) {
      source.src = videos[currentVideoIndex];
      video.load();
      
      // Keep track of audio states instantly on reload
      if (!video.paused) {
        iconPause.style.display = 'block';
        iconPlay.style.display = 'none';
      }
      video.play().catch(function(err) { console.log("Playback engine waiting hook auto call"); });
    }
  }

  // Hooking Arrow Actions
  prevVideoBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // Avoid triggering screen movement timers
    switchVideo(currentVideoIndex - 1);
  });

  nextVideoBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    switchVideo(currentVideoIndex + 1);
  });

  // CONTROLS TELEPORTATION LOGIC
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

  // PRESET CYCLER
  themeBtn.addEventListener('click', function() {
    document.body.classList.remove(themes[currentThemeIndex].class);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIndex].class);
    themeLabel.textContent = themes[currentThemeIndex].label;
  });

  // MEDIA HARDWARE HOOKS
  muteBtn.addEventListener('click', function() {
    if (video.muted) {
      video.muted = false;
      if(video.volume === 0) { video.volume = lastVolumeValue || 0.1; volumeSlider.value = video.volume; }
      musicWaveform.classList.add('playing');
    } else {
      video.muted = true; musicWaveform.classList.remove('playing');
    }
  });

  volumeSlider.addEventListener('input', function(e) {
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

  // SMART INTERFACE HUD HOVER DIMMER TIMEOUT MECHANICS
  var idleTimer;
  function resetIdleTimer() {
    if (!document.body.classList.contains('video-focused')) { showAllHUD(); return; }
    showAllHUD(); clearTimeout(idleTimer); idleTimer = setTimeout(hideAllHUD, 3000);
  }
  function hideAllHUD() { document.querySelectorAll('.hud-element').forEach(function(el) { el.classList.add('hud-hidden'); }); }
  function showAllHUD() { document.querySelectorAll('.hud-element').forEach(function(el) { el.classList.remove('hud-hidden'); }); }

  ['mousemove', 'keydown', 'click'].forEach(function(ev) { window.addEventListener(ev, resetIdleTimer); });
});

loadDiscord(); loadRoblox();
setInterval(loadDiscord, 30000); setInterval(loadRoblox, 60000);