// server.js — run locally with: node server.js  (then open http://localhost:3000)
// On Render set env vars: HENRIK_KEY, DISCORD_WEBHOOK (optional: VAL_REGION, VAL_NAME, VAL_TAG)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HENRIK_KEY = process.env.HENRIK_KEY || '';
const WEBHOOK = process.env.DISCORD_WEBHOOK || '';
const VAL = { region: process.env.VAL_REGION || 'eu', platform: 'pc', name: process.env.VAL_NAME || 'IMissHer', tag: process.env.VAL_TAG || 'becks' };

/* ── one small HTTPS helper for everything ── */
function request(u, { method = 'GET', headers = {}, data } = {}) {
  return new Promise((resolve, reject) => {
    const p = new URL(u);
    const body = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: p.hostname, path: p.pathname + p.search, method, timeout: 10000,
      headers: { Accept: 'application/json', 'User-Agent': 'profile-site/1.0',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...headers }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(b) }); } catch { resolve({ status: res.statusCode, body: b }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}
const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const readJSON = (req) => new Promise((resolve) => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
});

/* ── Valorant rank via HenrikDev API (free key from their Discord), cached 5 min ── */
let valCache = { t: 0, v: null };
async function getValorant() {
  if (valCache.v && Date.now() - valCache.t < 5 * 60e3) return valCache.v;
  if (!HENRIK_KEY) throw new Error('HENRIK_KEY not set');
  const { platform, name, tag } = VAL;
  // tries your region first, then the others, so a wrong region can't break it
  const regions = [...new Set([VAL.region, 'eu', 'na', 'ap', 'kr'])];
  let d = null, lastStatus = 0;
  for (const region of regions) {
    const r = await request(
      `https://api.henrikdev.xyz/valorant/v3/mmr/${region}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      { headers: { Authorization: HENRIK_KEY } }
    );
    lastStatus = r.status;
    if (r.status === 200 && r.body && r.body.data) { d = r.body.data; break; }
    if (r.status === 401 || r.status === 403) break; // bad key, no point trying other regions
  }
  if (!d) throw new Error('henrik status ' + lastStatus);
  const out = {
    current: { name: d.current && d.current.tier && d.current.tier.name, id: d.current && d.current.tier ? d.current.tier.id : null, rr: d.current && d.current.rr },
    peak: { name: d.peak && d.peak.tier && d.peak.tier.name, id: d.peak && d.peak.tier ? d.peak.tier.id : null }
  };
  if (!out.current.name && !out.peak.name) throw new Error('no rank in response');
  valCache = { t: Date.now(), v: out };
  return out;
}

/* ── guestbook cooldown (per IP) ── */
const lastPost = new Map();

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function notFound(res) {
  fs.readFile(path.join(__dirname, '404.html'), (e, d) => { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(e ? NOT_FOUND : d); });
}
const NOT_FOUND = '<body style="background:#060606;color:#00ff66;font:14px monospace;display:grid;place-items:center;height:100vh;margin:0"><div>&gt; SIGNAL LOST<br>&gt; 404<br>&gt; <a style="color:#c9a96e" href="/">return to hub</a></div></body>';

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    /* ── API routes ── */
    if (pathname === '/api/valorant' && req.method === 'GET') {
      try { return send(res, 200, await getValorant()); }
      catch (e) { return send(res, 502, { error: e.message }); }
    }
    if (pathname === '/api/guestbook' && req.method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (Date.now() - (lastPost.get(ip) || 0) < 8000) return send(res, 429, { error: 'slow down' });
      lastPost.set(ip, Date.now());
      const msg = String((await readJSON(req)).message || '').trim().slice(0, 150);
      if (!msg) return send(res, 400, { error: 'empty' });
      if (WEBHOOK) await request(WEBHOOK, { method: 'POST', data: { content: '📝 **Guestbook:** ' + msg, allowed_mentions: { parse: [] } } });
      return send(res, 200, { ok: true });
    }
    if (pathname === '/api/roblox/userid' && req.method === 'POST') {
      const { username } = await readJSON(req);
      const r = await request('https://users.roblox.com/v1/usernames/users', { method: 'POST', data: { usernames: [username], excludeBannedUsers: false } });
      return send(res, r.status, r.body);
    }
    if (pathname === '/api/roblox/presence' && req.method === 'POST') {
      const { userIds } = await readJSON(req);
      const r = await request('https://presence.roblox.com/v1/presence/users', { method: 'POST', data: { userIds } });
      return send(res, r.status, r.body);
    }
    const m = pathname.match(/^\/api\/roblox\/(user|avatar|friends)\/(\d+)$/);
    if (m && req.method === 'GET') {
      const urls = {
        user: `https://users.roblox.com/v1/users/${m[2]}`,
        avatar: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${m[2]}&size=150x150&format=Png`,
        friends: `https://friends.roblox.com/v1/users/${m[2]}/friends/count`
      };
      const r = await request(urls[m[1]]);
      return send(res, r.status, r.body);
    }
  } catch (e) { return send(res, 500, { error: e.message }); }

  /* ── static files ── */
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = '/'; }
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(__dirname, rel));
  const blocked = /(^|[\\/])\.|server\.js$|package(-lock)?\.json$/i.test(rel);
  if (!filePath.startsWith(__dirname + path.sep) || blocked) return notFound(res);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      const size = stat.size, range = req.headers.range;
      if (range) {
        const [s, e] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(s, 10), end = e ? parseInt(e, 10) : size - 1;
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': mime });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'Content-Length': size, 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(filePath).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => console.log(`\n  Site running at: http://localhost:${PORT}\n  Valorant key: ${HENRIK_KEY ? 'set' : 'NOT SET (rank will use the manual fallback)'}\n`));