// server.js  — run with:  node server.js
// Then open:  http://localhost:3000

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

/* ── Tiny HTTPS fetch helper ── */
function httpsGet(reqUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(reqUrl, options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function httpsPost(reqUrl, data) {
  const body = JSON.stringify(data);
  const parsed = new URL(reqUrl);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json',
        'User-Agent': 'profile-site/1.0'
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGetJSON(reqUrl) {
  const parsed = new URL(reqUrl);
  return new Promise((resolve, reject) => {
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'Accept': 'application/json', 'User-Agent': 'profile-site/1.0' }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

/* ── MIME types ── */
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  /* CORS headers for all responses */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  /* ── API proxy routes ── */

  /* POST /api/roblox/userid  { username } */
  if (pathname === '/api/roblox/userid' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { username } = JSON.parse(body);
        const result = await httpsPost(
          'https://users.roblox.com/v1/usernames/users',
          { usernames: [username], excludeBannedUsers: false }
        );
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  /* GET /api/roblox/user/:id */
  if (pathname.startsWith('/api/roblox/user/') && req.method === 'GET') {
    const uid = pathname.split('/').pop();
    try {
      const d = await httpsGetJSON(`https://users.roblox.com/v1/users/${uid}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(d));
    } catch (e) { res.writeHead(500); res.end('{}'); }
    return;
  }

  /* GET /api/roblox/avatar/:id */
  if (pathname.startsWith('/api/roblox/avatar/') && req.method === 'GET') {
    const uid = pathname.split('/').pop();
    try {
      const d = await httpsGetJSON(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Png`
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(d));
    } catch (e) { res.writeHead(500); res.end('{}'); }
    return;
  }

  /* GET /api/roblox/friends/:id */
  if (pathname.startsWith('/api/roblox/friends/') && req.method === 'GET') {
    const uid = pathname.split('/').pop();
    try {
      const d = await httpsGetJSON(`https://friends.roblox.com/v1/users/${uid}/friends/count`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(d));
    } catch (e) { res.writeHead(500); res.end('{}'); }
    return;
  }

  /* POST /api/roblox/presence  { userIds: [...] } */
  if (pathname === '/api/roblox/presence' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { userIds } = JSON.parse(body);
        const result = await httpsPost(
          'https://presence.roblox.com/v1/presence/users',
          { userIds }
        );
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  /* ── Static file server ── */
  let filePath = pathname === '/' ? '/profile.html' : pathname;
  filePath = path.join(__dirname, filePath);

  /* Security: prevent path traversal */
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`File not found: ${pathname}\n\nMake sure profile.html and bg.mp4 are in the same folder as server.js`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    /* Video streaming with range support */
    if (ext === '.mp4' || ext === '.webm') {
      const fileSize = stat.size;
      const rangeHeader = req.headers['range'];
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Profile site running at:  http://localhost:${PORT}\n`);
  console.log(`  Files needed in this folder:`);
  console.log(`    profile.html  ← the site`);
  console.log(`    bg.mp4        ← your anime edit video\n`);
});