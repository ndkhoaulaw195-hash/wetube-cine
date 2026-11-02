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

    this.isReady = false;
    this.sourceType = 'youtube'; // 'youtube' | 'direct' | 'embed'
    this.currentVideoId = null;
    this.currentVideoUrl = null;
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

    // Callbacks for App / UI
    this.onDurationDiscovered = null;
    this.onAudioBlocked = null;
    this.onVideoEnded = null;
    this.onPlaybackError = null;
    this.onStateToggled = null;
    this.onSeekRequested = null;
    this.onProgressUpdate = null;

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

      this.html5Player.addEventListener('ended', () => {
        if (this.sourceType !== 'direct') return;
        this.isPlaying = false;
        if (typeof this.onVideoEnded === 'function') {
          this.onVideoEnded();
        }
      });
    }

    if (window.YT && window.YT.Player) {
      this.createPlayer();
    } else {
      const prevHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevHandler === 'function') prevHandler();
        this.createPlayer();
      };

      const poll = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(poll);
          if (!this.player) this.createPlayer();
        }
      }, 150);
    }

    // Periodic time drift correction
    setInterval(() => this.correctTimeDrift(), 2000);

    // Periodic UI progress update (every 500ms)
    setInterval(() => this.updateProgress(), 500);
  }

  createPlayer() {
    if (this.player) return;

    const initialId = (this.pendingVideo && this.pendingVideo.sourceType === 'youtube')
      ? this.pendingVideo.id
      : 'jfKfPfyJRdk';

    try {
      this.player = new window.YT.Player('yt-player', {
        width: '1280',
        height: '720',
        videoId: initialId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 1,
          disablekb: 0,
          fs: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (e) => this.onPlayerReady(e),
          onStateChange: (e) => this.onPlayerStateChange(e),
          onAutoplayBlocked: () => this.handleAutoplayBlocked(),
          onError: (e) => this.onPlayerError(e)
        }
      });
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
      }
    } catch (err) {}

    try {
      this.player.mute();
      if (this.sourceType === 'youtube') {
        if (this.isPlaying) {
          this.player.playVideo();
        } else {
          this.player.pauseVideo();
        }
      }
    } catch {}

    if (this.pendingVideo) {
      this.syncVideo(this.pendingVideo, this.clockOffset);
      this.pendingVideo = null;
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

    if (event.data === window.YT.PlayerState.PLAYING) {
      if (idleScreen) idleScreen.classList.add('faded');
      if (playerError) playerError.classList.add('hidden');

      const dur = this.player.getDuration();
      if (dur > 0) {
        this.duration = dur;
        if (typeof this.onDurationDiscovered === 'function') {
          this.onDurationDiscovered(this.currentVideoId, dur);
        }
      }

      if (!this.isPlaying && this.canControl && typeof this.onStateToggled === 'function') {
        this.isPlaying = true;
        this.onStateToggled(true);
      }
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      if (this.isPlaying && !this.isSeeking && this.canControl && typeof this.onStateToggled === 'function') {
        this.onStateToggled(false);
      }
    } else if (event.data === window.YT.PlayerState.ENDED) {
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

  syncVideo(video, clockOffset) {
    if (!video || !video.id) return;

    this.clockOffset = clockOffset || 0;
    this.serverStartedAt = video.startedAt || Date.now();
    this.isPlaying = video.isPlaying !== undefined ? !!video.isPlaying : true;
    this.pausedAt = video.pausedAt || 0;
    this.duration = video.duration || 0;

    const targetSourceType = video.sourceType || 'youtube';
    this.switchActivePlayerDOM(targetSourceType);

    const elapsed = this.isPlaying
      ? Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000)
      : this.pausedAt;

    if (targetSourceType === 'direct') {
      if (!this.html5Player) this.html5Player = document.getElementById('html5-video-player');
      if (!this.html5Player) return;

      if (this.currentVideoId !== video.id || this.currentVideoUrl !== video.url) {
        this.currentVideoId = video.id;
        this.currentVideoUrl = video.url;
        this.html5Player.src = video.url;
        this.html5Player.currentTime = Math.floor(elapsed);
      }
      if (this.isPlaying) {
        this.html5Player.play().catch(() => this.handleAutoplayBlocked());
      } else {
        this.html5Player.pause();
      }
      return;
    }

    if (targetSourceType === 'embed') {
      if (!this.embedFrame) this.embedFrame = document.getElementById('embed-iframe-player');
      if (!this.embedFrame) return;

      if (this.currentVideoId !== video.id || this.currentVideoUrl !== video.url) {
        this.currentVideoId = video.id;
        this.currentVideoUrl = video.url;
        this.embedFrame.src = video.url;
      }
      return;
    }

    // Default: YouTube
    if (!this.isReady || !this.player) {
      this.pendingVideo = video;
      return;
    }

    if (this.currentVideoId !== video.id) {
      this.currentVideoId = video.id;
      this.currentVideoUrl = video.url;
      try {
        this.player.loadVideoById({
          videoId: video.id,
          startSeconds: Math.floor(elapsed)
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
      this.correctTimeDrift();
    }
  }

  applyPlaybackSync(payload) {
    const { isPlaying, currentTime, startedAt } = payload;
    this.isPlaying = !!isPlaying;

    if (startedAt) {
      this.serverStartedAt = startedAt;
    }

    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        if (currentTime !== undefined) {
          this.html5Player.currentTime = currentTime;
        }
        if (this.isPlaying) {
          this.html5Player.play().catch(() => {});
        } else {
          this.pausedAt = currentTime || this.html5Player.currentTime;
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
        this.pausedAt = currentTime || this.player.getCurrentTime();
        this.player.seekTo(this.pausedAt, true);
        this.player.pauseVideo();
      }
    } catch (e) {}

    this.updateProgress();
  }

  correctTimeDrift() {
    if (!this.currentVideoId || this.isSeeking) return;

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
      this.currentTime = cur;
      if (dur > 0) this.duration = dur;
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
      this.currentTime = cur;
      if (dur > 0) this.duration = dur;

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

    const nextState = !this.isPlaying;
    this.isPlaying = nextState;

    if (this.sourceType === 'direct' && this.html5Player) {
      try {
        if (nextState) this.html5Player.play();
        else this.html5Player.pause();
      } catch {}
    } else if (this.isReady && this.player) {
      try {
        if (nextState) {
          this.player.playVideo();
        } else {
          this.player.pauseVideo();
        }
      } catch {}
    }

    if (typeof this.onStateToggled === 'function') {
      this.onStateToggled(nextState);
    }
    return nextState;
  }

  seekTo(targetSeconds) {
    if (!this.canControl) return;

    const clamped = Math.max(0, Math.min(this.duration || 99999, targetSeconds));
    this.currentTime = clamped;

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

    if (typeof this.onSeekRequested === 'function') {
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
}
