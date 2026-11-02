/**
 * wetube ciné mini - YouTube Cinema Player & Sync Controller
 * Complete playback controls: Play/Pause, Seek, -10s, +10s, Volume, Progress bar, and real-time room sync
 */

class CinemaPlayer {
  constructor() {
    this.player = null;
    this.isReady = false;
    this.currentVideoId = null;
    this.serverStartedAt = 0;
    this.clockOffset = 0;
    this.volume = 80;
    this.isMuted = true; // Start muted for reliable browser autoplay
    this.pendingVideo = null;

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
    this.onStateToggled = null; // Called when user toggles play/pause to sync room
    this.onSeekRequested = null; // Called when user seeks to sync room
    this.onProgressUpdate = null; // Periodic progress updates for slider UI

    this.init();
  }

  init() {
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

    const initialId = this.pendingVideo ? this.pendingVideo.id : 'dQw4w9WgXcQ';

    try {
      this.player = new window.YT.Player('yt-player', {
        width: '1280',
        height: '720',
        videoId: initialId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 1, // ENABLE native YouTube controls directly on video
          disablekb: 0, // ENABLE keyboard shortcuts (space, arrows)
          fs: 1, // ENABLE fullscreen toggle inside YouTube player
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

  onPlayerReady(event) {
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
      if (this.isPlaying) {
        this.player.playVideo();
      } else {
        this.player.pauseVideo();
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
    if (!this.isReady || !this.player) return;
    try {
      const state = this.player.getPlayerState();
      if (this.isPlaying && state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
        this.handleAutoplayBlocked();
      } else if (this.isMuted) {
        if (typeof this.onAudioBlocked === 'function') {
          this.onAudioBlocked(true);
        }
      }
    } catch {}
  }

  handleAutoplayBlocked() {
    if (typeof this.onAudioBlocked === 'function') {
      this.onAudioBlocked(true);
    }
  }

  onPlayerStateChange(event) {
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

      // If state changed to playing locally while room was paused, notify room
      if (!this.isPlaying && typeof this.onStateToggled === 'function') {
        this.isPlaying = true;
        this.onStateToggled(true);
      }
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      // If user paused via YouTube player native controls, sync room
      if (this.isPlaying && !this.isSeeking && typeof this.onStateToggled === 'function') {
        this.onStateToggled(false);
      }
    } else if (event.data === window.YT.PlayerState.ENDED) {
      if (typeof this.onVideoEnded === 'function') {
        this.onVideoEnded();
      }
    }
  }

  onPlayerError(event) {
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
      playerErrorText.textContent = `${msg} Đang tự động chuyển bài tiếp theo...`;
    }
    if (playerError) {
      playerError.classList.remove('hidden');
    }

    if (typeof this.onPlaybackError === 'function') {
      setTimeout(() => {
        this.onPlaybackError(this.currentVideoId, event.data);
      }, 3500);
    }
  }

  syncVideo(video, clockOffset) {
    if (!video || !video.id) return;

    this.clockOffset = clockOffset || 0;
    this.serverStartedAt = video.startedAt || Date.now();
    this.isPlaying = video.isPlaying !== undefined ? !!video.isPlaying : true;
    this.pausedAt = video.pausedAt || 0;
    if (video.duration) this.duration = video.duration;

    if (!this.isReady || !this.player) {
      this.pendingVideo = video;
      return;
    }

    const elapsed = this.isPlaying
      ? Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000)
      : this.pausedAt;

    if (this.currentVideoId !== video.id) {
      this.currentVideoId = video.id;
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
        console.warn('Lỗi tải video:', e);
      }
    } else {
      this.correctTimeDrift();
    }
  }

  // Handle server-wide play/pause/seek sync message
  applyPlaybackSync(payload) {
    if (!this.isReady || !this.player) return;

    const { isPlaying, currentTime, startedAt } = payload;
    this.isPlaying = !!isPlaying;

    if (startedAt) {
      this.serverStartedAt = startedAt;
    }

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
    if (!this.isReady || !this.player || !this.currentVideoId || this.isSeeking) return;

    try {
      const state = this.player.getPlayerState();

      if (!this.isPlaying) {
        // Room is PAUSED
        if (state === window.YT.PlayerState.PLAYING) {
          this.player.pauseVideo();
        }
        if (this.pausedAt > 0 && Math.abs(this.player.getCurrentTime() - this.pausedAt) > 1.5) {
          this.player.seekTo(this.pausedAt, true);
        }
        return;
      }

      // Room is PLAYING
      if (state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
        this.player.playVideo();
      }

      const elapsed = Math.max(0, (Date.now() + this.clockOffset - this.serverStartedAt) / 1000);
      const currentTime = this.player.getCurrentTime();

      if (Math.abs(currentTime - elapsed) > 2.5) {
        this.player.seekTo(elapsed, true);
      }
    } catch {}
  }

  updateProgress() {
    if (!this.isReady || !this.player || this.isSeeking) return;

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
    if (this.isReady && this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch {}
    }
  }

  togglePlayPause() {
    const nextState = !this.isPlaying;
    this.isPlaying = nextState;

    if (this.isReady && this.player) {
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
    if (!this.isReady || !this.player) return;

    const clamped = Math.max(0, Math.min(this.duration || 9999, targetSeconds));
    this.currentTime = clamped;

    try {
      this.player.seekTo(clamped, true);
      if (this.isPlaying) {
        this.player.playVideo();
      }
    } catch {}

    if (typeof this.onSeekRequested === 'function') {
      this.onSeekRequested(clamped);
    }
  }

  rewind(seconds = 10) {
    const cur = this.currentTime || (this.player ? this.player.getCurrentTime() : 0);
    this.seekTo(Math.max(0, cur - seconds));
  }

  fastForward(seconds = 10) {
    const cur = this.currentTime || (this.player ? this.player.getCurrentTime() : 0);
    this.seekTo(cur + seconds);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, vol));
    if (this.isReady && this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(this.volume);
      if (this.volume > 0 && this.player.isMuted()) {
        this.player.unMute();
      }
    }
  }

  toggleMute() {
    if (!this.isReady || !this.player) return false;
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.player.mute();
    } else {
      this.player.unMute();
      this.player.setVolume(this.volume);
    }
    return this.isMuted;
  }

  unmuteWithGesture() {
    if (this.isReady && this.player) {
      try {
        this.player.unMute();
        this.player.setVolume(this.volume);
        this.player.playVideo();
      } catch {}
      this.isMuted = false;
    }
    const idleScreen = document.getElementById('screen-idle');
    if (idleScreen) idleScreen.classList.add('faded');
    const overlay = document.getElementById('audio-blocked-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
}
