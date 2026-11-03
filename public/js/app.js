/**
 * wetube ciné - Main Application Controller
 * Features:
 * 1. Auth & Account Management (Login, Register, Change Password, VIP/Admin badges)
 * 2. 12 Chibi 16-bit Pixel Art Characters (2D & 3D WebGL Sprite integration)
 * 3. Room Password Protection (Every room has a password; Host & Admin bypass/manage)
 * 4. Strict Host Screen Control (Only room creator Host or Admin can control playback/screen)
 * 5. Sequential Queue (No auto-advance, no random queue jumping — Host must click "Chuyển tiếp")
 * 6. Full 5-Module Admin Control Panel (Movies, Broadcast/Upload, Categories, Users/Spam, Stats/Revenue)
 */

class CinemaApp {
  constructor() {
    this.ws = null;
    this.authToken = localStorage.getItem('wetube_token') || null;
    this.you = null;
    this.room = null;
    this.clockOffset = 0;
    this.unreadChatCount = 0;
    this.isChatOpen = false;
    this.isHudHidden = false;

    // Interactive Suite: Data Saver, Polls, Stickers & Gifts
    this.isDataSaver = false;
    this.currentPoll = null;
    this.myVotedOption = null;
    this.activeStickerTab = 'stickers';

    this.stickersCatalog = [
      { id: 'stk_popcorn', name: 'Bắp rang bơ', url: '/stickers/popcorn.png' },
      { id: 'stk_fire', name: 'Cháy quá', url: '/stickers/fire.png' },
      { id: 'stk_laugh', name: 'Cười xỉu', url: '/stickers/laugh.png' },
      { id: 'stk_cry', name: 'Khóc ròng', url: '/stickers/cry.png' },
      { id: 'stk_heart', name: 'Thả tim', url: '/stickers/heart.png' },
      { id: 'stk_clap', name: 'Vỗ tay', url: '/stickers/clap.png' },
      { id: 'stk_party', name: 'Tiệc tùng', url: '/stickers/party.png' },
      { id: 'stk_shock', name: 'Quá sốc', url: '/stickers/shock.png' },
      { id: 'stk_cat', name: 'Mèo cưng', url: '/stickers/cat.png' },
      { id: 'stk_pizza', name: 'Ăn pizza', url: '/stickers/pizza.png' },
      { id: 'stk_crown', name: 'Vương miện', url: '/stickers/crown.png' },
      { id: 'stk_cool', name: 'Kính ngầu', url: '/stickers/cool.png' },
      { id: 'stk_mindblown', name: 'Bùng nổ não', url: '/stickers/mindblown.png' },
      { id: 'stk_sleepy', name: 'Buồn ngủ', url: '/stickers/sleepy.png' }
    ];

    this.memesCatalog = [
      { id: 'meme_cool', name: 'Kính ngầu chất', url: '/memes/cool.png' },
      { id: 'meme_mindblown', name: 'Bùng nổ não bộ', url: '/memes/mindblown.png' },
      { id: 'meme_popcorn', name: 'Ăn bắp hóng drama', url: '/memes/popcorn.png' },
      { id: 'meme_cat', name: 'Mèo bối rối', url: '/memes/cat.png' },
      { id: 'meme_shock', name: 'Sốc toàn tập', url: '/memes/shock.png' },
      { id: 'meme_sleepy', name: 'Buồn ngủ ghê', url: '/memes/sleepy.png' },
      { id: 'meme_pepe', name: 'Ếch Pepe khóc', url: '/memes/pepe.png' }
    ];

    this.virtualGifts = [
      { id: 'rose', name: 'Hoa Hồng', icon: '🌹', cost: 10, desc: 'Tặng cành hoa tươi thắm' },
      { id: 'boba', name: 'Trà Sữa', icon: '🧋', cost: 50, desc: 'Mời ly trà sữa full topping' },
      { id: 'popcorn_vip', name: 'Bắp Dát Vàng', icon: '🍿', cost: 100, desc: 'Bắp rang bơ hoàng gia' },
      { id: 'crown', name: 'Vương Miện', icon: '👑', cost: 200, desc: 'Tôn vinh rạp phim đỉnh chóp' },
      { id: 'rocket', name: 'Tên Lửa', icon: '🚀', cost: 500, desc: 'Bắn tên lửa rực sáng rạp phim' },
      { id: 'supercar', name: 'Siêu Xe', icon: '🏎️', cost: 1000, desc: 'Đại gia cập bến rạp VIP' }
    ];

    this.selectedRegAvatar = 'pixel_nerd';
    this.selectedProfileAvatar = 'pixel_nerd';
    this.selectedColor = '#f2cf78';
    this.pendingDeleteRoomId = null;

    this.catalog = { movies: [], categories: { genres: [], countries: [], years: [], tags: [] } };
    this.adminData = null;

    const urlParams = new URLSearchParams(window.location.search);
    this.requestedRoomFromUrl = urlParams.get('room') || null;
    this.currentRoomId = null;
    this.inLobby = true;
    this.roomsList = [];

    this.audioCtx = null;

    // Real-time Two-Way / Multi-User Voice Chat State
    this.isMicOn = false;
    this.voiceStream = null;
    this.voiceCaptureCtx = null;
    this.voiceSourceNode = null;
    this.voiceProcessor = null;
    this.voicePlayCtx = null;
    this.voiceNextPlayTime = new Map();
    this.activeSpeakers = new Map();
    this.lastVoiceSentAt = 0;

    // Unlock Web Audio playback context on first user interaction so incoming voice is always audible
    const unlockVoiceAudio = () => {
      if (this.voicePlayCtx && this.voicePlayCtx.state === 'suspended') {
        this.voicePlayCtx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockVoiceAudio, { passive: true });
    window.addEventListener('keydown', unlockVoiceAudio, { passive: true });

    // Start 3D scene paused in Lobby for 0% CPU/GPU usage
    this.cinema = new CinemaScene('canvas-container', 'css3d-container', true);
    this.player = new CinemaPlayer();

    this.cinema.onSeatClick = (seatId) => this.handleSeatSelection(seatId);
    this.cinema.onExitDoorClick = () => {
      this.leaveToLobby();
      this.showToast('🚪 Bạn đã đi qua Cửa Thoát Hiểm và quay về Sảnh Chờ!', 'info');
    };
    this.player.onDurationDiscovered = (id, dur) => this.reportDuration(id, dur);
    this.player.onAudioBlocked = () => this.showAudioBlockedBanner();

    // IMPORTANT: Do NOT auto-skip when video ends! Wait for Host to click "Chuyển tiếp"
    this.player.onVideoEnded = () => {
      this.updatePlayPauseButtonUI(false);
      if (this.canControlRoom()) {
        this.showToast('🎬 Video đã phát xong! Hãy bấm nút "Chuyển tiếp" để qua bài tiếp theo trong hàng chờ.', 'info');
      } else {
        this.showToast('🎬 Video đã kết thúc. Đang chờ Chủ phòng (Host) bấm "Chuyển tiếp"...', 'info');
      }
    };

    this.player.onPlaybackError = () => {
      if (this.canControlRoom()) {
        this.showToast('⚠️ Video này không hỗ trợ phát nhúng. Chủ phòng hãy bấm "Chuyển tiếp" sang bài kế nhé!', 'error');
      }
    };

    this.player.onStateToggled = (isPlaying, currentTime) => {
      if (!this.canControlRoom()) return;
      this.send('toggle-pause', { isPlaying, currentTime });
      this.updatePlayPauseButtonUI(isPlaying);
    };
    this.player.onSeekRequested = (time) => {
      if (!this.canControlRoom()) return;
      this.send('seek-video', { time });
    };
    this.player.onProgressUpdate = (cur, dur, percent) => {
      this.updatePlaybackBarUI(cur, dur, percent);
    };

    this.showLobbyUI();
    this.renderAvatarPickerGrids();
    this.initWebSocket();
    this.bindUIEvents();
    this.initHudAutoIdle();
    const savedQuality = localStorage.getItem('wetube_quality') || 'high';
    this.applyQualityLevel(savedQuality, false);
    this.refreshIcons();
  }

  initHudAutoIdle() {
    let idleTimer = null;
    const hideDelay = 2800; // 2.8 giây không di chuột sẽ tự động ẩn mượt các thanh điều khiển

    const wakeHud = () => {
      document.body.classList.remove('hud-autohide');
      clearTimeout(idleTimer);
      if (this.currentRoomId && !this.isHudHidden) {
        const isModalOpen = document.querySelector('.modal-backdrop:not(.hidden)');
        const isTyping = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
        if (!isModalOpen && !isTyping) {
          idleTimer = setTimeout(() => {
            document.body.classList.add('hud-autohide');
          }, hideDelay);
        }
      }
    };

    window.addEventListener('mousemove', wakeHud, { passive: true });
    window.addEventListener('mousedown', wakeHud, { passive: true });
    window.addEventListener('touchstart', wakeHud, { passive: true });
    window.addEventListener('keydown', wakeHud, { passive: true });

    const keepVisible = () => {
      document.body.classList.remove('hud-autohide');
      clearTimeout(idleTimer);
    };

    ['cinema-playback-bar', 'chat-drawer', 'utilities-popover'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('mouseenter', keepVisible);
      el?.addEventListener('mouseleave', wakeHud);
    });

    ['hud-bottom', 'hud-top'].forEach(cls => {
      const el = document.querySelector(`.${cls}`);
      el?.addEventListener('mouseenter', keepVisible);
      el?.addEventListener('mouseleave', wakeHud);
    });
  }

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  canControlRoom() {
    if (!this.you || !this.room) return false;
    return !!(this.room.canControl || this.you.role === 'admin' || this.you.isHost);
  }

  isLoggedIn() {
    return !!(this.you && this.you.username);
  }

  // --- Web Audio SFX ---
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    }
  }

  playPopSound() {
    this.initAudioContext();
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(840, this.audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch {}
  }

  playGiftSound() {
    this.initAudioContext();
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
    try {
      const now = this.audioCtx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.18, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      });
    } catch {}
  }

  // --- WebSocket Connection & Sync ---
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const tokenQuery = this.authToken ? `?token=${encodeURIComponent(this.authToken)}` : '';
    const wsUrl = `${protocol}//${window.location.host}/${tokenQuery}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.syncClock();
      if (this.authToken) {
        this.send('bind-auth', { token: this.authToken });
      }
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleServerMessage(msg);
    };

    this.ws.onclose = () => {
      setTimeout(() => this.initWebSocket(), 3000);
    };

    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.syncClock();
      }
    }, 15000);
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  syncClock() {
    this.send('ping', { clientTime: Date.now() });
  }

  handleServerMessage(msg) {
    const { type, payload, serverTime } = msg;

    if (serverTime) {
      this.clockOffset = serverTime - Date.now();
    }

    switch (type) {
      case 'pong': {
        if (payload?.clientTime) {
          const latency = (Date.now() - payload.clientTime) / 2;
          this.clockOffset = serverTime - (Date.now() - latency);
        }
        break;
      }

      case 'auth-error': {
        this.authToken = null;
        localStorage.removeItem('wetube_token');
        break;
      }

      case 'account-banned': {
        this.authToken = null;
        localStorage.removeItem('wetube_token');
        this.showToast(payload?.message || '🚫 Tài khoản đã bị khóa!', 'error');
        this.showLobbyUI();
        this.openAuthModal();
        break;
      }

      case 'require-login': {
        this.showToast(payload?.message || '🔑 Vui lòng đăng nhập tài khoản trước!', 'info');
        this.openAuthModal();
        break;
      }

      case 'room-password-prompt': {
        this.openRoomPasswordModal(payload.roomId, payload.roomName);
        break;
      }

      case 'room-password-error': {
        this.openRoomPasswordModal(payload.roomId, payload.roomName, payload.message);
        break;
      }

      case 'lobby-init': {
        this.inLobby = true;
        this.you = payload.you;
        this.currentRoomId = null;
        this.roomsList = payload.availableRooms || [];
        if (payload.catalog) {
          this.catalog = payload.catalog;
        }

        if (this.player) {
          this.player.pauseVideo();
        }

        this.showLobbyUI();
        this.updateProfileUI();
        this.renderLobbyRooms(this.roomsList);
        this.renderRoomsModal(this.roomsList);
        this.renderLobbyCatalog();

        // If user clicked a room before logging in, continue joining that room automatically
        if (this.isLoggedIn() && this.pendingJoinRoomId) {
          const nextRoomId = this.pendingJoinRoomId;
          const nextRoomPass = this.pendingJoinRoomPass;
          this.pendingJoinRoomId = null;
          this.pendingJoinRoomPass = null;
          this.attemptJoinRoom(nextRoomId, nextRoomPass);
        }
        break;
      }

      case 'init': {
        this.inLobby = false;
        this.you = payload.you;
        this.room = payload.room;
        this.currentRoomId = payload.room.roomId;
        if (payload.catalog) {
          this.catalog = payload.catalog;
        }

        this.closeModal('modal-room-pass');
        this.closeModal('modal-rooms');
        this.hideLobbyUI();

        const url = new URL(window.location.href);
        url.searchParams.set('room', this.currentRoomId);
        window.history.replaceState({}, '', url.toString());

        const roomBadgeText = document.getElementById('current-room-name');
        if (roomBadgeText) roomBadgeText.textContent = payload.room.roomName || 'Phòng 01';

        this.updateHostAndPermissionsUI();
        this.updateProfileUI();

        this.cinema.updateSeats(this.room.seats);
        this.cinema.updateStageUser(this.room.stageUser, this.room.realUsers, this.you.id);
        this.cinema.setPartyMode(this.room.partyMode);
        this.updatePartyModeUI(this.room.partyMode);
        this.cinema.setLightsOff(!!this.room.lightsOff);
        this.updateLightsModeUI(!!this.room.lightsOff);

        this.player.syncVideo(this.room.currentVideo, this.clockOffset);
        this.updateNowPlayingUI();
        this.updateOccupancyUI();
        this.renderSeatMapModal();
        this.renderQueueModal();

        if (payload.room && payload.room.currentPoll) {
          this.currentPoll = payload.room.currentPoll;
          this.renderPollOverlay(this.currentPoll);
        } else {
          this.hidePollOverlay();
        }

        if (payload.you && payload.you.coins !== undefined) {
          this.you.coins = payload.you.coins;
          this.updateCoinsUI();
        }

        if (payload.availableRooms) {
          this.roomsList = payload.availableRooms;
          this.renderRoomsModal(payload.availableRooms);
          this.renderLobbyRooms(payload.availableRooms);
        }

        const chatFeed = document.getElementById('chat-feed');
        if (chatFeed) {
          chatFeed.innerHTML = `
            <div class="chat-welcome">
              <div class="welcome-icon">🍿</div>
              <p>Phòng <strong>${this.room.roomName}</strong> · Host: <strong>${this.room.hostName}</strong></p>
            </div>
          `;
        }

        if (payload.recentMessages && Array.isArray(payload.recentMessages)) {
          payload.recentMessages.forEach((m) => this.appendChatMessage(m, false));
        }

        this.stopVoiceCapture(false);
        this.updateVoiceSpeakersPill();
        break;
      }

      case 'rooms-list-updated': {
        this.roomsList = payload.rooms || [];
        this.renderRoomsModal(this.roomsList);
        this.renderLobbyRooms(this.roomsList);
        break;
      }

      case 'catalog-updated': {
        this.catalog = payload || this.catalog;
        this.renderLobbyCatalog();
        this.renderQueueModal();
        break;
      }

      case 'profile-updated': {
        this.you = payload;
        if (this.room) {
          this.room.canControl = !!(this.you.role === 'admin' || this.you.isHost);
        }
        this.updateProfileUI();
        this.updateHostAndPermissionsUI();
        break;
      }

      case 'seat-state': {
        if (!this.room) break;
        this.room.seats = payload.seats;
        if (payload.stageUser !== undefined) this.room.stageUser = payload.stageUser;
        if (payload.movedUser && payload.movedUser.id === this.you.id) {
          this.you.seatId = payload.movedUser.seatId;
        }

        this.cinema.updateSeats(this.room.seats);
        this.renderSeatMapModal();
        this.updateOccupancyUI();
        this.updateProfileUI();
        break;
      }

      case 'stage-state': {
        if (!this.room) break;
        this.room.stageUser = payload.stageUser;
        if (payload.seats) {
          this.room.seats = payload.seats;
          this.cinema.updateSeats(this.room.seats);
          this.renderSeatMapModal();
          this.updateOccupancyUI();
        }
        if (payload.stageUser === this.you.id) {
          this.you.seatId = null;
          this.updateProfileUI();
        }

        this.cinema.updateStageUser(this.room.stageUser, this.room.realUsers || [], this.you.id);
        this.updateStageButtonUI();
        break;
      }

      case 'video-changed': {
        if (!this.room) break;
        this.room.currentVideo = payload.currentVideo;
        this.room.queue = payload.queue;

        this.player.syncVideo(this.room.currentVideo, this.clockOffset);
        this.updateNowPlayingUI();
        this.renderQueueModal();
        break;
      }

      case 'playback-sync': {
        if (this.room && this.room.currentVideo) {
          this.room.currentVideo.isPlaying = payload.isPlaying;
          this.room.currentVideo.pausedAt = payload.currentTime;
          if (payload.startedAt) {
            this.room.currentVideo.startedAt = payload.startedAt;
          }
        }
        const isSelfEcho = !!(payload.senderId && this.you && payload.senderId === this.you.id);
        this.player.applyPlaybackSync(payload, isSelfEcho);
        this.updatePlayPauseButtonUI(payload.isPlaying);
        break;
      }

      case 'queue-updated': {
        if (!this.room) break;
        this.room.queue = payload.queue;
        this.renderQueueModal();
        break;
      }

      case 'chat-message': {
        this.appendChatMessage(payload, true);
        if (this.room) {
          this.cinema.showSpeechBubble(
            payload.userId,
            payload.text,
            payload.seatId,
            this.room.stageUser === payload.userId
          );
        }
        break;
      }

      case 'chat-message-deleted': {
        const msgEl = document.querySelector(`[data-chat-id="${payload?.messageId}"]`);
        if (msgEl) msgEl.remove();
        break;
      }

      case 'emoji-reaction': {
        this.cinema.spawnEmojiReaction(payload.emoji, payload.seatId, payload.isOnStage, payload.isVip);
        this.playPopSound();
        break;
      }

      case 'poll-updated': {
        this.currentPoll = payload.poll;
        this.renderPollOverlay(this.currentPoll);
        break;
      }

      case 'gift-broadcast': {
        this.showGiftCelebration(payload);
        break;
      }

      case 'coins-updated': {
        if (this.you) {
          this.you.coins = payload.coins;
          this.updateCoinsUI();
        }
        break;
      }

      case 'room-announcement': {
        const banner = document.getElementById('room-announcement-banner');
        const sender = document.getElementById('announcement-sender');
        const text = document.getElementById('announcement-text');
        if (banner && text) {
          if (sender) sender.textContent = payload.senderName || 'Chủ phòng';
          text.textContent = payload.text || '';
          banner.classList.remove('hidden');
          this.playPopSound();
          setTimeout(() => banner.classList.add('hidden'), 8000);
        }
        break;
      }

      case 'chat-cleared': {
        const feed = document.getElementById('chat-feed');
        if (feed) {
          feed.innerHTML = `<div class="chat-welcome">🧹 Chat đã được dọn sạch bởi Chủ phòng/Admin.</div>`;
        }
        break;
      }

      case 'user-interaction-event': {
        this.playPopSound();
        this.showToast(payload.text, 'info');
        if (this.cinema) {
          this.cinema.spawnDomFloatingEmoji(payload.emoji, false);
          if (typeof payload.targetSeatId === 'number' && payload.targetSeatId !== null) {
            this.cinema.spawnEmojiReaction(payload.emoji, payload.targetSeatId, false);
          }
        }
        break;
      }

      case 'force-mic-off': {
        this.toggleVoiceMic(false);
        break;
      }

      case 'kicked-from-room': {
        this.showToast(payload.message || '🚪 Bạn đã bị mời ra khỏi phòng chiếu!', 'warning');
        this.showLobbyUI();
        break;
      }

      case 'room-info-updated': {
        if (this.room && payload.room) {
          if (payload.room.name) this.room.roomName = payload.room.name;
          if (payload.room.createdBy) this.room.hostName = payload.room.createdBy;
          if (payload.room.hostId) this.room.hostId = payload.room.hostId;
          const roomBadgeText = document.getElementById('current-room-name');
          if (roomBadgeText) roomBadgeText.textContent = payload.room.name;
          this.updateHostAndPermissionsUI();
        }
        break;
      }

      case 'screen-post-started': {
        if (this.room) this.room.screenPost = payload.screenPost;
        this.showScreenPostOverlay(payload.screenPost);
        break;
      }

      case 'screen-post-ended': {
        if (this.room) this.room.screenPost = null;
        this.hideScreenPostOverlay();
        break;
      }

      case 'party-mode-toggled': {
        if (this.room) this.room.partyMode = payload.partyMode;
        this.cinema.setPartyMode(payload.partyMode);
        this.updatePartyModeUI(payload.partyMode);
        break;
      }

      case 'lights-mode-toggled': {
        if (this.room) this.room.lightsOff = !!payload.lightsOff;
        this.cinema.setLightsOff(!!payload.lightsOff);
        this.updateLightsModeUI(!!payload.lightsOff);
        break;
      }

      case 'user-joined': {
        if (!this.room) break;
        this.room.onlineCount = payload.onlineCount;
        this.room.seats = payload.seats;
        if (payload.user) {
          this.room.realUsers = this.room.realUsers || [];
          const idx = this.room.realUsers.findIndex(u => u.id === payload.user.id);
          if (idx === -1) this.room.realUsers.push(payload.user);
          else this.room.realUsers[idx] = payload.user;
        }
        this.updateOccupancyUI();
        break;
      }

      case 'user-left': {
        if (!this.room) break;
        this.room.onlineCount = payload.onlineCount;
        this.room.seats = payload.seats;
        if (payload.userId) {
          this.activeSpeakers.delete(payload.userId);
          this.voiceNextPlayTime.delete(payload.userId);
          if (Array.isArray(this.room.realUsers)) {
            this.room.realUsers = this.room.realUsers.filter(u => u.id !== payload.userId);
          }
        }
        this.cinema.updateSeats(this.room.seats);
        this.renderSeatMapModal();
        this.updateOccupancyUI();
        this.updateVoiceSpeakersPill();
        break;
      }

      case 'voice-state-changed': {
        if (!this.room) break;
        if (payload.seats) {
          this.room.seats = payload.seats;
          this.cinema.updateSeats(this.room.seats);
          this.renderSeatMapModal();
        }
        if (Array.isArray(this.room.realUsers)) {
          const u = this.room.realUsers.find(x => x.id === payload.userId);
          if (u) u.micOn = !!payload.micOn;
          else if (payload.userId && payload.name) {
            this.room.realUsers.push({
              id: payload.userId,
              name: payload.name,
              color: payload.color,
              seatId: payload.seatId,
              micOn: !!payload.micOn
            });
          }
        }
        if (!payload.micOn && payload.userId) {
          this.activeSpeakers.delete(payload.userId);
          this.voiceNextPlayTime.delete(payload.userId);
        }
        this.updateVoiceSpeakersPill();
        break;
      }

      case 'voice-chunk': {
        if (!this.room || this.inLobby) break;
        this.handleIncomingVoiceChunk(payload);
        break;
      }

      case 'admin-data': {
        this.adminData = payload;
        this.renderAdminDashboard();
        break;
      }

      case 'notification': {
        this.showToast(payload.message, payload.type || 'info');
        break;
      }
    }
  }

  // --- Host & Screen Control Permissions UI ---
  updateHostAndPermissionsUI() {
    const canControl = this.canControlRoom();
    this.player.canControl = canControl;

    const hostNameEl = document.getElementById('hud-host-name');
    if (hostNameEl && this.room) {
      hostNameEl.textContent = canControl
        ? `Chủ phòng`
        : `Host: ${this.room.hostName}`;
    }

    const passTag = document.getElementById('hud-room-pass-tag');
    if (passTag) {
      if (canControl && this.room?.roomPassword) {
        passTag.textContent = `Pass: ${this.room.roomPassword}`;
        passTag.classList.remove('hidden');
      } else {
        passTag.classList.add('hidden');
      }
    }

    // Lock or unlock playback bar buttons for viewers
    const hostBtns = document.getElementById('host-playback-btns');
    const scrubber = document.getElementById('playback-scrubber');
    const hostNotice = document.getElementById('playback-host-notice');
    const btnSkipBottom = document.getElementById('btn-skip-vote');
    const btnPhotoBottom = document.getElementById('btn-open-photo');
    const btnPartyTop = document.getElementById('btn-toggle-party');
    const btnForceSkip = document.getElementById('btn-force-skip');
    const btnStopCurrent = document.getElementById('btn-stop-current');
    const btnBarStop = document.getElementById('btn-bar-stop');
    const formAddVideo = document.getElementById('form-add-video');

    if (hostBtns) hostBtns.classList.toggle('playback-disabled', !canControl);
    if (scrubber) scrubber.disabled = !canControl;
    if (hostNotice) hostNotice.classList.toggle('hidden', canControl);
    if (btnSkipBottom) btnSkipBottom.classList.toggle('playback-disabled', !canControl);
    if (btnPhotoBottom) btnPhotoBottom.classList.toggle('playback-disabled', !canControl);
    if (btnPartyTop) btnPartyTop.classList.toggle('playback-disabled', !canControl);
    if (btnForceSkip) btnForceSkip.classList.toggle('hidden', !canControl);
    if (btnStopCurrent) btnStopCurrent.classList.toggle('hidden', !canControl || !this.room?.currentVideo);
    if (btnBarStop) btnBarStop.classList.toggle('hidden', !canControl);
    if (formAddVideo) formAddVideo.classList.toggle('playback-disabled', !canControl);

    // Update Room Manager Button in Top HUD for Host & Admin
    const rmBtn = document.getElementById('btn-hud-room-manager');
    if (rmBtn) {
      rmBtn.classList.toggle('hidden', !canControl);
      const rmLabel = document.getElementById('label-hud-manager');
      const rmIcon = document.getElementById('icon-hud-manager');
      if (this.you && this.you.role === 'admin') {
        if (rmLabel) rmLabel.textContent = 'Admin';
        if (rmIcon) rmIcon.setAttribute('data-lucide', 'shield-check');
      } else {
        if (rmLabel) rmLabel.textContent = 'Chủ phòng';
        if (rmIcon) rmIcon.setAttribute('data-lucide', 'crown');
      }
      this.refreshIcons();
    }
  }

  // --- Pixel Art Avatar Grids ---
  renderAvatarPickerGrids() {
    if (!window.PixelAvatars) return;
    const templates = window.PixelAvatars.templates;

    const renderGrid = (containerId, currentSelected, onSelect) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = templates.map((t) => {
        const isSel = t.id === currentSelected;
        const imgUrl = window.PixelAvatars.getDataUrl(t.id, 4);
        return `
          <div class="pixel-avatar-card ${isSel ? 'selected' : ''}" data-avatar-id="${t.id}" title="${t.desc}">
            <img src="${imgUrl}" alt="${t.name}" />
            <span class="av-name">${t.name}</span>
            <span class="av-badge">${t.badge}</span>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.pixel-avatar-card').forEach((card) => {
        card.addEventListener('click', () => {
          const avId = card.getAttribute('data-avatar-id');
          onSelect(avId);
          renderGrid(containerId, avId, onSelect);
        });
      });
    };

    renderGrid('reg-avatar-grid', this.selectedRegAvatar, (avId) => {
      this.selectedRegAvatar = avId;
    });

    renderGrid('profile-avatar-grid', this.selectedProfileAvatar, (avId) => {
      this.selectedProfileAvatar = avId;
      const previewImg = document.getElementById('account-preview-img');
      if (previewImg && window.PixelAvatars) {
        previewImg.src = window.PixelAvatars.getDataUrl(avId, 5);
      }
    });
  }

  // --- Grand Lobby UI Management ---
  showLobbyUI() {
    this.inLobby = true;
    document.body.classList.add('in-lobby');
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.classList.remove('hidden');

    if (this.cinema) {
      this.cinema.pause();
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);

    this.updateProfileUI();
    this.refreshIcons();
  }

  hideLobbyUI() {
    this.inLobby = false;
    document.body.classList.remove('in-lobby');
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.classList.add('hidden');

    if (this.cinema) {
      this.cinema.resume();
    }
    this.refreshIcons();
  }

  leaveToLobby() {
    this.stopVoiceCapture(true);
    this.activeSpeakers.clear();
    this.voiceNextPlayTime.clear();
    this.updateVoiceSpeakersPill();
    this.currentRoomId = null;
    this.room = null;
    this.send('leave-to-lobby', {});
    this.showLobbyUI();
    if (this.player) {
      this.player.pauseVideo();
    }
    this.closeModal('modal-rooms');
    this.renderLobbyRooms(this.roomsList);
    this.renderRoomsModal(this.roomsList);
  }

  // --- Room Password Prompt ---
  openRoomPasswordModal(roomId, roomName, errorMsg = '') {
    const idInput = document.getElementById('pass-modal-room-id');
    const nameEl = document.getElementById('pass-modal-room-name');
    const passInput = document.getElementById('pass-modal-input');
    const errEl = document.getElementById('pass-modal-error');

    if (idInput) idInput.value = roomId;
    if (nameEl) nameEl.textContent = roomName || roomId;
    if (passInput) passInput.value = '';
    if (errEl) {
      if (errorMsg) {
        errEl.textContent = errorMsg;
        errEl.classList.remove('hidden');
      } else {
        errEl.classList.add('hidden');
      }
    }

    this.openModal('modal-room-pass');
    setTimeout(() => passInput?.focus(), 80);
  }

  attemptJoinRoom(roomId, providedPassword = null) {
    if (!roomId) return;
    if (!this.isLoggedIn()) {
      this.pendingJoinRoomId = roomId;
      this.pendingJoinRoomPass = providedPassword;
      this.showToast('🔑 Vui lòng Đăng nhập hoặc Đăng ký tài khoản để vào phòng chiếu!', 'info');
      this.openAuthModal();
      return;
    }

    const roomInfo = this.roomsList.find(r => r.id === roomId);
    if (providedPassword) {
      this.send('join-room', { roomId, password: providedPassword });
      return;
    }

    if (roomInfo && roomInfo.hasPassword && !roomInfo.canSkipPassword) {
      this.openRoomPasswordModal(roomInfo.id, roomInfo.name);
      return;
    }

    this.send('join-room', { roomId });
  }

  renderLobbyRooms(roomsList) {
    if (!Array.isArray(roomsList)) return;

    const countPill = document.getElementById('lobby-rooms-count-pill');
    if (countPill) countPill.textContent = `${roomsList.length}/5 phòng`;

    const activeCountTag = document.getElementById('lobby-active-count-tag');
    if (activeCountTag) countPill && (activeCountTag.textContent = `${roomsList.length} phòng`);

    // Populate Quick Join Room Select in Lobby
    const quickJoinCard = document.getElementById('lobby-quick-join-card');
    if (quickJoinCard) {
      quickJoinCard.classList.toggle('hidden', roomsList.length === 0);
    }
    const quickSelect = document.getElementById('lobby-quick-room-select');
    const quickPassInput = document.getElementById('lobby-quick-room-pass');
    if (quickSelect) {
      const prevVal = quickSelect.value;
      quickSelect.innerHTML = `<option value="" style="background:#11131a;">-- Chọn phòng --</option>` +
        roomsList.map(r => `<option value="${r.id}" data-skip="${r.canSkipPassword ? '1' : '0'}" style="background:#11131a;">🎬 ${r.name} (${r.seatedCount}/10 ghế)</option>`).join('');
      if (prevVal && roomsList.some(r => r.id === prevVal)) {
        quickSelect.value = prevVal;
      } else if (roomsList.length > 0) {
        quickSelect.value = roomsList[0].id;
      }
      const selectedRoom = roomsList.find(r => r.id === quickSelect.value);
      if (quickPassInput) {
        if (selectedRoom && selectedRoom.canSkipPassword) {
          quickPassInput.placeholder = 'Không cần mật khẩu';
          quickPassInput.required = false;
        } else {
          quickPassInput.placeholder = 'Mật khẩu phòng...';
          quickPassInput.required = true;
        }
      }
    }

    const createBadge = document.getElementById('lobby-create-badge');
    const inputCreate = document.getElementById('lobby-create-room-input');
    const inputPass = document.getElementById('lobby-create-room-pass');
    const btnSubmit = document.getElementById('btn-lobby-submit-create');
    const isMax = roomsList.length >= 5;

    if (createBadge) createBadge.textContent = `${roomsList.length}/5 phòng`;
    if (inputCreate && btnSubmit) {
      inputCreate.disabled = isMax;
      if (inputPass) inputPass.disabled = isMax;
      btnSubmit.disabled = isMax;
    }

    const emptyBox = document.getElementById('lobby-empty-rooms');
    const grid = document.getElementById('lobby-rooms-grid');
    if (!grid) return;

    if (roomsList.length === 0) {
      grid.innerHTML = '';
      if (emptyBox) emptyBox.classList.remove('hidden');
      return;
    }

    if (emptyBox) emptyBox.classList.add('hidden');

    grid.innerHTML = roomsList.map((r) => {
      const isCurrent = !this.inLobby && this.currentRoomId && r.id === this.currentRoomId;
      const passBadge = r.roomPassword
        ? `<span style="color:#f2cf78; font-weight:700;">🔑 Pass: ${r.roomPassword}</span>`
        : `<span style="color:#fca5a5;">🔒 Có mật khẩu</span>`;

      return `
        <div class="room-card ${isCurrent ? 'active' : ''}">
          <div class="room-card-head">
            <span class="room-card-title">${r.name}</span>
            <span class="room-card-occupancy">
              <i data-lucide="users" style="width: 14px; height: 14px;"></i>
              ${r.seatedCount}/10 ghế
            </span>
          </div>
          <div class="room-card-body">
            <img class="room-card-thumb" src="${r.currentVideoThumb || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'}" alt="Thumb" />
            <div class="room-card-info">
              <div class="room-card-np" title="${r.currentVideoTitle}">${r.currentVideoTitle}</div>
              <small style="color: #9ca3af; font-size: 11px;">👑 Host: <strong>${r.createdBy}</strong> · ${passBadge}</small>
            </div>
          </div>
          <div class="room-card-actions">
            <button class="room-card-btn" data-lobby-join="${r.id}">
              <i data-lucide="log-in" style="width: 14px; height: 14px;"></i>
              <span>Vào phòng</span>
            </button>
            ${r.canSkipPassword ? `
              <button class="room-delete-btn" data-lobby-delete="${r.id}" data-room-name="${r.name}" title="Xoá phòng này">
                <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-lobby-join]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-lobby-join');
        this.attemptJoinRoom(roomId);
      });
    });

    grid.querySelectorAll('[data-lobby-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.getAttribute('data-lobby-delete');
        const roomName = btn.getAttribute('data-room-name') || 'phòng này';
        this.promptDeleteRoom(roomId, roomName);
      });
    });

    this.refreshIcons();
  }

  renderLobbyCatalog() {
    const grid = document.getElementById('lobby-catalog-grid');
    const countTag = document.getElementById('lobby-catalog-count-tag');
    const movies = this.catalog?.movies || [];
    if (countTag) countTag.textContent = `${movies.length} bộ phim`;
    if (!grid) return;

    grid.innerHTML = movies.map((m) => `
      <div class="catalog-movie-card">
        <div class="catalog-movie-poster">
          <img src="${m.poster}" alt="${m.title}" />
          ${m.isVipOnly ? `<span class="catalog-vip-ribbon">👑 VIP EXCLUSIVE</span>` : ''}
        </div>
        <div class="catalog-movie-body">
          <div class="catalog-movie-title">${m.title}</div>
          <div class="catalog-movie-meta">${m.genre} · ${m.country} · ${m.year} · 👁️ ${m.views || 0} lượt xem</div>
          <p class="catalog-movie-desc">${m.description || ''}</p>
        </div>
      </div>
    `).join('');
  }

  renderRoomsModal(roomsList) {
    if (!Array.isArray(roomsList)) return;

    const countBadge = document.getElementById('rooms-count-badge');
    if (countBadge) countBadge.textContent = `${roomsList.length} / 5 phòng`;

    const grid = document.getElementById('rooms-grid');
    if (!grid) return;

    grid.innerHTML = roomsList.map((r) => {
      const isCurrent = !this.inLobby && r.id === this.currentRoomId;
      const passInfo = r.roomPassword ? `🔑 Pass: ${r.roomPassword}` : '🔒 Có mật khẩu';
      return `
        <div class="room-card ${isCurrent ? 'active' : ''}">
          <div class="room-card-head">
            <span class="room-card-title">${r.name}</span>
            <span class="room-card-occupancy">${r.seatedCount}/10 ghế</span>
          </div>
          <div class="room-card-body">
            <img class="room-card-thumb" src="${r.currentVideoThumb || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'}" alt="Thumb" />
            <div class="room-card-info">
              <div class="room-card-np">${r.currentVideoTitle}</div>
              <small style="color: #9ca3af; font-size: 11px;">👑 Host: ${r.createdBy} · ${passInfo}</small>
            </div>
          </div>
          <div class="room-card-actions">
            ${isCurrent ? `
              <button class="room-card-btn" data-out-room="${r.id}" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5;">
                <span>🚪 Rời phòng</span>
              </button>
            ` : `
              <button class="room-card-btn" data-join-room="${r.id}">
                <span>🚪 Vào phòng</span>
              </button>
            `}
            ${r.canSkipPassword ? `
              <button class="room-delete-btn" data-delete-room="${r.id}" data-room-name="${r.name}">
                <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('[data-join-room]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-join-room');
        if (roomId) {
          this.attemptJoinRoom(roomId);
        }
      });
    });

    grid.querySelectorAll('[data-out-room]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.leaveToLobby();
      });
    });

    grid.querySelectorAll('[data-delete-room]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptDeleteRoom(btn.getAttribute('data-delete-room'), btn.getAttribute('data-room-name'));
      });
    });

    this.refreshIcons();
  }

  promptDeleteRoom(roomId, roomName) {
    this.pendingDeleteRoomId = roomId;
    const targetNameEl = document.getElementById('delete-room-target-name');
    if (targetNameEl) targetNameEl.textContent = `"${roomName}"`;
    this.openModal('modal-confirm-delete');
  }

  // --- Auth & Account Modal UI ---
  openAuthModal() {
    this.updateProfileUI();
    this.openModal('modal-profile');
  }

  updateProfileUI() {
    if (!this.you) return;

    const avId = this.you.avatarId || 'pixel_nerd';
    this.selectedProfileAvatar = avId;
    this.selectedColor = this.you.color || '#f2cf78';

    const avatarDataUrl = window.PixelAvatars ? window.PixelAvatars.getDataUrl(avId, 4) : '';

    // Update Lobby Header Pill
    const lobbyAvImg = document.getElementById('lobby-user-avatar-img');
    const lobbyName = document.getElementById('lobby-user-name');
    const lobbyRoleTag = document.getElementById('lobby-user-role-tag');
    if (lobbyAvImg && avatarDataUrl) lobbyAvImg.src = avatarDataUrl;
    if (lobbyName) {
      lobbyName.textContent = this.isLoggedIn() ? this.you.name : 'Đăng nhập';
    }
    if (lobbyRoleTag) {
      lobbyRoleTag.className = 'role-mini-tag';
      if (this.you.role === 'admin') {
        lobbyRoleTag.textContent = '🛡️ Admin';
        lobbyRoleTag.classList.add('admin');
      } else if (this.you.isVip) {
        lobbyRoleTag.textContent = '👑 VIP';
        lobbyRoleTag.classList.add('vip');
      } else if (this.isLoggedIn()) {
        lobbyRoleTag.textContent = 'Thành viên';
      } else {
        lobbyRoleTag.textContent = 'Khách';
      }
    }

    // Show/Hide Admin Buttons (Strictly ONLY for Admin)
    const isAdmin = this.you.role === 'admin';
    const btnLobbyAdmin = document.getElementById('btn-lobby-admin');
    const btnHudAdmin = document.getElementById('btn-hud-admin');
    if (btnLobbyAdmin) btnLobbyAdmin.classList.toggle('hidden', !isAdmin);
    if (btnHudAdmin) btnHudAdmin.classList.toggle('hidden', !isAdmin);

    // Update Bottom HUD Profile Button
    const hudAvImg = document.getElementById('hud-user-avatar-img');
    const hudName = document.getElementById('user-display-name');
    if (hudAvImg && avatarDataUrl) hudAvImg.src = avatarDataUrl;
    if (hudName) hudName.textContent = this.you.name;

    // Update Seat Button
    const seatBtnText = document.getElementById('my-seat-status');
    if (seatBtnText) {
      if (this.you.seatId !== null && this.room?.seatLabels) {
        seatBtnText.textContent = `Ghế ${this.room.seatLabels[this.you.seatId]}`;
      } else {
        seatBtnText.textContent = 'Chọn ghế';
      }
    }

    // Toggle Guest vs Logged-in view inside #modal-profile
    const guestSec = document.getElementById('auth-guest-section');
    const userSec = document.getElementById('auth-user-section');
    if (this.isLoggedIn()) {
      if (guestSec) guestSec.classList.add('hidden');
      if (userSec) userSec.classList.remove('hidden');

      const previewImg = document.getElementById('account-preview-img');
      const infoName = document.getElementById('account-info-name');
      const infoUser = document.getElementById('account-info-username');
      const infoBadge = document.getElementById('account-info-badge');
      const nameInput = document.getElementById('profile-name-input');

      if (previewImg && window.PixelAvatars) previewImg.src = window.PixelAvatars.getDataUrl(avId, 5);
      if (infoName) infoName.textContent = this.you.name;
      if (infoUser) infoUser.textContent = `@${this.you.username}`;
      if (nameInput) nameInput.value = this.you.name;

      if (infoBadge) {
        infoBadge.className = 'role-badge';
        if (this.you.role === 'admin') {
          infoBadge.textContent = '🛡️ QUẢN TRỊ VIÊN (ADMIN)';
          infoBadge.classList.add('admin');
        } else if (this.you.isVip) {
          infoBadge.textContent = '👑 THÀNH VIÊN VIP';
          infoBadge.classList.add('vip');
        } else {
          infoBadge.textContent = 'THÀNH VIÊN';
        }
      }

      // Update VIP Perks Card Status
      const vipBtn = document.getElementById('btn-claim-vip-status');
      const vipLabel = document.getElementById('btn-claim-vip-label');
      const vipHeading = document.getElementById('vip-card-heading');
      if (this.you.isVip || this.you.role === 'admin') {
        if (vipLabel) vipLabel.textContent = '✅ Đang Là VIP Hoàng Gia';
        if (vipHeading) vipHeading.textContent = '👑 Đặc Quyền VIP (Đang Kích Hoạt)';
        if (vipBtn) {
          vipBtn.classList.add('is-active');
          vipBtn.disabled = true;
        }
      } else {
        if (vipLabel) vipLabel.textContent = '👑 Mở Khóa VIP Ngay';
        if (vipHeading) vipHeading.textContent = '🌟 Nâng Cấp Thành Viên VIP';
        if (vipBtn) {
          vipBtn.classList.remove('is-active');
          vipBtn.disabled = false;
        }
      }

      this.renderAvatarPickerGrids();
    } else {
      if (guestSec) guestSec.classList.remove('hidden');
      if (userSec) userSec.classList.add('hidden');
    }
  }

  // --- UI Event Bindings ---
  bindUIEvents() {
    // 1. Camera Mode Buttons (Toàn cảnh, Màn hình, Khán giả)
    document.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-camera');
        if (this.cinema) {
          this.cinema.setCameraMode(mode, this.you ? this.you.seatId : null);
        }
      });
    });

    // 2. Tiện ích Menu Dropdown (Gom Chiếu ảnh, Tặng quà, Bình chọn, Đèn, Tiết kiệm 4G, Ẩn giao diện)
    const btnUtil = document.getElementById('btn-toggle-utilities');
    const utilPopover = document.getElementById('utilities-popover');
    btnUtil?.addEventListener('click', (e) => {
      e.stopPropagation();
      utilPopover?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (utilPopover && !utilPopover.contains(e.target) && e.target !== btnUtil && !btnUtil?.contains(e.target)) {
        utilPopover.classList.add('hidden');
      }
    });

    document.getElementById('btn-util-photo')?.addEventListener('click', () => {
      utilPopover?.classList.add('hidden');
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được chiếu ảnh lên màn hình!', 'error');
        return;
      }
      this.openModal('modal-photo');
    });

    document.getElementById('btn-util-gifts')?.addEventListener('click', () => {
      utilPopover?.classList.add('hidden');
      this.openGiftModal();
    });

    document.getElementById('btn-util-poll')?.addEventListener('click', () => {
      utilPopover?.classList.add('hidden');
      this.openPollModal();
    });

    document.getElementById('btn-util-lights')?.addEventListener('click', () => {
      const nextLightsOff = !(this.cinema && this.cinema.lightsOff);
      if (this.cinema) this.cinema.setLightsOff(nextLightsOff);
      this.updateLightsModeUI(nextLightsOff);
      if (this.canControlRoom()) this.send('toggle-lights');
      const lbl = document.getElementById('label-util-lights');
      if (lbl) lbl.textContent = nextLightsOff ? 'Bật đèn' : 'Tắt đèn';
    });

    document.getElementById('btn-util-party')?.addEventListener('click', () => {
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được bật/tắt đèn tiệc!', 'error');
        return;
      }
      this.send('toggle-party');
    });

    document.getElementById('btn-util-clean-hud')?.addEventListener('click', () => {
      utilPopover?.classList.add('hidden');
      this.toggleHudVisibility();
    });

    document.getElementById('btn-util-help')?.addEventListener('click', () => {
      utilPopover?.classList.add('hidden');
      this.openModal('modal-help');
    });

    document.getElementById('btn-claim-vip-status')?.addEventListener('click', () => {
      this.send('claim-vip');
    });

    // 3. Screen Click to Unmute
    const screenIdle = document.getElementById('screen-idle');
    if (screenIdle) {
      screenIdle.addEventListener('click', () => {
        this.player.unmuteWithGesture();
      });
    }

    // 4. Playback Bar Controls (Strictly Host / Admin)
    const btnPlayPause = document.getElementById('btn-play-pause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        if (!this.canControlRoom()) {
          this.showToast('🔒 Chỉ Chủ phòng (Host) mới được Tạm dừng / Phát màn hình!', 'error');
          return;
        }
        const isPlaying = this.player.togglePlayPause();
        this.updatePlayPauseButtonUI(isPlaying);
      });
    }

    const btnRewind = document.getElementById('btn-rewind');
    if (btnRewind) {
      btnRewind.addEventListener('click', () => {
        if (!this.canControlRoom()) return;
        this.player.rewind(10);
      });
    }

    const btnForward = document.getElementById('btn-forward');
    if (btnForward) {
      btnForward.addEventListener('click', () => {
        if (!this.canControlRoom()) return;
        this.player.fastForward(10);
      });
    }

    const triggerManualNext = () => {
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được bấm Chuyển tiếp video!', 'error');
        return;
      }
      this.send('skip-now', {});
    };

    document.getElementById('btn-bar-next')?.addEventListener('click', triggerManualNext);
    document.getElementById('btn-skip-vote')?.addEventListener('click', triggerManualNext);
    document.getElementById('btn-force-skip')?.addEventListener('click', triggerManualNext);
    document.getElementById('btn-player-retry')?.addEventListener('click', triggerManualNext);

    const triggerStopVideo = () => {
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được tắt video đang chiếu trên màn hình!', 'error');
        return;
      }
      this.send('stop-video', {});
    };

    document.getElementById('btn-stop-current')?.addEventListener('click', triggerStopVideo);
    document.getElementById('btn-bar-stop')?.addEventListener('click', triggerStopVideo);

    const scrubber = document.getElementById('playback-scrubber');
    if (scrubber) {
      let lastLiveScrubAt = 0;
      scrubber.addEventListener('input', (e) => {
        if (!this.canControlRoom()) return;
        this.player.isSeeking = true;
        const pct = parseFloat(e.target.value) || 0;
        const fill = document.getElementById('scrubber-fill');
        if (fill) fill.style.width = `${pct}%`;

        const dur = this.player.duration
          || (this.player.isReady && this.player.player && typeof this.player.player.getDuration === 'function' ? this.player.player.getDuration() : 0)
          || (this.room?.currentVideo?.duration)
          || 0;
        if (dur > 0) {
          const targetSec = (pct / 100) * dur;
          const curEl = document.getElementById('playback-current-time');
          if (curEl) curEl.textContent = this.formatTime(targetSec);

          const now = Date.now();
          if (now - lastLiveScrubAt > 160) {
            lastLiveScrubAt = now;
            this.player.seekTo(targetSec, false);
          }
        }
      });

      scrubber.addEventListener('change', (e) => {
        if (!this.canControlRoom()) return;
        const pct = parseFloat(e.target.value) || 0;
        const dur = this.player.duration
          || (this.player.isReady && this.player.player && typeof this.player.player.getDuration === 'function' ? this.player.player.getDuration() : 0)
          || (this.room?.currentVideo?.duration)
          || 0;
        this.player.isSeeking = false;
        if (dur > 0) {
          this.player.seekTo((pct / 100) * dur, true);
        }
      });
    }

    // 5. Auto-Hide HUD
    document.getElementById('btn-toggle-hud')?.addEventListener('click', () => this.toggleHudVisibility());
    document.getElementById('btn-hud-quick-toggle')?.addEventListener('click', () => this.toggleHudVisibility());
    document.getElementById('btn-show-hud')?.addEventListener('click', () => this.toggleHudVisibility(false));

    // 6. Invite Link + Room Password Copy
    const copyInviteLink = () => {
      const url = new URL(window.location.href);
      if (this.currentRoomId) url.searchParams.set('room', this.currentRoomId);
      const passStr = this.room?.roomPassword ? ` | Mật khẩu phòng: ${this.room.roomPassword}` : '';
      const copyText = `${url.toString()}${passStr}`;
      navigator.clipboard?.writeText(copyText).then(() => {
        this.showToast(`📋 Đã sao chép Link phòng${passStr}! Hãy gửi cho bạn bè nhé.`, 'success');
      }).catch(() => {
        this.showToast(`Link: ${copyText}`, 'info');
      });
    };
    document.getElementById('btn-copy-invite')?.addEventListener('click', copyInviteLink);
    document.getElementById('btn-modal-copy-invite')?.addEventListener('click', copyInviteLink);

    // 7. Create Room in Lobby & Modal (With Password)
    const formLobbyCreate = document.getElementById('form-lobby-create-room');
    if (formLobbyCreate) {
      formLobbyCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.isLoggedIn()) {
          this.showToast('🔑 Vui lòng Đăng nhập hoặc Đăng ký tài khoản trước khi mở phòng!', 'info');
          this.openAuthModal();
          return;
        }
        const name = document.getElementById('lobby-create-room-input')?.value.trim();
        const password = document.getElementById('lobby-create-room-pass')?.value.trim();
        if (name && password) {
          this.send('create-room', { name, password });
          document.getElementById('lobby-create-room-input').value = '';
          document.getElementById('lobby-create-room-pass').value = '';
        }
      });
    }

    const formModalCreate = document.getElementById('form-create-room');
    if (formModalCreate) {
      formModalCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.isLoggedIn()) {
          this.openAuthModal();
          return;
        }
        const name = document.getElementById('create-room-input')?.value.trim();
        const password = document.getElementById('create-room-pass-input')?.value.trim();
        if (name && password) {
          this.send('create-room', { name, password });
          document.getElementById('create-room-input').value = '';
          document.getElementById('create-room-pass-input').value = '';
        }
      });
    }

    // 8. Room Password Submit Modal
    const formRoomPass = document.getElementById('form-enter-room-pass');
    if (formRoomPass) {
      formRoomPass.addEventListener('submit', (e) => {
        e.preventDefault();
        const roomId = document.getElementById('pass-modal-room-id')?.value;
        const password = document.getElementById('pass-modal-input')?.value.trim();
        if (roomId && password) {
          this.send('join-room', { roomId, password });
        }
      });
    }

    // 9. Delete Room Confirmation
    document.getElementById('btn-cancel-delete-room')?.addEventListener('click', () => {
      this.pendingDeleteRoomId = null;
      this.closeModal('modal-confirm-delete');
    });
    document.getElementById('btn-confirm-delete-room')?.addEventListener('click', () => {
      if (this.pendingDeleteRoomId) {
        this.send('delete-room', { roomId: this.pendingDeleteRoomId });
        this.pendingDeleteRoomId = null;
      }
      this.closeModal('modal-confirm-delete');
    });

    // 10. Back to Lobby / Out Room & Quick Join Room
    document.getElementById('btn-back-lobby')?.addEventListener('click', () => this.leaveToLobby());
    document.getElementById('btn-modal-back-lobby')?.addEventListener('click', () => this.leaveToLobby());
    document.getElementById('btn-bottom-leave-room')?.addEventListener('click', () => this.leaveToLobby());

    const quickRoomSelect = document.getElementById('lobby-quick-room-select');
    const quickRoomPass = document.getElementById('lobby-quick-room-pass');
    if (quickRoomSelect && quickRoomPass) {
      quickRoomSelect.addEventListener('change', () => {
        const selectedRoom = this.roomsList.find(r => r.id === quickRoomSelect.value);
        if (selectedRoom && selectedRoom.canSkipPassword) {
          quickRoomPass.placeholder = 'Bạn là Host/Admin (Vào thẳng không cần Pass)';
          quickRoomPass.required = false;
        } else {
          quickRoomPass.placeholder = 'Nhập mật khẩu phòng...';
          quickRoomPass.required = true;
        }
      });
    }

    const formLobbyQuickJoin = document.getElementById('form-lobby-quick-join');
    if (formLobbyQuickJoin) {
      formLobbyQuickJoin.addEventListener('submit', (e) => {
        e.preventDefault();
        const roomId = document.getElementById('lobby-quick-room-select')?.value;
        const pass = document.getElementById('lobby-quick-room-pass')?.value.trim();
        if (!roomId) {
          this.showToast('Vui lòng chọn phòng chiếu muốn vào!', 'info');
          return;
        }
        this.attemptJoinRoom(roomId, pass || null);
      });
    }

    // 11. Auth Tabs & Login / Register / Logout / Account Update
    document.querySelectorAll('[data-auth-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('[data-auth-tab]').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        const tab = tabBtn.getAttribute('data-auth-tab');
        document.getElementById('form-login')?.classList.toggle('hidden', tab !== 'login');
        document.getElementById('form-register')?.classList.toggle('hidden', tab !== 'register');
      });
    });

    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username')?.value.trim();
      const password = document.getElementById('login-password')?.value.trim();
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
          this.showToast(data.error || 'Đăng nhập thất bại!', 'error');
          return;
        }
        this.authToken = data.token;
        localStorage.setItem('wetube_token', data.token);
        this.send('bind-auth', { token: data.token });
        this.closeModal('modal-profile');
        this.showToast(`🎉 Chào mừng ${data.user.name} đã đăng nhập!`, 'success');
      } catch {
        this.showToast('Lỗi kết nối máy chủ khi đăng nhập.', 'error');
      }
    });

    document.getElementById('form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username')?.value.trim();
      const password = document.getElementById('reg-password')?.value.trim();
      const name = document.getElementById('reg-displayname')?.value.trim();
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            name,
            avatarId: this.selectedRegAvatar,
            color: '#f2cf78'
          })
        });
        const data = await res.json();
        if (!res.ok) {
          this.showToast(data.error || 'Đăng ký thất bại!', 'error');
          return;
        }
        this.authToken = data.token;
        localStorage.setItem('wetube_token', data.token);
        this.send('bind-auth', { token: data.token });
        this.closeModal('modal-profile');
        this.showToast(`✨ Tạo tài khoản "${data.user.username}" thành công!`, 'success');
      } catch {
        this.showToast('Lỗi kết nối khi đăng ký.', 'error');
      }
    });

    document.getElementById('btn-logout-account')?.addEventListener('click', () => {
      this.authToken = null;
      localStorage.removeItem('wetube_token');
      this.send('logout-auth', {});
      this.closeModal('modal-profile');
      this.showToast('Bạn đã đăng xuất khỏi tài khoản.', 'info');
    });

    document.getElementById('form-profile')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name-input')?.value.trim();
      const tier = document.getElementById('profile-tier-select')?.value;
      const currentPassword = document.getElementById('acc-current-password')?.value;
      const newPassword = document.getElementById('acc-new-password')?.value;

      if (this.authToken) {
        try {
          const res = await fetch('/api/auth/account', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-token': this.authToken
            },
            body: JSON.stringify({
              name,
              avatarId: this.selectedProfileAvatar,
              color: this.selectedColor,
              tier,
              currentPassword,
              newPassword
            })
          });
          const data = await res.json();
          if (!res.ok) {
            this.showToast(data.error || 'Cập nhật thất bại!', 'error');
            return;
          }
          document.getElementById('acc-current-password').value = '';
          document.getElementById('acc-new-password').value = '';
        } catch {}
      }

      this.send('update-profile', {
        name,
        avatarId: this.selectedProfileAvatar,
        color: this.selectedColor,
        tier
      });
      this.closeModal('modal-profile');
      this.showToast('✅ Đã lưu hồ sơ & nhân vật Pixel Chibi!', 'success');
    });

    document.querySelectorAll('.color-circle').forEach((c) => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.color-circle').forEach(b => b.classList.remove('selected'));
        c.classList.add('selected');
        this.selectedColor = c.getAttribute('data-color');
      });
    });

    // 12. Open Modals
    document.getElementById('btn-open-rooms')?.addEventListener('click', () => {
      this.send('list-rooms');
      this.openModal('modal-rooms');
    });
    document.getElementById('btn-open-seats')?.addEventListener('click', () => {
      this.renderSeatMapModal();
      this.openModal('modal-seats');
    });
    document.getElementById('btn-open-queue')?.addEventListener('click', () => {
      this.renderQueueModal();
      this.openModal('modal-queue');
    });
    document.getElementById('btn-open-photo')?.addEventListener('click', () => {
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được chiếu ảnh lên màn hình!', 'error');
        return;
      }
      this.openModal('modal-photo');
    });
    document.getElementById('btn-open-profile')?.addEventListener('click', () => this.openAuthModal());
    document.getElementById('btn-lobby-open-profile')?.addEventListener('click', () => this.openAuthModal());
    document.getElementById('btn-help')?.addEventListener('click', () => this.openModal('modal-help'));

    // 13. Admin Control Panel Modal (Strictly Admin Only in Lobby)
    const openAdminPanel = () => {
      if (!this.you || this.you.role !== 'admin') {
        this.showToast('🚫 Chỉ Quản trị viên (Admin) mới có quyền mở bảng này!', 'error');
        return;
      }
      this.send('admin-get-data', {});
      this.openModal('modal-admin');
    };
    document.getElementById('btn-lobby-admin')?.addEventListener('click', openAdminPanel);

    // In-Room Management Panel (Chỉ Chủ phòng & Admin trong rạp)
    document.getElementById('btn-hud-room-manager')?.addEventListener('click', () => {
      if (!this.canControlRoom()) {
        this.showToast('🚫 Chỉ Chủ phòng hoặc Admin mới có quyền quản lý phòng!', 'error');
        return;
      }
      this.openRoomManagerModal();
    });

    // In-Room Audience & Interaction Modal (Dành cho MỌI NGƯỜI trong rạp)
    document.getElementById('btn-room-members')?.addEventListener('click', () => {
      this.openRoomMembersModal();
    });

    // Announcement Close Button
    document.getElementById('btn-close-announcement')?.addEventListener('click', () => {
      document.getElementById('room-announcement-banner')?.classList.add('hidden');
    });

    // Room Manager Navigation Tabs
    document.querySelectorAll('[data-rm-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-rm-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-rm-tab');
        ['members', 'screen', 'settings', 'tools'].forEach((pane) => {
          document.getElementById(`rm-pane-${pane}`)?.classList.toggle('hidden', pane !== tab);
        });
      });
    });

    // Room Manager Screen & Queue Controls
    document.getElementById('rm-btn-reset-screen')?.addEventListener('click', () => {
      this.send('host-reset-screen');
    });
    document.getElementById('rm-btn-clear-queue')?.addEventListener('click', () => {
      this.send('host-clear-queue');
    });

    // Room Manager Room Info Form
    document.getElementById('rm-form-room-info')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('rm-input-room-name')?.value.trim();
      const password = document.getElementById('rm-input-room-password')?.value.trim();
      this.send('host-update-room', { name, password });
      this.closeModal('modal-room-manager');
    });

    // Room Manager Announcement
    document.getElementById('rm-btn-send-announcement')?.addEventListener('click', () => {
      const input = document.getElementById('rm-input-announcement');
      const text = input ? input.value.trim() : '';
      if (!text) {
        this.showToast('Vui lòng nhập nội dung thông báo!', 'warning');
        return;
      }
      this.send('host-broadcast-announcement', { text });
      if (input) input.value = '';
      this.closeModal('modal-room-manager');
    });

    // Room Manager Clear Chat
    document.getElementById('rm-btn-clear-chat')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn xóa sạch toàn bộ tin nhắn chat trong rạp?')) {
        this.send('host-clear-chat');
        this.closeModal('modal-room-manager');
      }
    });

    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-admin-tab');
        ['movies', 'broadcast', 'categories', 'users', 'stats'].forEach((pane) => {
          document.getElementById(`admin-pane-${pane}`)?.classList.toggle('hidden', pane !== tab);
        });
      });
    });

    this.bindAdminForms();

    // 14. Close Modals
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal(btn.getAttribute('data-close')));
    });

    // 15. Voice Mic, Party, Lights, Volume, Fullscreen, Chat, Emoji, Photo
    document.getElementById('btn-voice-mic')?.addEventListener('click', () => this.toggleVoiceMic());
    document.getElementById('btn-hud-mic')?.addEventListener('click', () => this.toggleVoiceMic());

    document.getElementById('btn-leave-seat')?.addEventListener('click', () => {
      this.send('leave-seat');
      this.closeModal('modal-seats');
    });
    document.getElementById('btn-toggle-party')?.addEventListener('click', () => {
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được bật/tắt đèn tiệc!', 'error');
        return;
      }
      this.send('toggle-party');
    });

    document.getElementById('btn-toggle-lights')?.addEventListener('click', () => {
      const nextLightsOff = !(this.cinema && this.cinema.lightsOff);
      if (this.cinema) {
        this.cinema.setLightsOff(nextLightsOff);
      }
      this.updateLightsModeUI(nextLightsOff);
      if (this.canControlRoom()) {
        this.send('toggle-lights');
      }
    });

    // Quality Selector Dropdown (Thấp - Trung bình - Cao)
    const qualityPopover = document.getElementById('quality-popover');
    document.getElementById('btn-quality-selector')?.addEventListener('click', (e) => {
      e.stopPropagation();
      qualityPopover?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (qualityPopover && !qualityPopover.contains(e.target) && !e.target.closest('#btn-quality-selector')) {
        qualityPopover.classList.add('hidden');
      }
    });
    document.querySelectorAll('.quality-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const level = btn.getAttribute('data-quality') || 'high';
        this.applyQualityLevel(level);
        qualityPopover?.classList.add('hidden');
      });
    });

    const volWrap = document.getElementById('volume-control-wrap');
    document.getElementById('btn-volume')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (volWrap && !volWrap.classList.contains('open')) {
        volWrap.classList.add('open');
        return;
      }
      const muted = this.player.toggleMute();
      this.updateVolumeIcon(muted ? 0 : this.player.volume);
    });
    document.addEventListener('click', (e) => {
      if (volWrap && !volWrap.contains(e.target)) {
        volWrap.classList.remove('open');
      }
    });
    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.player.setVolume(val);
      this.player.isMuted = val === 0;
      const valEl = document.getElementById('volume-val');
      if (valEl) valEl.textContent = `${val}%`;
      this.updateVolumeIcon(val);
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        if (this.cinema) this.cinema.setCameraMode('screen');
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.cam-btn[data-camera="screen"]')?.classList.add('active');
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.getElementById('btn-unmute-audio')?.addEventListener('click', () => this.player.unmuteWithGesture());

    document.getElementById('form-add-video')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.canControlRoom()) {
        this.showToast('🔒 Chỉ Chủ phòng (Host) mới được thêm video vào danh sách phát!', 'error');
        return;
      }
      const input = document.getElementById('video-url-input');
      if (input && input.value.trim()) {
        this.send('queue-video', { url: input.value.trim() });
        input.value = '';
      }
    });

    document.querySelectorAll('.emoji-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.send('reaction', { emoji: btn.getAttribute('data-emoji') });
      });
    });

    document.getElementById('btn-toggle-chat')?.addEventListener('click', () => this.toggleChat());
    document.getElementById('btn-close-chat')?.addEventListener('click', () => this.toggleChat(false));
    document.getElementById('chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (input && input.value.trim()) {
        this.send('chat', { text: input.value.trim() });
        input.value = '';
      }
    });

    const photoFileInput = document.getElementById('photo-file-input');
    const photoUrlInput = document.getElementById('photo-url-input');
    const previewBox = document.getElementById('photo-preview-box');
    const previewImg = document.getElementById('photo-preview-img');
    if (photoFileInput) {
      photoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          previewBox.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      });
    }
    document.getElementById('form-screen-photo')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const imgSrc = previewImg?.src || photoUrlInput?.value.trim();
      const caption = document.getElementById('photo-caption-input')?.value.trim();
      if (imgSrc && imgSrc.startsWith('http') || imgSrc.startsWith('data:')) {
        this.send('screen-post', { image: imgSrc, caption });
        this.closeModal('modal-photo');
      }
    });

    // 17. Stickers & Memes Drawer
    this.initStickerDrawer();

    // 18. Mini-game & Polls Overlay
    this.initPollHandlers();

    // 19. Virtual Gifts
    this.initGiftHandlers();

    // 20. Global Keyboard Shortcuts (F: Toàn màn hình, H: Ẩn/Hiện điều khiển, M: Bật/Tắt Mic)
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'f' || e.key === 'F') {
        const btnFs = document.getElementById('btn-fullscreen');
        btnFs?.click();
      } else if (e.key === 'h' || e.key === 'H') {
        this.toggleHudVisibility();
      } else if (e.key === 'm' || e.key === 'M') {
        this.toggleVoiceMic();
      }
    });
  }

  // --- Admin Panel Forms & Actions ---
  bindAdminForms() {
    // Save Movie Form
    document.getElementById('form-admin-movie')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('adm-movie-id')?.value || null;
      const title = document.getElementById('adm-movie-title')?.value.trim();
      const poster = document.getElementById('adm-movie-poster')?.value.trim();
      const cast = document.getElementById('adm-movie-cast')?.value.trim();
      const genre = document.getElementById('adm-movie-genre')?.value;
      const country = document.getElementById('adm-movie-country')?.value;
      const year = document.getElementById('adm-movie-year')?.value;
      const description = document.getElementById('adm-movie-desc')?.value.trim();
      const sourceType = document.getElementById('adm-movie-source')?.value;
      const isVipOnly = document.getElementById('adm-movie-vip')?.value === 'true';
      const videoUrl = document.getElementById('adm-movie-url')?.value.trim();
      const rawEps = document.getElementById('adm-movie-episodes')?.value.trim();

      const episodes = [];
      if (rawEps) {
        rawEps.split('\n').forEach((line, idx) => {
          const parts = line.split('|').map(s => s.trim());
          if (parts.length >= 2 && parts[1]) {
            episodes.push({ epNumber: idx + 1, title: parts[0] || `Tập ${idx + 1}`, sourceType, videoUrl: parts[1] });
          }
        });
      }

      this.send('admin-save-movie', {
        movie: { id, title, poster, cast, genre, country, year, description, sourceType, isVipOnly, videoUrl, episodes }
      });
      this.resetAdminMovieForm();
    });

    document.getElementById('btn-adm-movie-reset')?.addEventListener('click', () => this.resetAdminMovieForm());

    // Direct Video File Upload Form
    document.getElementById('form-admin-upload-video')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('adm-upload-file');
      const titleInput = document.getElementById('adm-upload-title');
      const btnText = document.getElementById('adm-upload-btn-text');
      const resBox = document.getElementById('adm-upload-result');

      const file = fileInput?.files?.[0];
      if (!file) return;

      try {
        if (btnText) btnText.textContent = 'Đang tải tệp phim lên máy chủ...';
        const res = await fetch('/api/upload-video', {
          method: 'POST',
          headers: {
            'x-auth-token': this.authToken || '',
            'x-filename': encodeURIComponent(file.name)
          },
          body: file
        });
        const data = await res.json();
        if (btnText) btnText.textContent = 'Tải Lên & Tạo Nguồn Phát Ngay';

        if (!res.ok) {
          this.showToast(data.error || 'Tải tệp thất bại!', 'error');
          return;
        }

        if (resBox) {
          resBox.innerHTML = `✅ Đã tải lên thành công! Đường dẫn phát nội bộ: <code>${data.url}</code>`;
          resBox.classList.remove('hidden');
        }

        // Automatically add to Movie Catalog
        this.send('admin-save-movie', {
          movie: {
            title: titleInput?.value.trim() || file.name,
            sourceType: 'direct',
            videoUrl: data.url,
            genre: 'Chiếu Rạp',
            country: 'Việt Nam',
            year: '2026',
            description: 'Phim được Admin tải trực tiếp lên máy chủ phát sóng.'
          }
        });
        fileInput.value = '';
      } catch {
        if (btnText) btnText.textContent = 'Tải Lên & Tạo Nguồn Phát Ngay';
        this.showToast('Lỗi kết nối khi tải tệp video.', 'error');
      }
    });

    // Save Categories Form
    document.getElementById('form-admin-categories')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const splitClean = (id) => (document.getElementById(id)?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      this.send('admin-save-categories', {
        categories: {
          genres: splitClean('adm-cat-genres'),
          countries: splitClean('adm-cat-countries'),
          years: splitClean('adm-cat-years'),
          tags: splitClean('adm-cat-tags')
        }
      });
    });
  }

  resetAdminMovieForm() {
    document.getElementById('adm-movie-id').value = '';
    document.getElementById('adm-movie-title').value = '';
    document.getElementById('adm-movie-poster').value = '';
    document.getElementById('adm-movie-cast').value = '';
    document.getElementById('adm-movie-desc').value = '';
    document.getElementById('adm-movie-url').value = '';
    document.getElementById('adm-movie-episodes').value = '';
    document.getElementById('admin-movie-form-title').textContent = '➕ Thêm Phim Mới';
  }

  renderAdminDashboard() {
    if (!this.adminData) return;
    const { accounts, movies, categories, allComments, roomsAdmin, stats } = this.adminData;

    // Populate Category Selects in Movie Form
    const fillSelect = (id, arr) => {
      const sel = document.getElementById(id);
      if (sel && Array.isArray(arr)) {
        sel.innerHTML = arr.map(v => `<option value="${v}">${v}</option>`).join('');
      }
    };
    fillSelect('adm-movie-genre', categories?.genres || []);
    fillSelect('adm-movie-country', categories?.countries || []);
    fillSelect('adm-movie-year', categories?.years || []);

    // Tab 1: Movies List
    document.getElementById('adm-movies-count').textContent = (movies || []).length;
    const moviesListEl = document.getElementById('adm-movies-list');
    if (moviesListEl) {
      moviesListEl.innerHTML = (movies || []).map(m => `
        <div class="admin-item-row">
          <div class="admin-item-info">
            <div class="admin-item-title">
              ${m.isVipOnly ? '<span style="color:#f2cf78;">[👑 VIP]</span>' : ''}
              <span>${m.title}</span>
            </div>
            <div class="admin-item-sub">${m.genre} · ${m.country} · ${m.year} · Nguồn: ${m.sourceType} · 👁️ ${m.views || 0} lượt xem</div>
          </div>
          <div class="admin-item-actions">
            <button class="adm-btn gold" data-adm-edit-movie="${m.id}">Sửa</button>
            <button class="adm-btn danger" data-adm-del-movie="${m.id}">Xóa</button>
          </div>
        </div>
      `).join('');

      moviesListEl.querySelectorAll('[data-adm-edit-movie]').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = movies.find(x => x.id === btn.getAttribute('data-adm-edit-movie'));
          if (!m) return;
          document.getElementById('adm-movie-id').value = m.id;
          document.getElementById('adm-movie-title').value = m.title || '';
          document.getElementById('adm-movie-poster').value = m.poster || '';
          document.getElementById('adm-movie-cast').value = m.cast || '';
          document.getElementById('adm-movie-desc').value = m.description || '';
          document.getElementById('adm-movie-source').value = m.sourceType || 'youtube';
          document.getElementById('adm-movie-vip').value = m.isVipOnly ? 'true' : 'false';
          document.getElementById('adm-movie-url').value = m.videoUrl || '';
          document.getElementById('adm-movie-episodes').value = (m.episodes || []).map(ep => `${ep.title} | ${ep.videoUrl}`).join('\n');
          document.getElementById('admin-movie-form-title').textContent = `✏️ Chỉnh Sửa: ${m.title}`;
        });
      });

      moviesListEl.querySelectorAll('[data-adm-del-movie]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.send('admin-delete-movie', { movieId: btn.getAttribute('data-adm-del-movie') });
        });
      });
    }

    // Tab 2: Rooms & Passwords Management
    const roomsPassEl = document.getElementById('adm-rooms-pass-list');
    if (roomsPassEl) {
      roomsPassEl.innerHTML = (roomsAdmin || []).map(r => `
        <div class="admin-item-row">
          <div class="admin-item-info">
            <div class="admin-item-title">${r.name}</div>
            <div class="admin-item-sub">👑 Host: ${r.hostName} (@${r.hostUsername}) · Đang xem: ${r.onlineCount} · Mật khẩu hiện tại: <strong style="color:#f2cf78;">${r.password}</strong></div>
          </div>
          <div class="admin-item-actions">
            <input type="text" placeholder="Pass mới" id="adm-pass-in-${r.id}" style="width:90px; padding:4px 7px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:#111; color:#fff; font-size:11px;" />
            <button class="adm-btn gold" data-adm-save-pass="${r.id}">Đổi Pass</button>
          </div>
        </div>
      `).join('');

      roomsPassEl.querySelectorAll('[data-adm-save-pass]').forEach(btn => {
        btn.addEventListener('click', () => {
          const rId = btn.getAttribute('data-adm-save-pass');
          const newPass = document.getElementById(`adm-pass-in-${rId}`)?.value.trim();
          if (newPass) {
            this.send('admin-update-room-pass', { roomId: rId, password: newPass });
          }
        });
      });
    }

    // Tab 3: Categories
    if (categories) {
      document.getElementById('adm-cat-genres').value = (categories.genres || []).join(', ');
      document.getElementById('adm-cat-countries').value = (categories.countries || []).join(', ');
      document.getElementById('adm-cat-years').value = (categories.years || []).join(', ');
      document.getElementById('adm-cat-tags').value = (categories.tags || []).join(', ');
    }

    // Tab 4: Users & Spam Comments
    document.getElementById('adm-users-count').textContent = (accounts || []).length;
    const usersListEl = document.getElementById('adm-users-list');
    if (usersListEl) {
      usersListEl.innerHTML = (accounts || []).map(u => {
        const avUrl = window.PixelAvatars ? window.PixelAvatars.getDataUrl(u.avatarId, 3) : '';
        const rawPass = u.plainPassword || '';
        return `
          <div class="admin-item-row" style="flex-wrap: wrap; gap: 8px;">
            <img src="${avUrl}" style="width:28px; height:35px; image-rendering:pixelated;" alt="av" />
            <div class="admin-item-info">
              <div class="admin-item-title">
                <span>${u.name}</span>
                <small style="color:#9ca3af;">(@${u.username})</small>
                ${u.role === 'admin' ? '<span class="role-mini-tag admin">Admin</span>' : ''}
                ${u.isVip ? '<span class="role-mini-tag vip">👑 VIP</span>' : ''}
                ${u.isBanned ? '<span style="color:#ef4444; font-size:10px;">[ĐÃ KHÓA]</span>' : ''}
              </div>
              <div class="admin-item-sub">${u.isOnline ? '🟢 Đang Online' : '⚪ Offline'} · Danh hiệu: ${u.tier}</div>

              <!-- Admin Password Inspection & Management -->
              <div class="adm-user-creds" style="margin-top: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; background: rgba(0,0,0,0.4); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); font-size: 11px;">
                <span style="color: #9ca3af;">TK:</span> <strong style="color: #e5e7eb;">${u.username}</strong>
                <span style="color: #9ca3af; margin-left: 4px;">Pass:</span>
                <span class="adm-pass-text" data-raw-pass="${rawPass}" style="font-family: monospace; letter-spacing: 1px; color: #f2cf78; font-weight: 700;">••••••••</span>
                <button class="adm-cred-btn" data-toggle-pass title="Ẩn / Xem mật khẩu" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; cursor: pointer; padding: 1px 6px; font-size: 11px;">👁️</button>
                <button class="adm-cred-btn" data-copy-pass="${rawPass}" title="Sao chép mật khẩu" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; cursor: pointer; padding: 1px 6px; font-size: 11px;">📋 Copy</button>
                <div style="display: inline-flex; align-items: center; gap: 4px; margin-left: auto;">
                  <input type="text" placeholder="Pass mới" id="adm-user-newpass-${u.id}" style="width: 75px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.18); background: #111; color: #fff; font-size: 11px;" />
                  <button class="adm-btn gold" data-adm-change-pass="${u.id}" style="padding: 2px 7px; font-size: 10px;">Lưu pass</button>
                </div>
              </div>
            </div>
            <div class="admin-item-actions">
              <button class="adm-btn gold" data-adm-vip="${u.id}">${u.isVip ? 'Gỡ VIP' : '+ Cấp VIP'}</button>
              ${u.username !== 'admin' ? `
                <button class="adm-btn ${u.isBanned ? 'success' : 'danger'}" data-adm-ban="${u.id}">${u.isBanned ? 'Mở khóa' : 'Khóa TK'}</button>
                <button class="adm-btn" data-adm-role="${u.id}">${u.role === 'admin' ? 'Hạ Admin' : 'Cấp Admin'}</button>
                <button class="adm-btn danger" data-adm-del-user="${u.id}">Xóa</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      usersListEl.querySelectorAll('[data-toggle-pass]').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.adm-user-creds');
          const passEl = row?.querySelector('.adm-pass-text');
          if (!passEl) return;
          const rawPass = passEl.getAttribute('data-raw-pass') || '';
          if (passEl.textContent === '••••••••') {
            passEl.textContent = rawPass || '(Chưa lưu)';
            btn.textContent = '🙈';
          } else {
            passEl.textContent = '••••••••';
            btn.textContent = '👁️';
          }
        });
      });

      usersListEl.querySelectorAll('[data-copy-pass]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pass = btn.getAttribute('data-copy-pass') || '';
          if (pass) {
            navigator.clipboard.writeText(pass).then(() => {
              this.showToast('📋 Đã copy mật khẩu vào clipboard!', 'success');
            }).catch(() => {
              this.showToast(`Mật khẩu: ${pass}`, 'info');
            });
          } else {
            this.showToast('Chưa có mật khẩu dạng text cho tài khoản này.', 'warning');
          }
        });
      });

      usersListEl.querySelectorAll('[data-adm-change-pass]').forEach(btn => {
        btn.addEventListener('click', () => {
          const accId = btn.getAttribute('data-adm-change-pass');
          const input = document.getElementById(`adm-user-newpass-${accId}`);
          const newPass = input?.value.trim();
          if (!newPass || newPass.length < 4) {
            this.showToast('Mật khẩu mới phải từ 4 ký tự trở lên!', 'error');
            return;
          }
          this.send('admin-set-user-password', { accountId: accId, newPassword: newPass });
          if (input) input.value = '';
        });
      });

      usersListEl.querySelectorAll('[data-adm-vip]').forEach(b => {
        b.addEventListener('click', () => this.send('admin-toggle-vip', { accountId: b.getAttribute('data-adm-vip') }));
      });
      usersListEl.querySelectorAll('[data-adm-ban]').forEach(b => {
        b.addEventListener('click', () => this.send('admin-toggle-ban', { accountId: b.getAttribute('data-adm-ban') }));
      });
      usersListEl.querySelectorAll('[data-adm-role]').forEach(b => {
        b.addEventListener('click', () => this.send('admin-toggle-role', { accountId: b.getAttribute('data-adm-role') }));
      });
      usersListEl.querySelectorAll('[data-adm-del-user]').forEach(b => {
        b.addEventListener('click', () => this.send('admin-delete-user', { accountId: b.getAttribute('data-adm-del-user') }));
      });
    }

    const commentsListEl = document.getElementById('adm-comments-list');
    if (commentsListEl) {
      if (!allComments || allComments.length === 0) {
        commentsListEl.innerHTML = `<div class="empty-queue-msg">Chưa có bình luận nào trong các phòng.</div>`;
      } else {
        commentsListEl.innerHTML = allComments.map(c => `
          <div class="admin-item-row">
            <div class="admin-item-info">
              <div class="admin-item-title">
                <span style="color:${c.color}">${c.name}</span>
                <small style="color:#9ca3af;">[${c.roomName} · ${c.time}]</small>
              </div>
              <div class="admin-item-sub" style="color:#f3f4f6;">${this.escapeHTML(c.text)}</div>
            </div>
            <button class="adm-btn danger" data-adm-del-msg="${c.id}" data-adm-msg-room="${c.roomId}">Xóa Spam</button>
          </div>
        `).join('');

        commentsListEl.querySelectorAll('[data-adm-del-msg]').forEach(b => {
          b.addEventListener('click', () => {
            this.send('admin-delete-comment', {
              messageId: b.getAttribute('data-adm-del-msg'),
              roomId: b.getAttribute('data-adm-msg-room')
            });
          });
        });
      }
    }

    // Tab 5: Activity Stats (Free for everyone — no revenue)
    if (stats) {
      const visitsEl = document.getElementById('stat-total-visits');
      const onlineEl = document.getElementById('stat-online-now');
      const accountsEl = document.getElementById('stat-total-accounts');
      const vipEl = document.getElementById('stat-total-vip');
      const moviesCountEl = document.getElementById('stat-total-movies');
      const activeRoomsEl = document.getElementById('stat-active-rooms');

      if (visitsEl) visitsEl.textContent = stats.totalVisits || 0;
      if (onlineEl) onlineEl.textContent = `Đang online: ${stats.onlineNow || 1} người`;
      if (accountsEl) accountsEl.textContent = stats.totalAccounts || 0;
      if (vipEl) vipEl.textContent = `Thành viên VIP: ${stats.totalVipAccounts || 0}`;
      if (moviesCountEl) moviesCountEl.textContent = (movies || []).length;
      if (activeRoomsEl) activeRoomsEl.textContent = (roomsAdmin || []).length;

      const topMoviesEl = document.getElementById('adm-top-movies');
      if (topMoviesEl) {
        const sorted = [...(movies || [])].sort((a, b) => (b.views || 0) - (a.views || 0));
        topMoviesEl.innerHTML = sorted.map((m, idx) => `
          <div class="admin-item-row">
            <div class="admin-item-info">
              <div class="admin-item-title">#${idx + 1}. ${m.title}</div>
              <div class="admin-item-sub">${m.genre} · ${m.country}</div>
            </div>
            <strong style="color:#f2cf78; font-size:13px;">👁️ ${m.views || 0} lượt xem</strong>
          </div>
        `).join('');
      }
    }
  }

  // --- UI Helpers ---
  toggleHudVisibility(forceState = null) {
    this.isHudHidden = forceState !== null ? forceState : !this.isHudHidden;
    document.body.classList.toggle('hud-hidden', this.isHudHidden);
    document.getElementById('btn-show-hud')?.classList.toggle('hidden', !this.isHudHidden);
  }

  updatePlayPauseButtonUI(isPlaying) {
    const icon = document.getElementById('icon-play-pause');
    const label = document.getElementById('label-play-pause');
    if (icon) icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    if (label) label.textContent = isPlaying ? 'Tạm dừng' : 'Phát tiếp';
    this.refreshIcons();
  }

  updatePlaybackBarUI(cur, dur, percent) {
    const curEl = document.getElementById('playback-current-time');
    const durEl = document.getElementById('playback-duration');
    const fillEl = document.getElementById('scrubber-fill');
    const scrubber = document.getElementById('playback-scrubber');

    if (curEl) curEl.textContent = this.formatTime(cur);
    if (durEl) durEl.textContent = this.formatTime(dur);
    if (!this.player.isSeeking) {
      if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
      if (scrubber) scrubber.value = Math.min(100, Math.max(0, percent));
    }
  }

  formatTime(sec) {
    if (!sec || isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  handleSeatSelection(seatId) {
    if (!this.room) return;
    this.send('pick-seat', { seatId });
    this.closeModal('modal-seats');
  }

  reportDuration(id, duration) {
    this.send('report-duration', { id, duration });
  }

  showAudioBlockedBanner() {
    document.getElementById('audio-blocked-overlay')?.classList.remove('hidden');
  }

  updateNowPlayingUI() {
    if (!this.room) return;
    const v = this.room.currentVideo;
    if (!v) {
      document.getElementById('np-title').textContent = 'Chưa phát video';
      document.getElementById('np-requester').textContent = 'Màn hình đang tắt';
      this.updatePlayPauseButtonUI(false);
      return;
    }
    document.getElementById('np-title').textContent = v.title || 'Đang phát...';
    document.getElementById('np-requester').textContent = `Bởi ${v.requester || 'Chủ phòng'}`;
    this.updatePlayPauseButtonUI(v.isPlaying !== false);
  }

  updateOccupancyUI() {
    if (!this.room) return;
    const totalSeats = (this.room.seats && this.room.seats.length) ? this.room.seats.length : 13;
    const seatedCount = this.room.seats.filter(s => s !== null).length;
    const occText = document.getElementById('occupancy-text');
    if (occText) occText.textContent = `${seatedCount}/${totalSeats} ghế`;

    const totalMembers = (this.room.realUsers ? this.room.realUsers.length : 0) || (seatedCount || 1);
    const memLabel = document.getElementById('label-room-members-count');
    if (memLabel) memLabel.textContent = `Khán giả (${totalMembers})`;
  }

  openRoomManagerModal() {
    if (!this.room || !this.canControlRoom()) return;

    const countEl = document.getElementById('rm-user-count');
    const listEl = document.getElementById('rm-members-list');
    const badgeEl = document.getElementById('rm-role-badge');
    if (badgeEl) {
      badgeEl.textContent = this.you?.role === 'admin' ? '🛡️ Admin Hệ Thống' : '👑 Chủ Phòng';
    }

    const nameInput = document.getElementById('rm-input-room-name');
    if (nameInput) nameInput.value = this.room.roomName || this.room.name || '';
    const curPassEl = document.getElementById('rm-current-pass-display');
    if (curPassEl) curPassEl.textContent = this.room.roomPassword ? `Pass: ${this.room.roomPassword}` : '(Không có mật khẩu)';

    const curVideoTitle = document.getElementById('rm-video-title');
    if (curVideoTitle) {
      curVideoTitle.textContent = this.room.currentVideo ? `🎬 ${this.room.currentVideo.title}` : 'Chưa phát video nào';
    }

    const members = (this.room.realUsers || []).filter(u => u.id !== this.you.id);
    if (countEl) countEl.textContent = (this.room.realUsers || []).length;

    if (listEl) {
      if (members.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; color:#9ca3af; padding: 20px;">Hiện tại chỉ có một mình bạn trong phòng chiếu.</div>`;
      } else {
        listEl.innerHTML = members.map((u) => {
          const avUrl = window.PixelAvatars ? window.PixelAvatars.getDataUrl(u.avatarId, 2) : '';
          const seatLabel = u.seatId !== null && this.room.seatLabels ? this.room.seatLabels[u.seatId] : (u.seatId !== null ? `Ghế #${u.seatId + 1}` : 'Khán giả tự do');
          return `
            <div class="rm-member-row" data-user-id="${u.id}">
              <div class="rm-member-info">
                ${avUrl ? `<img src="${avUrl}" style="width:28px; height:34px; image-rendering:pixelated;" alt="av" />` : ''}
                <div>
                  <div class="rm-member-name">${this.escapeHTML(u.name)} ${u.isVip ? '💎' : ''}</div>
                  <div class="rm-member-meta">${seatLabel} · ${u.micOn ? '🎙️ Mic Bật' : '🔇 Mic Tắt'}</div>
                </div>
              </div>
              <div class="rm-member-actions">
                ${u.seatId !== null ? `<button class="rm-btn-sm warning" data-action="kick-seat" data-seat-id="${u.seatId}">Mời rời ghế</button>` : ''}
                ${u.micOn ? `<button class="rm-btn-sm warning" data-action="mute-mic" data-target-id="${u.id}">Tắt mic</button>` : ''}
                <button class="rm-btn-sm primary" data-action="transfer-host" data-target-id="${u.id}">Nhượng Host</button>
                <button class="rm-btn-sm danger" data-action="kick-user" data-target-id="${u.id}">Kick</button>
              </div>
            </div>
          `;
        }).join('');

        listEl.querySelectorAll('[data-action]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const act = btn.getAttribute('data-action');
            if (act === 'kick-seat') {
              const seatId = btn.getAttribute('data-seat-id');
              this.send('host-kick-seat', { seatId });
            } else if (act === 'mute-mic') {
              const targetUserId = btn.getAttribute('data-target-id');
              this.send('host-force-mute', { targetUserId });
            } else if (act === 'transfer-host') {
              const targetUserId = btn.getAttribute('data-target-id');
              if (confirm('Bạn có chắc muốn nhượng quyền Chủ phòng cho thành viên này?')) {
                this.send('host-transfer', { targetUserId });
                this.closeModal('modal-room-manager');
              }
            } else if (act === 'kick-user') {
              const targetUserId = btn.getAttribute('data-target-id');
              if (confirm('Mời người xem này ra khỏi phòng chiếu?')) {
                this.send('host-kick-user', { targetUserId });
                btn.closest('.rm-member-row')?.remove();
              }
            }
          });
        });
      }
    }

    this.openModal('modal-room-manager');
  }

  openRoomMembersModal(targetUserId = null) {
    if (!this.room) return;
    const grid = document.getElementById('interactive-users-grid');
    const detail = document.getElementById('user-interaction-detail');
    if (!grid) return;

    const allUsers = this.room.realUsers || [];
    grid.innerHTML = allUsers.map((u) => {
      const isMe = this.you && u.id === this.you.id;
      const avUrl = window.PixelAvatars ? window.PixelAvatars.getDataUrl(u.avatarId, 2) : '';
      const seatLabel = u.seatId !== null && this.room.seatLabels ? this.room.seatLabels[u.seatId] : (u.seatId !== null ? `Ghế #${u.seatId + 1}` : 'Khán giả');
      return `
        <div class="interactive-user-card ${targetUserId === u.id ? 'selected' : ''}" data-uid="${u.id}">
          ${avUrl ? `<img src="${avUrl}" style="width:32px; height:38px; image-rendering:pixelated;" alt="av" />` : ''}
          <div style="font-size:12px; font-weight:700; color:#fff; margin-top:4px; text-align:center;">${this.escapeHTML(u.name)}${isMe ? ' (Bạn)' : ''}</div>
          <small style="font-size:10px; color:${u.isVip ? '#fbbf24' : '#9ca3af'};">${u.isVip ? '👑 VIP · ' : ''}${seatLabel}</small>
        </div>
      `;
    }).join('');

    const selectUser = (userId) => {
      const u = allUsers.find(x => x.id === userId);
      if (!u || (this.you && u.id === this.you.id)) {
        detail?.classList.add('hidden');
        return;
      }
      grid.querySelectorAll('.interactive-user-card').forEach(c => {
        c.classList.toggle('selected', c.getAttribute('data-uid') === userId);
      });
      detail?.classList.remove('hidden');

      const avUrl = window.PixelAvatars ? window.PixelAvatars.getDataUrl(u.avatarId, 3) : '';
      const avImg = document.getElementById('uid-avatar');
      if (avImg && avUrl) avImg.src = avUrl;
      const nameEl = document.getElementById('uid-name');
      if (nameEl) nameEl.textContent = u.name;
      const seatEl = document.getElementById('uid-seat');
      if (seatEl) {
        const s = u.seatId !== null && this.room.seatLabels ? this.room.seatLabels[u.seatId] : (u.seatId !== null ? `Ghế #${u.seatId + 1}` : 'Khán giả tự do');
        seatEl.textContent = `${s} · ${u.tier || (u.isVip ? '👑 VIP' : 'Thành viên')}`;
      }

      // Action buttons: popcorn, cheers, heart, clap
      detail.querySelectorAll('.uid-action-btn').forEach((btn) => {
        btn.onclick = () => {
          const action = btn.getAttribute('data-action');
          this.send('user-interaction', { targetUserId: u.id, action });
          this.showToast(`✨ Đã gửi tương tác tới ${u.name}!`, 'success');
        };
      });

      // Mod controls (for Host & Admin)
      const modControls = document.getElementById('uid-mod-controls');
      const canManage = this.canControlRoom();
      if (modControls) {
        modControls.classList.toggle('hidden', !canManage);
        if (canManage) {
          const btnKickSeat = document.getElementById('uid-btn-kick-seat');
          if (btnKickSeat) {
            btnKickSeat.classList.toggle('hidden', u.seatId === null);
            btnKickSeat.onclick = () => {
              this.send('host-kick-seat', { seatId: u.seatId });
              this.closeModal('modal-room-members');
            };
          }
          const btnMute = document.getElementById('uid-btn-mute-mic');
          if (btnMute) {
            btnMute.classList.toggle('hidden', !u.micOn);
            btnMute.onclick = () => {
              this.send('host-force-mute', { targetUserId: u.id });
              this.closeModal('modal-room-members');
            };
          }
          const btnHost = document.getElementById('uid-btn-transfer-host');
          if (btnHost) {
            btnHost.onclick = () => {
              if (confirm(`Chuyển giao quyền Chủ phòng cho ${u.name}?`)) {
                this.send('host-transfer', { targetUserId: u.id });
                this.closeModal('modal-room-members');
              }
            };
          }
          const btnKickUser = document.getElementById('uid-btn-kick-user');
          if (btnKickUser) {
            btnKickUser.onclick = () => {
              if (confirm(`Mời ${u.name} ra khỏi rạp chiếu?`)) {
                this.send('host-kick-user', { targetUserId: u.id });
                this.closeModal('modal-room-members');
              }
            };
          }
        }
      }
    };

    grid.querySelectorAll('.interactive-user-card').forEach((card) => {
      card.addEventListener('click', () => {
        const uid = card.getAttribute('data-uid');
        selectUser(uid);
      });
    });

    if (targetUserId) {
      selectUser(targetUserId);
    } else if (allUsers.length > 1) {
      const other = allUsers.find(x => this.you && x.id !== this.you.id);
      if (other) selectUser(other.id);
    } else {
      detail?.classList.add('hidden');
    }

    this.openModal('modal-room-members');
  }

  updateStageButtonUI() {
    const btnText = document.getElementById('stage-btn-text');
    if (btnText && this.room && this.you) {
      btnText.textContent = this.room.stageUser === this.you.id ? 'Rời sân khấu' : 'Lên sân khấu';
    }
  }

  updatePartyModeUI(active) {
    document.getElementById('btn-toggle-party')?.classList.toggle('active', active);
  }

  updateLightsModeUI(active) {
    const btn = document.getElementById('btn-toggle-lights');
    const label = document.getElementById('lights-btn-label');
    if (btn) btn.classList.toggle('active', !!active);
    if (label) label.textContent = active ? 'Bật đèn' : 'Tắt đèn';
  }

  updateVolumeIcon(vol) {
    const icon = document.getElementById('icon-volume') || document.getElementById('volume-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', vol === 0 ? 'volume-x' : (vol < 50 ? 'volume-1' : 'volume-2'));
    this.refreshIcons();
  }

  applyQualityLevel(level = 'high', showNotice = false) {
    const qualityLabel = document.getElementById('hud-quality-label');
    const labelMap = {
      high: '1080p',
      medium: '720p',
      low: '360p'
    };
    const nameMap = {
      high: 'Cao (1080p - Sắc nét)',
      medium: 'Trung bình (720p - Chuẩn)',
      low: 'Thấp (360p - Tiết kiệm)'
    };

    if (qualityLabel) {
      qualityLabel.textContent = labelMap[level] || 'HD';
    }

    document.querySelectorAll('.quality-option-btn').forEach(b => {
      const isCurrent = b.getAttribute('data-quality') === level;
      b.classList.toggle('active', isCurrent);
      const check = b.querySelector('.quality-check-icon');
      if (check) check.classList.toggle('hidden', !isCurrent);
    });

    if (this.player && typeof this.player.setVideoQuality === 'function') {
      this.player.setVideoQuality(level);
    }
    if (this.cinema && typeof this.cinema.setQuality === 'function') {
      this.cinema.setQuality(level);
    }

    localStorage.setItem('wetube_quality', level);
    if (showNotice) {
      this.showToast(`🎬 Đã chuyển chất lượng hình ảnh: ${nameMap[level] || level}`, 'info');
    }
  }

  renderSeatMapModal() {
    if (!this.room || !this.you) return;
    const rowA = document.getElementById('row-a-seats');
    const rowB = document.getElementById('row-b-seats');
    const rowC = document.getElementById('row-c-seats');
    const leaveBtn = document.getElementById('btn-leave-seat');
    if (!rowA || !rowB) return;

    rowA.innerHTML = '';
    rowB.innerHTML = '';
    if (rowC) rowC.innerHTML = '';

    this.room.seats.forEach((occupant, index) => {
      const label = this.room.seatLabels ? this.room.seatLabels[index] : `G${index + 1}`;
      const isVipSeat = (index >= 5 && index < 10);
      const isCoupleSeat = index >= 10;
      const isMine = occupant && occupant.userId === this.you.id;
      const isOccupied = occupant && !isMine;

      const btn = document.createElement('button');
      btn.className = `seat-item ${isMine ? 'mine' : (isOccupied ? 'occupied' : 'vacant')}${isVipSeat ? ' vip-seat' : ''}${isCoupleSeat ? ' couple-seat' : ''}`;
      const avUrl = occupant && window.PixelAvatars ? window.PixelAvatars.getDataUrl(occupant.avatarId, 2) : '';

      let badgeHtml = '';
      if (isVipSeat) {
        badgeHtml = ' <small style="color:#fbbf24; font-size:10px;">👑 VIP</small>';
      } else if (isCoupleSeat) {
        badgeHtml = ' <small style="color:#fb7185; font-size:10px;">💖 ĐÔI</small>';
      }

      btn.innerHTML = `
        <span class="seat-code">${label}${badgeHtml}</span>
        ${avUrl ? `<img src="${avUrl}" style="width:24px; height:30px; image-rendering:pixelated;" alt="av" />` : ''}
        <span class="seat-occupant">${occupant ? occupant.name : (isCoupleSeat ? 'Ghế Đôi Trống' : (isVipSeat ? 'Ghế VIP' : 'Trống'))}</span>
      `;

      if (!isOccupied) {
        btn.addEventListener('click', () => {
          if (isVipSeat && !this.you.isVip && this.you.role !== 'admin') {
            this.showToast('👑 Hàng ghế B là Ghế VIP Nhung Đỏ! Hãy bấm "Mở Khóa VIP" trong Tài khoản để ngồi!', 'warning');
            return;
          }
          this.handleSeatSelection(index);
        });
      } else {
        btn.addEventListener('click', () => {
          this.closeModal('modal-seats');
          this.openRoomMembersModal(occupant.userId);
        });
        btn.title = `Bấm để tương tác với ${occupant.name}`;
      }

      if (index < 5) {
        rowA.appendChild(btn);
      } else if (index < 10) {
        rowB.appendChild(btn);
      } else if (rowC) {
        rowC.appendChild(btn);
      }
    });

    if (leaveBtn) leaveBtn.classList.toggle('hidden', this.you.seatId === null);
  }

  renderQueueModal() {
    if (!this.room) return;
    const canControl = this.canControlRoom();
    const cur = this.room.currentVideo;
    const btnStopCurrent = document.getElementById('btn-stop-current');
    const defaultPoster = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80';

    if (cur) {
      document.getElementById('qc-thumb').src = cur.thumbnail || defaultPoster;
      document.getElementById('qc-title').textContent = cur.title;
      document.getElementById('qc-author').textContent = cur.author || '';
      document.getElementById('qc-requester').textContent = cur.requester ? `Bởi: ${cur.requester}` : '';
      if (btnStopCurrent) btnStopCurrent.classList.toggle('hidden', !canControl);
    } else {
      document.getElementById('qc-thumb').src = defaultPoster;
      document.getElementById('qc-title').textContent = 'Chưa phát video';
      document.getElementById('qc-author').textContent = '';
      document.getElementById('qc-requester').textContent = '';
      if (btnStopCurrent) btnStopCurrent.classList.add('hidden');
    }

    // Render Catalog quick-add for Host
    const catGrid = document.getElementById('queue-catalog-list');
    if (catGrid) {
      const movies = this.catalog?.movies || [];
      catGrid.innerHTML = movies.map(m => `
        <div class="queue-catalog-item">
          <img src="${m.poster}" alt="${m.title}" />
          <div class="qci-info">
            <div class="qci-title" title="${m.title}">${m.isVipOnly ? '👑 ' : ''}${m.title}</div>
            <small style="font-size:10px; color:#9ca3af;">${m.genre}</small>
          </div>
          ${canControl ? `<button type="button" data-queue-movie="${m.id}">+ Hàng chờ</button>` : ''}
        </div>
      `).join('');

      catGrid.querySelectorAll('[data-queue-movie]').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = movies.find(x => x.id === btn.getAttribute('data-queue-movie'));
          if (!m) return;
          if (m.isVipOnly && !this.you?.isVip && this.you?.role !== 'admin') {
            this.showToast('👑 Bộ phim này chỉ dành cho tài khoản Gói VIP!', 'error');
            return;
          }
          this.send('queue-video', {
            url: m.videoUrl,
            title: m.title,
            movieId: m.id
          });
        });
      });
    }

    // Render Sequential Queue List
    const qCount = document.getElementById('queue-count');
    const qList = document.getElementById('queue-list');
    const queue = this.room.queue || [];
    if (qCount) qCount.textContent = queue.length;
    if (!qList) return;

    if (queue.length === 0) {
      qList.innerHTML = `<div class="empty-queue-msg">Chưa có video nào trong danh sách chờ.</div>`;
      return;
    }

    qList.innerHTML = queue.map((item, idx) => `
      <div class="queue-item" style="cursor: ${canControl ? 'pointer' : 'default'};" data-play-q="${idx}" title="${canControl ? 'Bấm để phát bài này ngay' : ''}">
        <span class="q-index">#${idx + 1}</span>
        <img src="${item.thumbnail || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'}" alt="Thumb" />
        <div class="q-meta" style="flex:1;">
          <span class="q-title">${item.title}</span>
          <span class="q-sub">Bởi: ${item.requester}</span>
        </div>
        ${canControl ? `
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="adm-btn gold" data-play-btn="${idx}" title="Phát bài này ngay">Phát ngay</button>
            <button type="button" class="adm-btn danger" data-remove-q="${idx}" title="Xoá khỏi hàng chờ">Xoá</button>
          </div>
        ` : ''}
      </div>
    `).join('');

    if (canControl) {
      qList.querySelectorAll('[data-play-q]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-remove-q]')) return;
          const idx = parseInt(el.getAttribute('data-play-q'), 10);
          this.send('play-queue-item', { index: idx });
        });
      });
    }

    qList.querySelectorAll('[data-remove-q]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.send('remove-queue-item', { index: parseInt(btn.getAttribute('data-remove-q'), 10) });
      });
    });
  }

  toggleChat(forceState = null) {
    const drawer = document.getElementById('chat-drawer');
    const badge = document.getElementById('chat-unread-badge');
    if (!drawer) return;
    this.isChatOpen = forceState !== null ? forceState : !this.isChatOpen;
    drawer.classList.toggle('open', this.isChatOpen);
    if (this.isChatOpen && badge) {
      this.unreadChatCount = 0;
      badge.classList.add('hidden');
    }
  }

  appendChatMessage(msg, isNew = true) {
    const feed = document.getElementById('chat-feed');
    if (!feed) return;

    const div = document.createElement('div');
    div.className = 'chat-msg' + (msg.isVip ? ' is-vip-user' : '');
    div.setAttribute('data-chat-id', msg.id);

    const avUrl = window.PixelAvatars ? window.PixelAvatars.getDataUrl(msg.avatarId || 'pixel_nerd', 2) : '';
    const badges = [];
    if (msg.role === 'admin') badges.push('🛡️ Admin');
    else if (msg.isHost) badges.push('👑 Host');
    if (msg.isVip) badges.push('💎 VIP');

    let bodyContent = this.escapeHTML(msg.text);
    if (msg.sticker && (msg.sticker.url || msg.sticker.id || msg.sticker.name)) {
      // Normalize URL: luôn đảm bảo dùng file PNG nội bộ siêu nét, loại bỏ triệt để Giphy/Tenor
      let finalStickerUrl = msg.sticker.url || '';
      if (!finalStickerUrl || finalStickerUrl.includes('giphy.com') || finalStickerUrl.includes('tenor.com')) {
        finalStickerUrl = '';
      }
      const matched = [...this.stickersCatalog, ...this.memesCatalog].find(
        item => (msg.sticker.id && item.id === msg.sticker.id) ||
                (msg.sticker.name && item.name.toLowerCase() === msg.sticker.name.toLowerCase()) ||
                (finalStickerUrl && finalStickerUrl.includes(item.id.replace('stk_', '').replace('meme_', '')))
      );
      if (matched) {
        finalStickerUrl = matched.url;
      } else {
        const sName = (msg.sticker.name || '').toLowerCase();
        if (sName.includes('cháy') || sName.includes('fire')) finalStickerUrl = '/stickers/fire.png';
        else if (sName.includes('cười') || sName.includes('laugh')) finalStickerUrl = '/stickers/laugh.png';
        else if (sName.includes('khóc') || sName.includes('cry')) finalStickerUrl = '/stickers/cry.png';
        else if (sName.includes('tim') || sName.includes('heart')) finalStickerUrl = '/stickers/heart.png';
        else if (sName.includes('mèo') || sName.includes('cat')) finalStickerUrl = '/stickers/cat.png';
        else if (sName.includes('vỗ') || sName.includes('clap')) finalStickerUrl = '/stickers/clap.png';
        else if (sName.includes('tiệc') || sName.includes('party')) finalStickerUrl = '/stickers/party.png';
        else if (sName.includes('kính') || sName.includes('ngầu')) finalStickerUrl = '/stickers/cool.png';
        else if (sName.includes('ếch') || sName.includes('pepe')) finalStickerUrl = '/memes/pepe.png';
        else finalStickerUrl = '/stickers/popcorn.png';
      }

      bodyContent = `
        <div class="chat-sticker-bubble">
          <img src="${this.escapeHTML(finalStickerUrl)}" alt="${this.escapeHTML(msg.sticker.name || 'sticker')}" class="chat-sticker-img" loading="lazy" onerror="this.onerror=null; this.src='/stickers/popcorn.png';" />
          <span class="chat-sticker-label" style="font-size:11px; color:#9ca3af; margin-top:2px;">[${msg.sticker.isMeme ? 'Meme' : 'Sticker'}: ${this.escapeHTML(msg.sticker.name || '')}]</span>
        </div>
      `;
    } else if (msg.isGiftNotice) {
      bodyContent = `<div style="color: #fbbf24; font-weight: 700; display:flex; align-items:center; gap:6px;">${this.escapeHTML(msg.text)}</div>`;
    }

    div.innerHTML = `
      <div class="msg-head">
        <span class="msg-author" style="color: ${msg.color || '#f2cf78'}; display:flex; align-items:center; gap:5px;">
          ${avUrl ? `<img src="${avUrl}" style="width:18px; height:22px; image-rendering:pixelated;" alt="av" />` : ''}
          ${this.escapeHTML(msg.name)}
          ${badges.length ? `<span class="msg-seat-badge">${badges.join(' · ')}</span>` : ''}
        </span>
        <span class="msg-time">${msg.time || ''}</span>
      </div>
      <div class="msg-body">${bodyContent}</div>
    `;

    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;

    if (isNew && !this.isChatOpen) {
      this.unreadChatCount++;
      document.getElementById('chat-unread-badge')?.classList.remove('hidden');
    }
  }

  showScreenPostOverlay(post) {
    if (!post) return;
    const overlay = document.getElementById('screen-projection');
    document.getElementById('projection-img').src = post.image;
    document.getElementById('projection-caption').textContent = post.caption || '';
    document.getElementById('projection-sender').textContent = `Từ: ${post.senderName}`;
    overlay?.classList.remove('hidden');
  }

  hideScreenPostOverlay() {
    document.getElementById('screen-projection')?.classList.add('hidden');
  }

  openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
  }

  closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  }

  // --- Real-Time Two-Way / Multi-User Voice Chat Engine ---
  async toggleVoiceMic() {
    if (this.inLobby || !this.room) return;
    if (this.isMicOn) {
      this.stopVoiceCapture(true);
    } else {
      await this.startVoiceCapture();
    }
  }

  async startVoiceCapture() {
    if (this.isMicOn) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showToast('⚠️ Trình duyệt không hỗ trợ thu âm Microphone.', 'error');
      return;
    }

    try {
      this.ensureVoicePlayCtx();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      this.voiceStream = stream;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.voiceCaptureCtx = new AudioContextClass();
      if (this.voiceCaptureCtx.state === 'suspended') {
        await this.voiceCaptureCtx.resume().catch(() => {});
      }

      const source = this.voiceCaptureCtx.createMediaStreamSource(stream);
      const processor = this.voiceCaptureCtx.createScriptProcessor(4096, 1, 1);
      const inputRate = this.voiceCaptureCtx.sampleRate || 48000;
      const targetRate = 16000;

      this.voiceSourceNode = source;
      this.voiceProcessor = processor;
      this.isMicOn = true;

      this.updateVoiceMicUI(true, false);
      this.send('voice-state', { micOn: true });

      processor.onaudioprocess = (ev) => {
        if (!this.isMicOn || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const input = ev.inputBuffer.getChannelData(0);

        // Compute RMS volume level for voice activity detection
        let sumSq = 0;
        for (let i = 0; i < input.length; i++) {
          sumSq += input[i] * input[i];
        }
        const rms = Math.sqrt(sumSq / input.length);
        const now = Date.now();

        if (rms > 0.008) {
          this.lastVoiceSentAt = now;
        }

        const isSpeakingNow = (now - this.lastVoiceSentAt) < 420;
        this.updateVoiceMicUI(true, rms > 0.012);

        if (!isSpeakingNow) return;

        // Downsample to 16000 Hz mono Int16 PCM
        const ratio = inputRate / targetRate;
        const outLen = Math.max(1, Math.floor(input.length / ratio));
        const pcm16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const idx = Math.min(input.length - 1, Math.floor(i * ratio));
          const s = Math.max(-1, Math.min(1, input[idx] * 1.35));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = window.btoa(binary);
        this.send('voice-chunk', {
          data: b64,
          sampleRate: targetRate
        });
      };

      source.connect(processor);
      processor.connect(this.voiceCaptureCtx.destination);
    } catch {
      this.showToast('🎙️ Vui lòng cấp quyền Microphone trên trình duyệt để nói chuyện!', 'error');
      this.stopVoiceCapture(false);
    }
  }

  stopVoiceCapture(notifyServer = true) {
    const wasOn = this.isMicOn;
    this.isMicOn = false;

    if (this.voiceProcessor) {
      try {
        this.voiceProcessor.onaudioprocess = null;
        this.voiceProcessor.disconnect();
      } catch {}
      this.voiceProcessor = null;
    }
    if (this.voiceSourceNode) {
      try { this.voiceSourceNode.disconnect(); } catch {}
      this.voiceSourceNode = null;
    }
    if (this.voiceStream) {
      try {
        this.voiceStream.getTracks().forEach(t => t.stop());
      } catch {}
      this.voiceStream = null;
    }
    if (this.voiceCaptureCtx) {
      try { this.voiceCaptureCtx.close(); } catch {}
      this.voiceCaptureCtx = null;
    }

    this.updateVoiceMicUI(false, false);
    if (notifyServer && wasOn) {
      this.send('voice-state', { micOn: false });
    }
    this.updateVoiceSpeakersPill();
  }

  ensureVoicePlayCtx() {
    if (!this.voicePlayCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.voicePlayCtx = new AudioContextClass();
      }
    }
    if (this.voicePlayCtx && this.voicePlayCtx.state === 'suspended') {
      this.voicePlayCtx.resume().catch(() => {});
    }
    return this.voicePlayCtx;
  }

  handleIncomingVoiceChunk(payload) {
    if (!payload || !payload.data || !payload.userId) return;
    if (this.you && payload.userId === this.you.id) return;

    const ctx = this.ensureVoicePlayCtx();
    if (!ctx) return;

    try {
      const binary = window.atob(payload.data);
      const byteLen = binary.length;
      if (byteLen < 4) return;

      const bytes = new Uint8Array(byteLen);
      for (let i = 0; i < byteLen; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const sampleRate = Number(payload.sampleRate) || 16000;
      const audioBuffer = ctx.createBuffer(1, pcm16.length, sampleRate);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channel[i] = pcm16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.45;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;
      let startAt = this.voiceNextPlayTime.get(payload.userId) || 0;
      if (startAt < now || startAt > now + 0.45) {
        startAt = now + 0.03;
      }
      source.start(startAt);
      this.voiceNextPlayTime.set(payload.userId, startAt + audioBuffer.duration);

      // Highlight active speaker in top pill
      const prev = this.activeSpeakers.get(payload.userId);
      if (prev && prev.timer) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        this.activeSpeakers.delete(payload.userId);
        this.updateVoiceSpeakersPill();
      }, 650);
      this.activeSpeakers.set(payload.userId, {
        name: payload.name || 'Khán giả',
        color: payload.color || '#34d399',
        timer
      });
      this.updateVoiceSpeakersPill();
    } catch {}
  }

  updateVoiceMicUI(micOn, isSpeaking = false) {
    const btnBottom = document.getElementById('btn-voice-mic');
    const iconBottom = document.getElementById('voice-mic-icon');
    const textBottom = document.getElementById('voice-mic-text');

    const btnTop = document.getElementById('btn-hud-mic');
    const iconTop = document.getElementById('hud-mic-icon');
    const textTop = document.getElementById('hud-mic-label');

    if (btnBottom) {
      btnBottom.classList.toggle('active', !!micOn);
      btnBottom.classList.toggle('speaking', !!(micOn && isSpeaking));
    }
    if (btnTop) {
      btnTop.classList.toggle('active', !!micOn);
      btnTop.classList.toggle('speaking', !!(micOn && isSpeaking));
    }

    const nextIcon = micOn ? 'mic' : 'mic-off';
    const nextLabel = micOn ? 'Tắt Mic' : 'Bật Mic';

    if (iconBottom && iconBottom.getAttribute('data-lucide') !== nextIcon) {
      iconBottom.setAttribute('data-lucide', nextIcon);
      this.refreshIcons();
    }
    if (iconTop && iconTop.getAttribute('data-lucide') !== nextIcon) {
      iconTop.setAttribute('data-lucide', nextIcon);
      this.refreshIcons();
    }
    if (textBottom) textBottom.textContent = nextLabel;
    if (textTop) textTop.textContent = nextLabel;

    if (this.you) {
      this.you.micOn = !!micOn;
    }
    this.updateVoiceSpeakersPill();
  }

  updateVoiceSpeakersPill() {
    const pill = document.getElementById('voice-speakers-pill');
    const textEl = document.getElementById('voice-speakers-text');
    if (!pill || !textEl) return;

    const names = [];
    if (this.isMicOn && this.you?.name) {
      names.push(`🎙️ Bạn (${this.you.name})`);
    }
    for (const [uid, info] of this.activeSpeakers.entries()) {
      if (!this.you || uid !== this.you.id) {
        names.push(`🔊 ${info.name}`);
      }
    }
    if (this.room && Array.isArray(this.room.seats)) {
      this.room.seats.forEach((s) => {
        if (s && s.micOn && (!this.you || s.userId !== this.you.id) && !this.activeSpeakers.has(s.userId)) {
          names.push(`🎙️ ${s.name}`);
        }
      });
    }

    if (names.length === 0 || this.inLobby) {
      pill.classList.add('hidden');
    } else {
      textEl.textContent = names.join(' · ');
      pill.classList.remove('hidden');
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container || !message) return;
    container.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  // ==================== STICKERS & MEMES IN CHAT ====================
  initStickerDrawer() {
    const btnChatSticker = document.getElementById('btn-chat-sticker');
    const stickerPopover = document.getElementById('sticker-popover');
    const btnCloseStickers = document.getElementById('btn-close-stickers');

    btnChatSticker?.addEventListener('click', (e) => {
      e.stopPropagation();
      stickerPopover?.classList.toggle('hidden');
      this.renderStickerGrid();
    });

    btnCloseStickers?.addEventListener('click', () => {
      stickerPopover?.classList.add('hidden');
    });

    document.querySelectorAll('.sticker-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sticker-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeStickerTab = btn.getAttribute('data-sticker-tab') || 'stickers';
        this.renderStickerGrid();
      });
    });

    document.addEventListener('click', (e) => {
      if (stickerPopover && !stickerPopover.contains(e.target) && e.target !== btnChatSticker) {
        stickerPopover.classList.add('hidden');
      }
    });
  }

  renderStickerGrid() {
    const grid = document.getElementById('sticker-grid');
    if (!grid) return;
    const items = this.activeStickerTab === 'stickers' ? this.stickersCatalog : this.memesCatalog;
    grid.innerHTML = items.map((item) => `
      <div class="sticker-item" data-sticker-id="${item.id}" title="${item.name}">
        <img src="${item.url}" alt="${item.name}" loading="lazy" />
        <span>${item.name}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.sticker-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-sticker-id');
        const item = items.find(s => s.id === id);
        if (item) {
          this.send('chat', {
            text: '',
            sticker: {
              id: item.id,
              name: item.name,
              url: item.url,
              isMeme: this.activeStickerTab === 'memes'
            }
          });
          document.getElementById('sticker-popover')?.classList.add('hidden');
        }
      });
    });
  }

  // ==================== MINI-GAME & POLLS OVERLAY ====================
  initPollHandlers() {
    // Open Poll Maker
    document.getElementById('btn-open-poll-maker')?.addEventListener('click', () => {
      this.openPollModal();
    });

    // Preset buttons in Poll Modal
    document.querySelectorAll('.preset-tag-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        const qInput = document.getElementById('poll-input-question');
        const optInputs = document.querySelectorAll('.poll-option-input');
        if (preset === 'culprit') {
          if (qInput) qInput.value = '🕵️ Theo bạn ai là kẻ chủ mưu trong vụ này?';
          if (optInputs[0]) optInputs[0].value = 'Bác quản gia';
          if (optInputs[1]) optInputs[1].value = 'Người bạn thân';
          if (optInputs[2]) optInputs[2].value = 'Nhân vật bí ẩn';
          if (optInputs[3]) optInputs[3].value = 'Bị người khác hãm hại';
        } else if (preset === 'survive') {
          if (qInput) qInput.value = '⚔️ Liệu nhân vật chính có qua khỏi cảnh này?';
          if (optInputs[0]) optInputs[0].value = 'Sống sót kỳ tích 🔥';
          if (optInputs[1]) optInputs[1].value = 'Bay màu không kịp ngáp 💀';
          if (optInputs[2]) optInputs[2].value = 'Được đồng đội cứu';
          if (optInputs[3]) optInputs[3].value = '';
        } else if (preset === 'rating') {
          if (qInput) qInput.value = '⭐ Phân cảnh vừa rồi xứng đáng mấy điểm?';
          if (optInputs[0]) optInputs[0].value = '10/10 Quá xuất sắc! 🍿';
          if (optInputs[1]) optInputs[1].value = '8/10 Tạm ổn, cuốn';
          if (optInputs[2]) optInputs[2].value = '5/10 Hơi thất vọng';
          if (optInputs[3]) optInputs[3].value = '';
        }
      });
    });

    // Submit Create Poll
    document.getElementById('form-create-poll')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const question = document.getElementById('poll-input-question')?.value.trim();
      const options = Array.from(document.querySelectorAll('.poll-option-input'))
        .map(i => i.value.trim())
        .filter(v => v.length > 0);

      if (!question || options.length < 2) {
        this.showToast('⚠️ Vui lòng nhập câu hỏi và ít nhất 2 lựa chọn!', 'warning');
        return;
      }

      this.send('create-poll', { question, options });
      this.closeModal('modal-create-poll');
      document.getElementById('form-create-poll')?.reset();
    });

    // Close / Minimize Poll Card
    document.getElementById('btn-close-poll-overlay')?.addEventListener('click', () => {
      document.getElementById('room-poll-overlay')?.classList.add('hidden');
    });

    // Host End Poll Button
    document.getElementById('btn-host-end-poll')?.addEventListener('click', () => {
      if (!this.canControlRoom()) return;
      this.send('end-poll');
    });
  }

  openPollModal() {
    if (!this.canControlRoom()) {
      this.showToast('🔒 Chỉ Chủ phòng (Host) hoặc Admin mới được tạo bình chọn!', 'error');
      return;
    }
    this.openModal('modal-create-poll');
    this.refreshIcons();
  }

  renderPollOverlay(poll) {
    const card = document.getElementById('room-poll-overlay');
    if (!card || !poll) return;

    card.classList.remove('hidden');

    const qText = document.getElementById('poll-question-text');
    if (qText) qText.textContent = poll.question;

    const btnHostEnd = document.getElementById('btn-host-end-poll');
    if (btnHostEnd) {
      btnHostEnd.classList.toggle('hidden', !this.canControlRoom() || !poll.active);
    }

    const votersCount = document.getElementById('poll-voters-count');
    if (votersCount) votersCount.textContent = `${poll.totalVotes || 0} lượt bình chọn`;

    const statusTag = document.getElementById('poll-status-tag');
    if (statusTag) {
      statusTag.className = `poll-status-tag ${poll.active ? 'active' : 'ended'}`;
      statusTag.textContent = poll.active ? 'Đang diễn ra' : 'Đã kết thúc';
    }

    const optList = document.getElementById('poll-options-list');
    if (!optList) return;

    const total = poll.totalVotes || 0;
    const myVote = this.you && poll.userVotes ? poll.userVotes[this.you.id] : undefined;
    let maxVotes = -1;
    let winnerId = -1;
    if (!poll.active && poll.options) {
      poll.options.forEach(o => {
        if (o.votes > maxVotes) {
          maxVotes = o.votes;
          winnerId = o.id;
        }
      });
    }

    optList.innerHTML = poll.options.map((opt) => {
      const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
      const isMyPick = myVote === opt.id;
      const isWin = !poll.active && opt.id === winnerId && opt.votes > 0;
      return `
        <button type="button" class="poll-option-btn ${isMyPick ? 'voted' : ''} ${isWin ? 'winner' : ''}" data-poll-opt="${opt.id}" ${!poll.active ? 'disabled' : ''}>
          <div class="poll-bar-fill" style="width: ${pct}%;"></div>
          <span class="poll-option-text">
            ${isWin ? '👑 ' : ''}${isMyPick ? '✓ ' : ''}${this.escapeHTML(opt.text)}
          </span>
          <span class="poll-option-percent">${pct}% (${opt.votes})</span>
        </button>
      `;
    }).join('');

    if (poll.active) {
      optList.querySelectorAll('[data-poll-opt]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const optId = parseInt(btn.getAttribute('data-poll-opt'), 10);
          this.send('vote-poll', { pollId: poll.id, optionId: optId });
          this.playPopSound();
        });
      });
    }
  }

  hidePollOverlay() {
    document.getElementById('room-poll-overlay')?.classList.add('hidden');
  }

  // ==================== VIRTUAL GIFTS ====================
  initGiftHandlers() {
    document.getElementById('btn-open-gifts')?.addEventListener('click', () => {
      this.openGiftModal();
    });

    document.getElementById('btn-claim-free-coins')?.addEventListener('click', () => {
      this.send('claim-coins');
    });
  }

  openGiftModal() {
    this.openModal('modal-gifts');
    this.updateCoinsUI();
    this.renderGiftsGrid();
  }

  updateCoinsUI() {
    const coins = (this.you && typeof this.you.coins === 'number') ? this.you.coins : 1000;
    const el = document.getElementById('user-coins-display');
    if (el) el.textContent = `🪙 ${coins.toLocaleString('vi-VN')} Xu`;
  }

  renderGiftsGrid() {
    const grid = document.getElementById('gifts-grid');
    if (!grid) return;
    const userCoins = (this.you && typeof this.you.coins === 'number') ? this.you.coins : 1000;

    grid.innerHTML = this.virtualGifts.map((gift) => `
      <div class="gift-card" data-gift-id="${gift.id}">
        <span class="gift-card-icon">${gift.icon}</span>
        <span class="gift-card-name">${gift.name}</span>
        <span class="gift-card-cost">🪙 ${gift.cost} Xu</span>
        <span class="gift-card-desc">${gift.desc}</span>
        <button type="button" class="btn-send-gift-act" ${userCoins < gift.cost ? 'style="opacity:0.6;"' : ''}>
          Tặng ngay
        </button>
      </div>
    `).join('');

    grid.querySelectorAll('.gift-card').forEach((card) => {
      card.addEventListener('click', () => {
        const giftId = card.getAttribute('data-gift-id');
        this.send('send-gift', { giftId });
        this.closeModal('modal-gifts');
      });
    });
  }

  showGiftCelebration(event) {
    if (!event) return;
    this.playGiftSound();

    // 1. Center-Screen Grand Gift Celebration (Hiệu ứng quà tặng cực to giữa màn hình lớn)
    const centerOverlay = document.getElementById('cinema-center-gift-overlay');
    if (centerOverlay) {
      centerOverlay.innerHTML = '';
      const centerCard = document.createElement('div');
      centerCard.className = 'center-gift-card';
      centerCard.innerHTML = `
        <div class="center-gift-sunburst"></div>
        <div class="center-gift-icon-wrap">${event.giftIcon}</div>
        <div class="center-gift-sender">✨ ${this.escapeHTML(event.senderName)} ĐÃ TẶNG CHỦ PHÒNG</div>
        <div class="center-gift-title">${this.escapeHTML(event.giftName)}</div>
        <div class="center-gift-cost">🪙 +${event.giftCost} XU HOÀNG GIA</div>
      `;
      centerOverlay.appendChild(centerCard);

      // Burst glowing particles around center of screen
      const particleEmojis = ['✨', '💎', '🎉', '💖', event.giftIcon, '⭐', '🍿', '👑'];
      for (let i = 0; i < 20; i++) {
        const p = document.createElement('span');
        p.className = 'center-gift-particle';
        p.textContent = particleEmojis[i % particleEmojis.length];
        const angle = (i / 20) * 2 * Math.PI + (Math.random() * 0.3 - 0.15);
        const dist = 160 + Math.random() * 190;
        const dx = `${Math.cos(angle) * dist}px`;
        const dy = `${Math.sin(angle) * dist}px`;
        const rot = `${(Math.random() - 0.5) * 720}deg`;
        p.style.setProperty('--dx', dx);
        p.style.setProperty('--dy', dy);
        p.style.setProperty('--rot', rot);
        centerOverlay.appendChild(p);
      }

      setTimeout(() => {
        centerOverlay.innerHTML = '';
      }, 4800);
    }

    // 2. Trigger in-theater celebratory disco/spotlight lighting flash
    if (this.cinema) {
      if (typeof this.cinema.triggerGiftCelebrationLighting === 'function') {
        this.cinema.triggerGiftCelebrationLighting(event.giftCost || 100);
      }
      this.cinema.spawnDomFloatingEmoji(event.giftIcon);
      setTimeout(() => this.cinema.spawnDomFloatingEmoji(event.giftIcon), 250);
      setTimeout(() => this.cinema.spawnDomFloatingEmoji(event.giftIcon), 500);
    }

    // 3. Streamer gift banner across top
    const overlay = document.getElementById('gift-banner-overlay');
    if (!overlay) return;

    const banner = document.createElement('div');
    banner.className = 'gift-broadcast-banner';
    banner.innerHTML = `
      <span class="gift-banner-icon">${event.giftIcon}</span>
      <div class="gift-banner-content">
        <span class="gift-banner-sender">✨ ${this.escapeHTML(event.senderName)} đã tặng Chủ phòng</span>
        <span class="gift-banner-title">${this.escapeHTML(event.giftName)} (+${event.giftCost} Xu)!</span>
      </div>
    `;

    overlay.appendChild(banner);
    setTimeout(() => {
      banner.remove();
    }, 4600);
  }

  escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new CinemaApp();
});
