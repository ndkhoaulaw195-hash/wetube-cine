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
        name: 'Quản Trị Viên',
        avatarId: 'pixel_king',
        color: '#f2cf78',
        tier: '🛡️ Admin Tối Cao',
        role: 'admin',
        isVip: true,
        isBanned: false,
        createdAt: Date.now()
      },
      {
        id: 'acc_vip_demo',
        username: 'vip',
        passwordHash: hashPassword('123456'),
        name: 'Khách VIP Mẫu',
        avatarId: 'pixel_ceo',
        color: '#ec4899',
        tier: '👑 Thành Viên VIP',
        role: 'user',
        isVip: true,
        isBanned: false,
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

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.warn('Lỗi lưu DB:', e.message);
  }
}

loadDB();

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
    name: name || username,
    avatarId,
    color,
    tier: 'Khán Giả',
    role: 'user',
    isVip: false,
    isBanned: false,
    createdAt: Date.now()
  };

  db.accounts.push(newAcc);
  saveDB();

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
  }

  if (name && String(name).trim()) {
    acc.name = String(name).trim().substring(0, 24);
  }
  if (avatarId) acc.avatarId = avatarId;
  if (color) acc.color = color;
  if (tier) acc.tier = tier;

  saveDB();
  res.json({ user: sanitizeAccount(acc), message: 'Đã cập nhật thông tin tài khoản thành công!' });
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

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Parse video input (supports YouTube, Direct MP4/WebM/m3u8, Google Drive / Embed)
function parseVideoSource(input, customTitle = '') {
  if (!input) return null;
  const str = input.trim();

  // 1. Check YouTube ID or URL
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return { sourceType: 'youtube', id: str, url: `https://www.youtube.com/watch?v=${str}` };
  }
  const ytMatch = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (ytMatch) {
    return { sourceType: 'youtube', id: ytMatch[1], url: `https://www.youtube.com/watch?v=${ytMatch[1]}` };
  }

  // 2. Check Google Drive link
  const driveMatch = str.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveMatch) {
    const driveId = driveMatch[1];
    return {
      sourceType: 'embed',
      id: `gdrive_${driveId}`,
      url: `https://drive.google.com/file/d/${driveId}/preview`,
      title: customTitle || 'Phim Google Drive Cinema',
      author: 'Google Drive CDN',
      thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80'
    };
  }

  // 3. Check local uploaded file (/uploads/...) or direct video URL (.mp4, .webm, .m3u8, .mov, or http/https)
  if (str.startsWith('/uploads/') || /^https?:\/\//i.test(str)) {
    const isDirectVideo = /\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/i.test(str) || str.startsWith('/uploads/') || str.includes('commondatastorage');
    return {
      sourceType: isDirectVideo ? 'direct' : 'embed',
      id: 'vid_' + crypto.createHash('md5').update(str).digest('hex').substring(0, 10),
      url: str,
      title: customTitle || (str.startsWith('/uploads/') ? 'Phim Tải Lên Rạp (' + path.basename(str) + ')' : 'Phim Phát Sóng Trực Tiếp (CDN)'),
      author: 'Hệ Thống Phát Sóng',
      thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80'
    };
  }

  return null;
}

// 10 Seats for VIP Small Group (Row A: 0..4, Row B: 5..9)
const SEAT_LABELS = [
  'A01', 'A02', 'A03', 'A04', 'A05',
  'B01', 'B02', 'B03', 'B04', 'B05'
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
    currentVideo: {
      sourceType: 'youtube',
      id: 'jfKfPfyJRdk',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      title: 'Lofi Hip Hop Radio — Beats to Relax/Study to',
      author: 'Lofi Girl',
      duration: 0,
      startedAt: Date.now(),
      isPlaying: true,
      pausedAt: 0,
      requester: createdBy || 'Rạp Phim',
      thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'
    },
    queue: [
      {
        sourceType: 'youtube',
        id: 'JGwWNGJdvx8',
        url: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
        title: 'Ed Sheeran - Shape of You (Official Music Video)',
        author: 'Ed Sheeran',
        duration: 263,
        requester: 'Rạp Phim',
        thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg'
      }
    ],
    seats: Array(10).fill(null),
    stageUser: null,
    screenPost: null,
    partyMode: false,
    messages: [],
    users: new Map() // ws -> userData
  };
}

// Active Rooms Map (Max 5 rooms)
const rooms = new Map();
rooms.set('phong-1', createRoomInstance('phong-1', 'Phòng 01 — Chiếu Phim VIP', 'Quản Trị Viên', 'acc_admin', 'admin', '1234'));
rooms.set('phong-2', createRoomInstance('phong-2', 'Phòng 02 — Âm Nhạc & Quẩy', 'Quản Trị Viên', 'acc_admin', 'admin', '1234'));

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
      isOnStage: room.stageUser === u.id
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
    screenPost: room.screenPost,
    onlineCount: room.users.size,
    realUsers,
    serverTime: Date.now()
  };
}

// Summary of all rooms for room picker
function getRoomsSummary(requestingUser = null) {
  return Array.from(rooms.values()).map(r => {
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
      totalSeats: 10,
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

  broadcastToRoom(room, 'user-left', {
    userId: user.id,
    name: user.name,
    onlineCount: room.users.size,
    seats: room.seats
  });
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
      seatId: null,
      roomId: null
    };
  } else {
    user.seatId = null;
    user.roomId = null;
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
    isOnline: onlineAccountIds.has(a.id)
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

      // --- Seat Management (10 Seats per room) ---
      case 'pick-seat': {
        if (!room) return;
        const seatId = parseInt(payload.seatId, 10);
        if (isNaN(seatId) || seatId < 0 || seatId >= 10) return;

        const currentOccupant = room.seats[seatId];
        if (currentOccupant && currentOccupant.userId !== user.id) {
          send(ws, 'notification', { message: `Ghế ${SEAT_LABELS[seatId]} đã có ${currentOccupant.name} ngồi rồi!`, type: 'error' });
          return;
        }

        if (user.seatId !== null && user.seatId !== seatId) {
          room.seats[user.seatId] = null;
        }

        user.seatId = seatId;
        if (room.stageUser === user.id) {
          room.stageUser = null;
        }

        room.seats[seatId] = {
          seatId,
          userId: user.id,
          name: user.name,
          avatarId: user.avatarId || 'pixel_nerd',
          color: user.color,
          tier: user.tier,
          isVip: user.isVip,
          role: user.role
        };

        broadcastToRoom(room, 'seat-state', {
          seats: room.seats,
          movedUser: user,
          stageUser: room.stageUser
        });

        send(ws, 'notification', {
          message: `Bạn đã chọn ghế ${SEAT_LABELS[seatId]} thành công!`,
          type: 'success'
        });

        broadcastRoomsListToAll();
        break;
      }

      case 'leave-seat': {
        if (!room) return;
        if (user.seatId !== null) {
          const prev = user.seatId;
          room.seats[prev] = null;
          user.seatId = null;

          broadcastToRoom(room, 'seat-state', {
            seats: room.seats,
            movedUser: user
          });

          send(ws, 'notification', {
            message: `Bạn đã rời ghế ${SEAT_LABELS[prev]}.`,
            type: 'info'
          });

          broadcastRoomsListToAll();
        }
        break;
      }

      // --- Stage Management ---
      case 'take-stage': {
        if (!room) return;
        if (room.stageUser === user.id) {
          room.stageUser = null;
          broadcastToRoom(room, 'stage-state', {
            stageUser: null,
            seats: room.seats
          });
          send(ws, 'notification', { message: 'Bạn đã rời sân khấu.', type: 'info' });
        } else {
          if (user.seatId !== null) {
            room.seats[user.seatId] = null;
            user.seatId = null;
          }

          room.stageUser = user.id;
          broadcastToRoom(room, 'stage-state', {
            stageUser: user.id,
            seats: room.seats
          });
          broadcastToRoom(room, 'notification', {
            message: `🌟 ${user.name} đã bước lên sân khấu quẩy!`,
            type: 'info'
          });
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

        const parsed = parseVideoSource(payload.url || payload.id, payload.title);
        if (!parsed) {
          send(ws, 'notification', {
            message: 'Đường dẫn video không hợp lệ (Hỗ trợ YouTube, Google Drive, MP4/CDN hoặc phim tải lên).',
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
        if (room.currentVideo.isPlaying) {
          const elapsed = Math.max(0, (now - room.currentVideo.startedAt) / 1000);
          room.currentVideo.isPlaying = false;
          room.currentVideo.pausedAt = elapsed;
          broadcastToRoom(room, 'playback-sync', {
            isPlaying: false,
            currentTime: elapsed,
            startedAt: room.currentVideo.startedAt,
            user: user.name
          });
          broadcastToRoom(room, 'notification', {
            message: `⏸️ Chủ phòng ${user.name} đã tạm dừng màn hình`,
            type: 'info'
          });
        } else {
          room.currentVideo.isPlaying = true;
          const pausedAt = room.currentVideo.pausedAt || 0;
          room.currentVideo.startedAt = now - Math.floor(pausedAt * 1000);
          broadcastToRoom(room, 'playback-sync', {
            isPlaying: true,
            currentTime: pausedAt,
            startedAt: room.currentVideo.startedAt,
            user: user.name
          });
          broadcastToRoom(room, 'notification', {
            message: `▶️ Chủ phòng ${user.name} đã tiếp tục phát màn hình`,
            type: 'info'
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
          return;
        }

        const targetTime = Math.max(0, parseFloat(payload?.time) || 0);
        const now = Date.now();
        if (room.currentVideo.isPlaying) {
          room.currentVideo.startedAt = now - Math.floor(targetTime * 1000);
        } else {
          room.currentVideo.pausedAt = targetTime;
        }

        const mins = Math.floor(targetTime / 60);
        const secs = String(Math.floor(targetTime % 60)).padStart(2, '0');

        broadcastToRoom(room, 'playback-sync', {
          isPlaying: room.currentVideo.isPlaying,
          currentTime: targetTime,
          startedAt: room.currentVideo.startedAt,
          user: user.name
        });
        broadcastToRoom(room, 'notification', {
          message: `⏩ Chủ phòng ${user.name} đã tua màn hình đến ${mins}:${secs}`,
          type: 'info'
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

      case 'report-duration': {
        if (room && room.currentVideo && room.currentVideo.id === payload.id && payload.duration > 0) {
          room.currentVideo.duration = Math.floor(payload.duration);
        }
        break;
      }

      // --- Chat ---
      case 'chat': {
        if (!room) return;
        const text = (payload.text || '').trim();
        if (!text) return;

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
          text: text.substring(0, 200),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };

        room.messages.push(chatObj);
        if (room.messages.length > 80) room.messages.shift();

        broadcastToRoom(room, 'chat-message', chatObj);
        break;
      }

      // --- Floating Reactions ---
      case 'reaction': {
        if (!room) return;
        const emoji = payload.emoji || '❤️';
        broadcastToRoom(room, 'emoji-reaction', {
          emoji,
          userId: user.id,
          seatId: user.seatId,
          isOnStage: room.stageUser === user.id
        });
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
        broadcastToRoom(room, 'notification', {
          message: `📸 Chủ phòng ${user.name} đang chiếu ảnh lên màn hình rạp!`,
          type: 'info'
        });
        break;
      }

      // --- Party Mode (HOST & ADMIN ONLY) ---
      case 'toggle-party': {
        if (!room) return;
        if (!isRoomHostOrAdmin(user, room)) {
          send(ws, 'notification', {
            message: '🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được bật/tắt đèn sân khấu!',
            type: 'error'
          });
          return;
        }

        room.partyMode = !room.partyMode;
        broadcastToRoom(room, 'party-mode-toggled', { partyMode: room.partyMode });
        broadcastToRoom(room, 'notification', {
          message: room.partyMode ? `🎉 Chủ phòng ${user.name} đã bật đèn tiệc quẩy!` : `💡 Chủ phòng ${user.name} đã tắt đèn tiệc.`,
          type: 'info'
        });
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
        saveDB();

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
        saveDB();

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
        saveDB();

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
        saveDB();

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
