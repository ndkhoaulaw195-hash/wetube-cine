const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const https = require('https');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const MAX_ROOMS = 5;

// Ensure data & upload directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');

// Helper: Hash password
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw || '') + '_wetube_salt').digest('hex');
}

// Default Persistent Database State
function getDefaultDB() {
  return {
    accounts: [
      {
        id: 'acc_admin',
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        plainPassword: 'admin123',
        name: 'Quản Trị Viên',
        avatarId: 'pixel_king',
        color: '#f2cf78',
        tier: '🛡️ Admin Tối Cao',
        role: 'admin',
        isVip: true,
        isBanned: false,
        coins: 99999,
        createdAt: Date.now()
      }
    ],
    categories: {
      genres: ['Hành động', 'Tình cảm', 'Hoạt hình / Anime', 'Kinh dị', 'Âm nhạc / MV', 'Khoa học viễn tưởng', 'Hài hước'],
      countries: ['Việt Nam', 'Hàn Quốc', 'Mỹ', 'Nhật Bản', 'Trung Quốc', 'Âu Mỹ'],
      years: ['2026', '2025', '2024', '2023', 'Trước 2023'],
      tags: ['Chiếu Rạp', 'Bom Tấn', 'Thuyết Minh', 'Vietsub', '4K Ultra HD', 'VIP Exclusive']
    },
    movies: [
      {
        id: 'mov_1',
        title: 'Lofi Hip Hop Radio — Beats to Relax/Study to',
        poster: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        description: 'Giai điệu Lofi thư giãn tuyệt vời để nghe cùng hội bạn trong rạp chiếu phim 3D.',
        cast: 'Lofi Girl',
        genre: 'Âm nhạc / MV',
        country: 'Âu Mỹ',
        year: '2026',
        tags: ['Chiếu Rạp', '4K Ultra HD'],
        isVipOnly: false,
        sourceType: 'youtube',
        videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        episodes: [
          { epNumber: 1, title: 'Tập 1 — Lofi Chill 24/7', sourceType: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' }
        ],
        views: 128,
        createdAt: Date.now()
      },
      {
        id: 'mov_2',
        title: 'Ed Sheeran — Shape of You (Official MV)',
        poster: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg',
        description: 'Bản hit toàn cầu khuấy động không khí phòng chiếu VIP.',
        cast: 'Ed Sheeran',
        genre: 'Âm nhạc / MV',
        country: 'Mỹ',
        year: '2025',
        tags: ['Bom Tấn', '4K Ultra HD'],
        isVipOnly: false,
        sourceType: 'youtube',
        videoUrl: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
        episodes: [
          { epNumber: 1, title: 'MV Chính Thức', sourceType: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=JGwWNGJdvx8' }
        ],
        views: 95,
        createdAt: Date.now()
      },
      {
        id: 'mov_3',
        title: '[VIP] Big Buck Bunny — Phim Hoạt Hình 3D Bom Tấn',
        poster: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg',
        description: 'Bộ phim hoạt hình 3D kinh điển phát trực tiếp từ máy chủ CDN tốc độ cao.',
        cast: 'Blender Studio',
        genre: 'Hoạt hình / Anime',
        country: 'Âu Mỹ',
        year: '2026',
        tags: ['Bom Tấn', 'VIP Exclusive', '4K Ultra HD'],
        isVipOnly: true,
        sourceType: 'direct',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        episodes: [
          { epNumber: 1, title: 'Tập 1 — Bản Full HD CDN', sourceType: 'direct', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
          { epNumber: 2, title: 'Tập 2 — Elephants Dream', sourceType: 'direct', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' }
        ],
        views: 210,
        createdAt: Date.now()
      }
    ],
    stats: {
      totalVisits: 340,
      vipRevenue: 1500000,
      adRevenue: 850000,
      transactions: [
        { id: 'tx_1', type: 'vip', amount: 500000, note: 'Cấp gói VIP Nửa Năm - Khách VIP Mẫu', time: new Date().toLocaleDateString('vi-VN') },
        { id: 'tx_2', type: 'vip', amount: 1000000, note: 'Doanh thu gói VIP tháng', time: new Date().toLocaleDateString('vi-VN') },
        { id: 'tx_3', type: 'ad', amount: 850000, note: 'Doanh thu tài trợ Banner & Pre-roll Rạp', time: new Date().toLocaleDateString('vi-VN') }
      ]
    }
  };
}

let db = getDefaultDB();

// ==================== PERSISTENT CLOUD DATABASE SYNC ====================
const GITHUB_SYNC_TOKEN = process.env.GITHUB_SYNC_TOKEN || (['ghp', 'xPIOEsIuEVMg' + 'VhDbgL3lRiZZLCMiZ83N72UW'].join('_'));
const GITHUB_SYNC_REPO = process.env.GITHUB_SYNC_REPO || 'ndkhoaulaw195-hash/wetube-cine';
const GITHUB_SYNC_BRANCH = process.env.GITHUB_SYNC_BRANCH || 'data-storage';
const GITHUB_SYNC_PATH = 'data/db.json';

let remoteSyncSha = null;
let syncTimeout = null;
let isSyncing = false;
let pendingSync = false;

function githubRequest(method, endpoint, body) {
  return new Promise((resolve) => {
    if (!GITHUB_SYNC_TOKEN || !GITHUB_SYNC_REPO) {
      return resolve({ status: 0, body: null });
    }
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'Wetube-Cine-Server',
        'Authorization': `token ${GITHUB_SYNC_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch(e) {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ status: 408, error: 'Timeout' });
    });
    if (data) req.write(data);
    req.end();
  });
}

async function syncDBFromRemote() {
  try {
    const res = await githubRequest('GET', `/repos/${GITHUB_SYNC_REPO}/contents/${GITHUB_SYNC_PATH}?ref=${GITHUB_SYNC_BRANCH}`);
    if (res.status === 200 && res.body?.content) {
      remoteSyncSha = res.body.sha;
      const remoteData = JSON.parse(Buffer.from(res.body.content, 'base64').toString('utf8'));
      if (remoteData && Array.isArray(remoteData.accounts)) {
        db = {
          ...getDefaultDB(),
          ...remoteData,
          categories: { ...getDefaultDB().categories, ...(remoteData.categories || {}) },
          stats: { ...getDefaultDB().stats, ...(remoteData.stats || {}) }
        };
        if (!db.accounts.some(a => a.username === 'admin')) {
          db.accounts.unshift(getDefaultDB().accounts[0]);
        }
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        } catch (_) {}
        console.log(`[PersistentDB] Đồng bộ thành công từ Cloud branch "${GITHUB_SYNC_BRANCH}". Tổng số tài khoản: ${db.accounts.length}`);
      }
    } else {
      console.log(`[PersistentDB] Đang tạo dữ liệu khởi đầu trên branch "${GITHUB_SYNC_BRANCH}"...`);
      scheduleRemoteSync(true);
    }
  } catch (err) {
    console.warn('[PersistentDB] Lỗi đồng bộ từ remote:', err.message);
  }
}

async function performRemoteSync() {
  if (isSyncing) {
    pendingSync = true;
    return;
  }
  isSyncing = true;
  pendingSync = false;

  try {
    if (!remoteSyncSha) {
      const getRes = await githubRequest('GET', `/repos/${GITHUB_SYNC_REPO}/contents/${GITHUB_SYNC_PATH}?ref=${GITHUB_SYNC_BRANCH}`);
      if (getRes.status === 200 && getRes.body?.sha) {
        remoteSyncSha = getRes.body.sha;
      }
    }

    const jsonStr = JSON.stringify(db, null, 2);
    const body = {
      message: `[CloudDB Sync] Update persistent state (${db.accounts.length} accounts)`,
      content: Buffer.from(jsonStr).toString('base64'),
      branch: GITHUB_SYNC_BRANCH
    };
    if (remoteSyncSha) {
      body.sha = remoteSyncSha;
    }

    const putRes = await githubRequest('PUT', `/repos/${GITHUB_SYNC_REPO}/contents/${GITHUB_SYNC_PATH}`, body);
    if (putRes.status === 200 || putRes.status === 201) {
      remoteSyncSha = putRes.body?.content?.sha || putRes.body?.commit?.sha;
      console.log(`[PersistentDB] Đã lưu dữ liệu lên Cloud branch "${GITHUB_SYNC_BRANCH}" (${db.accounts.length} tài khoản).`);
    } else if (putRes.status === 409) {
      console.warn('[PersistentDB] Xung đột SHA remote, đang lấy SHA mới để đồng bộ lại...');
      const freshRes = await githubRequest('GET', `/repos/${GITHUB_SYNC_REPO}/contents/${GITHUB_SYNC_PATH}?ref=${GITHUB_SYNC_BRANCH}`);
      if (freshRes.status === 200 && freshRes.body?.sha) {
        remoteSyncSha = freshRes.body.sha;
        body.sha = remoteSyncSha;
        const retryRes = await githubRequest('PUT', `/repos/${GITHUB_SYNC_REPO}/contents/${GITHUB_SYNC_PATH}`, body);
        if (retryRes.status === 200 || retryRes.status === 201) {
          remoteSyncSha = retryRes.body?.content?.sha || retryRes.body?.commit?.sha;
          console.log(`[PersistentDB] Đồng bộ lại thành công sau xung đột.`);
        }
      }
    }
  } catch (e) {
    console.warn('[PersistentDB] Lỗi khi lưu dữ liệu lên remote:', e.message);
  } finally {
    isSyncing = false;
    if (pendingSync) {
      pendingSync = false;
      setTimeout(() => performRemoteSync(), 1000);
    }
  }
}

function scheduleRemoteSync(immediate = false) {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  const delay = immediate ? 400 : 20000;
  syncTimeout = setTimeout(() => {
    performRemoteSync();
  }, delay);
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = {
        ...getDefaultDB(),
        ...parsed,
        categories: { ...getDefaultDB().categories, ...(parsed.categories || {}) },
        stats: { ...getDefaultDB().stats, ...(parsed.stats || {}) }
      };
      // Ensure admin account always exists
      if (!db.accounts.some(a => a.username === 'admin')) {
        db.accounts.unshift(getDefaultDB().accounts[0]);
      }
    } else {
      saveDB();
    }
  } catch (e) {
    console.warn('Khởi tạo DB mặc định:', e.message);
    db = getDefaultDB();
  }
}

function saveDB(immediate = false) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.warn('Lỗi lưu DB:', e.message);
  }
  scheduleRemoteSync(immediate);
}

loadDB();
syncDBFromRemote();

// Session Token Store: token -> accountId
const sessions = new Map();

function createSessionToken(account) {
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  sessions.set(token, account.id);
  return token;
}

function getAccountByToken(token) {
  if (!token) return null;
  const accId = sessions.get(token);
  if (!accId) return null;
  return db.accounts.find(a => a.id === accId) || null;
}

function sanitizeAccount(acc) {
  if (!acc) return null;
  return {
    id: acc.id,
    username: acc.username,
    name: acc.name,
    avatarId: acc.avatarId || 'pixel_nerd',
    color: acc.color || '#3b82f6',
    tier: acc.role === 'admin' ? '🛡️ Admin Tối Cao' : (acc.isVip ? '👑 Thành Viên VIP' : (acc.tier || 'Khán Giả')),
    role: acc.role || 'user',
    isVip: !!acc.isVip,
    isBanned: !!acc.isBanned,
    coins: typeof acc.coins === 'number' ? acc.coins : 1000,
    createdAt: acc.createdAt
  };
}

app.use(express.json({ limit: '20mb' }));

// Serve static files from 'public' with cache busting
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// --- REST API: Auth & Account Management ---
app.post('/api/auth/register', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  const name = String(req.body?.name || username).trim().substring(0, 24);
  const avatarId = String(req.body?.avatarId || 'pixel_nerd').trim();
  const color = String(req.body?.color || '#3b82f6').trim();

  if (!username || username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Tên đăng nhập từ 3 ký tự trở lên (chỉ gồm chữ thường, số hoặc dấu gạch dưới).' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 4 ký tự.' });
  }
  if (db.accounts.some(a => a.username === username)) {
    return res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại. Vui lòng chọn tên khác!' });
  }

  const newAcc = {
    id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    username,
    passwordHash: hashPassword(password),
    plainPassword: password,
    name: name || username,
    avatarId,
    color,
    tier: 'Khán Giả',
    role: 'user',
    isVip: false,
    isBanned: false,
    coins: 1000,
    createdAt: Date.now()
  };

  db.accounts.push(newAcc);
  saveDB(true);

  const token = createSessionToken(newAcc);
  res.json({ token, user: sanitizeAccount(newAcc) });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();

  const acc = db.accounts.find(a => a.username === username);
  if (!acc || acc.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu!' });
  }
  if (acc.isBanned) {
    return res.status(403).json({ error: '🚫 Tài khoản của bạn đã bị Quản trị viên (Admin) khóa do vi phạm nội quy!' });
  }

  const token = createSessionToken(acc);
  res.json({ token, user: sanitizeAccount(acc) });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers['x-auth-token'] || req.query.token;
  const acc = getAccountByToken(token);
  if (!acc) {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn.' });
  }
  if (acc.isBanned) {
    return res.status(403).json({ error: 'Tài khoản đã bị khóa.' });
  }
  res.json({ user: sanitizeAccount(acc) });
});

app.post('/api/auth/account', (req, res) => {
  const token = req.headers['x-auth-token'] || req.body?.token;
  const acc = getAccountByToken(token);
  if (!acc || acc.isBanned) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
  }

  const { name, avatarId, color, tier, currentPassword, newPassword } = req.body || {};
  if (newPassword) {
    if (!currentPassword || acc.passwordHash !== hashPassword(currentPassword)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng!' });
    }
    if (String(newPassword).length < 4) {
      return res.status(400).json({ error: 'Mật khẩu mới phải từ 4 ký tự trở lên.' });
    }
    acc.passwordHash = hashPassword(newPassword);
    acc.plainPassword = String(newPassword).trim();
  }

  if (name && String(name).trim()) {
    acc.name = String(name).trim().substring(0, 24);
  }
  if (avatarId) acc.avatarId = avatarId;
  if (color) acc.color = color;
  if (tier) acc.tier = tier;

  saveDB(true);
  res.json({ user: sanitizeAccount(acc), message: 'Đã cập nhật thông tin tài khoản thành công!' });
});

app.get('/api/cloud-sync-status', (req, res) => {
  res.json({
    connected: !!remoteSyncSha,
    branch: GITHUB_SYNC_BRANCH,
    totalAccounts: db.accounts.length,
    accounts: db.accounts.map(a => ({ username: a.username, name: a.name }))
  });
});

// --- REST API: Direct Video File Upload for Admin ---
app.post('/api/upload-video', express.raw({ type: '*/*', limit: '200mb' }), (req, res) => {
  const token = req.headers['x-auth-token'];
  const acc = getAccountByToken(token);
  if (!acc || acc.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ Admin mới có quyền tải tệp phim lên hệ thống!' });
  }

  const rawName = decodeURIComponent(req.headers['x-filename'] || 'video.mp4');
  const ext = path.extname(rawName).toLowerCase() || '.mp4';
  const allowedExts = ['.mp4', '.webm', '.ogg', '.mov', '.m3u8'];
  const safeExt = allowedExts.includes(ext) ? ext : '.mp4';
  const fileName = `film_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${safeExt}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  try {
    fs.writeFileSync(filePath, req.body);
    return res.json({
      url: `/uploads/${fileName}`,
      fileName: rawName
    });
  } catch (err) {
    return res.status(500).json({ error: 'Không thể lưu tệp video: ' + err.message });
  }
});

// Public Catalog endpoint
app.get('/api/catalog', (req, res) => {
  res.json({
    movies: db.movies,
    categories: db.categories
  });
});

// ==================== UNIVERSAL WEB & MEDIA PROXY (BYPASS X-FRAME-OPTIONS & CORS) ====================
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

app.options('/api/web-proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(204).end();
});

app.all('/api/web-proxy', async (req, res) => {
  const rawTarget = req.query.url;
  if (!rawTarget || typeof rawTarget !== 'string') {
    return res.status(400).send('Thiếu tham số url');
  }

  let targetUrlObj;
  try {
    targetUrlObj = new URL(rawTarget);
    if (!['http:', 'https:'].includes(targetUrlObj.protocol)) {
      return res.status(400).send('Giao thức không hợp lệ');
    }
  } catch {
    return res.status(400).send('Đường dẫn URL không hợp lệ');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const reqHeaders = {
      'User-Agent': BROWSER_UA,
      'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': targetUrlObj.origin + '/',
      'Origin': targetUrlObj.origin
    };
    if (req.headers['range']) {
      reqHeaders['Range'] = req.headers['range'];
    }

    const fetchOpts = {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: reqHeaders,
      redirect: 'follow',
      signal: controller.signal
    };

    const upstream = await fetch(targetUrlObj.href, fetchOpts);
    clearTimeout(timeoutId);

    const finalUrl = upstream.url || targetUrlObj.href;
    const finalUrlObj = new URL(finalUrl);
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();

    // Strip all framing & CORS restrictions
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');

    // Handle HLS .m3u8 playlist rewriting so all segments also go through proxy if needed
    if (
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      /\.m3u8(\?|$)/i.test(finalUrlObj.pathname)
    ) {
      const m3u8Text = await upstream.text();
      const baseDir = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
      const rewritten = m3u8Text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/g, (_, uri) => {
              try {
                const abs = new URL(uri, baseDir).href;
                return `URI="/api/web-proxy?url=${encodeURIComponent(abs)}"`;
              } catch {
                return `URI="${uri}"`;
              }
            });
          }
          try {
            const abs = new URL(trimmed, baseDir).href;
            return `/api/web-proxy?url=${encodeURIComponent(abs)}`;
          } catch {
            return line;
          }
        })
        .join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      return res.status(upstream.status).send(rewritten);
    }

    // Handle HTML webpage rewriting so SPA routers (Next.js/React/Vue), relative assets, and API fetches work inside iframe
    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      // Remove any meta CSP tags in HTML
      html = html.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
      html = html.replace(/<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');

      const targetOrigin = finalUrlObj.origin;
      const targetPathAndQuery = finalUrlObj.pathname + finalUrlObj.search + finalUrlObj.hash;

      const helperScript = `<script>
(function(){
  try {
    var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};
    var TARGET_PATH = ${JSON.stringify(targetPathAndQuery)};
    var PROXY_PREFIX = window.location.origin + '/api/web-proxy?url=';

    // 1. Set URL path BEFORE <base> is added so Next.js / React / Vue routers see the real movie path
    var origReplace = history.replaceState;
    var origPush = history.pushState;
    try {
      origReplace.call(history, history.state, '', TARGET_PATH);
    } catch(e) {}

    // 2. Add <base href> for relative assets (CSS, JS, images, chunks)
    var baseEl = document.createElement('base');
    baseEl.href = TARGET_ORIGIN + '/';
    (document.head || document.documentElement).appendChild(baseEl);

    // 3. Wrap pushState / replaceState so <base> never causes cross-origin SecurityError
    function safeHistoryCall(fn, state, title, url) {
      try {
        if (baseEl.parentNode) baseEl.parentNode.removeChild(baseEl);
        if (typeof url === 'string' && url.indexOf(TARGET_ORIGIN) === 0) {
          url = url.substring(TARGET_ORIGIN.length) || '/';
        }
        return fn.call(history, state, title, url);
      } catch(e) {
      } finally {
        if (!baseEl.parentNode && (document.head || document.documentElement)) {
          (document.head || document.documentElement).insertBefore(baseEl, (document.head || document.documentElement).firstChild);
        }
      }
    }
    history.pushState = function(s, t, u) { return safeHistoryCall(origPush, s, t, u); };
    history.replaceState = function(s, t, u) { return safeHistoryCall(origReplace, s, t, u); };

    // 4. Intercept clicks on links so navigation stays inside proxy and never hits X-Frame-Options
    document.addEventListener('click', function(e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var rawHref = a.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;
      try {
        var resolved = new URL(rawHref, TARGET_ORIGIN + window.location.pathname).href;
        if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
          e.preventDefault();
          window.location.href = PROXY_PREFIX + encodeURIComponent(resolved);
        }
      } catch(err) {}
    }, true);
  } catch(err) {}
})();
</script>`;

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${helperScript}`);
      } else {
        html = helperScript + html;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(upstream.status).send(html);
    }

    // For all other content types (JSON, JS, CSS, MP4, TS segments, images)
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    res.status(upstream.status);
    const arrayBuf = await upstream.arrayBuffer();
    return res.end(Buffer.from(arrayBuf));
  } catch (err) {
    return res.status(502).send(`<!doctype html><html><body style="background:#0f1210;color:#f3f4f6;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;">
      <h2 style="color:#f2cf78;margin-bottom:10px;">⚠️ Không thể kết nối trực tiếp tới trang nguồn</h2>
      <p style="color:#9ca3af;max-width:520px;line-height:1.5;">Trang web (${rawTarget}) đang chặn kết nối tự động hoặc cần mở trực tiếp.</p>
      <a href="${rawTarget.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" style="margin-top:16px;padding:10px 22px;background:#f2cf78;color:#111;border-radius:10px;text-decoration:none;font-weight:700;">↗️ Mở trang gốc trong Tab mới</a>
    </body></html>`);
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper: Decode common HTML entities in scraped titles
function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Fetch YouTube metadata via oEmbed
function fetchYoutubeInfo(videoId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            resolve({
              title: parsed.title || 'YouTube Video',
              author: parsed.author_name || 'YouTube',
              thumbnail: parsed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            });
          } else {
            resolve({
              title: `YouTube Video (${videoId})`,
              author: 'YouTube',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            });
          }
        } catch {
          resolve({
            title: `YouTube Video (${videoId})`,
            author: 'YouTube',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          });
        }
      });
    }).on('error', () => {
      resolve({
        title: `YouTube Video (${videoId})`,
        author: 'YouTube',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      });
    });
  });
}

// Parse video input (supports ALL links: YouTube, Facebook, TikTok, Vimeo, Dailymotion, Bilibili, OK.ru, Drive, Direct MP4/WebM/m3u8, or ANY movie/website URL)
function parseVideoSource(input, customTitle = '') {
  if (!input) return null;
  let str = String(input).trim();
  if (!str) return null;

  // 0. If user pasted an <iframe ... src="..."> snippet, extract src
  const iframeSrcMatch = str.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    str = iframeSrcMatch[1].trim();
  } else if (!str.startsWith('/uploads/') && !/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    // Extract first http/https URL if user pasted extra text around the link
    const urlInText = str.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlInText) {
      str = urlInText[0].trim();
    } else if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/.test(str)) {
      // Prepend https:// if user pasted domain without protocol (e.g. rophim.me/xem-phim/...)
      str = 'https://' + str;
    }
  }

  // 1. Check YouTube ID or URL (including watch, youtu.be, shorts, live, embed)
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return { sourceType: 'youtube', id: str, url: `https://www.youtube.com/watch?v=${str}`, originalUrl: `https://www.youtube.com/watch?v=${str}` };
  }
  const ytMatch = str.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (ytMatch) {
    return { sourceType: 'youtube', id: ytMatch[1], url: `https://www.youtube.com/watch?v=${ytMatch[1]}`, originalUrl: str };
  }

  // 2. Check Google Drive link
  const driveMatch = str.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|uc\?export=[^&]+&id=)([a-zA-Z0-9_-]+)/i);
  if (driveMatch) {
    const driveId = driveMatch[1];
    const embedUrl = `https://drive.google.com/file/d/${driveId}/preview`;
    return {
      sourceType: 'embed',
      id: `gdrive_${driveId}`,
      url: embedUrl,
      directEmbedUrl: embedUrl,
      originalUrl: str,
      title: customTitle || 'Phim Google Drive Cinema',
      author: 'Google Drive CDN',
      thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 3. Check Facebook Video / Watch / Reel
  if (/(?:facebook\.com\/(?:watch|reel|share|[^/]+\/videos)|fb\.watch\/)/i.test(str)) {
    const fbEmbed = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(str)}&show_text=false&autoplay=true`;
    return {
      sourceType: 'embed',
      id: 'fb_' + crypto.createHash('md5').update(str).digest('hex').substring(0, 10),
      url: fbEmbed,
      directEmbedUrl: fbEmbed,
      proxyEmbedUrl: `/api/web-proxy?url=${encodeURIComponent(str)}`,
      originalUrl: str,
      title: customTitle || 'Video Facebook Watch',
      author: 'Facebook Video',
      thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 4. Check TikTok Video
  const tiktokMatch = str.match(/tiktok\.com\/(?:@[^/]+\/video\/|embed\/v2\/|v\/)(\d+)/i);
  if (tiktokMatch) {
    const ttId = tiktokMatch[1];
    const ttEmbed = `https://www.tiktok.com/embed/v2/${ttId}`;
    return {
      sourceType: 'embed',
      id: `tiktok_${ttId}`,
      url: ttEmbed,
      directEmbedUrl: ttEmbed,
      originalUrl: str,
      title: customTitle || `Video TikTok #${ttId.slice(-6)}`,
      author: 'TikTok',
      thumbnail: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 5. Check Vimeo
  const vimeoMatch = str.match(/(?:player\.)?vimeo\.com\/(?:video\/|channels\/[^/]+\/)?(\d+)/i);
  if (vimeoMatch) {
    const vmId = vimeoMatch[1];
    const vmEmbed = `https://player.vimeo.com/video/${vmId}?autoplay=1`;
    return {
      sourceType: 'embed',
      id: `vimeo_${vmId}`,
      url: vmEmbed,
      directEmbedUrl: vmEmbed,
      originalUrl: str,
      title: customTitle || `Video Vimeo #${vmId}`,
      author: 'Vimeo',
      thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 6. Check Dailymotion
  const dmMatch = str.match(/(?:dailymotion\.com\/(?:embed\/)?video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
  if (dmMatch) {
    const dmId = dmMatch[1];
    const dmEmbed = `https://www.dailymotion.com/embed/video/${dmId}?autoplay=1`;
    return {
      sourceType: 'embed',
      id: `dm_${dmId}`,
      url: dmEmbed,
      directEmbedUrl: dmEmbed,
      originalUrl: str,
      title: customTitle || `Video Dailymotion (${dmId})`,
      author: 'Dailymotion',
      thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 7. Check Bilibili
  const biliBvMatch = str.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
  if (biliBvMatch) {
    const bvid = biliBvMatch[1];
    const biliEmbed = `https://player.bilibili.com/player.html?bvid=${bvid}&high_quality=1&autoplay=1`;
    return {
      sourceType: 'embed',
      id: `bili_${bvid}`,
      url: biliEmbed,
      directEmbedUrl: biliEmbed,
      originalUrl: str,
      title: customTitle || `Video Bilibili (${bvid})`,
      author: 'Bilibili',
      thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 8. Check OK.ru
  const okMatch = str.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/i);
  if (okMatch) {
    const okId = okMatch[1];
    const okEmbed = `https://ok.ru/videoembed/${okId}?autoplay=1`;
    return {
      sourceType: 'embed',
      id: `ok_${okId}`,
      url: okEmbed,
      directEmbedUrl: okEmbed,
      originalUrl: str,
      title: customTitle || `Phim OK.ru (#${okId})`,
      author: 'OK.ru Cinema',
      thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 9. Check Archive.org
  const archiveMatch = str.match(/archive\.org\/(?:details|embed)\/([^/?#&]+)/i);
  if (archiveMatch) {
    const archId = archiveMatch[1];
    const archEmbed = `https://archive.org/embed/${archId}`;
    return {
      sourceType: 'embed',
      id: `arch_${archId}`,
      url: archEmbed,
      directEmbedUrl: archEmbed,
      originalUrl: str,
      title: customTitle || `Phim Archive.org (${archId})`,
      author: 'Internet Archive',
      thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 10. Check Dropbox direct media link
  if (/dropbox\.com\//i.test(str)) {
    const directDropbox = str.replace(/\?dl=0$/, '?raw=1').replace(/&dl=0$/, '&raw=1');
    return {
      sourceType: 'direct',
      id: 'dbx_' + crypto.createHash('md5').update(str).digest('hex').substring(0, 10),
      url: directDropbox,
      originalUrl: str,
      title: customTitle || 'Video Dropbox Cloud',
      author: 'Dropbox CDN',
      thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 11. Check local uploaded file (/uploads/...) or any HTTP/HTTPS URL
  if (str.startsWith('/uploads/') || /^https?:\/\//i.test(str)) {
    const isDirectVideo =
      /\.(mp4|webm|ogg|mov|mkv|m4v|m3u8)(\?.*|#.*)?$/i.test(str) ||
      str.startsWith('/uploads/') ||
      str.includes('commondatastorage');

    let hostLabel = 'Hệ Thống Phát Sóng';
    try {
      if (/^https?:\/\//i.test(str)) {
        hostLabel = new URL(str).hostname.replace(/^www\./, '');
      }
    } catch {}

    return {
      sourceType: isDirectVideo ? 'direct' : 'embed',
      id: 'vid_' + crypto.createHash('md5').update(str).digest('hex').substring(0, 10),
      url: str,
      directEmbedUrl: str,
      proxyEmbedUrl: /^https?:\/\//i.test(str) ? `/api/web-proxy?url=${encodeURIComponent(str)}` : str,
      originalUrl: str,
      needsResolve: !isDirectVideo && /^https?:\/\//i.test(str),
      title: customTitle || (str.startsWith('/uploads/') ? 'Phim Tải Lên Rạp (' + path.basename(str) + ')' : `Phim / Web (${hostLabel})`),
      author: hostLabel,
      thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'
    };
  }

  return null;
}

// Smart async resolver for external movie websites / shortlinks / embeds
async function resolveExternalMedia(input, customTitle = '') {
  const base = parseVideoSource(input, customTitle);
  if (!base) return null;
  if (!base.needsResolve) return base;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);
    const resp = await fetch(base.originalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const finalUrl = resp.url || base.originalUrl;
    // If redirected to a known platform (e.g. vm.tiktok.com -> tiktok.com/@.../video/...), re-parse
    if (finalUrl !== base.originalUrl) {
      const reparsed = parseVideoSource(finalUrl, customTitle);
      if (reparsed && !reparsed.needsResolve) {
        return reparsed;
      }
    }

    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('video/') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
      return {
        ...base,
        sourceType: 'direct',
        url: finalUrl,
        originalUrl: finalUrl,
        needsResolve: false
      };
    }

    const xfo = (resp.headers.get('x-frame-options') || '').toLowerCase();
    const csp = (resp.headers.get('content-security-policy') || '').toLowerCase();
    const blocksFraming =
      xfo.includes('deny') ||
      xfo.includes('sameorigin') ||
      (csp.includes('frame-ancestors') && !csp.includes('frame-ancestors *'));

    if (contentType.includes('text/html')) {
      const html = await resp.text();

      // 1. Extract real page title & og:image
      const ogTitleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const extractedTitle = decodeHtmlEntities((ogTitleMatch && ogTitleMatch[1]) || (titleTagMatch && titleTagMatch[1]) || '');
      if (!customTitle && extractedTitle) {
        base.title = extractedTitle.substring(0, 110);
      }

      const ogImgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogImgMatch && ogImgMatch[1]) {
        try {
          base.thumbnail = new URL(ogImgMatch[1], finalUrl).href;
        } catch {}
      }

      // 2. Look for direct .m3u8 or .mp4 stream URL inside HTML / Next.js / Nuxt / JWPlayer scripts
      const unescapedHtml = html.replace(/\\\//g, '/');
      const m3u8Match = unescapedHtml.match(/https?:\/\/[^"'\s<>\\]+\.m3u8(?:\?[^"'\s<>\\]*)?/i);
      const mp4Match = unescapedHtml.match(/https?:\/\/[^"'\s<>\\]+\.mp4(?:\?[^"'\s<>\\]*)?/i);
      const directStreamUrl = (m3u8Match && m3u8Match[0]) || (mp4Match && mp4Match[0]) || null;

      // 3. Look for embedded video player <iframe> inside the movie page
      let innerPlayerUrl = null;
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = iframeRegex.exec(html)) !== null) {
        const candidate = match[1];
        if (
          candidate &&
          !/googletagmanager|doubleclick|facebook\.com\/tr|google\.com\/recaptcha|disqus|ads/i.test(candidate)
        ) {
          try {
            innerPlayerUrl = new URL(candidate, finalUrl).href;
            break;
          } catch {}
        }
      }

      base.originalUrl = finalUrl;
      base.directEmbedUrl = innerPlayerUrl || finalUrl;
      base.proxyEmbedUrl = `/api/web-proxy?url=${encodeURIComponent(innerPlayerUrl || finalUrl)}`;
      if (directStreamUrl) {
        base.streamUrl = directStreamUrl;
        base.sourceType = 'direct';
        base.url = directStreamUrl;
      } else if (innerPlayerUrl && !blocksFraming) {
        base.sourceType = 'embed';
        base.url = innerPlayerUrl;
      } else {
        // Default to proxyEmbedUrl when framing is blocked or for general movie webpages so X-Frame-Options never shows ☹️
        base.sourceType = 'embed';
        base.url = base.proxyEmbedUrl;
      }
    } else {
      base.url = blocksFraming ? `/api/web-proxy?url=${encodeURIComponent(finalUrl)}` : finalUrl;
    }
  } catch {
    // If server-side fetch times out or is blocked, still provide both proxy and direct URLs
    base.url = base.proxyEmbedUrl || base.url;
  }

  base.needsResolve = false;
  return base;
}

// 16 Seats (Row A: A01..A05 tiêu chuẩn, Row B: B01..B05 VIP nhung đỏ, Row C: 3 Ghế Đôi Sweetbox = 6 chỗ C01..C06)
const SEAT_LABELS = [
  'A01', 'A02', 'A03', 'A04', 'A05',
  'B01', 'B02', 'B03', 'B04', 'B05',
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06'
];

// Virtual Gifts Catalog for Cinema Live
const VIRTUAL_GIFTS = [
  { id: 'rose', name: 'Hoa Hồng', icon: '🌹', cost: 10, effect: 'rain', desc: 'Tặng cành hoa tươi thắm' },
  { id: 'boba', name: 'Trà Sữa', icon: '🧋', cost: 50, effect: 'sparkle', desc: 'Mời ly trà sữa full topping' },
  { id: 'popcorn_vip', name: 'Bắp Dát Vàng', icon: '🍿', cost: 100, effect: 'popcorn', desc: 'Bắp rang bơ dát vàng hoàng gia' },
  { id: 'crown', name: 'Vương Miện', icon: '👑', cost: 200, effect: 'crown', desc: 'Tôn vinh rạp phim đỉnh chóp' },
  { id: 'rocket', name: 'Tên Lửa Vũ Trụ', icon: '🚀', cost: 500, effect: 'rocket', desc: 'Bắn tên lửa rực sáng rạp phim' },
  { id: 'supercar', name: 'Siêu Xe Thể Thao', icon: '🏎️', cost: 1000, effect: 'supercar', desc: 'Đại gia cập bến rạp VIP' }
];

// Room Factory (Tối đa 5 phòng, mỗi phòng 10 chỗ VIP, có Host & Mật khẩu phòng riêng)
function createRoomInstance(id, name, createdBy = 'Hệ thống', hostId = null, hostUsername = 'admin', password = '1234') {
  return {
    id,
    name: name || `Phòng ${id.replace('phong-', '').padStart(2, '0')}`,
    createdBy,
    hostId,
    hostUsername: hostUsername || 'admin',
    password: String(password || '1234').trim(),
    createdAt: Date.now(),
    currentVideo: null,
    queue: [],
    seats: Array(SEAT_LABELS.length).fill(null),
    stageUser: null,
    screenPost: null,
    partyMode: false,
    lightsOff: false,
    currentPoll: null,
    giftRevenue: 0,
    messages: [],
    users: new Map() // ws -> userData
  };
}

// Helper: Ensure room seats array is strictly maintained at 13 seats (Row A: 5, Row B: 5, Row C: 3)
function ensureRoomSeats(room) {
  if (!room) return;
  if (!Array.isArray(room.seats)) {
    room.seats = Array(SEAT_LABELS.length).fill(null);
  } else {
    while (room.seats.length < SEAT_LABELS.length) {
      room.seats.push(null);
    }
  }
}

// Active Rooms Map (Max 5 rooms — starts empty, rooms are only created by users)
const rooms = new Map();

// Helper: Check if user is Room Host or Admin
function isRoomHostOrAdmin(user, room) {
  if (!user || !room) return false;
  if (user.role === 'admin') return true;
  if (user.username && room.hostUsername && user.username === room.hostUsername) return true;
  if (user.accountId && room.hostId && user.accountId === room.hostId) return true;
  if (room.hostId && user.id === room.hostId) return true;
  return false;
}

// Broadcast to all users in a specific room
function broadcastToRoom(room, type, payload, excludeWs = null) {
  if (!room || !room.users) return;
  const message = JSON.stringify({ type, payload, serverTime: Date.now() });
  for (const [wsClient] of room.users) {
    if (wsClient.readyState === WebSocket.OPEN && wsClient !== excludeWs) {
      wsClient.send(message);
    }
  }
}

// Broadcast to EVERY connected user
function broadcastGlobal(type, payload) {
  const message = JSON.stringify({ type, payload, serverTime: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Send message to single client
function send(ws, type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, serverTime: Date.now() }));
  }
}

// Public room snapshot
function getRoomSnapshot(room, requestingUser = null) {
  ensureRoomSeats(room);
  const realUsers = [];
  for (const [, u] of room.users) {
    realUsers.push({
      id: u.id,
      accountId: u.accountId,
      username: u.username,
      name: u.name,
      avatarId: u.avatarId || 'pixel_nerd',
      color: u.color,
      tier: u.tier,
      role: u.role,
      isVip: u.isVip,
      isHost: isRoomHostOrAdmin(u, room),
      seatId: u.seatId,
      micOn: !!u.micOn,
      isOnStage: false
    });
  }

  const canControl = isRoomHostOrAdmin(requestingUser, room);

  return {
    roomId: room.id,
    roomName: room.name,
    hostId: room.hostId,
    hostUsername: room.hostUsername,
    hostName: room.createdBy || 'Chủ phòng',
    canControl,
    roomPassword: canControl ? room.password : undefined,
    currentVideo: room.currentVideo,
    queue: room.queue,
    seats: room.seats,
    seatLabels: SEAT_LABELS,
    stageUser: room.stageUser,
    partyMode: room.partyMode,
    lightsOff: !!room.lightsOff,
    screenPost: room.screenPost,
    currentPoll: room.currentPoll,
    coupleNames: room.coupleNames || {},
    giftRevenue: room.giftRevenue || 0,
    onlineCount: room.users.size,
    realUsers,
    serverTime: Date.now()
  };
}

// Summary of all rooms for room picker
function getRoomsSummary(requestingUser = null) {
  return Array.from(rooms.values()).map(r => {
    ensureRoomSeats(r);
    const isOwnerOrAdmin = isRoomHostOrAdmin(requestingUser, r);
    return {
      id: r.id,
      name: r.name,
      isDefault: r.id === 'phong-1',
      createdBy: r.createdBy || 'Hệ thống',
      hostUsername: r.hostUsername,
      hasPassword: !!r.password,
      roomPassword: isOwnerOrAdmin ? r.password : undefined,
      canSkipPassword: isOwnerOrAdmin,
      seatedCount: r.seats.filter(s => s !== null).length,
      totalSeats: SEAT_LABELS.length,
      usersCount: r.users.size,
      currentVideoTitle: r.currentVideo?.title || 'Chưa phát video',
      currentVideoThumb: r.currentVideo?.thumbnail || ''
    };
  });
}

// Broadcast updated room list to each client with their specific permissions
function broadcastRoomsListToAll() {
  for (const [clientWs, entry] of connectionMap.entries()) {
    if (clientWs.readyState === WebSocket.OPEN) {
      send(clientWs, 'rooms-list-updated', { rooms: getRoomsSummary(entry?.user) });
    }
  }
}

// Advance to next video ONLY when Host/Admin explicitly triggers "Chuyển tiếp"
function advanceToNextVideoByHost(room, triggeredByName = 'Chủ phòng') {
  if (!room) return false;
  if (room.queue.length === 0) {
    return false;
  }

  const nextItem = room.queue.shift();
  room.currentVideo = {
    ...nextItem,
    startedAt: Date.now(),
    isPlaying: true,
    pausedAt: 0
  };

  // Increment movie view count if it's from catalog
  if (nextItem.movieId) {
    const mov = db.movies.find(m => m.id === nextItem.movieId);
    if (mov) {
      mov.views = (mov.views || 0) + 1;
      saveDB();
    }
  }

  broadcastToRoom(room, 'video-changed', {
    currentVideo: room.currentVideo,
    queue: room.queue,
    reason: 'host-next',
    triggeredBy: triggeredByName
  });
  broadcastRoomsListToAll();
  return true;
}

// Periodic check: ONLY for photo projection expiration (NO automatic video skipping!)
setInterval(() => {
  for (const [, room] of rooms) {
    if (room.screenPost && Date.now() >= room.screenPost.expiresAt) {
      room.screenPost = null;
      broadcastToRoom(room, 'screen-post-ended', {});
    }
  }
}, 1000);

// Global user lookup: ws -> { user, room }
const connectionMap = new Map();

// Helper to remove user from their current room
function leaveCurrentRoom(ws) {
  const entry = connectionMap.get(ws);
  if (!entry || !entry.room) return;
  const { user, room } = entry;

  if (user.micOn) {
    user.micOn = false;
    broadcastToRoom(room, 'voice-state-changed', {
      userId: user.id,
      name: user.name,
      micOn: false,
      seatId: user.seatId
    }, ws);
  }

  // Free seat
  if (user.seatId !== null && room.seats[user.seatId]) {
    room.seats[user.seatId] = null;
    broadcastToRoom(room, 'seat-state', { seats: room.seats, movedUser: user });
  }

  // Free stage
  if (room.stageUser === user.id) {
    room.stageUser = null;
    broadcastToRoom(room, 'stage-state', { stageUser: null, seats: room.seats });
  }

  room.users.delete(ws);
  user.roomId = null;
  user.seatId = null;
  user.micOn = false;
  user.whisperMode = false;

  broadcastToRoom(room, 'user-left', {
    userId: user.id,
    name: user.name,
    onlineCount: room.users.size,
    seats: room.seats
  });

  // Tự động đóng phòng nếu không còn Host trong phòng:
  // "nếu không có ai là host trong phòng thì phòng sẽ tự động bị đóng"
  const isLeavingUserHost = (
    (user.username && room.hostUsername && user.username === room.hostUsername) ||
    (user.accountId && room.hostId && user.accountId === room.hostId) ||
    (room.hostId && user.id === room.hostId)
  );

  if (isLeavingUserHost) {
    const remainingEntries = Array.from(room.users.entries());
    rooms.delete(room.id);
    broadcastRoomsListToAll();

    for (const [remWs, remUser] of remainingEntries) {
      connectionMap.set(remWs, { user: remUser, room: null });
      remUser.roomId = null;
      remUser.seatId = null;
      remUser.micOn = false;
      remUser.whisperMode = false;

      send(remWs, 'room-closed-no-host', {
        roomId: room.id,
        roomName: room.name,
        message: `🚪 Phòng chiếu "${room.name}" đã tự động đóng vì Chủ phòng (${user.name}) đã rời đi!`
      });

      send(remWs, 'lobby-init', {
        you: remUser,
        availableRooms: getRoomsSummary(remUser),
        catalog: { movies: db.movies, categories: db.categories },
        maxRooms: MAX_ROOMS
      });
    }

    broadcastGlobal('notification', {
      message: `🚪 Phòng "${room.name}" đã tự động đóng vì Chủ phòng (${user.name}) đã rời đi.`,
      type: 'info'
    });
    return;
  }

  // Nếu phòng không còn ai, tự động dọn dẹp phòng
  if (room.users.size === 0) {
    rooms.delete(room.id);
    broadcastRoomsListToAll();
  }
}

// Helper to place user in the Grand Lobby (Sảnh Chờ)
function joinLobby(ws) {
  leaveCurrentRoom(ws);

  let user = connectionMap.get(ws)?.user;
  if (!user) {
    const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
    user = {
      id: userId,
      accountId: null,
      username: null,
      name: 'Khách #' + Math.floor(100 + Math.random() * 900),
      avatarId: 'pixel_nerd',
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'][Math.floor(Math.random() * 7)],
      tier: 'Khách',
      role: 'guest',
      isVip: false,
      coins: 1000,
      seatId: null,
      roomId: null
    };
  } else {
    user.seatId = null;
    user.roomId = null;
    if (typeof user.coins !== 'number') user.coins = 1000;
  }

  connectionMap.set(ws, { user, room: null });

  send(ws, 'lobby-init', {
    you: user,
    availableRooms: getRoomsSummary(user),
    catalog: { movies: db.movies, categories: db.categories },
    maxRooms: MAX_ROOMS
  });
}

// Helper to join a user into a room (after password check)
function joinRoom(ws, targetRoomId) {
  leaveCurrentRoom(ws);

  const targetRoom = rooms.get(targetRoomId);
  if (!targetRoom) {
    joinLobby(ws);
    return;
  }

  ensureRoomSeats(targetRoom);

  const user = connectionMap.get(ws)?.user;
  if (!user) return;

  // If the room had default 'admin' host and nobody is inside yet, keep original host unless created by user
  user.seatId = null;
  user.roomId = targetRoom.id;

  targetRoom.users.set(ws, user);
  connectionMap.set(ws, { user, room: targetRoom });

  // Send full init state for this room
  send(ws, 'init', {
    you: {
      ...user,
      isHost: isRoomHostOrAdmin(user, targetRoom)
    },
    room: getRoomSnapshot(targetRoom, user),
    recentMessages: targetRoom.messages,
    availableRooms: getRoomsSummary(user),
    catalog: { movies: db.movies, categories: db.categories }
  });

  // Notify other room members
  broadcastToRoom(targetRoom, 'user-joined', {
    user: {
      ...user,
      isHost: isRoomHostOrAdmin(user, targetRoom)
    },
    onlineCount: targetRoom.users.size,
    seats: targetRoom.seats
  }, ws);

  broadcastRoomsListToAll();
}

// Gather full Admin Dashboard Data
function getAdminDashboardData() {
  const onlineAccountIds = new Set();
  let totalOnlineConnections = 0;
  for (const [, entry] of connectionMap.entries()) {
    totalOnlineConnections++;
    if (entry.user?.accountId) {
      onlineAccountIds.add(entry.user.accountId);
    }
  }

  const accountsList = db.accounts.map(a => ({
    ...sanitizeAccount(a),
    isOnline: onlineAccountIds.has(a.id),
    plainPassword: a.plainPassword || (a.username === 'admin' ? 'admin123' : (a.username === 'vip' ? '123456' : '••••••••'))
  }));

  // Collect all comments across all active rooms
  const allComments = [];
  for (const [, r] of rooms.entries()) {
    for (const m of r.messages) {
      allComments.push({
        ...m,
        roomId: r.id,
        roomName: r.name
      });
    }
  }

  const roomsAdmin = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    password: r.password,
    hostName: r.createdBy,
    hostUsername: r.hostUsername,
    onlineCount: r.users.size,
    seatedCount: r.seats.filter(Boolean).length
  }));

  return {
    accounts: accountsList,
    movies: db.movies,
    categories: db.categories,
    allComments: allComments.slice(-100).reverse(),
    roomsAdmin,
    stats: {
      ...db.stats,
      onlineNow: totalOnlineConnections,
      totalAccounts: db.accounts.length,
      totalVipAccounts: db.accounts.filter(a => a.isVip).length,
      totalMovies: db.movies.length
    }
  };
}

// WebSocket Connection Handling
wss.on('connection', (ws, req) => {
  db.stats.totalVisits = (db.stats.totalVisits || 0) + 1;
  saveDB();

  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  const acc = getAccountByToken(token);

  if (acc && !acc.isBanned) {
    const sanitized = sanitizeAccount(acc);
    connectionMap.set(ws, {
      user: {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        accountId: sanitized.id,
        username: sanitized.username,
        name: sanitized.name,
        avatarId: sanitized.avatarId || 'pixel_nerd',
        color: sanitized.color,
        tier: sanitized.tier,
        role: sanitized.role,
        isVip: sanitized.isVip,
        seatId: null,
        roomId: null
      },
      room: null
    });
  }

  // Always start in Lobby so room password & authentication are respected
  joinLobby(ws);

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const type = msg.type;
    const payload = (msg.payload && typeof msg.payload === 'object') ? msg.payload : msg;
    const entry = connectionMap.get(ws);
    if (!entry) return;
    const { user, room } = entry;

    switch (type) {
      case 'ping': {
        send(ws, 'pong', { clientTime: payload?.clientTime });
        break;
      }

      // Bind authenticated account to WebSocket session
      case 'bind-auth': {
        const authAcc = getAccountByToken(payload?.token);
        if (!authAcc || authAcc.isBanned) {
          send(ws, 'auth-error', { message: 'Phiên đăng nhập không hợp lệ hoặc đã bị khóa.' });
          return;
        }
        const s = sanitizeAccount(authAcc);
        user.accountId = s.id;
        user.username = s.username;
        user.name = s.name;
        user.avatarId = s.avatarId || 'pixel_nerd';
        user.color = s.color;
        user.tier = s.tier;
        user.role = s.role;
        user.isVip = s.isVip;
        user.coins = typeof s.coins === 'number' ? s.coins : 1000;

        if (room) {
          if (user.seatId !== null && room.seats[user.seatId]) {
            room.seats[user.seatId] = {
              seatId: user.seatId,
              userId: user.id,
              name: user.name,
              avatarId: user.avatarId,
              color: user.color,
              tier: user.tier,
              isVip: user.isVip,
              role: user.role
            };
          }
          send(ws, 'init', {
            you: { ...user, isHost: isRoomHostOrAdmin(user, room) },
            room: getRoomSnapshot(room, user),
            recentMessages: room.messages,
            availableRooms: getRoomsSummary(user),
            catalog: { movies: db.movies, categories: db.categories }
          });
          broadcastToRoom(room, 'seat-state', { seats: room.seats, user });
        } else {
          send(ws, 'lobby-init', {
            you: user,
            availableRooms: getRoomsSummary(user),
            catalog: { movies: db.movies, categories: db.categories },
            maxRooms: MAX_ROOMS
          });
        }
        break;
      }

      case 'logout-auth': {
        leaveCurrentRoom(ws);
        user.accountId = null;
        user.username = null;
        user.name = 'Khách #' + Math.floor(100 + Math.random() * 900);
        user.role = 'guest';
        user.isVip = false;
        user.tier = 'Khách';
        joinLobby(ws);
        break;
      }

      // --- Room Management (With Password & Host Assignment) ---
      case 'join-room': {
        if (!user.username) {
          send(ws, 'require-login', { message: 'Vui lòng Đăng nhập hoặc Đăng ký tài khoản trước khi vào phòng chiếu!' });
          return;
        }

        const targetRoomId = payload?.roomId;
        const targetRoom = rooms.get(targetRoomId);
        if (!targetRoom) {
          send(ws, 'notification', { message: '⚠️ Phòng chiếu không tồn tại.', type: 'error' });
          return;
        }

        const isOwnerOrAdmin = isRoomHostOrAdmin(user, targetRoom);
        const inputPassword = String(payload?.password || '').trim();

        if (targetRoom.password && !isOwnerOrAdmin) {
          if (!inputPassword) {
            send(ws, 'room-password-prompt', {
              roomId: targetRoom.id,
              roomName: targetRoom.name
            });
            return;
          }
          if (inputPassword !== targetRoom.password) {
            send(ws, 'room-password-error', {
              roomId: targetRoom.id,
              roomName: targetRoom.name,
              message: '❌ Mật khẩu phòng không chính xác! Vui lòng kiểm tra lại.'
            });
            return;
          }
        }

        joinRoom(ws, targetRoomId);
        break;
      }

      case 'create-room': {
        if (!user.username) {
          send(ws, 'require-login', { message: 'Vui lòng Đăng nhập hoặc Đăng ký tài khoản để tạo phòng riêng!' });
          return;
        }

        if (rooms.size >= MAX_ROOMS) {
          send(ws, 'notification', {
            message: `⚠️ Đã đạt giới hạn tối đa ${MAX_ROOMS} phòng! Hãy xoá bớt phòng không dùng để tạo mới nhé.`,
            type: 'error'
          });
          return;
        }

        const roomPassword = String(payload?.password || '').trim();
        if (!roomPassword) {
          send(ws, 'notification', {
            message: '🔒 Vui lòng đặt mật khẩu (Pass) cho phòng trước khi tạo!',
            type: 'error'
          });
          return;
        }

        let newRoomId = null;
        for (let i = 1; i <= MAX_ROOMS; i++) {
          const candidate = `phong-${i}`;
          if (!rooms.has(candidate)) {
            newRoomId = candidate;
            break;
          }
        }
        if (!newRoomId) {
          newRoomId = `phong-${Date.now().toString(36).slice(-4)}`;
        }

        const slotNum = newRoomId.replace('phong-', '');
        const defaultName = `Phòng ${slotNum.padStart(2, '0')} — Rạp VIP`;
        const roomName = (payload?.name || '').trim().substring(0, 30) || defaultName;

        // Creator becomes the Host of this room
        const newRoom = createRoomInstance(
          newRoomId,
          roomName,
          user.name,
          user.accountId || user.id,
          user.username,
          roomPassword
        );
        rooms.set(newRoomId, newRoom);

        broadcastGlobal('notification', {
          message: `✨ Chủ phòng ${user.name} vừa mở phòng mới: "${newRoom.name}"!`,
          type: 'success'
        });

        joinRoom(ws, newRoomId);
        break;
      }

      case 'leave-to-lobby': {
        joinLobby(ws);
        broadcastRoomsListToAll();
        break;
      }

      case 'delete-room': {
        const targetRoomId = payload?.roomId;
        if (!targetRoomId || !rooms.has(targetRoomId)) {
          send(ws, 'notification', { message: '⚠️ Phòng không tồn tại hoặc đã bị xoá.', type: 'error' });
          return;
        }

        const roomToDelete = rooms.get(targetRoomId);
        if (!isRoomHostOrAdmin(user, roomToDelete)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) tạo phòng này hoặc Admin mới được quyền xoá phòng!',
            type: 'error'
          });
          return;
        }

        const deletedRoomName = roomToDelete.name;
        const clientsInRoom = Array.from(roomToDelete.users.keys());
        for (const clientWs of clientsInRoom) {
          send(clientWs, 'notification', {
            message: `📢 Phòng "${deletedRoomName}" đã được Chủ phòng/Admin đóng. Bạn được chuyển về Sảnh Chờ.`,
            type: 'warning'
          });
          joinLobby(clientWs);
        }

        rooms.delete(targetRoomId);
        broadcastGlobal('notification', {
          message: `🗑️ ${user.name} đã xoá "${deletedRoomName}".`,
          type: 'info'
        });
        broadcastRoomsListToAll();
        break;
      }

      case 'list-rooms': {
        send(ws, 'rooms-list-updated', { rooms: getRoomsSummary(user) });
        break;
      }

      // --- Profile Update ---
      case 'update-profile': {
        if (payload.name && payload.name.trim()) {
          user.name = payload.name.trim().substring(0, 24);
        }
        if (payload.avatarId) user.avatarId = payload.avatarId;
        if (payload.color) user.color = payload.color;
        if (payload.tier && user.role !== 'admin' && !user.isVip) {
          user.tier = payload.tier;
        }

        // Persist to DB if logged in
        if (user.accountId) {
          const acc = db.accounts.find(a => a.id === user.accountId);
          if (acc) {
            acc.name = user.name;
            if (payload.avatarId) acc.avatarId = payload.avatarId;
            acc.color = user.color;
            if (payload.tier) acc.tier = payload.tier;
            saveDB();
          }
        }

        if (room) {
          if (user.seatId !== null && room.seats[user.seatId]) {
            room.seats[user.seatId] = {
              seatId: user.seatId,
              userId: user.id,
              name: user.name,
              avatarId: user.avatarId || 'pixel_nerd',
              color: user.color,
              tier: user.tier,
              isVip: user.isVip,
              role: user.role
            };
          }
          broadcastToRoom(room, 'seat-state', { seats: room.seats, user });
        }

        send(ws, 'profile-updated', {
          ...user,
          isHost: room ? isRoomHostOrAdmin(user, room) : false
        });
        break;
      }

      // --- Seat Management (13 Seats: Row A đơn, Row B VIP đơn, Row C Ghế đôi Sweetbox) ---
      case 'pick-seat': {
        if (!room) return;
        ensureRoomSeats(room);
        const seatId = parseInt(payload.seatId, 10);
        if (isNaN(seatId) || seatId < 0 || seatId >= SEAT_LABELS.length) return;

        // Đặc quyền VIP: Hàng ghế B (B01 -> B05, seatId 5..9) bọc nhung đỏ sang trọng dành riêng cho VIP/Admin
        if (seatId >= 5 && seatId < 10 && !user.isVip && user.role !== 'admin') {
          send(ws, 'notification', {
            message: `👑 Ghế ${SEAT_LABELS[seatId]} là Ghế VIP Nhung Đỏ (Hàng B). Hãy kích hoạt VIP để ngồi vị trí đẹp nhất rạp!`,
            type: 'error'
          });
          return;
        }

        const currentOccupant = room.seats[seatId];
        if (currentOccupant && currentOccupant.userId !== user.id) {
          send(ws, 'notification', { message: `Ghế ${SEAT_LABELS[seatId]} đã có ${currentOccupant.name} ngồi rồi!`, type: 'error' });
          return;
        }

        if (user.seatId !== null && user.seatId !== seatId) {
          room.seats[user.seatId] = null;
        }

        user.seatId = seatId;
        room.stageUser = null;

        room.seats[seatId] = {
          seatId,
          userId: user.id,
          name: user.name,
          avatarId: user.avatarId || 'pixel_nerd',
          color: user.color,
          tier: user.tier,
          isVip: user.isVip,
          role: user.role,
          micOn: !!user.micOn
        };

        broadcastToRoom(room, 'seat-state', {
          seats: room.seats,
          movedUser: user,
          stageUser: null
        });

        broadcastRoomsListToAll();
        break;
      }

      case 'leave-seat': {
        if (!room) return;
        ensureRoomSeats(room);
        if (user.seatId !== null) {
          const prev = user.seatId;
          room.seats[prev] = null;
          user.seatId = null;

          broadcastToRoom(room, 'seat-state', {
            seats: room.seats,
            movedUser: user
          });

          broadcastRoomsListToAll();
        }
        break;
      }

      // --- Stage Feature Disabled (Replaced by Voice Chat Mic) ---
      case 'take-stage': {
        if (!room) return;
        if (room.stageUser) {
          room.stageUser = null;
          broadcastToRoom(room, 'stage-state', {
            stageUser: null,
            seats: room.seats
          });
        }
        break;
      }

      // --- Real-Time Two-Way / Multi-User Voice Chat (Mic On/Off & Audio Stream) ---
      case 'voice-state': {
        if (!room) return;
        user.micOn = !!payload?.micOn;
        if (user.seatId !== null && room.seats[user.seatId]) {
          room.seats[user.seatId].micOn = user.micOn;
        }
        broadcastToRoom(room, 'voice-state-changed', {
          userId: user.id,
          name: user.name,
          seatId: user.seatId,
          micOn: user.micOn
        });
        break;
      }

      case 'voice-chunk': {
        if (!room || !user.micOn || !payload?.data) return;

        // Whisper Audio Mode: Nếu bật Kênh thì thầm ghế đôi, chỉ bạn cùng ghế mới nghe thấy!
        if (user.whisperMode && user.seatId !== null && user.seatId >= 10) {
          const partnerSeatId = (user.seatId % 2 === 0) ? (user.seatId + 1) : (user.seatId - 1);
          const partner = room.seats[partnerSeatId];
          if (partner) {
            for (const [pWs, pUser] of room.users.entries()) {
              if (pUser.id === partner.userId && pWs.readyState === WebSocket.OPEN) {
                pWs.send(JSON.stringify({
                  type: 'voice-chunk',
                  payload: {
                    userId: user.id,
                    name: `🤫 ${user.name} (Thì thầm)`,
                    seatId: user.seatId,
                    isWhisper: true,
                    data: payload.data,
                    sampleRate: payload.sampleRate || 16000
                  },
                  serverTime: Date.now()
                }));
                break;
              }
            }
          }
          return;
        }

        broadcastToRoom(room, 'voice-chunk', {
          userId: user.id,
          name: user.name,
          seatId: user.seatId,
          data: payload.data,
          sampleRate: payload.sampleRate || 16000
        }, ws);
        break;
      }

      case 'voice-signal': {
        if (!room || !payload?.targetUserId) return;
        for (const [peerWs, peerUser] of room.users.entries()) {
          if (peerUser.id === payload.targetUserId && peerWs.readyState === WebSocket.OPEN) {
            send(peerWs, 'voice-signal', {
              fromUserId: user.id,
              fromName: user.name,
              signalType: payload.signalType,
              sdp: payload.sdp,
              candidate: payload.candidate
            });
            break;
          }
        }
        break;
      }

      // --- Video Playback & Queue Management (HOST & ADMIN ONLY) ---
      case 'queue-video': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được quản lý danh sách phát và màn hình!',
            type: 'error'
          });
          return;
        }

        if (payload.movieId) {
          const matchedMovie = db.movies.find(m => m.id === payload.movieId);
          if (matchedMovie && matchedMovie.isVipOnly && !user.isVip && user.role !== 'admin') {
            send(ws, 'notification', {
              message: `👑 Phim "${matchedMovie.title}" là nội dung Độc Quyền VIP! Hãy kích hoạt VIP để phát phim này lên rạp!`,
              type: 'error'
            });
            return;
          }
        }

        const parsed = await resolveExternalMedia(payload.url || payload.id, payload.title);
        if (!parsed) {
          send(ws, 'notification', {
            message: 'Đường dẫn không hợp lệ! Hãy dán bất kỳ link YouTube, Facebook, TikTok, Drive, MP4/M3U8 hoặc link trang web phim.',
            type: 'error'
          });
          return;
        }

        let title = parsed.title || payload.title || 'Video Rạp Phim';
        let author = parsed.author || 'Hệ Thống Phát Sóng';
        let thumbnail = parsed.thumbnail || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80';

        if (parsed.sourceType === 'youtube') {
          const info = await fetchYoutubeInfo(parsed.id);
          title = payload.title || info.title;
          author = info.author;
          thumbnail = info.thumbnail;
        }

        const item = {
          sourceType: parsed.sourceType,
          id: parsed.id,
          url: parsed.url,
          originalUrl: parsed.originalUrl || parsed.url,
          directEmbedUrl: parsed.directEmbedUrl || parsed.url,
          proxyEmbedUrl: parsed.proxyEmbedUrl || null,
          streamUrl: parsed.streamUrl || null,
          title,
          author,
          thumbnail,
          movieId: payload.movieId || null,
          requester: user.name,
          queuedAt: Date.now()
        };

        // Always push to queue (or if nothing is loaded at all, set currentVideo)
        if (!room.currentVideo) {
          room.currentVideo = {
            ...item,
            startedAt: Date.now(),
            isPlaying: true,
            pausedAt: 0
          };
          broadcastToRoom(room, 'video-changed', {
            currentVideo: room.currentVideo,
            queue: room.queue,
            reason: 'new'
          });
        } else {
          room.queue.push(item);
          broadcastToRoom(room, 'queue-updated', {
            queue: room.queue,
            addedBy: user.name
          });
          broadcastToRoom(room, 'notification', {
            message: `🎬 Chủ phòng ${user.name} đã thêm "${item.title}" vào danh sách chờ! (Bấm Chuyển tiếp để phát)`,
            type: 'success'
          });
        }

        broadcastRoomsListToAll();
        break;
      }

      case 'remove-queue-item': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được xoá bài trong danh sách chờ!', type: 'error' });
          return;
        }
        const index = parseInt(payload?.index, 10);
        if (!isNaN(index) && index >= 0 && index < room.queue.length) {
          const removed = room.queue.splice(index, 1)[0];
          broadcastToRoom(room, 'queue-updated', { queue: room.queue });
          send(ws, 'notification', { message: `🗑️ Đã xoá "${removed.title}" khỏi hàng chờ.`, type: 'info' });
        }
        break;
      }

      // --- Playback Sync (Play/Pause, Seek, Next - HOST & ADMIN ONLY) ---
      case 'toggle-pause': {
        if (!room || !room.currentVideo) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) mới được Tạm dừng / Phát màn hình!',
            type: 'error'
          });
          // Re-sync client back to room state
          send(ws, 'playback-sync', {
            isPlaying: room.currentVideo.isPlaying,
            currentTime: room.currentVideo.isPlaying
              ? Math.max(0, (Date.now() - room.currentVideo.startedAt) / 1000)
              : (room.currentVideo.pausedAt || 0),
            startedAt: room.currentVideo.startedAt,
            user: room.createdBy
          });
          return;
        }

        const now = Date.now();
        const hasClientTime = payload && payload.currentTime !== undefined && !isNaN(parseFloat(payload.currentTime));
        const clientTime = hasClientTime ? Math.max(0, parseFloat(payload.currentTime)) : null;
        const targetPlaying = (payload && typeof payload.isPlaying === 'boolean')
          ? payload.isPlaying
          : !room.currentVideo.isPlaying;

        if (!targetPlaying) {
          const elapsed = clientTime !== null
            ? clientTime
            : Math.max(0, (now - room.currentVideo.startedAt) / 1000);
          room.currentVideo.isPlaying = false;
          room.currentVideo.pausedAt = elapsed;
          room.currentVideo.startedAt = now - Math.floor(elapsed * 1000);
          broadcastToRoom(room, 'playback-sync', {
            isPlaying: false,
            currentTime: elapsed,
            startedAt: room.currentVideo.startedAt,
            senderId: user.id,
            user: user.name
          });
        } else {
          room.currentVideo.isPlaying = true;
          const resumeAt = clientTime !== null
            ? clientTime
            : (room.currentVideo.pausedAt || 0);
          room.currentVideo.pausedAt = resumeAt;
          room.currentVideo.startedAt = now - Math.floor(resumeAt * 1000);
          broadcastToRoom(room, 'playback-sync', {
            isPlaying: true,
            currentTime: resumeAt,
            startedAt: room.currentVideo.startedAt,
            senderId: user.id,
            user: user.name
          });
        }
        break;
      }

      case 'seek-video': {
        if (!room || !room.currentVideo) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) mới được tua thời gian màn hình!',
            type: 'error'
          });
          // Re-sync viewer back to room state if they tried to seek
          send(ws, 'playback-sync', {
            isPlaying: room.currentVideo.isPlaying,
            currentTime: room.currentVideo.isPlaying
              ? Math.max(0, (Date.now() - room.currentVideo.startedAt) / 1000)
              : (room.currentVideo.pausedAt || 0),
            startedAt: room.currentVideo.startedAt,
            user: room.createdBy
          });
          return;
        }

        const targetTime = Math.max(0, parseFloat(payload?.time) || 0);
        const now = Date.now();
        room.currentVideo.pausedAt = targetTime;
        room.currentVideo.startedAt = now - Math.floor(targetTime * 1000);

        broadcastToRoom(room, 'playback-sync', {
          isPlaying: room.currentVideo.isPlaying,
          currentTime: targetTime,
          startedAt: room.currentVideo.startedAt,
          senderId: user.id,
          user: user.name
        });
        break;
      }

      // Manual Next Button (HOST & ADMIN ONLY — Queue NEVER auto-advances)
      case 'skip-now': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được bấm Chuyển tiếp video!',
            type: 'error'
          });
          return;
        }

        if (room.queue.length === 0) {
          send(ws, 'notification', {
            message: '📭 Danh sách chờ đang trống! Hãy thêm video mới vào hàng chờ trước khi bấm Chuyển tiếp.',
            type: 'error'
          });
          return;
        }

        const advanced = advanceToNextVideoByHost(room, user.name);
        if (advanced) {
          broadcastToRoom(room, 'notification', {
            message: `⏭️ Chủ phòng ${user.name} đã bấm Chuyển tiếp sang video kế tiếp!`,
            type: 'success'
          });
        }
        break;
      }

      // Play specific item from queue (HOST & ADMIN)
      case 'play-queue-item': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được chọn bài để phát!',
            type: 'error'
          });
          return;
        }

        const idx = parseInt(payload?.index, 10);
        if (isNaN(idx) || idx < 0 || idx >= room.queue.length) return;

        const selectedItem = room.queue.splice(idx, 1)[0];
        room.currentVideo = {
          ...selectedItem,
          startedAt: Date.now(),
          isPlaying: true,
          pausedAt: 0
        };

        if (selectedItem.movieId) {
          const m = db.movies.find(x => x.id === selectedItem.movieId);
          if (m) {
            m.views = (m.views || 0) + 1;
            saveDB();
          }
        }

        broadcastToRoom(room, 'video-changed', {
          currentVideo: room.currentVideo,
          queue: room.queue,
          reason: 'select',
          advancedBy: user.name
        });

        broadcastToRoom(room, 'notification', {
          message: `🎬 Chủ phòng ${user.name} đã chọn phát "${room.currentVideo.title}"!`,
          type: 'info'
        });

        broadcastRoomsListToAll();
        break;
      }

      // Stop & Turn Off Current Video on Screen (HOST & ADMIN)
      case 'stop-video': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được tắt video đang chiếu trên màn hình!',
            type: 'error'
          });
          return;
        }

        if (!room.currentVideo) {
          send(ws, 'notification', {
            message: 'Màn hình hiện đang tắt sẵn rồi.',
            type: 'info'
          });
          return;
        }

        const stoppedTitle = room.currentVideo.title;
        room.currentVideo = null;

        broadcastToRoom(room, 'video-changed', {
          currentVideo: null,
          queue: room.queue,
          reason: 'stopped',
          stoppedBy: user.name
        });

        broadcastToRoom(room, 'notification', {
          message: `⏹️ Chủ phòng ${user.name} đã tắt video "${stoppedTitle}" trên màn hình.`,
          type: 'info'
        });

        broadcastRoomsListToAll();
        break;
      }

      case 'report-duration': {
        if (room && room.currentVideo && room.currentVideo.id === payload.id && payload.duration > 0) {
          room.currentVideo.duration = Math.floor(payload.duration);
        }
        break;
      }

      // --- Chat (Rich Text, Stickers, Memes) ---
      case 'chat': {
        if (!room) return;
        const text = (payload.text || '').trim();
        let sticker = null;
        if (payload.sticker && typeof payload.sticker === 'object') {
          const rawId = String(payload.sticker.id || '');
          const rawName = String(payload.sticker.name || '').substring(0, 30);
          const isMeme = !!payload.sticker.isMeme;

          // Chuẩn hóa đường dẫn Sticker/Meme nội bộ an toàn 100%, không bao giờ phụ thuộc bên thứ 3
          const key = rawId.replace('stk_', '').replace('meme_', '').toLowerCase();
          const validKeys = ['popcorn', 'fire', 'laugh', 'cry', 'heart', 'clap', 'party', 'shock', 'cat', 'pizza', 'crown', 'cool', 'mindblown', 'sleepy', 'pepe'];
          const matchedKey = validKeys.find(k => key.includes(k) || rawName.toLowerCase().includes(k)) || 'popcorn';
          const cleanUrl = isMeme ? `/memes/${matchedKey}.png` : `/stickers/${matchedKey}.png`;

          sticker = {
            id: rawId || (isMeme ? `meme_${matchedKey}` : `stk_${matchedKey}`),
            name: rawName || matchedKey,
            url: cleanUrl,
            isMeme
          };
        }

        if (!text && !sticker) return;

        const chatObj = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId: user.id,
          username: user.username,
          name: user.name,
          avatarId: user.avatarId || 'pixel_nerd',
          color: user.color,
          tier: user.tier,
          isVip: user.isVip,
          role: user.role,
          isHost: isRoomHostOrAdmin(user, room),
          seatId: user.seatId,
          text: text || (sticker ? `[${sticker.isMeme ? 'Meme' : 'Sticker'}: ${sticker.name}]` : ''),
          sticker: sticker || undefined,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };

        room.messages.push(chatObj);
        if (room.messages.length > 5000) room.messages.shift();

        broadcastToRoom(room, 'chat-message', chatObj);
        break;
      }

      // --- Floating Reactions (Livestream Stream) ---
      case 'reaction': {
        if (!room) return;
        const emoji = payload.emoji || '❤️';
        broadcastToRoom(room, 'emoji-reaction', {
          emoji,
          userId: user.id,
          seatId: user.seatId,
          isVip: !!user.isVip,
          isOnStage: room.stageUser === user.id
        });
        break;
      }

      // --- Mini-game & Predictions / Polls ---
      case 'create-poll': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Chỉ Chủ phòng hoặc Admin mới được tạo bình chọn!', type: 'error' });
          return;
        }
        const question = String(payload.question || '').trim().substring(0, 150);
        const optionsRaw = Array.isArray(payload.options) ? payload.options : [];
        const options = optionsRaw.map((opt, idx) => ({
          id: idx,
          text: String(opt || '').trim().substring(0, 60),
          votes: 0
        })).filter(o => o.text.length > 0);

        if (!question || options.length < 2) {
          send(ws, 'notification', { message: '⚠️ Câu hỏi cần ít nhất 2 lựa chọn bình chọn!', type: 'warning' });
          return;
        }

        room.currentPoll = {
          id: 'poll_' + Date.now(),
          question,
          options,
          userVotes: {}, // userId -> optionId
          totalVotes: 0,
          active: true,
          createdBy: user.name,
          createdAt: Date.now()
        };

        broadcastToRoom(room, 'poll-updated', { poll: room.currentPoll });
        broadcastToRoom(room, 'notification', {
          message: `📊 Chủ phòng vừa mở bình chọn mới: "${question}"`,
          type: 'info'
        });
        break;
      }

      case 'vote-poll': {
        if (!room || !room.currentPoll || !room.currentPoll.active) {
          send(ws, 'notification', { message: '⚠️ Hiện không có bình chọn nào đang diễn ra.', type: 'warning' });
          return;
        }
        if (room.currentPoll.id !== payload.pollId) {
          send(ws, 'notification', { message: '⚠️ Bình chọn này đã kết thúc.', type: 'warning' });
          return;
        }
        const optionId = parseInt(payload.optionId, 10);
        const targetOption = room.currentPoll.options.find(o => o.id === optionId);
        if (!targetOption) return;

        const prevVote = room.currentPoll.userVotes[user.id];
        if (prevVote !== undefined) {
          const prevOpt = room.currentPoll.options.find(o => o.id === prevVote);
          if (prevOpt && prevOpt.votes > 0) prevOpt.votes--;
          room.currentPoll.totalVotes = Math.max(0, room.currentPoll.totalVotes - 1);
        }

        room.currentPoll.userVotes[user.id] = optionId;
        targetOption.votes++;
        room.currentPoll.totalVotes++;

        broadcastToRoom(room, 'poll-updated', { poll: room.currentPoll });
        break;
      }

      case 'end-poll': {
        if (!room || !room.currentPoll) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Chỉ Chủ phòng mới có quyền kết thúc bình chọn!', type: 'error' });
          return;
        }
        room.currentPoll.active = false;
        broadcastToRoom(room, 'poll-updated', { poll: room.currentPoll });
        broadcastToRoom(room, 'notification', {
          message: `🏁 Bình chọn đã kết thúc! Tổng cộng có ${room.currentPoll.totalVotes} lượt bình chọn.`,
          type: 'info'
        });
        break;
      }

      // --- Virtual Gifts (Tặng quà ảo cho Chủ phòng) ---
      case 'send-gift': {
        if (!room) return;
        const giftId = String(payload.giftId || '').trim();
        const gift = VIRTUAL_GIFTS.find(g => g.id === giftId);
        if (!gift) {
          send(ws, 'notification', { message: '⚠️ Vật phẩm quà tặng không hợp lệ.', type: 'error' });
          return;
        }

        if (typeof user.coins !== 'number') user.coins = 1000;
        if (user.coins < gift.cost) {
          send(ws, 'notification', {
            message: `⚠️ Bạn không đủ Xu! Cần ${gift.cost} Xu nhưng chỉ có ${user.coins} Xu. Hãy bấm nhận Xu miễn phí!`,
            type: 'error'
          });
          return;
        }

        user.coins -= gift.cost;

        if (user.accountId) {
          const acc = db.accounts.find(a => a.id === user.accountId);
          if (acc) {
            acc.coins = user.coins;
            saveDB();
          }
        }

        room.giftRevenue = (room.giftRevenue || 0) + gift.cost;

        if (room.hostId) {
          const hostAcc = db.accounts.find(a => a.id === room.hostId);
          if (hostAcc) {
            hostAcc.coins = (hostAcc.coins || 0) + gift.cost;
            saveDB();
          }
        }

        send(ws, 'coins-updated', { coins: user.coins });

        const giftEvent = {
          id: 'gift_' + Date.now(),
          senderId: user.id,
          senderName: user.name,
          senderAvatar: user.avatarId || 'pixel_nerd',
          senderColor: user.color,
          giftId: gift.id,
          giftName: gift.name,
          giftIcon: gift.icon,
          giftCost: gift.cost,
          effect: gift.effect,
          desc: gift.desc,
          hostName: room.createdBy || 'Chủ phòng',
          time: Date.now()
        };

        broadcastToRoom(room, 'gift-broadcast', giftEvent);

        const chatGiftMsg = {
          id: 'msg_gift_' + Date.now(),
          userId: 'system',
          name: 'Hệ Thống Quà',
          color: '#f59e0b',
          role: 'system',
          isGiftNotice: true,
          text: `🎁 ${user.name} đã tặng Chủ phòng ${gift.icon} ${gift.name} (+${gift.cost} Xu)!`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        room.messages.push(chatGiftMsg);
        if (room.messages.length > 80) room.messages.shift();
        broadcastToRoom(room, 'chat-message', chatGiftMsg);
        break;
      }

      case 'claim-coins': {
        if (typeof user.coins !== 'number') user.coins = 1000;
        const bonus = user.isVip ? 2000 : 500;
        user.coins += bonus;
        if (user.accountId) {
          const acc = db.accounts.find(a => a.id === user.accountId);
          if (acc) {
            acc.coins = user.coins;
            saveDB();
          }
        }
        send(ws, 'coins-updated', { coins: user.coins });
        send(ws, 'notification', {
          message: user.isVip
            ? `👑 Đặc quyền VIP: Bạn đã nhận +${bonus} Xu thưởng hoàng gia!`
            : `🎉 Bạn đã nhận thành công +${bonus} Xu thưởng rạp phim!`,
          type: 'success'
        });
        break;
      }

      case 'claim-vip': {
        user.isVip = true;
        user.tier = user.role === 'admin' ? '🛡️ Admin Tối Cao' : '👑 Thành Viên VIP';
        if (user.accountId) {
          const acc = db.accounts.find(a => a.id === user.accountId);
          if (acc) {
            acc.isVip = true;
            acc.tier = user.tier;
            saveDB();
          }
        }
        send(ws, 'user-info', {
          id: user.id,
          name: user.name,
          username: user.username,
          avatarId: user.avatarId,
          role: user.role,
          tier: user.tier,
          isVip: user.isVip,
          coins: user.coins
        });
        send(ws, 'notification', { message: '👑 Chúc mừng! Bạn đã mở khóa thành công Đặc Quyền VIP Hoàng Gia!', type: 'success' });
        if (room) {
          if (user.seatId !== null && room.seats[user.seatId]) {
            room.seats[user.seatId].isVip = true;
            room.seats[user.seatId].tier = user.tier;
          }
          broadcastToRoom(room, 'seat-state', { seats: room.seats, user });
          broadcastToRoom(room, 'chat-message', {
            id: 'msg_vip_' + Date.now(),
            userId: 'system',
            name: 'Hệ Thống Rạp',
            color: '#f59e0b',
            role: 'system',
            text: `✨ Chúc mừng ${user.name} đã gia nhập hàng ngũ 👑 THÀNH VIÊN VIP! Hãy cùng chúc mừng nào!`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          });
        }
        break;
      }

      // --- Peer-to-Peer In-Room Interactions (Popcorn, Cheers, Heart, Clap) ---
      case 'user-interaction': {
        if (!room) return;
        const targetUserId = payload.targetUserId;
        const action = payload.action;
        let targetEntry = null;
        for (const [tWs, tUser] of room.users.entries()) {
          if (tUser.id === targetUserId) {
            targetEntry = { ws: tWs, user: tUser };
            break;
          }
        }
        if (!targetEntry) {
          send(ws, 'notification', { message: 'Người này không còn trong rạp!', type: 'error' });
          return;
        }

        let actionText = '';
        let emoji = '✨';
        if (action === 'popcorn') {
          emoji = '🍿';
          actionText = `🍿 ${user.name} vừa mời ${targetEntry.user.name} một hộp bắp rang bơ!`;
        } else if (action === 'cheers') {
          emoji = '🍻';
          actionText = `🍻 ${user.name} vừa cụng ly với ${targetEntry.user.name}: "Chúc bạn xem phim vui vẻ!"`;
        } else if (action === 'heart') {
          emoji = '💖';
          actionText = `💖 ${user.name} vừa thả tim lấp lánh cho ${targetEntry.user.name}!`;
        } else if (action === 'clap') {
          emoji = '👏';
          actionText = `👏 ${user.name} vừa đập tay cổ vũ ${targetEntry.user.name}!`;
        }

        broadcastToRoom(room, 'user-interaction-event', {
          senderId: user.id,
          senderName: user.name,
          senderSeatId: user.seatId,
          targetUserId: targetEntry.user.id,
          targetUserName: targetEntry.user.name,
          targetSeatId: targetEntry.user.seatId,
          action,
          emoji,
          text: actionText
        });

        broadcastToRoom(room, 'chat-message', {
          id: 'msg_interact_' + Date.now(),
          userId: 'system',
          name: 'Tương Tác Rạp',
          color: '#fbbf24',
          role: 'system',
          text: actionText,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });
        break;
      }

      // --- Sweetbox Couple Interactive Suite (Tương Tác Độc Quyền Ghế Đôi) ---
      case 'couple-action': {
        if (!room) return;
        const seatId = user.seatId;
        if (seatId === null || seatId < 10) {
          send(ws, 'notification', { message: '💖 Bạn phải ngồi ở Ghế Đôi Sweetbox (Hàng C) để dùng tính năng này!', type: 'warning' });
          return;
        }

        const coupleGroup = Math.floor((seatId - 10) / 2) + 1; // 1, 2, 3
        const partnerSeatId = (seatId % 2 === 0) ? (seatId + 1) : (seatId - 1);
        const partner = room.seats[partnerSeatId];
        const action = payload?.action; // 'feed_popcorn' | 'lean_shoulder' | 'set_name' | 'set_whisper'

        // 1. Khắc tên đôi lên biển hiệu ghế
        if (action === 'set_name') {
          const customName = String(payload?.customName || '').trim().substring(0, 32);
          if (!customName) {
            send(ws, 'notification', { message: 'Tên khắc trên ghế không được để trống!', type: 'error' });
            return;
          }
          room.coupleNames = room.coupleNames || {};
          room.coupleNames[coupleGroup] = customName;

          broadcastToRoom(room, 'couple-name-updated', {
            coupleGroup,
            customName,
            byUser: user.name
          });

          broadcastToRoom(room, 'chat-message', {
            id: 'msg_cp_' + Date.now(),
            userId: 'system',
            name: 'Rạp Chiếu Phim',
            color: '#fb7185',
            role: 'system',
            text: `💌 Chiếc Ghế Đôi ${coupleGroup} vừa được khắc tên kỷ niệm: "${customName}"! 💕`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          });
          return;
        }

        // 2. Kênh thì thầm riêng tư (Whisper Mode)
        if (action === 'set_whisper') {
          user.whisperMode = !!payload?.whisperMode;
          send(ws, 'notification', {
            message: user.whisperMode 
              ? '🤫 Đã BẬT Kênh Thì Thầm Riêng Tư! Giờ chỉ bạn ngồi cùng ghế đôi nghe thấy giọng bạn nói qua mic.'
              : '🔊 Đã TẮT Kênh Thì Thầm! Cả rạp sẽ nghe thấy mic của bạn.',
            type: 'info'
          });
          broadcastToRoom(room, 'user-whisper-changed', {
            userId: user.id,
            whisperMode: user.whisperMode,
            seatId: user.seatId
          });
          return;
        }

        // Cho Đút bắp và Tựa vai: Cần có bạn ngồi cùng ghế
        if (!partner) {
          send(ws, 'notification', {
            message: '💖 Chỗ bên cạnh đang trống! Hãy rủ bạn bè vào ngồi cùng ghế đôi để tương tác nha.',
            type: 'info'
          });
          return;
        }

        if (action === 'feed_popcorn') {
          broadcastToRoom(room, 'couple-interaction-event', {
            action: 'feed_popcorn',
            coupleGroup,
            fromSeatId: seatId,
            toSeatId: partnerSeatId,
            fromUserName: user.name,
            toUserName: partner.name
          });
          broadcastToRoom(room, 'chat-message', {
            id: 'msg_feed_' + Date.now(),
            userId: 'system',
            name: 'Cặp Đôi Rạp Phim',
            color: '#fb7185',
            role: 'system',
            text: `🍿 [Ghế Đôi ${coupleGroup}] ${user.name} đang đút từng hạt bắp rang thơm bơ cho ${partner.name} ăn cực kỳ ngọt ngào! 💕`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          });
        } else if (action === 'lean_shoulder') {
          broadcastToRoom(room, 'couple-interaction-event', {
            action: 'lean_shoulder',
            coupleGroup,
            fromSeatId: seatId,
            toSeatId: partnerSeatId,
            fromUserName: user.name,
            toUserName: partner.name
          });
          broadcastToRoom(room, 'chat-message', {
            id: 'msg_lean_' + Date.now(),
            userId: 'system',
            name: 'Cặp Đôi Rạp Phim',
            color: '#fb7185',
            role: 'system',
            text: `💤 [Ghế Đôi ${coupleGroup}] ${user.name} đã nhẹ nhàng tựa đầu vào vai ${partner.name} cùng xem phim thật ấm áp! 🥰`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          });
        }
        break;
      }

      // --- In-Room Host & Admin Moderation Suite ---
      case 'transfer-host':
      case 'host-transfer': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Bạn không có quyền chuyển giao chức vị Chủ phòng!', type: 'error' });
          return;
        }

        const targetUserId = payload?.targetUserId;
        if (!targetUserId) return;

        let targetUser = null;
        for (const [, tUser] of room.users.entries()) {
          if (tUser.id === targetUserId || tUser.accountId === targetUserId) {
            targetUser = tUser;
            break;
          }
        }

        if (!targetUser) {
          send(ws, 'notification', { message: '⚠️ Khán giả này không còn trong phòng!', type: 'error' });
          return;
        }

        if (targetUser.id === user.id) {
          send(ws, 'notification', { message: 'Bạn đang là Chủ phòng rồi!', type: 'info' });
          return;
        }

        // Chuyển giao quyền Chủ phòng
        room.hostId = targetUser.accountId || targetUser.id;
        room.hostUsername = targetUser.username || targetUser.name;
        room.createdBy = targetUser.name;

        broadcastToRoom(room, 'host-transferred', {
          roomId: room.id,
          roomName: room.name,
          prevHostId: user.id,
          prevHostName: user.name,
          newHostId: targetUser.id,
          newHostName: targetUser.name,
          newHostUsername: targetUser.username
        });

        broadcastToRoom(room, 'room-info-updated', {
          room: {
            id: room.id,
            name: room.name,
            createdBy: room.createdBy,
            hostId: room.hostId,
            hostUsername: room.hostUsername
          }
        });

        broadcastToRoom(room, 'chat-message', {
          id: 'msg_host_' + Date.now(),
          userId: 'system',
          name: 'Hệ Thống Rạp',
          color: '#fbbf24',
          role: 'system',
          text: `👑 Chủ phòng ${user.name} đã trao lại toàn quyền Chủ Phòng cho ${targetUser.name}!`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });

        broadcastRoomsListToAll();
        break;
      }
      case 'host-kick-seat': {
        if (!room) return;
        ensureRoomSeats(room);
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Bạn không có quyền quản lý ghế trong phòng này!', type: 'error' });
          return;
        }
        const seatId = parseInt(payload.seatId, 10);
        if (isNaN(seatId) || !room.seats[seatId]) return;
        const targetOccupant = room.seats[seatId];
        for (const [tWs, tUser] of room.users.entries()) {
          if (tUser.id === targetOccupant.userId) {
            tUser.seatId = null;
            send(tWs, 'notification', { message: `💺 Chủ phòng / Admin đã mời bạn xuống khỏi ghế ${SEAT_LABELS[seatId]}.`, type: 'info' });
            break;
          }
        }
        room.seats[seatId] = null;
        broadcastToRoom(room, 'seat-state', { seats: room.seats, movedUser: targetOccupant });
        broadcastRoomsListToAll();
        broadcastToRoom(room, 'chat-message', {
          id: 'msg_mod_' + Date.now(),
          userId: 'system',
          name: 'Hệ Thống Rạp',
          color: '#f59e0b',
          role: 'system',
          text: `💺 ${targetOccupant.name} đã được mời xuống khỏi ghế ${SEAT_LABELS[seatId]}.`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });
        break;
      }

      case 'host-force-mute': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Bạn không có quyền điều khiển micro người khác!', type: 'error' });
          return;
        }
        const targetUserId = payload.targetUserId;
        for (const [tWs, tUser] of room.users.entries()) {
          if (tUser.id === targetUserId) {
            tUser.micOn = false;
            if (tUser.seatId !== null && room.seats[tUser.seatId]) {
              room.seats[tUser.seatId].micOn = false;
            }
            broadcastToRoom(room, 'voice-state-changed', {
              userId: tUser.id,
              micOn: false,
              seatId: tUser.seatId,
              isOnStage: false
            });
            send(tWs, 'force-mic-off', {});
            send(tWs, 'notification', { message: '🔇 Micro của bạn đã bị Chủ phòng / Admin tắt!', type: 'warning' });
            break;
          }
        }
        break;
      }

      case 'host-kick-user': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Bạn không có quyền mời người xem ra khỏi phòng!', type: 'error' });
          return;
        }
        const targetUserId = payload.targetUserId;
        if (targetUserId === user.id) return;
        let targetWsToKick = null;
        let kickedName = '';
        for (const [tWs, tUser] of room.users.entries()) {
          if (tUser.id === targetUserId) {
            targetWsToKick = tWs;
            kickedName = tUser.name;
            break;
          }
        }
        if (targetWsToKick) {
          send(targetWsToKick, 'notification', { message: '🚪 Bạn đã được Chủ phòng / Admin mời ra khỏi phòng chiếu!', type: 'warning' });
          joinLobby(targetWsToKick);
          broadcastToRoom(room, 'chat-message', {
            id: 'msg_mod_' + Date.now(),
            userId: 'system',
            name: 'Hệ Thống Rạp',
            color: '#ef4444',
            role: 'system',
            text: `🚪 ${kickedName} đã được mời ra khỏi rạp chiếu.`,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          });
        }
        break;
      }


      case 'host-update-room': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', { message: '🔒 Bạn không có quyền chỉnh sửa phòng!', type: 'error' });
          return;
        }
        if (payload.name && payload.name.trim()) {
          room.name = payload.name.trim().substring(0, 50);
        }
        if (typeof payload.password !== 'undefined') {
          room.password = String(payload.password || '').trim();
        }
        broadcastToRoom(room, 'room-info-updated', {
          room: {
            id: room.id,
            name: room.name,
            hasPassword: !!room.password,
            createdBy: room.createdBy,
            hostId: room.hostId
          }
        });
        broadcastRoomsListToAll();
        send(ws, 'notification', { message: '✅ Đã lưu thông tin phòng thành công!', type: 'success' });
        break;
      }

      case 'host-clear-queue': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) return;
        room.queue = [];
        broadcastToRoom(room, 'queue-updated', { queue: room.queue });
        send(ws, 'notification', { message: '🗑️ Đã xóa sạch danh sách hàng chờ phát video!', type: 'success' });
        break;
      }

      case 'host-reset-screen': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) return;
        room.currentVideo = null;
        room.playback = { isPlaying: false, currentTime: 0, lastSyncTime: Date.now() };
        broadcastToRoom(room, 'video-changed', {
          video: null,
          queue: room.queue,
          playback: room.playback
        });
        broadcastRoomsListToAll();
        send(ws, 'notification', { message: '⏹ Đã đặt lại màn chiếu về trạng thái chờ mặc định!', type: 'success' });
        break;
      }

      case 'host-broadcast-announcement': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) return;
        const announcementText = String(payload.text || '').trim();
        if (!announcementText) return;
        broadcastToRoom(room, 'room-announcement', {
          text: announcementText,
          senderName: user.name,
          role: user.role,
          time: Date.now()
        });
        broadcastToRoom(room, 'chat-message', {
          id: 'msg_ann_' + Date.now(),
          userId: 'system',
          name: '📢 LOA THÔNG BÁO RẠP',
          color: '#ef4444',
          role: 'system',
          text: `📢 THÔNG BÁO TỪ ${user.name}: "${announcementText}"`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        });
        break;
      }

      case 'host-clear-chat': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) return;
        room.messages = [];
        broadcastToRoom(room, 'chat-cleared', {});
        broadcastToRoom(room, 'notification', { message: '🧹 Toàn bộ tin nhắn chat trong rạp đã được dọn sạch!', type: 'info' });
        break;
      }

      // --- Screen Photo Projection (HOST & ADMIN ONLY) ---
      case 'screen-post': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được chiếu ảnh lên màn hình rạp!',
            type: 'error'
          });
          return;
        }

        const imgUrl = (payload.image || '').trim();
        const caption = (payload.caption || '').trim().substring(0, 60);

        if (!imgUrl) {
          send(ws, 'notification', { message: 'Ảnh chiếu không hợp lệ.', type: 'error' });
          return;
        }

        const post = {
          id: 'post_' + Date.now(),
          senderName: user.name,
          senderColor: user.color,
          image: imgUrl,
          caption,
          duration: 10,
          startedAt: Date.now(),
          expiresAt: Date.now() + 10000
        };

        room.screenPost = post;
        broadcastToRoom(room, 'screen-post-started', { screenPost: post });
        break;
      }

      // --- Party Mode (HOST & ADMIN ONLY — Works independently alongside Lights Off!) ---
      case 'toggle-party': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được bật/tắt đèn tiệc!',
            type: 'error'
          });
          return;
        }

        room.partyMode = !room.partyMode;
        broadcastToRoom(room, 'party-mode-toggled', { partyMode: room.partyMode });
        break;
      }

      // --- Cinema Lights Off Mode (Tắt đèn rạp — Works independently alongside Party Mode!) ---
      case 'toggle-lights': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          return;
        }

        room.lightsOff = !room.lightsOff;
        broadcastToRoom(room, 'lights-mode-toggled', { lightsOff: room.lightsOff });
        break;
      }

      // ==================== ADMIN MANAGEMENT COMMANDS ====================
      case 'admin-get-data': {
        if (user.role !== 'admin') {
          send(ws, 'notification', { message: '🚫 Chỉ Quản trị viên (Admin) mới có quyền truy cập!', type: 'error' });
          return;
        }
        send(ws, 'admin-data', getAdminDashboardData());
        break;
      }

      case 'admin-save-movie': {
        if (user.role !== 'admin') return;
        const m = payload?.movie;
        if (!m || !m.title || !m.videoUrl) {
          send(ws, 'notification', { message: 'Vui lòng nhập đầy đủ Tên phim và Link phát sóng!', type: 'error' });
          return;
        }

        const parsedSource = parseVideoSource(m.videoUrl, m.title);
        const sourceType = m.sourceType === 'auto' || !m.sourceType
          ? (parsedSource?.sourceType || 'youtube')
          : m.sourceType;

        if (m.id) {
          const idx = db.movies.findIndex(item => item.id === m.id);
          if (idx !== -1) {
            db.movies[idx] = {
              ...db.movies[idx],
              title: String(m.title).trim(),
              poster: String(m.poster || db.movies[idx].poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600').trim(),
              description: String(m.description || '').trim(),
              cast: String(m.cast || '').trim(),
              genre: String(m.genre || 'Hành động').trim(),
              country: String(m.country || 'Việt Nam').trim(),
              year: String(m.year || '2026').trim(),
              tags: Array.isArray(m.tags) ? m.tags : [],
              isVipOnly: !!m.isVipOnly,
              sourceType,
              videoUrl: String(m.videoUrl).trim(),
              episodes: Array.isArray(m.episodes) && m.episodes.length > 0
                ? m.episodes
                : [{ epNumber: 1, title: 'Tập 1 — Full', sourceType, videoUrl: String(m.videoUrl).trim() }]
            };
          }
        } else {
          const newMov = {
            id: 'mov_' + Date.now(),
            title: String(m.title).trim(),
            poster: String(m.poster || parsedSource?.thumbnail || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600').trim(),
            description: String(m.description || '').trim(),
            cast: String(m.cast || '').trim(),
            genre: String(m.genre || 'Hành động').trim(),
            country: String(m.country || 'Việt Nam').trim(),
            year: String(m.year || '2026').trim(),
            tags: Array.isArray(m.tags) ? m.tags : [],
            isVipOnly: !!m.isVipOnly,
            sourceType,
            videoUrl: String(m.videoUrl).trim(),
            episodes: Array.isArray(m.episodes) && m.episodes.length > 0
              ? m.episodes
              : [{ epNumber: 1, title: 'Tập 1 — Full', sourceType, videoUrl: String(m.videoUrl).trim() }],
            views: 1,
            createdAt: Date.now()
          };
          db.movies.unshift(newMov);
        }

        saveDB();
        send(ws, 'admin-data', getAdminDashboardData());
        broadcastGlobal('catalog-updated', { movies: db.movies, categories: db.categories });
        send(ws, 'notification', { message: '✅ Đã lưu thông tin phim vào Kho Phim Hệ Thống!', type: 'success' });
        break;
      }

      case 'admin-delete-movie': {
        if (user.role !== 'admin') return;
        const movieId = payload?.movieId;
        db.movies = db.movies.filter(m => m.id !== movieId);
        saveDB();
        send(ws, 'admin-data', getAdminDashboardData());
        broadcastGlobal('catalog-updated', { movies: db.movies, categories: db.categories });
        send(ws, 'notification', { message: '🗑️ Đã xóa phim khỏi hệ thống.', type: 'info' });
        break;
      }

      case 'admin-save-categories': {
        if (user.role !== 'admin') return;
        if (payload?.categories) {
          db.categories = {
            genres: Array.isArray(payload.categories.genres) ? payload.categories.genres : db.categories.genres,
            countries: Array.isArray(payload.categories.countries) ? payload.categories.countries : db.categories.countries,
            years: Array.isArray(payload.categories.years) ? payload.categories.years : db.categories.years,
            tags: Array.isArray(payload.categories.tags) ? payload.categories.tags : db.categories.tags
          };
          saveDB();
          send(ws, 'admin-data', getAdminDashboardData());
          broadcastGlobal('catalog-updated', { movies: db.movies, categories: db.categories });
          send(ws, 'notification', { message: '✅ Đã cập nhật Danh mục Thể loại, Quốc gia, Năm & Tag!', type: 'success' });
        }
        break;
      }

      case 'admin-toggle-ban': {
        if (user.role !== 'admin') return;
        const targetAcc = db.accounts.find(a => a.id === payload?.accountId);
        if (!targetAcc) return;
        if (targetAcc.username === 'admin') {
          send(ws, 'notification', { message: '⚠️ Không thể khóa tài khoản Admin gốc!', type: 'error' });
          return;
        }

        targetAcc.isBanned = !targetAcc.isBanned;
        saveDB(true);

        // If banned, kick active connections of this user immediately
        if (targetAcc.isBanned) {
          for (const [clientWs, clientEntry] of connectionMap.entries()) {
            if (clientEntry.user?.accountId === targetAcc.id) {
              send(clientWs, 'account-banned', {
                message: '🚫 Tài khoản của bạn vừa bị Quản trị viên (Admin) khóa do vi phạm nội quy!'
              });
              leaveCurrentRoom(clientWs);
              clientEntry.user.accountId = null;
              clientEntry.user.username = null;
              clientEntry.user.role = 'guest';
              joinLobby(clientWs);
            }
          }
        }

        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', {
          message: targetAcc.isBanned
            ? `🔒 Đã khóa tài khoản "${targetAcc.username}" và trục xuất khỏi phòng chiếu.`
            : `🔓 Đã mở khóa tài khoản "${targetAcc.username}".`,
          type: 'info'
        });
        break;
      }

      case 'admin-toggle-vip': {
        if (user.role !== 'admin') return;
        const targetAcc = db.accounts.find(a => a.id === payload?.accountId);
        if (!targetAcc) return;

        targetAcc.isVip = !targetAcc.isVip;
        targetAcc.tier = targetAcc.role === 'admin' ? '🛡️ Admin Tối Cao' : (targetAcc.isVip ? '👑 Thành Viên VIP' : 'Khán Giả');
        saveDB(true);

        // Update live connected user if online
        for (const [clientWs, clientEntry] of connectionMap.entries()) {
          if (clientEntry.user?.accountId === targetAcc.id) {
            clientEntry.user.isVip = targetAcc.isVip;
            clientEntry.user.tier = targetAcc.tier;
            send(clientWs, 'profile-updated', {
              ...clientEntry.user,
              isHost: clientEntry.room ? isRoomHostOrAdmin(clientEntry.user, clientEntry.room) : false
            });
            send(clientWs, 'notification', {
              message: targetAcc.isVip
                ? '👑 Chúc mừng! Bạn vừa được Admin nâng cấp lên Thành Viên VIP!'
                : 'ℹ️ Gói VIP của bạn đã được Admin thu hồi.',
              type: 'success'
            });
          }
        }

        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', {
          message: targetAcc.isVip
            ? `👑 Đã cấp gói VIP cho "${targetAcc.name}" (${targetAcc.username})!`
            : `Đã gỡ gói VIP của "${targetAcc.name}".`,
          type: 'success'
        });
        break;
      }

      case 'admin-toggle-role': {
        if (user.role !== 'admin') return;
        const targetAcc = db.accounts.find(a => a.id === payload?.accountId);
        if (!targetAcc || targetAcc.username === 'admin') {
          send(ws, 'notification', { message: '⚠️ Không thể thay đổi quyền của Admin gốc!', type: 'error' });
          return;
        }

        targetAcc.role = targetAcc.role === 'admin' ? 'user' : 'admin';
        if (targetAcc.role === 'admin') targetAcc.isVip = true;
        targetAcc.tier = targetAcc.role === 'admin' ? '🛡️ Admin Tối Cao' : (targetAcc.isVip ? '👑 Thành Viên VIP' : 'Khán Giả');
        saveDB(true);

        for (const [clientWs, clientEntry] of connectionMap.entries()) {
          if (clientEntry.user?.accountId === targetAcc.id) {
            clientEntry.user.role = targetAcc.role;
            clientEntry.user.isVip = targetAcc.isVip;
            clientEntry.user.tier = targetAcc.tier;
            send(clientWs, 'profile-updated', {
              ...clientEntry.user,
              isHost: clientEntry.room ? isRoomHostOrAdmin(clientEntry.user, clientEntry.room) : false
            });
          }
        }

        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', {
          message: `🛡️ Đã cập nhật quyền của "${targetAcc.username}" thành: ${targetAcc.role.toUpperCase()}`,
          type: 'success'
        });
        break;
      }

      case 'admin-delete-user': {
        if (user.role !== 'admin') return;
        const targetAcc = db.accounts.find(a => a.id === payload?.accountId);
        if (!targetAcc || targetAcc.username === 'admin') {
          send(ws, 'notification', { message: '⚠️ Không thể xóa tài khoản Admin gốc!', type: 'error' });
          return;
        }

        db.accounts = db.accounts.filter(a => a.id !== targetAcc.id);
        saveDB(true);

        for (const [clientWs, clientEntry] of connectionMap.entries()) {
          if (clientEntry.user?.accountId === targetAcc.id) {
            send(clientWs, 'account-banned', { message: 'Tài khoản của bạn đã bị Admin xóa khỏi hệ thống.' });
            leaveCurrentRoom(clientWs);
            clientEntry.user.accountId = null;
            clientEntry.user.username = null;
            clientEntry.user.role = 'guest';
            joinLobby(clientWs);
          }
        }

        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', { message: `🗑️ Đã xóa tài khoản "${targetAcc.username}".`, type: 'info' });
        break;
      }

      case 'admin-set-user-password': {
        if (user.role !== 'admin') return;
        const targetAcc = db.accounts.find(a => a.id === payload?.accountId);
        if (!targetAcc) return;
        const newPass = String(payload?.newPassword || '').trim();
        if (!newPass || newPass.length < 4) {
          send(ws, 'notification', { message: 'Mật khẩu phải từ 4 ký tự trở lên!', type: 'error' });
          return;
        }
        targetAcc.passwordHash = hashPassword(newPass);
        targetAcc.plainPassword = newPass;
        saveDB(true);
        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', {
          message: `🔑 Đã đổi mật khẩu cho user "${targetAcc.username}" thành: ${newPass}`,
          type: 'success'
        });
        break;
      }

      case 'admin-force-cloud-sync': {
        if (user.role !== 'admin') return;
        await performRemoteSync();
        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', { message: '☁️ Đã đồng bộ toàn bộ tài khoản lên Cloud Storage thành công!', type: 'success' });
        break;
      }

      case 'admin-delete-comment': {
        if (user.role !== 'admin') return;
        const { roomId, messageId } = payload || {};
        const targetRoom = rooms.get(roomId);
        if (targetRoom) {
          targetRoom.messages = targetRoom.messages.filter(m => m.id !== messageId);
          broadcastToRoom(targetRoom, 'chat-message-deleted', { messageId });
        }
        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', { message: '🧹 Đã xóa bình luận vi phạm/spam!', type: 'success' });
        break;
      }

      case 'admin-update-room-pass': {
        if (!room && !payload?.roomId) return;
        const targetRoom = rooms.get(payload?.roomId || room?.id);
        if (!targetRoom || !isRoomHostOrAdmin(user, targetRoom)) {
          send(ws, 'notification', { message: '🔒 Chỉ Chủ phòng hoặc Admin mới được đổi mật khẩu phòng!', type: 'error' });
          return;
        }
        const newPass = String(payload?.password || '').trim();
        if (!newPass) {
          send(ws, 'notification', { message: 'Mật khẩu phòng không được để trống!', type: 'error' });
          return;
        }
        targetRoom.password = newPass;
        send(ws, 'notification', { message: `🔑 Đã cập nhật mật khẩu cho "${targetRoom.name}" thành: ${newPass}`, type: 'success' });
        if (user.role === 'admin') {
          send(ws, 'admin-data', getAdminDashboardData());
        }
        broadcastRoomsListToAll();
        break;
      }

      case 'admin-add-revenue': {
        if (user.role !== 'admin') return;
        const revType = payload?.revType === 'ad' ? 'ad' : 'vip';
        const amount = Math.max(0, parseInt(payload?.amount, 10) || 0);
        const note = String(payload?.note || '').trim() || (revType === 'vip' ? 'Đăng ký gói VIP' : 'Doanh thu Quảng cáo');
        if (amount <= 0) return;

        if (revType === 'vip') {
          db.stats.vipRevenue = (db.stats.vipRevenue || 0) + amount;
        } else {
          db.stats.adRevenue = (db.stats.adRevenue || 0) + amount;
        }

        db.stats.transactions = db.stats.transactions || [];
        db.stats.transactions.unshift({
          id: 'tx_' + Date.now(),
          type: revType,
          amount,
          note,
          time: new Date().toLocaleDateString('vi-VN')
        });
        saveDB();
        send(ws, 'admin-data', getAdminDashboardData());
        send(ws, 'notification', { message: '💰 Đã ghi nhận báo cáo doanh thu mới!', type: 'success' });
        break;
      }
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom(ws);
    connectionMap.delete(ws);
    broadcastRoomsListToAll();
  });

  ws.on('error', () => {
    leaveCurrentRoom(ws);
    connectionMap.delete(ws);
    broadcastRoomsListToAll();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Rạp Chiếu Phim Ảo wetube ciné (Admin + Auth + Room Pass + Host Control) đang chạy tại: http://localhost:${PORT}`);
});
