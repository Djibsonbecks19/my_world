var API = window.location.port === '3000' ? '' : 'http://localhost:3000';

// ── DISCORD API INTEGRATION ──
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

// ── ROBLOX API INTEGRATION ──
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
        img.src = imgUrl;
        img.style.display = 'block';
        document.getElementById('rblx-av-svg').style.display = 'none';
      }
    });

    fetchJSON(API + '/api/roblox/user/' + uid).then(function(d) {
      if (d && d.created) {
        document.getElementById('rblx-joined').textContent = new Date(d.created).getFullYear();
      }
    });

    fetchJSON(API + '/api/roblox/friends/' + uid).then(function(d) {
      if (d && d.count != null) {
        document.getElementById('rblx-friends').textContent = d.count;
      }
    });

    fetch(API + '/api/roblox/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [uid] })
    }).then(function(r) {
      return r.json();
    }).then(function(d) {
      var p = d && d.userPresences ? d.userPresences[0] : null;
      if (p) {
        var presMap = { 0: 'Offline', 1: 'Online', 2: 'In Game', 3: 'In Studio' };
        var label = presMap[p.userPresenceType] || 'Unknown';
        document.getElementById('rblx-pres-state').textContent = label;
        document.getElementById('rblx-status').textContent = label;
        document.getElementById('tb-rblx-lbl').textContent = label;
        if (p.lastLocation && p.userPresenceType === 2) {
          document.getElementById('rblx-pres-game').textContent = p.lastLocation.slice(0, 18);
        }
      }
    }).catch(function() {
      document.getElementById('rblx-pres-state').textContent = 'Unavailable';
    });

  } catch (e) {
    showRblxFail();
  }
}

async function fetchJSON(url) {
  try {
    var r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

function showRblxFail() {
  document.getElementById('rblx-pres-state').textContent = 'Api not running';
  var ids = ['rblx-friends', 'rblx-joined', 'rblx-status', 'rblx-uid'];
  ids.forEach(function(id) {
    document.getElementById(id).textContent = '—';
  });
}

// ── AUDIO & TOGGLE EVENT INITIALIZER ──
document.addEventListener('DOMContentLoaded', function() {
  var video = document.getElementById('bg-video');
  var muteBtn = document.getElementById('mute-btn');
  var volumeSlider = document.getElementById('volume-slider');
  var toggleVideoBtn = document.getElementById('toggle-video-btn');
  var btnText = toggleVideoBtn.querySelector('.btn-text');
  
  var iconOn = muteBtn.querySelector('.volume-icon-on');
  var iconMuted = muteBtn.querySelector('.volume-icon-muted');
  
  // Set default audio volume level explicitly to 10%
  var defaultVolume = 0.1;
  video.volume = defaultVolume;
  volumeSlider.value = defaultVolume;
  var lastVolumeValue = defaultVolume;

  // Handle browser autoplay policies (start muted)
  video.muted = true;
  iconOn.style.display = 'none';
  iconMuted.style.display = 'block';

  // Toggle Mute Handler
  muteBtn.addEventListener('click', function() {
    if (video.muted) {
      video.muted = false;
      if(video.volume === 0) {
        video.volume = lastVolumeValue || defaultVolume;
        volumeSlider.value = video.volume;
      }
      iconOn.style.display = 'block';
      iconMuted.style.display = 'none';
    } else {
      video.muted = true;
      iconOn.style.display = 'none';
      iconMuted.style.display = 'block';
    }
  });

  // Slider Input Adjuster
  volumeSlider.addEventListener('input', function(e) {
    var val = parseFloat(e.target.value);
    video.volume = val;
    if (val > 0) {
      video.muted = false;
      lastVolumeValue = val;
      iconOn.style.display = 'block';
      iconMuted.style.display = 'none';
    } else {
      video.muted = true;
      iconOn.style.display = 'none';
      iconMuted.style.display = 'block';
    }
  });

  // Action Button Click - Unmutes if needed, changes text, hides card/overlays
  toggleVideoBtn.addEventListener('click', function() {
    if (video.muted && video.volume > 0) {
      video.muted = false;
      iconOn.style.display = 'block';
      iconMuted.style.display = 'none';
    }
    
    var isFocused = document.body.classList.toggle('video-focused');
    if (isFocused) {
      btnText.textContent = 'Show Card';
    } else {
      btnText.textContent = 'See Video';
    }
  });
});

loadDiscord();
loadRoblox();
setInterval(loadDiscord, 30000);
setInterval(loadRoblox, 60000);