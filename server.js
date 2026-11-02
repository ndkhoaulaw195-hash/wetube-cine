const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const https = require('https');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const MAX_ROOMS = 5;

// Serve static files from 'public' with cache busting
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

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

// Extract YouTube ID from various URL formats
function extractYoutubeId(input) {
  if (!input) return null;
  const str = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

// 10 Seats for VIP Small Group (Row A: 0..4, Row B: 5..9)
const SEAT_LABELS = [
  'A01', 'A02', 'A03', 'A04', 'A05',
  'B01', 'B02', 'B03', 'B04', 'B05'
];

// Room Factory (Tối đa 5 phòng, mỗi phòng 10 chỗ VIP, 0 bot giả)
function createRoomInstance(id, name, createdBy = 'Hệ thống') {
  return {
    id,
    name: name || `Phòng ${id.replace('phong-', '').padStart(2, '0')}`,
    createdBy,
    createdAt: Date.now(),
    currentVideo: {
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
      author: 'Rick Astley',
      duration: 213,
      startedAt: Date.now(),
      isPlaying: true,
      pausedAt: 0,
      requester: 'Rạp Phim',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    },
    queue: [
      {
        id: 'JGwWNGJdvx8',
        title: 'Ed Sheeran - Shape of You (Official Music Video)',
        author: 'Ed Sheeran',
        duration: 263,
        requester: 'Rạp Phim',
        thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg'
      }
    ],
    seats: Array(10).fill(null), // Exactly 10 seats per room
    stageUser: null,
    skipVotes: new Set(),
    screenPost: null,
    partyMode: false,
    messages: [],
    users: new Map() // ws -> userData
  };
}

// Active Rooms Map (Max 5 rooms)
const rooms = new Map();
rooms.set('phong-1', createRoomInstance('phong-1', 'Phòng 01 — Chiếu Phim VIP'));
rooms.set('phong-2', createRoomInstance('phong-2', 'Phòng 02 — Âm Nhạc & Quẩy'));

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

// Broadcast to EVERY connected user (across all rooms, e.g. room list updates)
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
function getRoomSnapshot(room) {
  const realUsers = [];
  for (const [, user] of room.users) {
    realUsers.push({
      id: user.id,
      name: user.name,
      color: user.color,
      tier: user.tier,
      seatId: user.seatId,
      isOnStage: room.stageUser === user.id
    });
  }

  return {
    roomId: room.id,
    roomName: room.name,
    currentVideo: room.currentVideo,
    queue: room.queue,
    seats: room.seats,
    seatLabels: SEAT_LABELS,
    stageUser: room.stageUser,
    skipVotesCount: room.skipVotes.size,
    requiredSkipVotes: Math.max(1, Math.ceil(room.users.size / 2)),
    partyMode: room.partyMode,
    screenPost: room.screenPost,
    onlineCount: room.users.size,
    realUsers,
    serverTime: Date.now()
  };
}

// Summary of all rooms for room picker
function getRoomsSummary() {
  return Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    isDefault: r.id === 'phong-1',
    createdBy: r.createdBy || (r.id === 'phong-1' ? 'Mặc định' : 'Khán giả'),
    seatedCount: r.seats.filter(s => s !== null).length,
    totalSeats: 10,
    usersCount: r.users.size,
    currentVideoTitle: r.currentVideo?.title || 'Chưa phát video',
    currentVideoThumb: r.currentVideo?.thumbnail || ''
  }));
}

// Skip to next video in a specific room
function skipToNextVideo(room, reason = 'skipped') {
  if (!room) return;
  room.skipVotes.clear();
  if (room.queue.length > 0) {
    room.currentVideo = {
      ...room.queue.shift(),
      startedAt: Date.now(),
      isPlaying: true,
      pausedAt: 0
    };
  } else {
    // Default fallback video
    room.currentVideo = {
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
      author: 'Rick Astley',
      duration: 213,
      startedAt: Date.now(),
      isPlaying: true,
      pausedAt: 0,
      requester: 'Rạp Phim',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
    };
  }

  broadcastToRoom(room, 'video-changed', {
    currentVideo: room.currentVideo,
    queue: room.queue,
    reason
  });
  broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
}

// Periodic check: video ending and photo projection expiration for all rooms
setInterval(() => {
  for (const [, room] of rooms) {
    if (room.currentVideo && room.currentVideo.duration > 0 && room.currentVideo.isPlaying) {
      const elapsed = (Date.now() - room.currentVideo.startedAt) / 1000;
      if (elapsed >= room.currentVideo.duration + 2) {
        skipToNextVideo(room, 'completed');
      }
    }

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

  // Free skip vote
  if (room.skipVotes.has(user.id)) {
    room.skipVotes.delete(user.id);
    broadcastToRoom(room, 'skip-votes-updated', {
      votesCount: room.skipVotes.size,
      required: Math.max(1, Math.ceil(room.users.size / 2))
    });
  }

  room.users.delete(ws);
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
      name: 'Khán giả #' + Math.floor(100 + Math.random() * 900),
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'][Math.floor(Math.random() * 7)],
      tier: 'Người Xem',
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
    availableRooms: getRoomsSummary(),
    maxRooms: MAX_ROOMS
  });
}

// Helper to join a user into a room
function joinRoom(ws, targetRoomId) {
  leaveCurrentRoom(ws);

  let targetRoom = rooms.get(targetRoomId);
  if (!targetRoom) {
    joinLobby(ws);
    return;
  }

  let user = connectionMap.get(ws)?.user;
  if (!user) {
    const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
    user = {
      id: userId,
      name: 'Khán giả #' + Math.floor(100 + Math.random() * 900),
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'][Math.floor(Math.random() * 7)],
      tier: 'Người Xem',
      seatId: null,
      roomId: targetRoom.id
    };
  } else {
    user.seatId = null;
    user.roomId = targetRoom.id;
  }

  targetRoom.users.set(ws, user);
  connectionMap.set(ws, { user, room: targetRoom });

  // Send full init state for this room
  send(ws, 'init', {
    you: user,
    room: getRoomSnapshot(targetRoom),
    recentMessages: targetRoom.messages,
    availableRooms: getRoomsSummary()
  });

  // Notify other room members
  broadcastToRoom(targetRoom, 'user-joined', {
    user,
    onlineCount: targetRoom.users.size,
    seats: targetRoom.seats
  }, ws);

  // Update room directory for all
  broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
}

// WebSocket Connection Handling
wss.on('connection', (ws, req) => {
  // Parse room query parameter from URL (e.g. ws://host/?room=phong-2)
  const url = new URL(req.url, 'http://localhost');
  const requestedRoomId = url.searchParams.get('room');

  if (requestedRoomId && rooms.has(requestedRoomId)) {
    joinRoom(ws, requestedRoomId);
  } else {
    // Default to Lobby so user creates or selects a room
    joinLobby(ws);
  }

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

    // Guard room-required actions if user is in Grand Lobby
    const roomRequiredTypes = new Set([
      'pick-seat', 'leave-seat', 'take-stage', 'queue-video',
      'toggle-pause', 'seek-video', 'skip-vote', 'skip-now',
      'report-duration', 'chat', 'reaction', 'screen-post', 'toggle-party'
    ]);
    if (roomRequiredTypes.has(type) && !room) {
      return;
    }

    switch (type) {
      case 'ping': {
        send(ws, 'pong', { clientTime: payload?.clientTime });
        break;
      }

      // --- Room Management ---
      case 'join-room': {
        const targetRoomId = payload?.roomId;
        if (targetRoomId && rooms.has(targetRoomId)) {
          joinRoom(ws, targetRoomId);
        }
        break;
      }

      case 'create-room': {
        if (rooms.size >= MAX_ROOMS) {
          send(ws, 'notification', {
            message: `⚠️ Đã đạt giới hạn tối đa ${MAX_ROOMS} phòng! Bạn hãy xoá bớt phòng không dùng để tạo mới nhé.`,
            type: 'error'
          });
          return;
        }

        // Find the lowest unused room id from phong-1 to phong-5
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

        const newRoom = createRoomInstance(newRoomId, roomName, user.name);
        rooms.set(newRoomId, newRoom);

        broadcastGlobal('notification', {
          message: `✨ ${user.name} vừa mở phòng mới: "${newRoom.name}"!`,
          type: 'success'
        });

        // Switch creator into the new room
        joinRoom(ws, newRoomId);
        break;
      }

      case 'leave-to-lobby': {
        joinLobby(ws);
        break;
      }

      case 'delete-room': {
        const targetRoomId = payload?.roomId;
        if (!targetRoomId || !rooms.has(targetRoomId)) {
          send(ws, 'notification', {
            message: '⚠️ Phòng không tồn tại hoặc đã bị xoá.',
            type: 'error'
          });
          return;
        }

        const roomToDelete = rooms.get(targetRoomId);
        const deletedRoomName = roomToDelete.name;

        // Move all clients inside this room back to the Lobby
        const clientsInRoom = Array.from(roomToDelete.users.keys());
        for (const clientWs of clientsInRoom) {
          send(clientWs, 'notification', {
            message: `📢 Phòng "${deletedRoomName}" đã được đóng/xoá. Bạn được chuyển về Sảnh Chờ.`,
            type: 'warning'
          });
          joinLobby(clientWs);
        }

        // Remove from rooms Map
        rooms.delete(targetRoomId);

        // Global notification
        broadcastGlobal('notification', {
          message: `🗑️ ${user.name} đã xoá "${deletedRoomName}".`,
          type: 'info'
        });

        // Broadcast updated room list to all clients
        broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
        break;
      }

      case 'list-rooms': {
        send(ws, 'rooms-list-updated', { rooms: getRoomsSummary() });
        break;
      }

      // --- Profile Update ---
      case 'update-profile': {
        if (payload.name && payload.name.trim()) {
          user.name = payload.name.trim().substring(0, 24);
        }
        if (payload.color) user.color = payload.color;
        if (payload.tier) user.tier = payload.tier;

        if (room) {
          if (user.seatId !== null && room.seats[user.seatId]) {
            room.seats[user.seatId] = {
              seatId: user.seatId,
              userId: user.id,
              name: user.name,
              color: user.color,
              tier: user.tier
            };
          }
          broadcastToRoom(room, 'seat-state', { seats: room.seats, user });
        }

        send(ws, 'profile-updated', user);
        break;
      }

      // --- Seat Management (10 Seats per room) ---
      case 'pick-seat': {
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
          color: user.color,
          tier: user.tier
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

        broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
        break;
      }

      case 'leave-seat': {
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

          broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
        }
        break;
      }

      // --- Stage Management ---
      case 'take-stage': {
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

      // --- Video Playback & Queue Management ---
      case 'queue-video': {
        const videoId = extractYoutubeId(payload.url || payload.id);
        if (!videoId) {
          send(ws, 'notification', { message: 'Đường dẫn YouTube không hợp lệ. Vui lòng kiểm tra lại.', type: 'error' });
          return;
        }

        const info = await fetchYoutubeInfo(videoId);
        const item = {
          id: videoId,
          title: info.title,
          author: info.author,
          thumbnail: info.thumbnail,
          requester: user.name,
          queuedAt: Date.now()
        };

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
            message: `🎵 ${user.name} đã thêm bài: "${item.title}" vào hàng chờ!`,
            type: 'success'
          });
        }

        broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
        break;
      }

      // --- Playback Sync (Play/Pause, Seek) ---
      case 'toggle-pause': {
        if (!room.currentVideo) return;
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
            message: `⏸️ ${user.name} đã tạm dừng video`,
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
            message: `▶️ ${user.name} đã tiếp tục phát video`,
            type: 'info'
          });
        }
        break;
      }

      case 'seek-video': {
        if (!room.currentVideo) return;
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
          message: `⏩ ${user.name} đã tua video đến ${mins}:${secs}`,
          type: 'info'
        });
        break;
      }

      // --- Skip Voting ---
      case 'skip-vote': {
        if (!room.currentVideo) return;

        if (room.skipVotes.has(user.id)) {
          room.skipVotes.delete(user.id);
        } else {
          room.skipVotes.add(user.id);
        }

        const required = Math.max(1, Math.ceil(room.users.size / 2));
        if (room.skipVotes.size >= required) {
          broadcastToRoom(room, 'notification', {
            message: `⏩ Đã đủ phiếu bình chọn (${room.skipVotes.size}/${required})! Đang chuyển bài...`,
            type: 'info'
          });
          skipToNextVideo(room, 'voted');
        } else {
          broadcastToRoom(room, 'skip-votes-updated', {
            votesCount: room.skipVotes.size,
            required
          });
          send(ws, 'notification', {
            message: `Đã ghi nhận phiếu của bạn (${room.skipVotes.size}/${required} người đồng ý)`,
            type: 'info'
          });
        }
        break;
      }

      case 'skip-now': {
        if (room.currentVideo) {
          broadcastToRoom(room, 'notification', {
            message: `⏭️ ${user.name} đã chuyển sang bài tiếp theo!`,
            type: 'info'
          });
          skipToNextVideo(room, 'instant');
        }
        break;
      }

      case 'report-duration': {
        if (room.currentVideo && room.currentVideo.id === payload.id && payload.duration > 0) {
          room.currentVideo.duration = Math.floor(payload.duration);
        }
        break;
      }

      // --- Chat ---
      case 'chat': {
        const text = (payload.text || '').trim();
        if (!text) return;

        const chatObj = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId: user.id,
          name: user.name,
          color: user.color,
          tier: user.tier,
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
        const emoji = payload.emoji || '❤️';
        broadcastToRoom(room, 'emoji-reaction', {
          emoji,
          userId: user.id,
          seatId: user.seatId,
          isOnStage: room.stageUser === user.id
        });
        break;
      }

      // --- Screen Photo Projection ---
      case 'screen-post': {
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
          message: `📸 ${user.name} đang chiếu ảnh lên màn hình rạp!`,
          type: 'info'
        });
        break;
      }

      // --- Party Mode ---
      case 'toggle-party': {
        room.partyMode = !room.partyMode;
        broadcastToRoom(room, 'party-mode-toggled', { partyMode: room.partyMode });
        broadcastToRoom(room, 'notification', {
          message: room.partyMode ? `🎉 ${user.name} đã bật đèn tiệc quẩy!` : `💡 ${user.name} đã tắt đèn tiệc.`,
          type: 'info'
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom(ws);
    connectionMap.delete(ws);
    broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
  });

  ws.on('error', () => {
    leaveCurrentRoom(ws);
    connectionMap.delete(ws);
    broadcastGlobal('rooms-list-updated', { rooms: getRoomsSummary() });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎬 Rạp Chiếu Phim Ảo wetube ciné (Hỗ trợ tối đa ${MAX_ROOMS} phòng, mỗi phòng 10 ghế) đang chạy tại: http://localhost:${PORT}`);
});
