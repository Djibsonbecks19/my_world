// extras.js — extra pages + animations (builds its own HTML). Loaded by script.js.
const css = document.createElement('link');
css.rel = 'stylesheet'; css.href = 'extras.css';
document.head.appendChild(css);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ───────── EDIT YOUR CONTENT HERE ───────── */
const GAMING = { agents: ['Clove', 'Phoenix', 'Chamber'], roblox: ['Murder Mystery 2', 'Roblox FUT', 'Arsenal'] };
const FAVORITES = [
  ['Anime', ['Tokyo Ghoul', 'Death Note', 'Dragon Ball Super']],
  ['Characters', ['Kaneki', 'Light Yagami', 'Goku']],
  ['Games', ['Valorant', 'Murder Mystery 2', 'Roblox']],
  ['Edit styles', ['Dark', 'Fast cuts', 'Phonk']]
];
const TIMELINE = [['2019', 'Joined Roblox'], ['2020', 'Made my Discord account'], ['2024', 'Started making edits'], ['2026', 'Built this hub']];
const LINKS = [['Copy Discord: Mouhamadx', 'Mouhamadx'], ['Copy Valorant: IMissHer#becks', 'IMissHer#becks'], ['GitHub', 'https://github.com/Djibsonbecks19']];
const CHANGELOG = [
  ['v1.4', 'Live rank icons, Music + Achievements + Favorites pages, 404 page'],
  ['v1.3', 'New pages, themes, shortcuts, achievements'],
  ['v1.2', 'Guestbook, command palette, boot sequence'],
  ['v1.0', 'Site launched']
];
const MORE = [['gaming', 'Gaming'], ['music', 'Music'], ['timeline', 'Timeline'], ['achievements', 'Achievements'], ['favorites', 'Favorites'], ['links', 'Links'], ['changelog', 'Changelog']];
const ORDER = ['home', 'stats', 'projects', 'about', 'guestbook', ...MORE.map(m => m[0])];

const ACH = {
  explorer: ['🧭', 'Explorer', 'Visit every page'],
  konami: ['🕹️', 'Secret', 'Enter the Konami code (↑↑↓↓←→←→ B A)'],
  palette: ['⌨️', 'Power user', 'Open the command palette with Ctrl+K'],
  night: ['🌙', 'Night owl', 'Visit between midnight and 5 AM'],
  themer: ['🎨', 'Stylist', 'Switch themes 5 times'],
  guest: ['✍️', 'Signed in', 'Sign the guestbook']
};

/* ───────── BUILD SCREENS ───────── */
const page = document.querySelector('.page');
const addScreen = (id, title, sub, body) => {
  const s = document.createElement('section');
  s.className = 'screen'; s.id = 'screen-' + id;
  s.innerHTML = `<div class="wide-panel"><div class="section-head"><h2>${title}</h2><span class="section-sub">${sub}</span></div>${body}</div>`;
  page.appendChild(s);
};
const bar = (label, k) => `<div class="bar-row" data-bar="${k}"><span>${label}</span><b>…</b><div class="track"><i style="--w:0%"></i></div></div>`;
const chips = a => `<div class="badges-row">${a.map(x => `<span class="badge">${esc(x)}</span>`).join('')}</div>`;

addScreen('gaming', 'Gaming', 'Where I grind', `<div class="grid2 stagger">
  <div class="card tilt"><h4>Valorant · IMissHer#becks</h4>
    <div class="rank-duo"><div><img data-rank="cur" alt=""><span>Current</span></div><div><img data-rank="peak" alt=""><span>Peak</span></div></div>
    ${bar('Current', 'cur')}${bar('Peak', 'peak')}
    <h4 style="margin-top:14px">Mains</h4>${chips(GAMING.agents)}</div>
  <div class="card tilt"><h4>Roblox favorites</h4>${chips(GAMING.roblox)}</div></div>`);

addScreen('music', 'Music', 'Live from Last.fm', `<div class="grid2 stagger">
  <div class="card"><h4>Recent tracks</h4><div id="music-recent"><p>Loading…</p></div></div>
  <div class="card"><h4>Top artists · 30 days</h4><div id="music-top"><p>Loading…</p></div></div></div>`);

addScreen('timeline', 'Timeline', 'My journey so far', `<div class="tl stagger">${TIMELINE.map(([y, t]) => `<div class="tl-item"><span class="tl-dot"></span><b>${y}</b><p>${esc(t)}</p></div>`).join('')}</div>`);

addScreen('achievements', 'Achievements', '', `<div class="grid2 stagger">${Object.entries(ACH).map(([k, [i, t, d]]) => `<div class="card ach-card tilt" data-ach="${k}"><span class="ico">${i}</span><div><h4>${t}</h4><p>${d}</p></div></div>`).join('')}</div>`);

addScreen('favorites', 'Favorites', 'What I\'m into', `<div class="grid2 stagger">${FAVORITES.map(([h, a]) => `<div class="card tilt"><h4>${h}</h4>${chips(a)}</div>`).join('')}</div>`);

addScreen('links', 'Links', 'Find me everywhere', `<div class="socials-row stagger">${LINKS.map(([l, v]) => v.startsWith('http') ? `<a class="social-chip" href="${v}" target="_blank" rel="noopener">${l}</a>` : `<button class="social-chip" data-copy="${v}">${l}</button>`).join('')}</div>`);

addScreen('changelog', 'Changelog', 'What changed', `<div class="stagger">${CHANGELOG.map(([v, t]) => `<div class="cl-item"><b>${v}</b><span>${esc(t)}</span></div>`).join('')}</div>`);

document.querySelectorAll('.stats-grid, .panel').forEach(e => e.classList.add('stagger'));

/* ───────── "MORE" DROPDOWN ───────── */
const more = document.createElement('div');
more.className = 'more-wrap';
more.innerHTML = `<button class="sn-btn more-btn">More ▾</button><div class="more-menu">${MORE.map(([k, l]) => `<button data-goto="${k}">${l}</button>`).join('')}</div>`;
document.getElementById('screen-nav').appendChild(more);
more.querySelector('.more-btn').addEventListener('click', e => { e.stopPropagation(); more.classList.toggle('open'); });
document.addEventListener('click', () => more.classList.remove('open'));

/* ───────── TOAST + ACHIEVEMENTS ───────── */
const toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
function refreshAchPage() {
  const got = store.get('ach', []);
  document.querySelectorAll('#screen-achievements .ach-card').forEach(c => c.classList.toggle('done', got.includes(c.dataset.ach)));
  const sub = document.querySelector('#screen-achievements .section-sub');
  if (sub) sub.textContent = got.length + ' / ' + Object.keys(ACH).length + ' unlocked';
}
function renderAch() {
  const row = document.getElementById('badges-row');
  if (!row) return;
  row.querySelectorAll('.ach').forEach(e => e.remove());
  store.get('ach', []).forEach(id => {
    if (!ACH[id]) return;
    const b = document.createElement('div');
    b.className = 'badge ach';
    b.innerHTML = `<span>${ACH[id][0]}</span><span>${ACH[id][1]}</span>`;
    row.appendChild(b);
  });
}
function unlock(id) {
  const got = store.get('ach', []);
  if (got.includes(id) || !ACH[id]) return;
  got.push(id); store.set('ach', got);
  toast('🏆 ' + ACH[id][1] + ' unlocked');
  refreshAchPage(); renderAch();
}
addEventListener('guestbooksent', () => unlock('guest'));
document.addEventListener('click', e => {
  if (e.target.closest('#theme-cycle-btn')) { const n = store.get('themeclicks', 0) + 1; store.set('themeclicks', n); if (n >= 5) unlock('themer'); }
});

/* ───────── MUSIC PAGE (Last.fm) ───────── */
let musicAt = 0;
async function loadMusic() {
  if (Date.now() - musicAt < 60000) return;
  musicAt = Date.now();
  const H = window.HUB || {};
  const recentEl = document.getElementById('music-recent'), topEl = document.getElementById('music-top');
  if (!H.LASTFM_API_KEY) { recentEl.innerHTML = topEl.innerHTML = '<p>Add your Last.fm key in script.js</p>'; return; }
  const base = 'https://ws.audioscrobbler.com/2.0/?format=json&api_key=' + H.LASTFM_API_KEY + '&user=' + encodeURIComponent(H.LASTFM_USER);
  const get = u => fetch(u).then(r => r.json()).catch(() => null);
  const [rec, top] = await Promise.all([get(base + '&method=user.getrecenttracks&limit=8'), get(base + '&method=user.gettopartists&period=1month&limit=6')]);
  const tracks = [].concat((rec && rec.recenttracks && rec.recenttracks.track) || []);
  recentEl.innerHTML = tracks.length ? tracks.map(t => `<div class="trk"><div><b>${esc(t.name)}</b><span>${esc(t.artist['#text'] || t.artist.name)}</span></div>${t['@attr'] && t['@attr'].nowplaying ? '<i class="live">● live</i>' : ''}</div>`).join('') : '<p>Nothing scrobbled yet.</p>';
  const artists = [].concat((top && top.topartists && top.topartists.artist) || []);
  topEl.innerHTML = artists.length ? artists.map((a, i) => `<div class="trk"><div><b>${i + 1}. ${esc(a.name)}</b></div><span>${esc(a.playcount)} plays</span></div>`).join('') : '<p>No data yet.</p>';
  document.querySelectorAll('#screen-music .trk').forEach((r, i) => r.style.animation = 'rise .5s ' + (i * 50) + 'ms both');
}

/* ───────── SCREEN CHANGE HOOK ───────── */
addEventListener('screenchange', e => {
  const n = e.detail, s = document.getElementById('screen-' + n);
  if (s) s.querySelectorAll('.stagger > *').forEach((c, i) => c.style.setProperty('--i', i));
  more.querySelector('.more-btn').classList.toggle('active', MORE.some(m => m[0] === n));
  try { localStorage.setItem('lastScreen', n); } catch (_) {}
  const seen = new Set(store.get('seen', [])); seen.add(n); store.set('seen', [...seen]);
  if (ORDER.every(k => seen.has(k))) unlock('explorer');
  if (new Date().getHours() < 5) unlock('night');
  if (n === 'about') renderAch();
  if (n === 'achievements') refreshAchPage();
  if (n === 'music') loadMusic();
});

/* ───────── LIVE VALORANT RANK → GAMING PAGE ───────── */
function setImg(img, urls) {
  if (!img || !urls || !urls.length) return;
  let i = 0;
  img.onerror = () => { if (++i < urls.length) img.src = urls[i]; else img.onerror = null; };
  img.src = urls[0];
}
function applyVal(d) {
  [['cur', d.current, d.currentId, d.currentUrls], ['peak', d.peak, d.peakId, d.peakUrls]].forEach(([k, name, id, urls]) => {
    const row = document.querySelector('#screen-gaming [data-bar="' + k + '"]');
    if (row && name) {
      row.querySelector('b').textContent = name;
      row.querySelector('.track i').style.setProperty('--w', Math.max(4, Math.min(100, ((id || 3) - 3) / 24 * 100)) + '%');
    }
    if (id != null) setImg(document.querySelector('#screen-gaming img[data-rank="' + k + '"]'), urls);
  });
}
addEventListener('valorantdata', e => applyVal(e.detail));
if (window.__valData) applyVal(window.__valData);

/* ───────── COMMANDS ───────── */
window.EXTRA_COMMANDS = [
  ...MORE.map(([k, l]) => ({ tag: 'Screen', label: 'Go to ' + l, run: () => window.goToScreen(k) })),
  { tag: 'Secret', label: 'Matrix rain', run: () => rain(5000) }
];

/* ───────── KEYBOARD ───────── */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kpos = 0;
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') unlock('palette');
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  kpos = (e.key === KONAMI[kpos] || e.key.toLowerCase() === KONAMI[kpos]) ? kpos + 1 : 0;
  if (kpos === KONAMI.length) { kpos = 0; document.body.classList.toggle('secret'); rain(6000); unlock('konami'); }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9]$/.test(e.key)) { const t = ORDER[(+e.key + 9) % 10]; if (t) window.goToScreen(t); }
});

function rain(ms) {
  const c = document.createElement('canvas');
  c.className = 'rain'; document.body.appendChild(c);
  const x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight; x.font = '14px monospace';
  const drops = Array(Math.floor(c.width / 16)).fill(0);
  const color = getComputedStyle(document.body).getPropertyValue('--accent');
  const t = setInterval(() => {
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = color;
    drops.forEach((y, i) => { x.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), i * 16, y); drops[i] = y > c.height && Math.random() > .975 ? 0 : y + 16; });
  }, 50);
  setTimeout(() => { clearInterval(t); c.remove(); }, ms);
}

/* ───────── COPY + TILT ───────── */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]');
  if (b && navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(() => toast('Copied ' + b.dataset.copy));
});
let tilted = null;
document.addEventListener('mousemove', e => {
  const c = e.target.closest && e.target.closest('.tilt, .project-card, .stats-card');
  if (tilted && tilted !== c) tilted.style.transform = '';
  tilted = c;
  if (!c) return;
  const r = c.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
  c.style.transform = `perspective(700px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg) translateY(-2px)`;
});