/**
 * wetube ciné mini - Multi-Source Cinema Player & Sync Controller
 * Supports: YouTube IFrame API, Direct Video (MP4/WebM/Uploaded/CDN), and Google Drive/CDN Embed
 * Strict Host Control: Only Host/Admin can toggle play/pause or seek; Queue never auto-advances.
 */

class CinemaPlayer {
  constructor() {
    this.player = null; // YouTube Player instance
    this.html5Player = null; // <video id="html5-video-player">
    this.embedFrame = null; // <iframe id="embed-iframe-player">
    this.hlsInstance = null; // Hls.js instance for .m3u8 streams

    this.isReady = false;
    this.ytApiReady = false;
    this.sourceType = 'youtube'; // 'youtube' | 'direct' | 'embed'
    this.currentVideo = null;
    this.currentVideoId = null;
    this.currentVideoUrl = null;
    this.embedMode = 'proxy'; // 'proxy' | 'direct'
    this.serverStartedAt = 0;
    this.clockOffset = 0;
    this.volume = 80;
    this.isMuted = true; // Start muted for reliable browser autoplay
    this.pendingVideo = null;
    this.canControl = false; // True only if user is Room Host or Admin

    // Room Playback State
    this.isPlaying = true;
    this.pausedAt = 0;
    this.duration = 0;
    this.currentTime = 0;
    this.isSeeking = false;
    this.lastSyncAt = 0;
    this.hasStartedPlayingCurrentVideo = false;
    this.lastLocalSeekAt = 0;
    this.lastRemoteSyncAt = 0;
    this.nativeSeekTimer = null;
    this.pauseCheckTimer = null;

    // Callbacks for App / UI
    this.onDurationDiscovered = null;
    this.onAudioBlocked = null;
    this.onVideoEnded = null;
    this.onPlaybackError = null;
    this.onStateToggled = null;
    this.onSeekRequested = null;
    this.onProgressUpdate = null;
    this.onAmbilightColor = null;

    // Screen Sharing WebRTC State
    this.screenShareStream = null;
    this.isScreenSharing = false;

    // Ambilight Color Sampling
    this.ambilightCanvas = null;
    this.ambilightCtx = null;

    this.init();
  }

  init() {
    this.html5Player = document.getElementById('html5-video-player');
    this.embedFrame = document.getElementById('embed-iframe-player');

    if (this.html5Player) {
      this.html5Player.muted = this.isMuted;
      this.html5Player.volume = this.volume / 100;

      this.html5Player.addEventListener('loadedmetadata', () => {
        if (this.sourceType !== 'direct') return;
        const dur = this.html5Player.duration;
        if (dur && isFinite(dur) && dur > 0) {
          this.duration = dur;
          if (typeof this.onDurationDiscovered === 'function') {
            this.onDurationDiscovered(this.currentVideoId, dur);
          }
        }
      });

      this.html5Player.addEventListener('playing', () => {
        if (this.sourceType !== 'direct') return;
        this.hasStartedPlayingCurrentVideo = true;
      });

      this.html5Player.addEventListener('seeked', () => {
        if (this.sourceType !== 'direct' || !this.canControl) return;
        if (!this.hasStartedPlayingCurrentVideo) return;
        if (Date.now() - this.lastSyncAt < 2500) return;
        if (Date.now() - this.lastRemoteSyncAt < 1200) return;
        const cur = this.html5Player.currentTime || 0;
        if (Math.abs(cur - this.getExpectedTime()) > 1.5) {
          this.scheduleHostNativeSeek(cur);
          this.updateProgress();
        }
      });

      this.html5Player.addEventListener('ended', () => {
        if (this.sourceType !== 'direct') return;
        this.isPlaying = false;
        if (typeof this.onVideoEnded === 'function') {
          this.onVideoEnded();
        }
      });

      this.html5Player.addEventListener('error', () => {
        if (this.sourceType !== 'direct' || !this.currentVideo) return;
        // If extracted direct stream fails, automatically fall back to embed web player
        if (this.currentVideo.proxyEmbedUrl || this.currentVideo.directEmbedUrl) {
          this.switchEmbedMode('proxy');
        }
      });
    }

    if (window.YT && window.YT.Player) {
      this.ytApiReady = true;
      if (this.pendingVideo && (this.pendingVideo.sourceType || 'youtube') === 'youtube') {
        const v = this.pendingVideo;
        this.pendingVideo = null;
        this.syncVideo(v, this.clockOffset);
      }
    } else {
      const prevHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevHandler === 'function') prevHandler();
        this.ytApiReady = true;
        if (this.pendingVideo && (this.pendingVideo.sourceType || 'youtube') === 'youtube') {
          const v = this.pendingVideo;
          this.pendingVideo = null;
          this.syncVideo(v, this.clockOffset);
        }
      };

      const poll = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(poll);
          this.ytApiReady = true;
          if (this.pendingVideo && (this.pendingVideo.sourceType || 'youtube') === 'youtube') {
            const v = this.pendingVideo;
            this.pendingVideo = null;
            this.syncVideo(v, this.clockOffset);
          }
        }
      }, 150);
    }

    this.bindEmbedToolbarEvents();

    // Canvas nhỏ ẩn dùng để trích xuất màu sắc màn hình cho Three.js Ambilight
    this.ambilightCanvas = document.createElement('canvas');
    this.ambilightCanvas.width = 32;
    this.ambilightCanvas.height = 18;
    this.ambilightCtx = this.ambilightCanvas.getContext('2d', { willReadFrequently: true });
    setInterval(() => this.sampleAmbilightColor(), 350);

    // Periodic time drift correction
    setInterval(() => this.correctTimeDrift(), 2000);

    // High-frequency UI & two-way seek sync (every 200ms)
    setInterval(() => this.updateProgress(), 200);
  }

  // Trích xuất màu Ambilight động từ video hoặc tạo hiệu ứng ánh sáng điện ảnh mượt mà
  sampleAmbilightColor() {
    if (!this.isPlaying && this.sourceType !== 'direct') return;

    if (this.sourceType === 'direct' && this.html5Player && !this.html5Player.paused && this.html5Player.readyState >= 2) {
      try {
        this.ambilightCtx.drawImage(this.html5Player, 0, 0, 32, 18);
        const frame = this.ambilightCtx.getImageData(0, 0, 32, 18);
        const data = frame.data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) { // Lấy mẫu cách quãng nhanh gọn
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count > 0) {
          const avgR = Math.min(255, Math.round((r / count) * 1.3));
          const avgG = Math.min(255, Math.round((g / count) * 1.3));
          const avgB = Math.min(255, Math.round((b / count) * 1.3));
          if (typeof this.onAmbilightColor === 'function') {
            this.onAmbilightColor({ r: avgR, g: avgG, b: avgB });
          }
          return;
        }
      } catch (err) {
        // Dính CORS nếu video từ CDN bên ngoài, tự động fallback sang Mood Cinema Glow
      }
    }

    // Mood Cinema Glow: Chuyển động quang phổ ấm áp điện ảnh (ấm vàng hoàng gia, cam đỏ, xanh ngọc dịu)
    const t = Date.now() * 0.00035;
    const r = Math.round(180 + Math.sin(t) * 55);
    const g = Math.round(140 + Math.sin(t + 2) * 50);
    const b = Math.round(120 + Math.cos(t + 4) * 60);
    if (typeof this.onAmbilightColor === 'function') {
      this.onAmbilightColor({ r, g, b });
    }
  }

  // Khởi động chia sẻ màn hình máy tính (kèm âm thanh hệ thống) lên rạp 3D
  async startScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
      this.screenShareStream = stream;
      this.isScreenSharing = true;

      const screenShareEl = document.getElementById('screen-share-player');
      if (screenShareEl) {
        screenShareEl.srcObject = stream;
        screenShareEl.classList.remove('hidden');
        screenShareEl.play().catch(() => {});
      }

      document.getElementById('yt-player-wrapper')?.classList.add('hidden');
      document.getElementById('html5-video-player')?.classList.add('hidden');
      document.getElementById('embed-iframe-player')?.classList.add('hidden');
      document.getElementById('screen-idle')?.classList.add('hidden');

      stream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenShare();
      });

      return { success: true, stream };
    } catch (err) {
      console.warn('Hủy chia sẻ màn hình:', err);
      return { success: false, error: err };
    }
  }

  stopScreenShare() {
    if (this.screenShareStream) {
      this.screenShareStream.getTracks().forEach(track => track.stop());
      this.screenShareStream = null;
    }
    this.isScreenSharing = false;
    const screenShareEl = document.getElementById('screen-share-player');
    if (screenShareEl) {
      screenShareEl.srcObject = null;
      screenShareEl.classList.add('hidden');
    }

    if (this.sourceType === 'youtube') {
      document.getElementById('yt-player-wrapper')?.classList.remove('hidden');
    } else if (this.sourceType === 'direct') {
      document.getElementById('html5-video-player')?.classList.remove('hidden');
    } else if (this.sourceType === 'embed') {
      document.getElementById('embed-iframe-player')?.classList.remove('hidden');
    }
  }

  bindEmbedToolbarEvents() {
    document.getElementById('btn-embed-mode-proxy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchEmbedMode('proxy');
    });
    document.getElementById('btn-embed-mode-direct')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchEmbedMode('direct');
    });
    document.getElementById('btn-embed-mode-stream')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchEmbedMode('stream');
    });
    document.getElementById('btn-embed-reload')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.embedFrame && this.embedFrame.src) {
        const currentSrc = this.embedFrame.src;
        this.embedFrame.src = currentSrc;
      }
    });
  }

  switchEmbedMode(mode) {
    if (!this.currentVideo) return;
    const v = this.currentVideo;

    if (mode === 'stream' && v.streamUrl) {
      this.embedMode = 'stream';
      this.switchActivePlayerDOM('direct');
      this.loadDirectOrHlsVideo(v.streamUrl, this.getExpectedTime());
      this.updateEmbedToolbarUI();
      return;
    }

    this.embedMode = mode === 'direct' ? 'direct' : 'proxy';
    this.switchActivePlayerDOM('embed');
    if (!this.embedFrame) this.embedFrame = document.getElementById('embed-iframe-player');
    if (!this.embedFrame) return;

    const rawUrl = v.directEmbedUrl || v.originalUrl || v.url;
    const proxyUrl = v.proxyEmbedUrl || `/api/web-proxy?url=${encodeURIComponent(rawUrl)}`;
    const targetSrc = this.embedMode === 'direct' ? rawUrl : proxyUrl;

    this.currentVideoUrl = targetSrc;
    this.embedFrame.src = targetSrc;
    this.updateEmbedToolbarUI();
  }

  updateEmbedToolbarUI() {
    const bar = document.getElementById('embed-helper-bar');
    if (!bar) return;

    const v = this.currentVideo;
    if (!v || (this.sourceType !== 'embed' && !v.proxyEmbedUrl)) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    const hostLabelEl = document.getElementById('embed-source-domain');
    if (hostLabelEl) {
      hostLabelEl.textContent = v.author || 'Nguồn Web Ngoài';
    }

    const btnProxy = document.getElementById('btn-embed-mode-proxy');
    const btnDirect = document.getElementById('btn-embed-mode-direct');
    const btnStream = document.getElementById('btn-embed-mode-stream');
    const linkOrig = document.getElementById('btn-embed-open-origin');

    if (btnProxy) btnProxy.classList.toggle('active', this.sourceType === 'embed' && this.embedMode === 'proxy');
    if (btnDirect) btnDirect.classList.toggle('active', this.sourceType === 'embed' && this.embedMode === 'direct');
    if (btnStream) {
      btnStream.classList.toggle('hidden', !v.streamUrl);
      btnStream.classList.toggle('active', this.sourceType === 'direct' && this.embedMode === 'stream');
    }
    if (linkOrig) {
      linkOrig.href = v.originalUrl || v.directEmbedUrl || v.url || '#';
    }
  }

  getExpectedTime() {
    if (!this.isPlaying) return this.pausedAt || 0;
    return Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000);
  }

  canTriggerHostNativeSeek(cur) {
    if (!this.canControl || !this.currentVideoId) return false;
    if (!this.hasStartedPlayingCurrentVideo) return false;
    if (this.duration <= 0) return false;
    if (Date.now() - this.lastSyncAt < 3000) return false;
    if (Date.now() - this.lastRemoteSyncAt < 1200) return false;
    // Never falsely seek to 0:00 if expected time is ahead and player just reported 0
    if (cur < 0.5 && this.getExpectedTime() > 3.5) return false;
    return true;
  }

  scheduleHostNativeSeek(newTime) {
    const clamped = Math.max(0, newTime || 0);
    this.currentTime = clamped;
    this.pausedAt = clamped;
    this.serverStartedAt = Date.now() + this.clockOffset - Math.floor(clamped * 1000);
    this.lastLocalSeekAt = Date.now();

    if (this.nativeSeekTimer) {
      clearTimeout(this.nativeSeekTimer);
    }
    this.nativeSeekTimer = setTimeout(() => {
      this.nativeSeekTimer = null;
      if (this.canControl && typeof this.onSeekRequested === 'function') {
        this.onSeekRequested(this.currentTime);
      }
    }, 180);
  }

  createPlayer(videoId, startSeconds = 0) {
    if (this.player) return;
    if (!window.YT || !window.YT.Player) return;

    const targetId = videoId || (this.pendingVideo && this.pendingVideo.id);
    if (!targetId) return; // Never create YT.Player without a valid videoId!

    try {
      const config = {
        width: '1280',
        height: '720',
        videoId: targetId,
        playerVars: {
          autoplay: this.isPlaying ? 1 : 0,
          mute: 1,
          controls: 1,
          disablekb: 0,
          fs: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          modestbranding: 0,
          start: Math.max(0, Math.floor(startSeconds || 0))
        },
        events: {
          onReady: (e) => this.onPlayerReady(e),
          onStateChange: (e) => this.onPlayerStateChange(e),
          onAutoplayBlocked: () => this.handleAutoplayBlocked(),
          onError: (e) => this.onPlayerError(e)
        }
      };
      this.currentVideoId = targetId;
      this.player = new window.YT.Player('yt-player', config);
    } catch (e) {
      console.warn('Không thể khởi tạo YouTube Player:', e);
    }
  }

  onPlayerReady() {
    this.isReady = true;

    try {
      const iframe = this.player.getIframe();
      if (iframe) {
        iframe.tabIndex = 0;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share; fullscreen';
        iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; web-share; fullscreen');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.style.pointerEvents = 'auto';
      }
    } catch (err) {}

    try {
      if (this.isMuted) {
        this.player.mute();
      } else {
        this.player.unMute();
        this.player.setVolume(this.volume);
      }
      this.setVideoQuality(this.videoQuality || 'high');
    } catch {}

    if (this.pendingVideo) {
      const v = this.pendingVideo;
      this.pendingVideo = null;
      this.syncVideo(v, this.clockOffset);
    } else if (this.sourceType === 'youtube' && this.currentVideoId) {
      try {
        const elapsed = this.getExpectedTime();
        if (elapsed > 2) {
          this.player.seekTo(elapsed, true);
        }
        if (this.isPlaying) {
          this.player.playVideo();
        } else {
          this.player.pauseVideo();
        }
      } catch {}
    }

    setTimeout(() => {
      this.checkPlaybackState();
    }, 1200);
  }

  checkPlaybackState() {
    if (this.sourceType === 'youtube') {
      if (!this.isReady || !this.player) return;
      try {
        const state = this.player.getPlayerState();
        if (this.isPlaying && state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
          this.player.playVideo();
          this.handleAutoplayBlocked();
        } else if (this.isMuted && typeof this.onAudioBlocked === 'function') {
          this.onAudioBlocked(true);
        }
      } catch {}
    }
  }

  handleAutoplayBlocked() {
    if (typeof this.onAudioBlocked === 'function') {
      this.onAudioBlocked(true);
    }
  }

  onPlayerStateChange(event) {
    if (this.sourceType !== 'youtube') return;

    const idleScreen = document.getElementById('screen-idle');
    const playerError = document.getElementById('player-error');

    if (event.data === window.YT.PlayerState.BUFFERING) {
      if (this.pauseCheckTimer) {
        clearTimeout(this.pauseCheckTimer);
        this.pauseCheckTimer = null;
      }
      const cur = this.player.getCurrentTime() || 0;
      if (this.canTriggerHostNativeSeek(cur)) {
        if (Math.abs(cur - this.getExpectedTime()) > 1.6) {
          this.scheduleHostNativeSeek(cur);
          this.updateProgress();
        }
      }
      return;
    }

    if (event.data === window.YT.PlayerState.PLAYING) {
      if (this.pauseCheckTimer) {
        clearTimeout(this.pauseCheckTimer);
        this.pauseCheckTimer = null;
      }
      if (idleScreen) idleScreen.classList.add('faded');
      if (playerError) playerError.classList.add('hidden');

      try {
        const ytQuality = (this.videoQuality === 'high' ? 'hd1080' : (this.videoQuality === 'medium' ? 'hd720' : 'medium'));
        if (typeof this.player.setPlaybackQuality === 'function') {
          this.player.setPlaybackQuality(ytQuality);
        }
      } catch {}

      const dur = this.player.getDuration();
      if (dur > 0) {
        this.duration = dur;
        if (typeof this.onDurationDiscovered === 'function') {
          this.onDurationDiscovered(this.currentVideoId, dur);
        }
      }

      const cur = this.player.getCurrentTime() || 0;
      // On initial start after F5, if player started at 0 but room is further ahead, jump to room time first!
      const expected = this.getExpectedTime();
      if (!this.hasStartedPlayingCurrentVideo) {
        this.hasStartedPlayingCurrentVideo = true;
        if (expected > 3 && cur < 1.5) {
          this.lastSyncAt = Date.now();
          try {
            this.player.seekTo(expected, true);
          } catch {}
          return;
        }
      }

      if (this.canTriggerHostNativeSeek(cur)) {
        if (Math.abs(cur - expected) > 1.6) {
          this.scheduleHostNativeSeek(cur);
        }
        if (!this.isPlaying && typeof this.onStateToggled === 'function') {
          this.isPlaying = true;
          this.pausedAt = cur;
          this.serverStartedAt = Date.now() + this.clockOffset - Math.floor(cur * 1000);
          this.onStateToggled(true, cur);
        }
      }
      this.updateProgress();
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      const cur = this.player.getCurrentTime() || 0;
      if (this.canTriggerHostNativeSeek(cur)) {
        if (Math.abs(cur - this.getExpectedTime()) > 1.6) {
          this.scheduleHostNativeSeek(cur);
          this.updateProgress();
        }

        if (this.isPlaying && !this.isSeeking) {
          if (this.pauseCheckTimer) clearTimeout(this.pauseCheckTimer);
          // Wait briefly to distinguish a genuine Pause click from a YouTube red-bar scrub
          this.pauseCheckTimer = setTimeout(() => {
            this.pauseCheckTimer = null;
            if (!this.player || typeof this.player.getPlayerState !== 'function') return;
            if (this.player.getPlayerState() === window.YT.PlayerState.PAUSED && this.isPlaying) {
              const pausedCur = this.player.getCurrentTime() || cur;
              this.isPlaying = false;
              this.currentTime = pausedCur;
              this.pausedAt = pausedCur;
              this.serverStartedAt = Date.now() + this.clockOffset - Math.floor(pausedCur * 1000);
              this.updateProgress();
              if (typeof this.onStateToggled === 'function') {
                this.onStateToggled(false, pausedCur);
              }
            }
          }, 260);
        }
      }
    } else if (event.data === window.YT.PlayerState.ENDED) {
      if (this.pauseCheckTimer) {
        clearTimeout(this.pauseCheckTimer);
        this.pauseCheckTimer = null;
      }
      // Do NOT auto-advance! Keep at ended state until Host clicks "Chuyển tiếp"
      this.isPlaying = false;
      if (typeof this.onVideoEnded === 'function') {
        this.onVideoEnded();
      }
    }
  }

  onPlayerError(event) {
    if (this.sourceType !== 'youtube') return;
    console.warn('YouTube Player error code:', event.data);
    const playerError = document.getElementById('player-error');
    const playerErrorText = document.getElementById('player-error-text');

    let msg = 'YouTube không phát được video này.';
    if (event.data === 101 || event.data === 150) {
      msg = 'Chủ video không cho phép phát nhúng bên ngoài YouTube.';
    } else if (event.data === 100) {
      msg = 'Video đã bị xóa hoặc đặt ở chế độ riêng tư.';
    } else if (event.data === 2) {
      msg = 'Mã video YouTube không hợp lệ.';
    }

    if (playerErrorText) {
      playerErrorText.textContent = `${msg} Chủ phòng (Host) hãy bấm nút "Chuyển tiếp" để qua video khác.`;
    }
    if (playerError) {
      playerError.classList.remove('hidden');
    }

    if (typeof this.onPlaybackError === 'function') {
      this.onPlaybackError(this.currentVideoId, event.data);
    }
  }

  switchActivePlayerDOM(sourceType) {
    this.sourceType = sourceType || 'youtube';
    const ytWrap = document.getElementById('yt-player-wrapper');
    const html5El = this.html5Player || document.getElementById('html5-video-player');
    const embedEl = this.embedFrame || document.getElementById('embed-iframe-player');
    const idleScreen = document.getElementById('screen-idle');
    const playerError = document.getElementById('player-error');

    if (playerError) playerError.classList.add('hidden');

    if (this.sourceType === 'direct') {
      if (ytWrap) ytWrap.classList.add('hidden');
      if (embedEl) {
        embedEl.classList.add('hidden');
        embedEl.src = '';
      }
      if (html5El) html5El.classList.remove('hidden');
      if (idleScreen) idleScreen.classList.add('faded');
      if (this.isReady && this.player && typeof this.player.pauseVideo === 'function') {
        try { this.player.pauseVideo(); } catch {}
      }
    } else if (this.sourceType === 'embed') {
      if (ytWrap) ytWrap.classList.add('hidden');
      if (html5El) {
        html5El.classList.add('hidden');
        try { html5El.pause(); } catch {}
      }
      if (embedEl) embedEl.classList.remove('hidden');
      if (idleScreen) idleScreen.classList.add('faded');
      if (this.isReady && this.player && typeof this.player.pauseVideo === 'function') {
        try { this.player.pauseVideo(); } catch {}
      }
    } else {
      // YouTube
      if (html5El) {
        html5El.classList.add('hidden');
        try { html5El.pause(); } catch {}
      }
      if (embedEl) {
        embedEl.classList.add('hidden');
        embedEl.src = '';
      }
      if (ytWrap) ytWrap.classList.remove('hidden');
    }
  }

  destroyHls() {
    if (this.hlsInstance) {
      try {
        this.hlsInstance.destroy();
      } catch {}
      this.hlsInstance = null;
    }
  }

  loadDirectOrHlsVideo(url, startSeconds = 0) {
    if (!this.html5Player) this.html5Player = document.getElementById('html5-video-player');
    if (!this.html5Player || !url) return;

    this.destroyHls();
    const isHls = /\.m3u8(\?.*|#.*)?$/i.test(url) || url.includes('m3u8');

    if (isHls && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false
      });
      this.hlsInstance = hls;
      let retriedWithProxy = false;

      hls.loadSource(url);
      hls.attachMedia(this.html5Player);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (startSeconds > 1) {
          try {
            this.html5Player.currentTime = Math.floor(startSeconds);
          } catch {}
        }
        if (this.isPlaying) {
          this.html5Player.play().catch(() => this.handleAutoplayBlocked());
        } else {
          this.html5Player.pause();
        }
      });

      hls.on(window.Hls.Events.ERROR, (_, data) => {
        if (data && data.fatal) {
          if (!retriedWithProxy && !url.startsWith('/api/web-proxy')) {
            retriedWithProxy = true;
            const proxiedUrl = `/api/web-proxy?url=${encodeURIComponent(url)}`;
            hls.loadSource(proxiedUrl);
            hls.startLoad();
          } else if (this.currentVideo && (this.currentVideo.proxyEmbedUrl || this.currentVideo.directEmbedUrl)) {
            this.switchEmbedMode('proxy');
          }
        }
      });
      return;
    }

    this.html5Player.src = url;
    try {
      this.html5Player.currentTime = Math.floor(startSeconds);
    } catch {}
    if (this.isPlaying) {
      this.html5Player.play().catch(() => this.handleAutoplayBlocked());
    } else {
      this.html5Player.pause();
    }
  }

  stopAndClearScreen() {
    this.currentVideo = null;
    this.currentVideoId = null;
    this.currentVideoUrl = null;
    this.pendingVideo = null;
    this.isPlaying = false;
    this.hasStartedPlayingCurrentVideo = false;
    this.pausedAt = 0;
    this.duration = 0;
    this.currentTime = 0;

    this.destroyHls();

    if (this.html5Player) {
      try {
        this.html5Player.pause();
        this.html5Player.removeAttribute('src');
        this.html5Player.load();
      } catch {}
    }
    if (this.embedFrame) {
      try {
        this.embedFrame.src = '';
      } catch {}
    }
    if (this.isReady && this.player && typeof this.player.stopVideo === 'function') {
      try {
        this.player.stopVideo();
      } catch {}
    }

    const embedBar = document.getElementById('embed-helper-bar');
    if (embedBar) embedBar.classList.add('hidden');

    const playerError = document.getElementById('player-error');
    if (playerError) playerError.classList.add('hidden');

    const idleScreen = document.getElementById('screen-idle');
    if (idleScreen) idleScreen.classList.remove('faded');

    if (typeof this.onProgressUpdate === 'function') {
      this.onProgressUpdate(0, 0, 0);
    }
  }

  syncVideo(video, clockOffset) {
    if (!video || !video.id) {
      this.stopAndClearScreen();
      return;
    }

    this.currentVideo = video;
    this.clockOffset = clockOffset || 0;
    this.serverStartedAt = video.startedAt || Date.now();
    this.isPlaying = video.isPlaying !== undefined ? !!video.isPlaying : true;
    this.pausedAt = video.pausedAt || 0;
    this.duration = video.duration || 0;
    this.lastSyncAt = Date.now();

    const targetSourceType = video.sourceType || 'youtube';
    this.switchActivePlayerDOM(targetSourceType);

    const idleScreen = document.getElementById('screen-idle');
    if (idleScreen) idleScreen.classList.add('faded');

    const elapsed = this.isPlaying
      ? Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000)
      : this.pausedAt;

    if (targetSourceType === 'direct') {
      if (this.currentVideoId !== video.id || this.currentVideoUrl !== video.url) {
        this.hasStartedPlayingCurrentVideo = false;
        this.currentVideoId = video.id;
        this.currentVideoUrl = video.url;
        this.embedMode = video.streamUrl ? 'stream' : 'direct';
        this.loadDirectOrHlsVideo(video.url, elapsed);
      } else if (this.html5Player) {
        if (this.isPlaying) {
          this.html5Player.play().catch(() => this.handleAutoplayBlocked());
        } else {
          this.html5Player.pause();
        }
      }
      this.updateEmbedToolbarUI();
      return;
    }

    if (targetSourceType === 'embed') {
      this.destroyHls();
      if (!this.embedFrame) this.embedFrame = document.getElementById('embed-iframe-player');
      if (!this.embedFrame) return;

      if (this.currentVideoId !== video.id || this.currentVideoUrl !== video.url) {
        this.hasStartedPlayingCurrentVideo = false;
        this.currentVideoId = video.id;
        this.currentVideoUrl = video.url;
        this.embedMode = String(video.url || '').startsWith('/api/web-proxy') ? 'proxy' : 'direct';
        this.embedFrame.src = video.url;
      }
      this.updateEmbedToolbarUI();
      return;
    }

    // Default: YouTube
    this.destroyHls();
    this.updateEmbedToolbarUI();

    if (!this.player) {
      this.pendingVideo = video;
      if (this.ytApiReady) {
        this.pendingVideo = null;
        this.hasStartedPlayingCurrentVideo = false;
        this.currentVideoUrl = video.url;
        this.createPlayer(video.id, elapsed);
      }
      return;
    }

    if (!this.isReady) {
      this.pendingVideo = video;
      return;
    }

    if (this.currentVideoId !== video.id) {
      this.hasStartedPlayingCurrentVideo = false;
      this.currentVideoId = video.id;
      this.currentVideoUrl = video.url;
      try {
        const ytQuality = (this.videoQuality === 'high' ? 'hd1080' : (this.videoQuality === 'medium' ? 'hd720' : 'medium'));
        this.player.loadVideoById({
          videoId: video.id,
          startSeconds: Math.floor(elapsed),
          suggestedQuality: ytQuality
        });
        if (this.isPlaying) {
          this.player.playVideo();
        } else {
          this.player.pauseVideo();
        }
      } catch (e) {
        console.warn('Lỗi tải video YouTube:', e);
      }
    } else {
      try {
        const state = this.player.getPlayerState();
        if (this.isPlaying && state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
          if (elapsed > 2) this.player.seekTo(elapsed, true);
          this.player.playVideo();
        }
      } catch {}
      this.correctTimeDrift();
    }
  }

  applyPlaybackSync(payload, isSelfEcho = false) {
    const { isPlaying, currentTime, startedAt } = payload;
    this.isPlaying = !!isPlaying;

    if (startedAt) {
      this.serverStartedAt = startedAt;
    }
    if (currentTime !== undefined) {
      this.pausedAt = currentTime;
      this.currentTime = currentTime;
    }

    // If this sync broadcast originated from this client's own seek/pause action,
    // do NOT force-seek the local player again (prevents red-bar jump/glitch while dragging).
    if (isSelfEcho) {
      this.updateProgress();
      return;
    }

    this.lastRemoteSyncAt = Date.now();

    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        if (currentTime !== undefined) {
          this.html5Player.currentTime = currentTime;
        }
        if (this.isPlaying) {
          this.html5Player.play().catch(() => {});
        } else {
          this.pausedAt = currentTime ?? this.html5Player.currentTime;
          this.html5Player.pause();
        }
      } catch {}
      this.updateProgress();
      return;
    }

    if (!this.isReady || !this.player || this.sourceType !== 'youtube') return;

    try {
      if (this.isPlaying) {
        if (currentTime !== undefined) {
          this.player.seekTo(currentTime, true);
        }
        this.player.playVideo();
      } else {
        this.pausedAt = currentTime ?? this.player.getCurrentTime();
        this.player.seekTo(this.pausedAt, true);
        this.player.pauseVideo();
      }
    } catch (e) {}

    this.updateProgress();
  }

  correctTimeDrift() {
    if (!this.currentVideoId || this.isSeeking) return;

    // IMPORTANT: If this user is the Room Host or Admin (canControl === true),
    // their player is the master clock! Never snap the Host/Admin's player back
    // to an older server timestamp when they drag the red YouTube progress bar.
    if (this.canControl) {
      return;
    }

    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        if (!this.isPlaying) {
          if (!this.html5Player.paused) this.html5Player.pause();
          return;
        }
        if (this.html5Player.ended) return;
        const elapsed = Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000);
        if (this.duration > 0 && elapsed >= this.duration) return;
        if (this.html5Player.paused) {
          this.html5Player.play().catch(() => {});
        }
        if (Math.abs(this.html5Player.currentTime - elapsed) > 2.5) {
          this.html5Player.currentTime = elapsed;
        }
      } catch {}
      return;
    }

    if (!this.isReady || !this.player || this.sourceType !== 'youtube') return;

    try {
      const state = this.player.getPlayerState();
      if (state === window.YT.PlayerState.ENDED) return;

      if (!this.isPlaying) {
        if (state === window.YT.PlayerState.PLAYING) {
          this.player.pauseVideo();
        }
        if (this.pausedAt > 0 && Math.abs(this.player.getCurrentTime() - this.pausedAt) > 1.5) {
          this.player.seekTo(this.pausedAt, true);
        }
        return;
      }

      const elapsed = Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000);
      if (this.duration > 0 && elapsed >= this.duration) return;

      if (state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
        this.player.playVideo();
      }

      const currentTime = this.player.getCurrentTime();
      if (Math.abs(currentTime - elapsed) > 2.5) {
        this.player.seekTo(elapsed, true);
      }
    } catch {}
  }

  updateProgress() {
    if (this.isSeeking) return;

    if (this.sourceType === 'direct' && this.html5Player) {
      const cur = this.html5Player.currentTime || 0;
      const dur = (this.html5Player.duration && isFinite(this.html5Player.duration))
        ? this.html5Player.duration
        : (this.duration || 0);
      if (dur > 0) this.duration = dur;
      if (this.canTriggerHostNativeSeek(cur)) {
        if (Math.abs(cur - this.getExpectedTime()) > 1.6) {
          this.scheduleHostNativeSeek(cur);
        }
      }
      this.currentTime = cur;
      const percent = dur > 0 ? (cur / dur) * 100 : 0;
      if (typeof this.onProgressUpdate === 'function') {
        this.onProgressUpdate(cur, dur, percent);
      }
      return;
    }

    if (!this.isReady || !this.player || this.sourceType !== 'youtube') return;

    try {
      const cur = this.player.getCurrentTime() || 0;
      const dur = this.player.getDuration() || this.duration || 0;
      if (dur > 0) this.duration = dur;

      // Detect when Host/Admin drags the red YouTube progress bar directly
      // (even while paused or playing) and immediately sync the yellow bar + server!
      if (this.canTriggerHostNativeSeek(cur)) {
        const state = this.player.getPlayerState();
        if (state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.PAUSED) {
          if (Math.abs(cur - this.getExpectedTime()) > 1.6) {
            this.scheduleHostNativeSeek(cur);
          }
        }
      }

      this.currentTime = cur;
      const percent = dur > 0 ? (cur / dur) * 100 : 0;

      if (typeof this.onProgressUpdate === 'function') {
        this.onProgressUpdate(cur, dur, percent);
      }
    } catch {}
  }

  // --- Playback Control Actions ---
  pauseVideo() {
    this.isPlaying = false;
    if (this.sourceType === 'direct' && this.html5Player) {
      try { this.html5Player.pause(); } catch {}
    }
    if (this.isReady && this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch {}
    }
  }

  togglePlayPause() {
    if (!this.canControl) return this.isPlaying;

    if (this.pauseCheckTimer) {
      clearTimeout(this.pauseCheckTimer);
      this.pauseCheckTimer = null;
    }

    const nextState = !this.isPlaying;
    this.isPlaying = nextState;

    let cur = this.currentTime || 0;
    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        cur = this.html5Player.currentTime || cur;
        if (nextState) this.html5Player.play();
        else this.html5Player.pause();
      } catch {}
    } else if (this.isReady && this.player) {
      try {
        cur = this.player.getCurrentTime() || cur;
        if (nextState) {
          this.player.playVideo();
        } else {
          this.player.pauseVideo();
        }
      } catch {}
    }

    this.currentTime = cur;
    this.pausedAt = cur;
    this.serverStartedAt = Date.now() + this.clockOffset - Math.floor(cur * 1000);

    if (typeof this.onStateToggled === 'function') {
      this.onStateToggled(nextState, cur);
    }
    return nextState;
  }

  seekTo(targetSeconds, emitToServer = true) {
    if (!this.canControl) return;

    const maxDur = (this.duration && this.duration > 0)
      ? this.duration
      : ((this.isReady && this.player && typeof this.player.getDuration === 'function' && this.player.getDuration() > 0)
        ? this.player.getDuration()
        : 99999);

    const clamped = Math.max(0, Math.min(maxDur, targetSeconds));
    this.currentTime = clamped;
    this.pausedAt = clamped;
    this.serverStartedAt = Date.now() + this.clockOffset - Math.floor(clamped * 1000);
    this.lastLocalSeekAt = Date.now();

    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        this.html5Player.currentTime = clamped;
        if (this.isPlaying) this.html5Player.play();
      } catch {}
    } else if (this.isReady && this.player) {
      try {
        this.player.seekTo(clamped, true);
        if (this.isPlaying) {
          this.player.playVideo();
        }
      } catch {}
    }

    const dur = maxDur < 99999 ? maxDur : (this.duration || 0);
    const percent = dur > 0 ? (clamped / dur) * 100 : 0;
    if (typeof this.onProgressUpdate === 'function') {
      this.onProgressUpdate(clamped, dur, percent);
    }

    if (emitToServer && typeof this.onSeekRequested === 'function') {
      this.onSeekRequested(clamped);
    }
  }

  rewind(seconds = 10) {
    if (!this.canControl) return;
    const cur = this.currentTime || 0;
    this.seekTo(Math.max(0, cur - seconds));
  }

  fastForward(seconds = 10) {
    if (!this.canControl) return;
    const cur = this.currentTime || 0;
    this.seekTo(cur + seconds);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, vol));
    if (this.html5Player) {
      this.html5Player.volume = this.volume / 100;
      if (this.volume > 0) this.html5Player.muted = false;
    }
    if (this.isReady && this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(this.volume);
      if (this.volume > 0 && this.player.isMuted()) {
        this.player.unMute();
      }
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.html5Player) {
      this.html5Player.muted = this.isMuted;
    }
    if (this.isReady && this.player) {
      if (this.isMuted) {
        this.player.mute();
      } else {
        this.player.unMute();
        this.player.setVolume(this.volume);
      }
    }
    return this.isMuted;
  }

  unmuteWithGesture() {
    this.isMuted = false;
    if (this.html5Player) {
      this.html5Player.muted = false;
      this.html5Player.volume = this.volume / 100;
      if (this.sourceType === 'direct' && this.isPlaying) {
        this.html5Player.play().catch(() => {});
      }
    }
    if (this.isReady && this.player) {
      try {
        this.player.unMute();
        this.player.setVolume(this.volume);
        if (this.sourceType === 'youtube' && this.isPlaying) {
          this.player.playVideo();
        }
      } catch {}
    }
    const idleScreen = document.getElementById('screen-idle');
    if (idleScreen) idleScreen.classList.add('faded');
    const overlay = document.getElementById('audio-blocked-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // --- Quality Level Controller: 'high' (1080p Full HD) | 'medium' (720p HD) | 'low' (360p SD) ---
  setVideoQuality(level = 'high') {
    this.videoQuality = level;
    let width = 1920;
    let height = 1080;
    let ytQuality = 'hd1080';

    if (level === 'low') {
      width = 854;
      height = 480;
      ytQuality = 'medium';
    } else if (level === 'medium') {
      width = 1280;
      height = 720;
      ytQuality = 'hd720';
    } else { // 'high'
      width = 1920;
      height = 1080;
      ytQuality = 'hd1080';
    }

    if (this.isReady && this.player) {
      try {
        if (typeof this.player.setSize === 'function') {
          this.player.setSize(width, height);
        }
        if (typeof this.player.setPlaybackQuality === 'function') {
          this.player.setPlaybackQuality(ytQuality);
        }
        if (typeof this.player.setPlaybackQualityRange === 'function') {
          this.player.setPlaybackQualityRange(ytQuality, (level === 'high' ? 'highres' : ytQuality));
        }
      } catch (err) {}
    }

    if (this.hlsInstance && this.hlsInstance.levels && this.hlsInstance.levels.length > 0) {
      try {
        const len = this.hlsInstance.levels.length;
        if (level === 'low') {
          this.hlsInstance.currentLevel = 0;
        } else if (level === 'medium') {
          this.hlsInstance.currentLevel = Math.max(0, Math.floor(len / 2));
        } else {
          this.hlsInstance.currentLevel = len - 1;
        }
      } catch {}
    }
  }

  // --- Data Saver Mode (Tự động hạ chất lượng video xuống 360p / bitrate thấp) ---
  setDataSaver(enabled) {
    this.isDataSaver = !!enabled;
    if (this.isReady && this.player) {
      try {
        if (typeof this.player.setPlaybackQuality === 'function') {
          this.player.setPlaybackQuality(enabled ? 'small' : 'default');
        }
      } catch {}
    }
    if (this.hlsInstance) {
      try {
        if (enabled) {
          this.hlsInstance.currentLevel = 0; // Luồng bitrate thấp nhất cho 4G
        } else {
          this.hlsInstance.currentLevel = -1; // Auto thích ứng
        }
      } catch {}
    }
  }

  // --- Picture-in-Picture (PiP) Window Controller ---
  async togglePictureInPicture() {
    // 1. Direct HTML5 Video Player PiP
    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return false;
        } else {
          await this.html5Player.requestPictureInPicture();
          return true;
        }
      } catch (err) {
        console.warn('HTML5 Video PiP:', err);
      }
    }

    // 2. Modern Document Picture-in-Picture API (Chrome / Edge)
    if (window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === 'function') {
      try {
        if (window.pipWindowInstance) {
          window.pipWindowInstance.close();
          window.pipWindowInstance = null;
          return false;
        }
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 520,
          height: 310
        });
        window.pipWindowInstance = pipWin;

        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.background = '#0a0b0e';
        pipWin.document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        pipWin.document.body.style.display = 'flex';
        pipWin.document.body.style.flexDirection = 'column';
        pipWin.document.body.style.alignItems = 'center';
        pipWin.document.body.style.justifyContent = 'center';
        pipWin.document.body.style.color = '#fff';
        pipWin.document.body.style.padding = '16px';
        pipWin.document.body.style.boxSizing = 'border-box';

        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.innerHTML = `
          <div style="font-size:28px; margin-bottom:8px;">🎬</div>
          <div style="font-size:15px; font-weight:700; color:#f2cf78; margin-bottom:6px;">wetube ciné — Cửa Sổ PiP</div>
          <div style="font-size:13px; color:#f3f4f6; margin-bottom:10px; max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${this.currentVideo?.title || 'Rạp Chiếu Phim Đồng Bộ'}
          </div>
          <div style="font-size:11px; color:#9ca3af; line-height:1.4;">
            Đang đồng bộ trực tiếp với rạp phim.<br>Bạn có thể chuyển sang tab khác mà âm thanh và tiến trình vẫn phát liên tục!
          </div>
        `;
        pipWin.document.body.appendChild(wrapper);

        pipWin.addEventListener('pagehide', () => {
          window.pipWindowInstance = null;
        });

        return true;
      } catch (err) {
        console.warn('Document PiP failed:', err);
      }
    }

    // 3. Fallback: Popout compact window
    const pipUrl = window.location.href;
    const miniWin = window.open(pipUrl, 'wetube_pip_window', 'width=520,height=340,menubar=no,toolbar=no,location=no,status=no');
    return !!miniWin;
  }
}
