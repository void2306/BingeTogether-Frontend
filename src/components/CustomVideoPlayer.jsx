import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import Hls from "hls.js";
import "./CustomVideoPlayer.css";

const CustomVideoPlayer = forwardRef(
  (
    {
      src,
      title = "Live Stream",
      autoPlay = true,
      onSeeked,
      onPlay,
      onPause,
      className = "",
      poster,
    },
    ref
  ) => {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const containerRef = useRef(null);
    const scrubBarRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const customTrackUrlsRef = useRef([]);
    const subtitleFileInputRef = useRef(null);
    const audioFileInputRef = useRef(null);
    const customAudioRef = useRef(null);
    const customAudioUrlsRef = useRef([]);

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Controls visibility
    const [showControls, setShowControls] = useState(true);
    const [activeMenu, setActiveMenu] = useState(null); // 'audio' | 'subtitles' | 'speed' | 'quality' | null

    // Track state
    const [audioTracks, setAudioTracks] = useState([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState(0);

    const [subtitleTracks, setSubtitleTracks] = useState([]);
    const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(-1); // -1 = off

    const [qualityLevels, setQualityLevels] = useState([]);
    const [currentQualityLevel, setCurrentQualityLevel] = useState(-1); // -1 = auto

    // Scrubber hover state
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverPos, setHoverPos] = useState(0);
    const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);

    // Toast feedback notification
    const [toastMessage, setToastMessage] = useState(null);
    const toastTimeoutRef = useRef(null);

    const showToast = useCallback((msg) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToastMessage(msg);
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
    }, []);

    // Expose API via forwardRef for RoomPage & BingeBotChat
    useImperativeHandle(
      ref,
      () => ({
        getCurrentTime: () => videoRef.current?.currentTime || 0,
        seekTo: (seconds) => {
          if (videoRef.current && typeof seconds === "number" && !isNaN(seconds)) {
            videoRef.current.currentTime = seconds;
          }
        },
        play: () => videoRef.current?.play(),
        pause: () => videoRef.current?.pause(),
        getInternalPlayer: () => videoRef.current,
      }),
      []
    );

    // Format seconds to mm:ss or hh:mm:ss
    const formatTime = (secs) => {
      if (isNaN(secs) || secs < 0) return "0:00";
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      if (h > 0) {
        return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
      }
      return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    // Auto-hide controls
    const resetControlsTimeout = useCallback(() => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

      if (isPlaying && !activeMenu) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3200);
      }
    }, [isPlaying, activeMenu]);

    const handleMouseMove = () => {
      resetControlsTimeout();
    };

    // Initialize Video & HLS
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Reset track states
      setAudioTracks([]);
      setCurrentAudioTrack(0);
      setSubtitleTracks([]);
      setCurrentSubtitleTrack(-1);
      setQualityLevels([]);
      setCurrentQualityLevel(-1);

      const isHls =
        src.includes(".m3u8") ||
        src.startsWith("blob:") ||
        src.includes("application/x-mpegURL");

      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          renderTextTracksNatively: false,
        });

        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          // Audio tracks
          if (hls.audioTracks && hls.audioTracks.length > 0) {
            const mappedAudio = hls.audioTracks.map((track, idx) => ({
              id: idx,
              name:
                track.name ||
                track.lang ||
                (idx === 0 ? "Default Audio" : `Audio Track ${idx + 1}`),
              lang: track.lang || "und",
              default: track.default,
            }));
            setAudioTracks(mappedAudio);
            setCurrentAudioTrack(hls.audioTrack);
          }

          // Subtitle tracks
          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
            const mappedSubs = hls.subtitleTracks.map((track, idx) => ({
              id: idx,
              name:
                track.name ||
                track.lang ||
                `Subtitle Track ${idx + 1}`,
              lang: track.lang || "und",
              hlsIndex: idx,
            }));
            setSubtitleTracks(mappedSubs);
            setCurrentSubtitleTrack(hls.subtitleTrack);
          }

          // Quality levels
          if (data.levels && data.levels.length > 0) {
            const mappedLevels = data.levels.map((lvl, idx) => ({
              id: idx,
              height: lvl.height,
              bitrate: Math.round(lvl.bitrate / 1000),
              name: lvl.height ? `${lvl.height}p` : `Bitrate ${Math.round(lvl.bitrate / 1000)}k`,
            }));
            setQualityLevels(mappedLevels);
          }

          if (autoPlay) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
          if (data.audioTracks && data.audioTracks.length > 0) {
            setAudioTracks(
              data.audioTracks.map((track, idx) => ({
                id: idx,
                name: track.name || track.lang || `Track ${idx + 1}`,
                lang: track.lang || "und",
              }))
            );
            setCurrentAudioTrack(hls.audioTrack);
          }
        });

        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
          setCurrentAudioTrack(data.id);
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
          if (data.subtitleTracks && data.subtitleTracks.length > 0) {
            setSubtitleTracks(
              data.subtitleTracks.map((track, idx) => ({
                id: idx,
                name: track.name || track.lang || `Subtitle ${idx + 1}`,
                lang: track.lang || "und",
                hlsIndex: idx,
              }))
            );
          }
        });

        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
          setCurrentSubtitleTrack(data.id);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setCurrentQualityLevel(data.level);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("[CustomPlayer] HLS network error, recovering...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("[CustomPlayer] HLS media error, recovering...");
                hls.recoverMediaError();
                break;
              default:
                console.error("[CustomPlayer] Unrecoverable HLS error:", data);
                hls.destroy();
                break;
            }
          }
        });
      } else {
        // Standard HTML5 video element source
        video.src = src;

        // Native audio tracks support (Safari / WebKit)
        const checkNativeTracks = () => {
          if (video.audioTracks && video.audioTracks.length > 0) {
            const list = [];
            for (let i = 0; i < video.audioTracks.length; i++) {
              const trk = video.audioTracks[i];
              list.push({
                id: i,
                name: trk.label || trk.language || `Track ${i + 1}`,
                lang: trk.language || "und",
                enabled: trk.enabled,
              });
              if (trk.enabled) setCurrentAudioTrack(i);
            }
            setAudioTracks(list);
          }

          if (video.textTracks && video.textTracks.length > 0) {
            const subs = [];
            for (let i = 0; i < video.textTracks.length; i++) {
              const t = video.textTracks[i];
              subs.push({
                id: i,
                name: t.label || t.language || `Track ${i + 1}`,
                lang: t.language || "und",
              });
              if (t.mode === "showing") setCurrentSubtitleTrack(i);
            }
            setSubtitleTracks(subs);
          }
        };

        video.addEventListener("loadedmetadata", checkNativeTracks);
        if (autoPlay) {
          video.play().catch(() => {});
        }
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src, autoPlay]);

    // Clean up created object URLs for custom subtitle and audio blobs on unmount
    useEffect(() => {
      const subUrls = customTrackUrlsRef.current;
      const audioUrls = customAudioUrlsRef.current;
      return () => {
        subUrls.forEach((url) => URL.revokeObjectURL(url));
        audioUrls.forEach((url) => URL.revokeObjectURL(url));
        if (customAudioRef.current) {
          customAudioRef.current.pause();
          customAudioRef.current.src = "";
          customAudioRef.current = null;
        }
      };
    }, []);

    // Video Event Listeners
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlePlay = () => {
        setIsPlaying(true);
        resetControlsTimeout();
        if (customAudioRef.current && customAudioRef.current.src) {
          customAudioRef.current.play().catch(() => {});
        }
        onPlay?.();
      };

      const handlePause = () => {
        setIsPlaying(false);
        setShowControls(true);
        if (customAudioRef.current && customAudioRef.current.src) {
          customAudioRef.current.pause();
        }
        onPause?.();
      };

      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        if (customAudioRef.current && customAudioRef.current.src && !video.paused) {
          const drift = Math.abs(customAudioRef.current.currentTime - video.currentTime);
          if (drift > 0.35) {
            customAudioRef.current.currentTime = video.currentTime;
          }
        }
        if (video.buffered.length > 0 && video.duration > 0) {
          try {
            const end = video.buffered.end(video.buffered.length - 1);
            setBuffered(Math.min(100, (end / video.duration) * 100));
          } catch {
            // Safe fallback
          }
        }
      };

      const handleDurationChange = () => {
        setDuration(video.duration || 0);
      };

      const handleWaiting = () => {
        setIsBuffering(true);
        if (customAudioRef.current && customAudioRef.current.src) {
          customAudioRef.current.pause();
        }
      };

      const handlePlaying = () => {
        setIsBuffering(false);
        if (customAudioRef.current && customAudioRef.current.src) {
          customAudioRef.current.play().catch(() => {});
        }
      };

      const handleSeeked = () => {
        setIsBuffering(false);
        if (customAudioRef.current && customAudioRef.current.src) {
          customAudioRef.current.currentTime = video.currentTime;
        }
        onSeeked?.(video.currentTime);
      };

      const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
      };

      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("durationchange", handleDurationChange);
      video.addEventListener("waiting", handleWaiting);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("seeked", handleSeeked);
      video.addEventListener("volumechange", handleVolumeChange);

      return () => {
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("durationchange", handleDurationChange);
        video.removeEventListener("waiting", handleWaiting);
        video.removeEventListener("playing", handlePlaying);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("volumechange", handleVolumeChange);
      };
    }, [onSeeked, onPlay, onPause, resetControlsTimeout]);

    // Fullscreen state listener
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
      };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (
          ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) ||
          document.activeElement?.isContentEditable
        ) {
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        switch (e.code) {
          case "Space":
          case "KeyK":
            e.preventDefault();
            togglePlay();
            break;
          case "ArrowLeft":
            e.preventDefault();
            seekRelative(-5);
            break;
          case "ArrowRight":
            e.preventDefault();
            seekRelative(5);
            break;
          case "ArrowUp":
            e.preventDefault();
            changeVolume(Math.min(1, volume + 0.1));
            break;
          case "ArrowDown":
            e.preventDefault();
            changeVolume(Math.max(0, volume - 0.1));
            break;
          case "KeyM":
            e.preventDefault();
            toggleMute();
            break;
          case "KeyF":
            e.preventDefault();
            toggleFullscreen();
            break;
          case "KeyC":
            e.preventDefault();
            toggleSubtitlesQuick();
            break;
          default:
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [volume, isPlaying, isMuted, subtitleTracks, currentSubtitleTrack]);

    // Control Handlers
    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
      resetControlsTimeout();
    };

    const seekRelative = (delta) => {
      const video = videoRef.current;
      if (!video) return;
      const target = Math.max(0, Math.min(duration || 0, video.currentTime + delta));
      video.currentTime = target;
      resetControlsTimeout();
      showToast(`${delta > 0 ? `+${delta}s` : `${delta}s`} (${formatTime(target)})`);
    };

    const handleScrubberClick = (e) => {
      const bar = scrubBarRef.current;
      const video = videoRef.current;
      if (!bar || !video || !duration) return;

      const rect = bar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = percent * duration;

      video.currentTime = targetTime;
      resetControlsTimeout();
    };

    const handleScrubberMouseMove = (e) => {
      const bar = scrubBarRef.current;
      if (!bar || !duration) return;

      const rect = bar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, clickX / rect.width));
      setHoverPos(percent * 100);
      setHoverTime(percent * duration);
    };

    const changeVolume = (newVol) => {
      const video = videoRef.current;
      if (!video) return;
      setVolume(newVol);
      setIsMuted(newVol === 0);
      if (customAudioRef.current && customAudioRef.current.src) {
        customAudioRef.current.volume = newVol;
        customAudioRef.current.muted = newVol === 0;
      } else {
        video.volume = newVol;
        video.muted = newVol === 0;
      }
      resetControlsTimeout();
    };

    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      if (customAudioRef.current && customAudioRef.current.src) {
        customAudioRef.current.muted = nextMuted;
      } else {
        video.muted = nextMuted;
      }
      resetControlsTimeout();
      showToast(nextMuted ? "Muted" : `Volume: ${Math.round(volume * 100)}%`);
    };

    const setSpeed = (rate) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = rate;
      if (customAudioRef.current && customAudioRef.current.src) {
        customAudioRef.current.playbackRate = rate;
      }
      setPlaybackRate(rate);
      setActiveMenu(null);
      showToast(`Speed: ${rate}x`);
    };

    const toggleFullscreen = () => {
      const container = containerRef.current;
      if (!container) return;

      if (!document.fullscreenElement) {
        container.requestFullscreen?.().catch((err) => {
          console.warn("Fullscreen request error:", err);
        });
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    };

    const togglePiP = async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
        }
      } catch (err) {
        console.warn("PiP error:", err);
      }
    };

    // Audio Track Switcher (HLS, Native, or Custom Uploaded)
    const selectAudioTrack = (trackOrId) => {
      let selected;
      let targetId;

      if (typeof trackOrId === "object" && trackOrId !== null) {
        selected = trackOrId;
        targetId = trackOrId.id;
      } else {
        targetId = trackOrId;
        selected = audioTracks.find((t) => t.id === trackOrId) || audioTracks[trackOrId];
      }

      if (selected?.isCustom) {
        // Mute video element to prevent audio overlap
        if (videoRef.current) {
          videoRef.current.muted = true;
        }
        if (!customAudioRef.current) {
          customAudioRef.current = new Audio();
        }
        const audio = customAudioRef.current;
        if (audio.src !== selected.src) {
          audio.src = selected.src;
        }
        if (videoRef.current) {
          audio.currentTime = videoRef.current.currentTime || 0;
          audio.playbackRate = videoRef.current.playbackRate || 1;
        }
        audio.volume = isMuted ? 0 : volume;
        audio.muted = isMuted;

        if (isPlaying) {
          audio.play().catch(() => {});
        }

        setCurrentAudioTrack(targetId);
        showToast(`Audio: ${selected.name}`);
      } else {
        // Reverting to native video audio / HLS track
        if (customAudioRef.current) {
          customAudioRef.current.pause();
          customAudioRef.current.src = "";
        }
        if (videoRef.current) {
          videoRef.current.muted = isMuted;
        }

        if (hlsRef.current && typeof targetId === "number") {
          hlsRef.current.audioTrack = targetId;
          setCurrentAudioTrack(targetId);
          showToast(`Audio: ${selected?.name || selected?.lang || `Track ${targetId + 1}`}`);
        } else if (videoRef.current && videoRef.current.audioTracks) {
          for (let i = 0; i < videoRef.current.audioTracks.length; i++) {
            videoRef.current.audioTracks[i].enabled = i === targetId;
          }
          setCurrentAudioTrack(targetId);
          showToast(`Audio: ${selected?.name || `Track ${targetId + 1}`}`);
        } else {
          setCurrentAudioTrack(0);
          showToast("Audio: Default Video Audio");
        }
      }
      setActiveMenu(null);
    };

    // Audio File (.mp3, .m4a, .aac, .wav) Upload Handler
    const handleAudioFileUpload = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const blobUrl = URL.createObjectURL(file);
      customAudioUrlsRef.current.push(blobUrl);

      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      const newTrack = {
        id: `custom-audio-${Date.now()}`,
        name: `${cleanName} (Attached)`,
        lang: "custom",
        src: blobUrl,
        isCustom: true,
      };

      setAudioTracks((prev) => {
        const hasDefault = prev.some((t) => t.id === 0 || t.isDefault);
        const base = hasDefault
          ? prev
          : [{ id: 0, name: "Default Video Audio", lang: "default", isDefault: true }, ...prev];
        return [...base, newTrack];
      });

      selectAudioTrack(newTrack);
      showToast(`Attached Audio: ${cleanName}`);
      e.target.value = "";
    };

    // Subtitle Track Switcher
    const selectSubtitleTrack = (index) => {
      setCurrentSubtitleTrack(index);

      if (index === -1) {
        // Off
        if (hlsRef.current) {
          hlsRef.current.subtitleTrack = -1;
          hlsRef.current.subtitleDisplay = false;
        }
        if (videoRef.current) {
          for (let i = 0; i < videoRef.current.textTracks.length; i++) {
            videoRef.current.textTracks[i].mode = "disabled";
          }
        }
        showToast("Subtitles: Off");
      } else {
        const selected = subtitleTracks[index];
        if (selected?.isCustom) {
          // Custom uploaded subtitle
          if (hlsRef.current) {
            hlsRef.current.subtitleTrack = -1;
            hlsRef.current.subtitleDisplay = false;
          }
          if (videoRef.current) {
            for (let i = 0; i < videoRef.current.textTracks.length; i++) {
              const trk = videoRef.current.textTracks[i];
              trk.mode =
                trk.label === selected.name || trk.label === selected.id
                  ? "showing"
                  : "disabled";
            }
          }
          showToast(`Subtitles: ${selected.name}`);
        } else if (hlsRef.current && selected?.hlsIndex !== undefined) {
          // Native HLS subtitle track
          if (videoRef.current) {
            for (let i = 0; i < videoRef.current.textTracks.length; i++) {
              videoRef.current.textTracks[i].mode = "disabled";
            }
          }
          hlsRef.current.subtitleTrack = selected.hlsIndex;
          hlsRef.current.subtitleDisplay = true;
          showToast(
            `Subtitles: ${selected.name || selected.lang || `Track ${index + 1}`}`
          );
        } else if (videoRef.current && videoRef.current.textTracks.length > 0) {
          for (let i = 0; i < videoRef.current.textTracks.length; i++) {
            videoRef.current.textTracks[i].mode =
              i === index ? "showing" : "disabled";
          }
          showToast(`Subtitles: ${selected.name || `Track ${index + 1}`}`);
        }
      }
      setActiveMenu(null);
    };

    const toggleSubtitlesQuick = () => {
      if (subtitleTracks.length === 0) {
        showToast("No subtitles available");
        return;
      }
      if (currentSubtitleTrack === -1) {
        selectSubtitleTrack(0);
      } else {
        selectSubtitleTrack(-1);
      }
    };

    // Subtitle File (.srt, .vtt) Upload Handler
    const handleSubtitleFileUpload = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        let vttContent = content;

        // Simple and resilient SRT -> WebVTT conversion
        if (file.name.toLowerCase().endsWith(".srt")) {
          vttContent =
            "WEBVTT\n\n" +
            content
              .replace(/\r\n|\r/g, "\n")
              .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
        }

        const blob = new Blob([vttContent], { type: "text/vtt" });
        const blobUrl = URL.createObjectURL(blob);
        customTrackUrlsRef.current.push(blobUrl);

        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const newTrack = {
          id: `custom-${Date.now()}`,
          name: `${cleanName} (Uploaded)`,
          lang: "custom",
          src: blobUrl,
          isCustom: true,
        };

        if (videoRef.current) {
          const trackElem = document.createElement("track");
          trackElem.kind = "subtitles";
          trackElem.label = newTrack.name;
          trackElem.srclang = "custom";
          trackElem.src = blobUrl;
          trackElem.default = true;
          videoRef.current.appendChild(trackElem);

          trackElem.addEventListener("load", () => {
            for (let i = 0; i < videoRef.current.textTracks.length; i++) {
              const trk = videoRef.current.textTracks[i];
              trk.mode = trk.label === newTrack.name ? "showing" : "disabled";
            }
          });
        }

        setSubtitleTracks((prev) => {
          const updated = [...prev, newTrack];
          setCurrentSubtitleTrack(updated.length - 1);
          return updated;
        });

        showToast(`Loaded Subtitle: ${cleanName}`);
        setActiveMenu(null);
      };

      reader.readAsText(file);
      e.target.value = "";
    };

    // Quality Level Switcher
    const selectQualityLevel = (lvlId) => {
      if (hlsRef.current) {
        hlsRef.current.currentLevel = lvlId;
        setCurrentQualityLevel(lvlId);
        if (lvlId === -1) {
          showToast("Quality: Auto Adaptive");
        } else {
          const lvl = qualityLevels.find((q) => q.id === lvlId);
          showToast(`Quality: ${lvl?.name || "Manual"}`);
        }
      }
      setActiveMenu(null);
    };

    const toggleMenu = (menuName) => {
      setActiveMenu((prev) => (prev === menuName ? null : menuName));
    };

    const currentProgressPercent =
      duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        className={`custom-player-container ${
          isFullscreen ? "is-fullscreen" : ""
        } ${!showControls && isPlaying ? "controls-hidden" : ""} ${className}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          if (isPlaying && !activeMenu) setShowControls(false);
        }}
      >
        {/* Hidden File Input for Custom Subtitles */}
        <input
          type="file"
          ref={subtitleFileInputRef}
          accept=".vtt,.srt"
          style={{ display: "none" }}
          onChange={handleSubtitleFileUpload}
        />

        {/* Hidden File Input for Custom Audio Tracks */}
        <input
          type="file"
          ref={audioFileInputRef}
          accept=".mp3,.m4a,.aac,.wav,.ogg,.flac"
          style={{ display: "none" }}
          onChange={handleAudioFileUpload}
        />

        {/* The Native HTML5 Video Element */}
        <video
          ref={videoRef}
          id="room-video-player"
          className="custom-video-element"
          poster={poster}
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlay}
        >
          Your browser does not support HTML5 video.
        </video>

        {/* Central Buffering Spinner */}
        {isBuffering && (
          <div className="player-buffering-overlay">
            <div className="buffering-glow-spinner"></div>
            <span className="buffering-text">Buffering...</span>
          </div>
        )}

        {/* Center Ripple / Quick Play-Pause Indicator */}
        <div
          className={`center-action-glow ${!isPlaying ? "visible-paused" : ""}`}
          onClick={togglePlay}
        >
          {!isPlaying ? (
            <svg viewBox="0 0 24 24" className="center-icon">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
            </svg>
          ) : null}
        </div>

        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="player-toast-chip">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header Bar (Title & Stream Info) */}
        <div className="player-top-bar">
          <div className="player-stream-info">
            <h4 className="player-title">{title}</h4>
            <div className="player-badges">
              {src && (src.includes(".m3u8") || src.includes("blob:")) && (
                <span className="tech-badge hls">HLS Multi-Track</span>
              )}
              {audioTracks.length > 1 && (
                <span className="tech-badge audio">
                  🎧 {audioTracks.length} Audio Tracks
                </span>
              )}
              {subtitleTracks.length > 0 && (
                <span className="tech-badge subs">
                  💬 {subtitleTracks.length} Subtitles
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Floating Menu Popovers (Audio, Subtitles, Speed, Quality) */}
        {activeMenu && (
          <div
            className="player-popover-backdrop"
            onClick={() => setActiveMenu(null)}
          >
            <div
              className="player-popover-card"
              onClick={(e) => e.stopPropagation()}
            >
              {/* AUDIO TRACKS MENU */}
              {activeMenu === "audio" && (
                <div className="menu-section">
                  <div className="menu-header">
                    <span className="menu-icon">🎧</span>
                    <h4>Select Audio Track</h4>
                  </div>
                  {audioTracks.length === 0 ? (
                    <>
                      <div className="menu-options-list">
                        <button
                          className={`menu-option-item ${
                            currentAudioTrack === 0 ? "active" : ""
                          }`}
                          onClick={() => selectAudioTrack(0)}
                        >
                          <span className="option-name">Default Video Audio</span>
                          <span className="option-badge">DEFAULT</span>
                          {currentAudioTrack === 0 && (
                            <span className="option-check">✓</span>
                          )}
                        </button>
                      </div>
                      <div className="menu-empty-hint">
                        <p>Default audio stream active.</p>
                        <small>
                          💡 <strong>Why single track?</strong> Web browsers (unlike VLC) only demux track 0 from static MP4/MKV files. Use HLS (.m3u8) or attach an audio track below.
                        </small>
                      </div>
                    </>
                  ) : (
                    <div className="menu-options-list">
                      {audioTracks.map((trk) => (
                        <button
                          key={trk.id}
                          className={`menu-option-item ${
                            currentAudioTrack === trk.id ? "active" : ""
                          }`}
                          onClick={() => selectAudioTrack(trk.id)}
                        >
                          <span className="option-name">{trk.name}</span>
                          {trk.lang && (
                            <span className="option-badge">
                              {trk.lang.toUpperCase()}
                            </span>
                          )}
                          {currentAudioTrack === trk.id && (
                            <span className="option-check">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Attach Custom Audio Action */}
                  <div className="menu-footer-action">
                    <button
                      className="upload-sub-btn"
                      onClick={() => audioFileInputRef.current?.click()}
                    >
                      <span>➕</span> Attach Audio Track (.mp3 / .m4a / .aac)
                    </button>
                  </div>
                </div>
              )}

              {/* SUBTITLES MENU */}
              {activeMenu === "subtitles" && (
                <div className="menu-section">
                  <div className="menu-header">
                    <span className="menu-icon">💬</span>
                    <h4>Subtitles & Captions</h4>
                  </div>
                  <div className="menu-options-list">
                    <button
                      className={`menu-option-item ${
                        currentSubtitleTrack === -1 ? "active" : ""
                      }`}
                      onClick={() => selectSubtitleTrack(-1)}
                    >
                      <span className="option-name">Off (Disabled)</span>
                      {currentSubtitleTrack === -1 && (
                        <span className="option-check">✓</span>
                      )}
                    </button>

                    {subtitleTracks.map((sub, idx) => (
                      <button
                        key={sub.id || idx}
                        className={`menu-option-item ${
                          currentSubtitleTrack === idx ? "active" : ""
                        }`}
                        onClick={() => selectSubtitleTrack(idx)}
                      >
                        <span className="option-name">{sub.name}</span>
                        {sub.lang && (
                          <span className="option-badge">
                            {sub.lang.toUpperCase()}
                          </span>
                        )}
                        {currentSubtitleTrack === idx && (
                          <span className="option-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {subtitleTracks.length === 0 && (
                    <div className="menu-empty-hint" style={{ marginTop: "4px" }}>
                      <small>
                        💡 <strong>Why no subtitles?</strong> Browsers cannot demux embedded MKV/MP4 subtitles. Upload a .srt or .vtt file below.
                      </small>
                    </div>
                  )}

                  {/* Upload Custom Subtitle Action */}
                  <div className="menu-footer-action">
                    <button
                      className="upload-sub-btn"
                      onClick={() => subtitleFileInputRef.current?.click()}
                    >
                      <span>➕</span> Upload Subtitle (.srt / .vtt)
                    </button>
                  </div>
                </div>
              )}

              {/* SPEED MENU */}
              {activeMenu === "speed" && (
                <div className="menu-section">
                  <div className="menu-header">
                    <span className="menu-icon">⚡</span>
                    <h4>Playback Speed</h4>
                  </div>
                  <div className="menu-options-list speed-grid">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        className={`menu-option-item ${
                          playbackRate === rate ? "active" : ""
                        }`}
                        onClick={() => setSpeed(rate)}
                      >
                        <span className="option-name">
                          {rate === 1.0 ? "Normal (1x)" : `${rate}x`}
                        </span>
                        {playbackRate === rate && (
                          <span className="option-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QUALITY MENU */}
              {activeMenu === "quality" && (
                <div className="menu-section">
                  <div className="menu-header">
                    <span className="menu-icon">⚙️</span>
                    <h4>Stream Quality</h4>
                  </div>
                  <div className="menu-options-list">
                    <button
                      className={`menu-option-item ${
                        currentQualityLevel === -1 ? "active" : ""
                      }`}
                      onClick={() => selectQualityLevel(-1)}
                    >
                      <span className="option-name">Auto (Adaptive)</span>
                      {currentQualityLevel === -1 && (
                        <span className="option-check">✓</span>
                      )}
                    </button>
                    {qualityLevels.map((lvl) => (
                      <button
                        key={lvl.id}
                        className={`menu-option-item ${
                          currentQualityLevel === lvl.id ? "active" : ""
                        }`}
                        onClick={() => selectQualityLevel(lvl.id)}
                      >
                        <span className="option-name">{lvl.name}</span>
                        {lvl.bitrate && (
                          <span className="option-badge">{lvl.bitrate} kbps</span>
                        )}
                        {currentQualityLevel === lvl.id && (
                          <span className="option-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS OVERLAY */}
        <div className="player-controls-overlay">
          {/* SCRUBBER TIMELINE */}
          <div
            ref={scrubBarRef}
            className="timeline-scrubber-track"
            onClick={handleScrubberClick}
            onMouseMove={handleScrubberMouseMove}
            onMouseEnter={() => setIsHoveringScrubber(true)}
            onMouseLeave={() => setIsHoveringScrubber(false)}
          >
            {/* Buffered Progress */}
            <div
              className="timeline-buffered-bar"
              style={{ width: `${buffered}%` }}
            />
            {/* Played Progress */}
            <div
              className="timeline-played-bar"
              style={{ width: `${currentProgressPercent}%` }}
            >
              <div className="timeline-thumb-glow" />
            </div>

            {/* Hover Tooltip */}
            {isHoveringScrubber && hoverTime !== null && (
              <div
                className="timeline-hover-tooltip"
                style={{ left: `${hoverPos}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* CONTROLS ROW */}
          <div className="controls-row">
            {/* LEFT ACTIONS: Play/Pause, -10s, +10s, Volume, Time */}
            <div className="controls-left-group">
              {/* Play / Pause */}
              <button
                className="player-btn icon-btn"
                onClick={togglePlay}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                  </svg>
                )}
              </button>

              {/* Rewind 10s */}
              <button
                className="player-btn icon-btn skip-btn"
                onClick={() => seekRelative(-10)}
                title="Rewind 10s"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    d="M12.5 3a9 9 0 1 0 8.7 6.7"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  <polyline
                    points="8 3 13 3 13 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span className="skip-number">10</span>
              </button>

              {/* Forward 10s */}
              <button
                className="player-btn icon-btn skip-btn"
                onClick={() => seekRelative(10)}
                title="Forward 10s"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    d="M11.5 3a9 9 0 1 1-8.7 6.7"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  <polyline
                    points="16 3 11 3 11 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span className="skip-number">10</span>
              </button>

              {/* Volume Slider & Mute */}
              <div className="volume-control-box">
                <button
                  className="player-btn icon-btn"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" width="19" height="19">
                      <path
                        d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg viewBox="0 0 24 24" width="19" height="19">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="19" height="19">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9.5 9.5 0 0 1 0 14" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  className="volume-slider"
                  title="Volume"
                />
              </div>

              {/* Timestamp Counter */}
              <div className="player-time-display">
                <span className="time-current">{formatTime(currentTime)}</span>
                <span className="time-sep">/</span>
                <span className="time-duration">{formatTime(duration)}</span>
              </div>
            </div>

            {/* RIGHT ACTIONS: Audio Track, Subtitles, Speed, Quality, PiP, Fullscreen */}
            <div className="controls-right-group">
              {/* AUDIO TRACK SELECTOR BUTTON */}
              <button
                className={`player-btn text-icon-btn ${
                  activeMenu === "audio" ? "active-btn-glow" : ""
                }`}
                onClick={() => toggleMenu("audio")}
                title="Audio Tracks"
              >
                <span className="control-emoji">🎧</span>
                <span className="control-label-text">
                  {(() => {
                    const trk = audioTracks.find((t) => t.id === currentAudioTrack) || audioTracks[currentAudioTrack];
                    if (!trk) return "Audio";
                    return trk.lang && trk.lang !== "und" && trk.lang !== "custom" && trk.lang !== "default"
                      ? trk.lang.toUpperCase()
                      : trk.name?.slice(0, 8) || "Audio";
                  })()}
                </span>
                {audioTracks.length > 1 && (
                  <span className="track-count-dot">{audioTracks.length}</span>
                )}
              </button>

              {/* SUBTITLES / CC BUTTON */}
              <button
                className={`player-btn text-icon-btn ${
                  currentSubtitleTrack !== -1 ? "cc-active" : ""
                } ${activeMenu === "subtitles" ? "active-btn-glow" : ""}`}
                onClick={() => toggleMenu("subtitles")}
                title="Subtitles & Captions"
              >
                <span className="control-emoji">💬</span>
                <span className="control-label-text">
                  {currentSubtitleTrack !== -1 ? "CC On" : "CC"}
                </span>
              </button>

              {/* PLAYBACK SPEED BUTTON */}
              <button
                className={`player-btn text-icon-btn ${
                  activeMenu === "speed" ? "active-btn-glow" : ""
                }`}
                onClick={() => toggleMenu("speed")}
                title="Playback Speed"
              >
                <span className="speed-label">{playbackRate}x</span>
              </button>

              {/* QUALITY SELECTOR (HLS) */}
              {qualityLevels.length > 0 && (
                <button
                  className={`player-btn text-icon-btn ${
                    activeMenu === "quality" ? "active-btn-glow" : ""
                  }`}
                  onClick={() => toggleMenu("quality")}
                  title="Stream Quality"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                  <span className="control-label-text">
                    {currentQualityLevel === -1
                      ? "Auto"
                      : qualityLevels.find((q) => q.id === currentQualityLevel)?.name ||
                        "Quality"}
                  </span>
                </button>
              )}

              {/* PICTURE-IN-PICTURE (PiP) */}
              <button
                className="player-btn icon-btn"
                onClick={togglePiP}
                title="Picture-in-Picture"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <rect
                    x="2"
                    y="4"
                    width="20"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                  <rect
                    x="12"
                    y="11"
                    width="8"
                    height="7"
                    rx="1"
                    fill="currentColor"
                  />
                </svg>
              </button>

              {/* FULLSCREEN */}
              <button
                className="player-btn icon-btn"
                onClick={toggleFullscreen}
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CustomVideoPlayer.displayName = "CustomVideoPlayer";

export default CustomVideoPlayer;
