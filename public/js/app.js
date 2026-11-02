/**
 * wetube ciné mini - Main Application Controller
 * Multi-Room (Max 5 rooms, 10 VIP seats each, 100% real users)
 * Full synchronized playback (Play/Pause/Seek) and Auto-Hide HUD
 */

class CinemaApp {
  constructor() {
    this.ws = null;
    this.you = null;
    this.room = null;
    this.clockOffset = 0;
    this.unreadChatCount = 0;
    this.isChatOpen = false;

    // Room Selection (URL query parameter or default to Lobby)
    const urlParams = new URLSearchParams(window.location.search);
    this.currentRoomId = urlParams.get('room') || null;
    this.inLobby = !this.currentRoomId;
    this.roomsList = [];

    // Web Audio Synthesizer for UI sound effects
    this.audioCtx = null;

    // Initialize 3D Engine & Player safely
    this.cinema = new CinemaScene('canvas-container', 'css3d-container');
    this.player = new CinemaPlayer();

    // Hook Player & Cinema callbacks
    this.cinema.onSeatClick = (seatId) => this.handleSeatSelection(seatId);
    this.player.onDurationDiscovered = (id, dur) => this.reportDuration(id, dur);
    this.player.onAudioBlocked = () => this.showAudioBlockedBanner();
    this.player.onVideoEnded = () => this.send('skip-now', {});
    this.player.onPlaybackError = (id, err) => {
      this.send('skip-now', {});
      this.showToast('⚠️ Video không phát được, đang tự động chuyển bài tiếp theo...', 'info');
    };

    // Playback sync callbacks
    this.player.onStateToggled = (isPlaying) => {
      this.send('toggle-pause', { isPlaying });
      this.updatePlayPauseButtonUI(isPlaying);
    };
    this.player.onSeekRequested = (time) => {
      this.send('seek-video', { time });
    };
    this.player.onProgressUpdate = (cur, dur, percent) => {
      this.updatePlaybackBarUI(cur, dur, percent);
    };

    if (this.inLobby) {
      this.showLobbyUI();
    }

    this.initWebSocket();
    this.bindUIEvents();
    this.refreshIcons();
  }

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // --- Web Audio SFX ---
  initAudioContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
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
      gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch {}
  }

  playChimeSound() {
    this.initAudioContext();
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime);
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch {}
  }

  // --- WebSocket Connection & Sync ---
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const roomParam = this.currentRoomId ? `?room=${encodeURIComponent(this.currentRoomId)}` : '';
    const wsUrl = `${protocol}//${window.location.host}/${roomParam}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('🎬 Đã kết nối với máy chủ rạp phim!');
      this.syncClock();
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
      console.warn('Mất kết nối máy chủ, đang thử kết nối lại sau 3s...');
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

      case 'lobby-init': {
        this.inLobby = true;
        this.you = payload.you;
        this.currentRoomId = null;
        this.roomsList = payload.availableRooms || [];

        if (this.player) {
          this.player.pauseVideo();
        }

        this.showLobbyUI();
        this.updateProfileUI();
        this.renderLobbyRooms(this.roomsList);
        this.renderRoomsModal(this.roomsList);
        break;
      }

      case 'init': {
        this.inLobby = false;
        this.you = payload.you;
        this.room = payload.room;
        this.currentRoomId = payload.room.roomId;

        this.hideLobbyUI();

        // Update URL to ?room=phong-X without reloading
        const url = new URL(window.location.href);
        url.searchParams.set('room', this.currentRoomId);
        window.history.replaceState({}, '', url.toString());

        const roomBadgeText = document.getElementById('current-room-name');
        if (roomBadgeText) roomBadgeText.textContent = payload.room.roomName || 'Phòng 01';

        this.updateProfileUI();

        this.cinema.updateSeats(this.room.seats);
        this.cinema.updateStageUser(this.room.stageUser, this.room.realUsers, this.you.id);
        this.cinema.setPartyMode(this.room.partyMode);
        this.updatePartyModeUI(this.room.partyMode);

        this.player.syncVideo(this.room.currentVideo, this.clockOffset);
        this.updateNowPlayingUI();
        this.updateOccupancyUI();
        this.updateSkipVoteUI();
        this.renderSeatMapModal();
        this.renderQueueModal();
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
              <p>Chào mừng bạn đến với <strong>${this.room.roomName}</strong>!</p>
              <p class="sub">Rạp 10 ghế người thật. Bấm nút <strong>"Mời bạn bè"</strong> để gửi link phòng này cho bạn bè nhé!</p>
            </div>
          `;
        }

        if (payload.recentMessages && Array.isArray(payload.recentMessages)) {
          payload.recentMessages.forEach((m) => this.appendChatMessage(m, false));
        }

        this.showToast(`Chào mừng bạn vào "${this.room.roomName}"!`, 'success');
        break;
      }

      case 'rooms-list-updated': {
        this.roomsList = payload.rooms || [];
        this.renderRoomsModal(this.roomsList);
        this.renderLobbyRooms(this.roomsList);
        break;
      }

      case 'profile-updated': {
        this.you = payload;
        this.updateProfileUI();
        const lobbyName = document.getElementById('lobby-user-name');
        const lobbyColor = document.getElementById('lobby-user-color');
        if (lobbyName) lobbyName.textContent = this.you.name;
        if (lobbyColor) lobbyColor.style.background = this.you.color;
        break;
      }

      case 'seat-state': {
        this.room.seats = payload.seats;
        if (payload.stageUser !== undefined) this.room.stageUser = payload.stageUser;
        if (payload.movedUser && payload.movedUser.id === this.you.id) {
          this.you.seatId = payload.movedUser.seatId;
        }

        this.cinema.updateSeats(this.room.seats);
        this.renderSeatMapModal();
        this.updateOccupancyUI();
        this.updateProfileUI();

        if (this.cinema.cameraMode === 'seat') {
          this.cinema.setCameraMode('seat', this.you.seatId);
        }
        break;
      }

      case 'stage-state': {
        this.room.stageUser = payload.stageUser;
        if (payload.seats) this.room.seats = payload.seats;

        this.cinema.updateStageUser(this.room.stageUser, this.room.realUsers || [], this.you.id);
        this.updateStageButtonUI();
        break;
      }

      case 'video-changed': {
        this.room.currentVideo = payload.currentVideo;
        this.room.queue = payload.queue;
        this.room.skipVotesCount = 0;

        this.player.syncVideo(this.room.currentVideo, this.clockOffset);
        this.updateNowPlayingUI();
        this.updateSkipVoteUI();
        this.renderQueueModal();
        break;
      }

      case 'playback-sync': {
        this.player.applyPlaybackSync(payload);
        this.updatePlayPauseButtonUI(payload.isPlaying);
        break;
      }

      case 'queue-updated': {
        this.room.queue = payload.queue;
        this.renderQueueModal();
        break;
      }

      case 'skip-votes-updated': {
        this.room.skipVotesCount = payload.votesCount;
        this.room.requiredSkipVotes = payload.required;
        this.updateSkipVoteUI();
        break;
      }

      case 'party-mode-toggled': {
        this.room.partyMode = payload.partyMode;
        this.cinema.setPartyMode(this.room.partyMode);
        this.updatePartyModeUI(this.room.partyMode);
        break;
      }

      case 'screen-post-started': {
        this.showScreenProjection(payload.screenPost);
        break;
      }

      case 'screen-post-ended': {
        this.hideScreenProjection();
        break;
      }

      case 'chat-message': {
        this.appendChatMessage(payload, true);
        this.cinema.showSpeechBubble(payload.userId, payload.text, payload.seatId, this.room.stageUser === payload.userId);
        break;
      }

      case 'emoji-reaction': {
        this.cinema.spawnEmojiReaction(payload.emoji, payload.seatId, payload.isOnStage);
        this.playPopSound();
        break;
      }

      case 'notification': {
        this.showToast(payload.message, payload.type || 'info');
        break;
      }

      case 'user-joined': {
        this.room.onlineCount = payload.onlineCount;
        if (payload.seats) this.room.seats = payload.seats;
        this.updateOccupancyUI();
        this.renderSeatMapModal();
        this.showToast(`👋 ${payload.user.name} vừa vào rạp!`, 'info');
        break;
      }

      case 'user-left': {
        this.room.onlineCount = payload.onlineCount;
        if (payload.seats) this.room.seats = payload.seats;
        if (payload.stageUser !== undefined) this.room.stageUser = payload.stageUser;

        this.cinema.updateSeats(this.room.seats);
        this.cinema.updateStageUser(this.room.stageUser, this.room.realUsers || [], this.you?.id);
        this.updateOccupancyUI();
        this.renderSeatMapModal();
        break;
      }
    }
  }

  // --- Copy Invite Link Helper ---
  copyInviteLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.currentRoomId);
    const inviteUrl = url.toString();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        this.showToast(`📋 Đã sao chép link "${this.room?.roomName || 'Rạp Chiếu'}"! Hãy gửi cho bạn bè để cùng vào phòng này nhé.`, 'success');
      }).catch(() => {
        this.fallbackCopy(inviteUrl);
      });
    } else {
      this.fallbackCopy(inviteUrl);
    }
  }

  fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      this.showToast('📋 Đã sao chép link phòng! Hãy gửi cho bạn bè để cùng vào xem nhé.', 'success');
    } catch {
      prompt('Sao chép đường dẫn này để gửi cho bạn bè:', text);
    }
    document.body.removeChild(input);
  }

  // --- Multi-Room Directory Rendering & Switching ---
  renderRoomsModal(roomsList) {
    if (!Array.isArray(roomsList)) return;
    this.roomsList = roomsList;

    const countBadge = document.getElementById('rooms-count-badge');
    if (countBadge) countBadge.textContent = `${roomsList.length} / 5 phòng`;

    const btnSubmitCreate = document.getElementById('btn-submit-create-room');
    const inputCreate = document.getElementById('create-room-input');
    if (btnSubmitCreate && inputCreate) {
      const isMax = roomsList.length >= 5;
      btnSubmitCreate.disabled = isMax;
      inputCreate.disabled = isMax;
      if (isMax) {
        inputCreate.placeholder = 'Đã đạt giới hạn tối đa 5 phòng (Xoá bớt để tạo mới)';
      } else {
        inputCreate.placeholder = 'Nhập tên phòng (VD: Hội Bạn Thân, Cày Phim Đêm...)';
      }
    }

    const grid = document.getElementById('rooms-grid');
    if (!grid) return;

    grid.innerHTML = roomsList.map((r) => {
      const isCurrent = this.currentRoomId && r.id === this.currentRoomId;
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
            <img class="room-card-thumb" src="${r.currentVideoThumb || 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'}" alt="Thumb" />
            <div class="room-card-info">
              <div class="room-card-np" title="${r.currentVideoTitle}">${r.currentVideoTitle}</div>
              <small style="color: #9ca3af; font-size: 11px;">${r.usersCount} người · Tạo bởi: ${r.createdBy || 'Hệ thống'}</small>
            </div>
          </div>
          <div class="room-card-actions">
            <button class="room-card-btn ${isCurrent ? 'active-room' : ''}" data-room="${r.id}" ${isCurrent ? 'disabled' : ''}>
              ${isCurrent ? '✓ Đang ở phòng này' : 'Vào phòng này'}
            </button>
            <button class="room-delete-btn" data-delete-room="${r.id}" data-room-name="${r.name}" title="Xoá phòng này">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              <span>Xoá</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.refreshIcons();

    // Bind switch buttons
    grid.querySelectorAll('.room-card-btn:not(.active-room)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetRoomId = btn.dataset.room;
        this.switchRoom(targetRoomId);
      });
    });

    // Bind delete buttons
    grid.querySelectorAll('.room-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.dataset.deleteRoom;
        const roomName = btn.dataset.roomName;
        this.askDeleteRoom(roomId, roomName);
      });
    });
  }

  // --- Grand Lobby UI Management ---
  showLobbyUI() {
    this.inLobby = true;
    document.body.classList.add('in-lobby');
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.classList.remove('hidden');

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);

    if (this.you) {
      const nameEl = document.getElementById('lobby-user-name');
      const colorEl = document.getElementById('lobby-user-color');
      if (nameEl) nameEl.textContent = this.you.name;
      if (colorEl) colorEl.style.background = this.you.color;
    }
    this.refreshIcons();
  }

  hideLobbyUI() {
    this.inLobby = false;
    document.body.classList.remove('in-lobby');
    const lobbyScreen = document.getElementById('lobby-screen');
    if (lobbyScreen) lobbyScreen.classList.add('hidden');
    this.refreshIcons();
  }

  leaveToLobby() {
    this.send('leave-to-lobby', {});
    this.showLobbyUI();
    if (this.player) {
      this.player.pauseVideo();
    }
    this.closeModal('modal-rooms');
    this.showToast('Bạn đã rời phòng và quay về Sảnh Chờ.', 'info');
  }

  renderLobbyRooms(roomsList) {
    if (!Array.isArray(roomsList)) return;

    const countPill = document.getElementById('lobby-rooms-count-pill');
    if (countPill) countPill.textContent = `${roomsList.length} / 5 phòng đang mở`;

    const activeCountTag = document.getElementById('lobby-active-count-tag');
    if (activeCountTag) activeCountTag.textContent = `${roomsList.length} phòng`;

    const createBadge = document.getElementById('lobby-create-badge');
    const inputCreate = document.getElementById('lobby-create-room-input');
    const btnSubmit = document.getElementById('btn-lobby-submit-create');
    const isMax = roomsList.length >= 5;

    if (createBadge) createBadge.textContent = isMax ? 'Đã đạt tối đa 5/5 phòng' : `Đang mở: ${roomsList.length}/5 phòng`;
    if (inputCreate && btnSubmit) {
      inputCreate.disabled = isMax;
      btnSubmit.disabled = isMax;
      if (isMax) {
        inputCreate.placeholder = 'Đã đạt giới hạn tối đa 5 phòng (Xoá bớt phòng để tạo mới)';
      } else {
        inputCreate.placeholder = 'Nhập tên phòng chiếu (VD: Hội Bạn Cày Phim, Nghe Nhạc Chill...)';
      }
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
      const isCurrent = this.currentRoomId && r.id === this.currentRoomId;
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
            <img class="room-card-thumb" src="${r.currentVideoThumb || 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'}" alt="Thumb" />
            <div class="room-card-info">
              <div class="room-card-np" title="${r.currentVideoTitle}">${r.currentVideoTitle}</div>
              <small style="color: #9ca3af; font-size: 11px;">${r.usersCount} người · Tạo bởi: ${r.createdBy || 'Hệ thống'}</small>
            </div>
          </div>
          <div class="room-card-actions">
            <button class="room-card-btn" data-lobby-join="${r.id}">
              <i data-lucide="ticket" style="width: 14px; height: 14px;"></i>
              <span>Vào xem ngay</span>
            </button>
            <button class="room-delete-btn" data-delete-room="${r.id}" data-room-name="${r.name}" title="Xoá phòng này">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              <span>Xoá</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.refreshIcons();

    // Bind join buttons
    grid.querySelectorAll('[data-lobby-join]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roomId = btn.dataset.lobbyJoin;
        this.switchRoom(roomId);
      });
    });

    // Bind delete buttons
    grid.querySelectorAll('.room-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.dataset.deleteRoom;
        const roomName = btn.dataset.roomName;
        this.askDeleteRoom(roomId, roomName);
      });
    });
  }

  askDeleteRoom(roomId, roomName) {
    if (!roomId) return;
    this.pendingDeleteRoomId = roomId;
    const targetNameEl = document.getElementById('delete-room-target-name');
    if (targetNameEl) {
      targetNameEl.textContent = `"${roomName}"`;
    }
    this.openModal('modal-confirm-delete');
    this.refreshIcons();
  }

  confirmDeleteRoom() {
    if (!this.pendingDeleteRoomId) return;
    this.send('delete-room', { roomId: this.pendingDeleteRoomId });
    this.closeModal('modal-confirm-delete');
    this.pendingDeleteRoomId = null;
    this.showToast('Đang tiến hành xoá phòng...', 'info');
  }

  switchRoom(roomId) {
    if (!roomId) return;
    this.currentRoomId = roomId;

    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url.toString());

    this.send('join-room', { roomId });
    this.closeModal('modal-rooms');
    this.showToast('Đang vào phòng chiếu...', 'info');
  }

  // --- UI Bindings ---
  bindUIEvents() {
    // 1. Copy Invite Link
    const copyInviteBtns = [document.getElementById('btn-copy-invite'), document.getElementById('btn-modal-copy-invite')];
    copyInviteBtns.forEach((b) => {
      if (b) b.addEventListener('click', () => this.copyInviteLink());
    });

    // 1b. Theater 2D / 3D Mode Toggle
    const btnTheater = document.getElementById('btn-theater-mode');
    if (btnTheater) {
      btnTheater.addEventListener('click', () => {
        const is2D = this.cinema.toggleTheater2DMode();
        document.getElementById('theater-mode-label').textContent = is2D ? 'Toàn Cảnh 3D' : 'Tập trung màn hình';
        this.showToast(is2D ? 'Đã bật chế độ xem rạp cận cảnh' : 'Đã quay lại toàn cảnh rạp 3D', 'info');
      });
    }

    // 1c. Screen Click to Play & Unmute
    const screenIdle = document.getElementById('screen-idle');
    if (screenIdle) {
      screenIdle.addEventListener('click', () => {
        this.player.unmuteWithGesture();
        this.showToast('Âm thanh rạp phim đã sẵn sàng!', 'success');
      });
    }

    const btnPlayCenter = document.getElementById('btn-screen-play-center');
    if (btnPlayCenter) {
      btnPlayCenter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.player.unmuteWithGesture();
        this.showToast('Âm thanh rạp phim đã sẵn sàng!', 'success');
      });
    }

    const btnPlayerRetry = document.getElementById('btn-player-retry');
    if (btnPlayerRetry) {
      btnPlayerRetry.addEventListener('click', (e) => {
        e.stopPropagation();
        this.send('skip-now', {});
      });
    }

    // 1d. Room Picker & Creator Form
    const btnOpenRooms = document.getElementById('btn-open-rooms');
    if (btnOpenRooms) {
      btnOpenRooms.addEventListener('click', () => this.openModal('modal-rooms'));
    }

    const formCreateRoom = document.getElementById('form-create-room');
    if (formCreateRoom) {
      formCreateRoom.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('create-room-input');
        const name = input.value.trim();
        if (name) {
          this.send('create-room', { name });
          input.value = '';
          this.closeModal('modal-rooms');
        }
      });
    }

    const btnConfirmDelete = document.getElementById('btn-confirm-delete-room');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.confirmDeleteRoom());
    }

    const btnCancelDelete = document.getElementById('btn-cancel-delete-room');
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener('click', () => {
        this.pendingDeleteRoomId = null;
        this.closeModal('modal-confirm-delete');
      });
    }

    // 1d-lobby: Grand Lobby Actions
    const formLobbyCreate = document.getElementById('form-lobby-create-room');
    if (formLobbyCreate) {
      formLobbyCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('lobby-create-room-input');
        const name = input.value.trim();
        if (name) {
          this.send('create-room', { name });
          input.value = '';
          this.showToast(`Đang mở phòng "${name}"...`, 'info');
        }
      });
    }

    const btnBackLobby = document.getElementById('btn-back-lobby');
    if (btnBackLobby) {
      btnBackLobby.addEventListener('click', () => this.leaveToLobby());
    }

    const btnModalBackLobby = document.getElementById('btn-modal-back-lobby');
    if (btnModalBackLobby) {
      btnModalBackLobby.addEventListener('click', () => this.leaveToLobby());
    }

    const btnLobbyProfile = document.getElementById('btn-lobby-open-profile');
    if (btnLobbyProfile) {
      btnLobbyProfile.addEventListener('click', () => this.openModal('modal-profile'));
    }

    // 1e. Playback Control Bar Actions
    const btnPlayPause = document.getElementById('btn-play-pause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        const isPlaying = this.player.togglePlayPause();
        this.updatePlayPauseButtonUI(isPlaying);
      });
    }

    const btnRewind = document.getElementById('btn-rewind');
    if (btnRewind) {
      btnRewind.addEventListener('click', () => {
        this.player.rewind(10);
      });
    }

    const btnForward = document.getElementById('btn-forward');
    if (btnForward) {
      btnForward.addEventListener('click', () => {
        this.player.fastForward(10);
      });
    }

    const scrubber = document.getElementById('playback-scrubber');
    const scrubberFill = document.getElementById('scrubber-fill');
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        this.player.isSeeking = true;
        const val = parseFloat(e.target.value);
        if (scrubberFill) scrubberFill.style.width = val + '%';
        const dur = this.player.duration || 0;
        const previewTime = (val / 100) * dur;
        const curLabel = document.getElementById('playback-current-time');
        if (curLabel) curLabel.textContent = this.formatTime(previewTime);
      });

      scrubber.addEventListener('change', (e) => {
        this.player.isSeeking = false;
        const val = parseFloat(e.target.value);
        const dur = this.player.duration || 0;
        const targetTime = (val / 100) * dur;
        this.player.seekTo(targetTime);
      });
    }

    // 1f. Clean HUD & Auto-Hide on Inactivity
    const toggleHud = () => {
      document.body.classList.toggle('hud-hidden');
      const isHidden = document.body.classList.contains('hud-hidden');
      const showHudBtn = document.getElementById('btn-show-hud');
      if (showHudBtn) showHudBtn.classList.toggle('hidden', !isHidden);
      this.showToast(isHidden ? 'Đã ẩn giao diện (Bấm H hoặc di chuột để hiện lại)' : 'Đã hiện lại giao diện', 'info');
    };

    const btnToggleHud = document.getElementById('btn-toggle-hud');
    if (btnToggleHud) btnToggleHud.addEventListener('click', toggleHud);

    const btnHudQuick = document.getElementById('btn-hud-quick-toggle');
    if (btnHudQuick) btnHudQuick.addEventListener('click', toggleHud);

    const btnShowHud = document.getElementById('btn-show-hud');
    if (btnShowHud) {
      btnShowHud.addEventListener('click', () => {
        document.body.classList.remove('hud-hidden');
        btnShowHud.classList.add('hidden');
      });
    }

    const btnDismissAudio = document.getElementById('btn-dismiss-audio-banner');
    if (btnDismissAudio) {
      btnDismissAudio.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('audio-blocked-overlay').classList.add('hidden');
      });
    }

    // Inactivity Auto-Hide Timer (2.5s)
    let hudTimer = null;
    const resetHudTimer = () => {
      document.body.classList.remove('hud-autohide');
      if (document.body.classList.contains('hud-hidden')) return;

      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => {
        const isInputFocused = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        const isModalOpen = !document.querySelector('.modal-backdrop:not(.hidden)');
        if (!this.isChatOpen && isModalOpen && !isInputFocused) {
          document.body.classList.add('hud-autohide');
        }
      }, 2500);
    };

    window.addEventListener('mousemove', resetHudTimer, { passive: true });
    window.addEventListener('pointerdown', resetHudTimer, { passive: true });
    window.addEventListener('touchstart', resetHudTimer, { passive: true });
    resetHudTimer();

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const isInput = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
      if (isInput) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          const isPlaying = this.player.togglePlayPause();
          this.updatePlayPauseButtonUI(isPlaying);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.player.rewind(10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.player.fastForward(10);
          break;
        case 'KeyM':
          this.player.toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        case 'KeyH':
          e.preventDefault();
          toggleHud();
          break;
      }
    });

    // 2. Camera Buttons
    document.querySelectorAll('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cam-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.camera;
        this.cinema.setCameraMode(mode, this.you?.seatId);
      });
    });

    // 3. Quick Emoji Reactions
    document.querySelectorAll('.emoji-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        this.send('reaction', { emoji });
        this.cinema.spawnEmojiReaction(emoji, this.you?.seatId, this.room?.stageUser === this.you?.id);
        this.playPopSound();
      });
    });

    // 4. Modals Open/Close
    document.getElementById('btn-open-seats').addEventListener('click', () => this.openModal('modal-seats'));
    document.getElementById('btn-open-queue').addEventListener('click', () => this.openModal('modal-queue'));
    document.getElementById('btn-open-photo').addEventListener('click', () => this.openModal('modal-photo'));
    document.getElementById('btn-open-profile').addEventListener('click', () => this.openModal('modal-profile'));
    document.getElementById('btn-help').addEventListener('click', () => this.openModal('modal-help'));

    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        this.closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
        }
      });
    });

    // 5. Chat Toggle & Form
    const chatDrawer = document.getElementById('chat-drawer');
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    const btnCloseChat = document.getElementById('btn-close-chat');

    btnToggleChat.addEventListener('click', () => {
      this.isChatOpen = !this.isChatOpen;
      chatDrawer.classList.toggle('open', this.isChatOpen);
      if (this.isChatOpen) {
        this.unreadChatCount = 0;
        document.getElementById('chat-unread-badge').classList.add('hidden');
        document.getElementById('chat-input').focus();
      }
    });

    btnCloseChat.addEventListener('click', () => {
      this.isChatOpen = false;
      chatDrawer.classList.remove('open');
    });

    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (text) {
        this.send('chat', { text });
        input.value = '';
      }
    });

    // 6. Stage Toggle Button
    document.getElementById('btn-stage').addEventListener('click', () => {
      this.send('take-stage', {});
    });

    // 7. Skip Vote Button
    document.getElementById('btn-skip-vote').addEventListener('click', () => {
      this.send('skip-vote', {});
    });

    document.getElementById('btn-force-skip').addEventListener('click', () => {
      this.send('skip-now', {});
    });

    // 8. Party Mode Button
    document.getElementById('btn-toggle-party').addEventListener('click', () => {
      this.send('toggle-party', {});
    });

    // 9. Quality Toggle Button
    document.getElementById('btn-toggle-quality').addEventListener('click', () => {
      const isHigh = this.cinema.quality === 'high';
      const newQuality = isHigh ? 'smooth' : 'high';
      this.cinema.setQuality(newQuality);
      document.getElementById('quality-label').textContent = newQuality === 'high' ? 'Độ nét: Cao' : 'Độ nét: Mượt';
      this.showToast(`Đã chuyển sang ${newQuality === 'high' ? 'chế độ độ nét cao' : 'chế độ mượt mà'}!`, 'info');
    });

    // 10. Volume Slider
    const volumeSlider = document.getElementById('volume-slider');
    const volumeVal = document.getElementById('volume-val');
    const btnVolume = document.getElementById('btn-volume');

    volumeSlider.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      volumeVal.textContent = vol + '%';
      this.player.setVolume(vol);
    });

    btnVolume.addEventListener('click', () => {
      const isMuted = this.player.toggleMute();
      this.showToast(isMuted ? 'Đã tắt tiếng rạp phim' : 'Đã bật tiếng', 'info');
    });

    // 11. Unmute Audio Banner
    document.getElementById('btn-unmute-audio').addEventListener('click', () => {
      this.player.unmuteWithGesture();
      document.getElementById('audio-blocked-overlay').classList.add('hidden');
      this.showToast('Âm thanh rạp phim đã sẵn sàng!', 'success');
    });

    // 12. Fullscreen Button
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // 13. Add Video Form
    document.getElementById('form-add-video').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('video-url-input');
      const url = input.value.trim();
      if (url) {
        this.send('queue-video', { url });
        input.value = '';
        this.closeModal('modal-queue');
      }
    });

    // Quick Recommendations
    document.querySelectorAll('.rec-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const url = pill.dataset.url;
        this.send('queue-video', { url });
        this.closeModal('modal-queue');
      });
    });

    // 14. Screen Photo Form
    const photoFileInput = document.getElementById('photo-file-input');
    const photoUrlInput = document.getElementById('photo-url-input');
    const photoPreviewBox = document.getElementById('photo-preview-box');
    const photoPreviewImg = document.getElementById('photo-preview-img');
    let selectedImageBase64 = null;

    photoFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          selectedImageBase64 = ev.target.result;
          photoPreviewImg.src = selectedImageBase64;
          photoPreviewBox.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('form-post-photo').addEventListener('submit', (e) => {
      e.preventDefault();
      const caption = document.getElementById('photo-caption-input').value.trim();
      const finalImage = selectedImageBase64 || photoUrlInput.value.trim();

      if (finalImage) {
        this.send('screen-post', { image: finalImage, caption });
        photoFileInput.value = '';
        photoUrlInput.value = '';
        selectedImageBase64 = null;
        photoPreviewBox.classList.add('hidden');
        document.getElementById('photo-caption-input').value = '';
        this.closeModal('modal-photo');
      }
    });

    // 15. Profile Form
    document.querySelectorAll('.color-circle').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-circle').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    document.getElementById('form-profile').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name-input').value.trim();
      const selectedColorBtn = document.querySelector('.color-circle.selected');
      const color = selectedColorBtn ? selectedColorBtn.dataset.color : this.you.color;
      const tier = document.getElementById('profile-tier-select').value;

      this.send('update-profile', { name, color, tier });
      this.closeModal('modal-profile');
    });

    // 16. Leave Seat Button
    document.getElementById('btn-leave-seat').addEventListener('click', () => {
      this.send('leave-seat', {});
      this.closeModal('modal-seats');
    });
  }

  handleSeatSelection(seatId) {
    if (this.you && this.you.seatId === seatId) {
      this.openModal('modal-seats');
      return;
    }
    this.send('pick-seat', { seatId });
  }

  reportDuration(videoId, duration) {
    this.send('report-duration', { id: videoId, duration });
  }

  showAudioBlockedBanner() {
    document.getElementById('audio-blocked-overlay').classList.remove('hidden');
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remM = m % 60;
    const remS = s % 60;

    if (h > 0) {
      return `${h}:${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
    }
    return `${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
  }

  updatePlayPauseButtonUI(isPlaying) {
    const label = document.getElementById('label-play-pause');
    const icon = document.getElementById('icon-play-pause');
    if (label) label.textContent = isPlaying ? 'Tạm dừng' : 'Phát tiếp';
    if (icon) {
      icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
      this.refreshIcons();
    }
  }

  updatePlaybackBarUI(cur, dur, percent) {
    const curLabel = document.getElementById('playback-current-time');
    const durLabel = document.getElementById('playback-duration');
    const scrubber = document.getElementById('playback-scrubber');
    const scrubberFill = document.getElementById('scrubber-fill');

    if (curLabel) curLabel.textContent = this.formatTime(cur);
    if (durLabel) durLabel.textContent = this.formatTime(dur);
    if (scrubberFill) scrubberFill.style.width = `${percent}%`;
    if (scrubber && !this.player.isSeeking) scrubber.value = percent;
  }

  updateProfileUI() {
    if (!this.you) return;
    document.getElementById('user-display-name').textContent = this.you.name;
    document.getElementById('profile-name-input').value = this.you.name;
    document.getElementById('profile-tier-select').value = this.you.tier || 'Khán Giả VIP';

    document.querySelectorAll('.color-circle').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.color === this.you.color);
    });

    if (this.you.seatId !== null && this.room && this.room.seatLabels) {
      document.getElementById('my-seat-status').textContent = `Ghế ${this.room.seatLabels[this.you.seatId]}`;
      document.getElementById('btn-leave-seat').classList.remove('hidden');
    } else {
      document.getElementById('my-seat-status').textContent = 'Chọn ghế';
      document.getElementById('btn-leave-seat').classList.add('hidden');
    }
  }

  updatePartyModeUI(active) {
    const btn = document.getElementById('btn-toggle-party');
    btn.classList.toggle('active', !!active);
  }

  updateStageButtonUI() {
    const isOnStage = this.room?.stageUser === this.you?.id;
    const btnText = document.getElementById('stage-btn-text');
    btnText.textContent = isOnStage ? 'Về ghế ngồi' : 'Lên sân khấu';
  }

  updateNowPlayingUI() {
    if (!this.room || !this.room.currentVideo) return;
    const v = this.room.currentVideo;
    document.getElementById('np-title').textContent = v.title || 'Đang chiếu...';
    document.getElementById('np-requester').textContent = `Gửi bởi ${v.requester || 'Rạp'}`;

    document.getElementById('qc-title').textContent = v.title || 'Đang chiếu...';
    document.getElementById('qc-author').textContent = v.author || 'YouTube';
    document.getElementById('qc-requester').textContent = `Yêu cầu bởi: ${v.requester || 'Rạp'}`;
    document.getElementById('qc-thumb').src = v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;

    const idleTitle = document.getElementById('screen-idle-title');
    const idleSub = document.getElementById('screen-idle-sub');
    if (idleTitle && v.title) {
      idleTitle.innerHTML = `${v.title}<br><i>Chạm vào rạp để xem & nghe âm thanh.</i>`;
    }
    if (idleSub && v.requester) {
      idleSub.textContent = `Yêu cầu bởi ${v.requester} · Chọn một chỗ ngồi · Gửi bài bạn thích`;
    }
  }

  updateOccupancyUI() {
    if (!this.room) return;
    const seatedCount = (this.room.seats || []).filter((s) => s !== null).length;
    document.getElementById('occupancy-text').textContent = `${seatedCount} / 10 ghế`;
  }

  updateSkipVoteUI() {
    if (!this.room) return;
    const count = this.room.skipVotesCount || 0;
    const req = this.room.requiredSkipVotes || 1;
    document.getElementById('skip-vote-text').textContent = `Bỏ qua (${count}/${req})`;
  }

  openModal(modalId) {
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  renderSeatMapModal() {
    if (!this.room) return;
    const seats = this.room.seats || [];
    const labels = this.room.seatLabels || [];

    // Row A: 0..4
    const rowA = document.getElementById('seat-row-a');
    if (rowA) {
      rowA.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        rowA.appendChild(this.createSeatElement(i, labels[i], seats[i]));
      }
    }

    // Row B: 5..9
    const rowB = document.getElementById('seat-row-b');
    if (rowB) {
      rowB.innerHTML = '';
      for (let i = 5; i < 10; i++) {
        rowB.appendChild(this.createSeatElement(i, labels[i], seats[i]));
      }
    }
  }

  createSeatElement(id, label, occupant) {
    const el = document.createElement('div');
    const isMine = this.you && this.you.seatId === id;
    const isOccupied = occupant !== null;

    el.className = `seat-item ${isMine ? 'mine' : isOccupied ? 'occupied' : 'empty'}`;

    if (isOccupied && !isMine && occupant.color) {
      el.style.borderColor = occupant.color;
    }

    el.innerHTML = `
      <i data-lucide="armchair"></i>
      <span class="seat-id">${label}</span>
      <span class="seat-user">${isMine ? 'Bạn' : isOccupied ? occupant.name : 'Trống'}</span>
    `;

    el.addEventListener('click', () => {
      this.handleSeatSelection(id);
    });

    return el;
  }

  renderQueueModal() {
    if (!this.room) return;
    const queue = this.room.queue || [];
    const queueList = document.getElementById('queue-list');
    const queueBadge = document.getElementById('queue-count-badge');

    if (queueBadge) queueBadge.textContent = `${queue.length} bài`;

    if (!queueList) return;

    if (queue.length === 0) {
      queueList.innerHTML = `
        <div class="empty-queue-msg">
          <i data-lucide="music-2"></i>
          <p>Hàng chờ đang trống. Hãy là người đầu tiên gửi bài bạn thích nhé!</p>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    queueList.innerHTML = queue.map((item, index) => `
      <div class="queue-item">
        <span class="queue-num">#${index + 1}</span>
        <img class="queue-item-thumb" src="${item.thumbnail}" alt="Thumb" />
        <div class="queue-item-info">
          <span class="queue-item-title">${item.title}</span>
          <span class="queue-item-req">Gửi bởi ${item.requester}</span>
        </div>
      </div>
    `).join('');

    this.refreshIcons();
  }

  showScreenProjection(post) {
    if (!post) return;
    const overlay = document.getElementById('screen-projection');
    const img = document.getElementById('projection-img');
    const sender = document.getElementById('projection-sender');
    const caption = document.getElementById('projection-caption');
    const bar = document.getElementById('projection-bar');

    img.src = post.image;
    sender.textContent = `Bởi ${post.senderName}`;
    sender.style.color = post.senderColor;
    caption.textContent = post.caption ? `"${post.caption}"` : '';

    overlay.classList.remove('hidden');
    bar.style.width = '100%';
    bar.style.transition = 'none';

    setTimeout(() => {
      bar.style.transition = `width ${post.duration}s linear`;
      bar.style.width = '0%';
    }, 50);

    this.playChimeSound();
  }

  hideScreenProjection() {
    const overlay = document.getElementById('screen-projection');
    overlay.classList.add('hidden');
  }

  appendChatMessage(msg, playSound = true) {
    const feed = document.getElementById('chat-feed');
    if (!feed) return;

    const el = document.createElement('div');
    const isMe = this.you && msg.userId === this.you.id;
    el.className = `chat-msg ${isMe ? 'mine' : ''}`;

    el.innerHTML = `
      <div class="msg-header">
        <span class="msg-sender" style="color: ${msg.color};">${msg.name}</span>
        <span class="msg-tier">${msg.tier || ''}</span>
        <span class="msg-time">${msg.time}</span>
      </div>
      <div class="msg-bubble">${this.escapeHtml(msg.text)}</div>
    `;

    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;

    if (!this.isChatOpen && playSound) {
      this.unreadChatCount++;
      const badge = document.getElementById('chat-unread-badge');
      badge.textContent = this.unreadChatCount;
      badge.classList.remove('hidden');
      this.playPopSound();
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info'}"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    this.refreshIcons();

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate App when DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  window.cinemaApp = new CinemaApp();
});
