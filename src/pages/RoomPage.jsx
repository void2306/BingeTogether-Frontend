import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./RoomPage.css";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL, WS_BASE_URL } from "../config";
import CustomVideoPlayer from "../components/CustomVideoPlayer";

// Free Google STUN Servers
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * Google Meet-Style Participant Tile Subcomponent
 * Displays live video when camera is ON, or an animated Avatar placeholder when camera is OFF.
 * Remote audio plays seamlessly without echoes.
 */
function ParticipantVideoTile({
  stream,
  name,
  isLocal,
  isCameraOn,
  isMuted,
  avatarInitial,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream && isCameraOn) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [stream, isCameraOn]);

  useEffect(() => {
    // When camera is off for a remote user, their mic audio still plays via an audio element
    if (!isLocal && !isCameraOn && audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
    }
  }, [stream, isCameraOn, isLocal]);

  return (
    <div
      className={`participant-tile ${isLocal ? "local-participant" : ""} ${
        !isCameraOn ? "camera-off" : ""
      }`}
    >
      {/* 1. Live Video when Camera is ON */}
      {isCameraOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // MUST be muted for local to prevent acoustic feedback loop!
          className={`participant-video ${isLocal ? "mirrored" : ""}`}
        />
      ) : (
        /* 2. Google Meet Avatar Placeholder when Camera is OFF */
        <div className="avatar-placeholder-container">
          <div className="google-meet-avatar">
            {avatarInitial || (name ? name.charAt(0).toUpperCase() : "U")}
          </div>
          <span className="camera-off-indicator">Camera Off</span>
        </div>
      )}

      {/* Hidden audio element for remote participants when their camera is off but mic is on */}
      {!isLocal && !isCameraOn && (
        <audio ref={audioRef} autoPlay playsInline />
      )}

      {/* Bottom Status Bar */}
      <div className="tile-bottom-bar">
        <span className="participant-name">
          {name} {isLocal && "(You)"}
        </span>
        <span
          className={`mic-badge ${isMuted ? "muted" : "unmuted"}`}
          title={isMuted ? "Microphone Muted" : "Microphone Active"}
        >
          {isMuted ? "🔇" : "🎙️"}
        </span>
      </div>
    </div>
  );
}

function RoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const botMessagesEndRef = useRef(null);

  const playerRef = useRef(null);
  const isSeekingRef = useRef(false);
  const ignoreNextSyncRef = useRef(false);

  const currentUserId = Number(localStorage.getItem("userId")) || 999;
  const currentUsername = localStorage.getItem("username")?.trim() || "User";

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const stompClientRef = useRef(null);

  const [pendingSync, setPendingSync] = useState(null);
  const [demoVideo, setDemoVideo] = useState(null);

  // 🤖 BingeBot State & Controls
  const [activeTab, setActiveTab] = useState("chat");
  const [botMessages, setBotMessages] = useState([
    {
      id: 1,
      sender: "BingeBot",
      text: "Hey! I'm your private watch-party AI assistant. Ask me anything about this movie or scene!",
      isBot: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [botInput, setBotInput] = useState("");
  const [isBotLoading, setIsBotLoading] = useState(false);

  // 📹 Google Meet-Style Independent Media States
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }
  // Tracks participant camera/mic state: { [peerId]: { isCameraOn: boolean, isMuted: boolean, name: string } }
  const [peerMediaStates, setPeerMediaStates] = useState({});

  const peerConnectionsRef = useRef({}); // { [peerId]: RTCPeerConnection }
  const pendingCandidatesRef = useRef({}); // { [peerId]: RTCIceCandidateInit[] }
  const localStreamRef = useRef(null);

  // Local storage mapping for persistent member names
  const getStoredRoomNames = () => {
    try {
      const saved = localStorage.getItem(`room_names_${roomCode}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const saveStoredRoomName = (userId, username) => {
    if (!userId || !username || username === "User" || username.startsWith("User #")) return;
    try {
      const currentMap = getStoredRoomNames();
      currentMap[Number(userId)] = username;
      localStorage.setItem(`room_names_${roomCode}`, JSON.stringify(currentMap));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentUserId && currentUsername) {
      saveStoredRoomName(currentUserId, currentUsername);
    }
  }, [roomCode, currentUserId, currentUsername]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollBotToBottom = () => {
    botMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Broadcasts media state (camera on/off, mic on/off) over STOMP
  const broadcastMediaState = useCallback(
    (cameraState, mutedState) => {
      if (stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/app/room/${roomCode}/sync`,
          body: JSON.stringify({
            sender: currentUsername,
            userId: currentUserId,
            action: "MEDIA_STATE_UPDATE",
            isCameraOn: cameraState,
            isMuted: mutedState,
          }),
        });
      }
    },
    [roomCode, currentUsername, currentUserId]
  );

  // -------------------------------------------------------------
  // 🎙️ Google Meet-Style WebRTC Engine
  // -------------------------------------------------------------

  /**
   * Creates or retrieves an RTCPeerConnection for targetUserId.
   * If the local user has no tracks yet (camera off, mic off), it attaches
   * recvonly transceivers so Person B can receive Person A's video/audio immediately!
   */
  const getOrCreatePeerConnection = useCallback(
    (targetUserId) => {
      if (peerConnectionsRef.current[targetUserId]) {
        return peerConnectionsRef.current[targetUserId];
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Add local tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // If no local tracks exist, ensure recvonly transceivers are ready to receive
      const senders = pc.getSenders();
      const hasAudio = senders.some((s) => s.track && s.track.kind === "audio");
      const hasVideo = senders.some((s) => s.track && s.track.kind === "video");

      if (!hasAudio) {
        pc.addTransceiver("audio", { direction: "recvonly" });
      }
      if (!hasVideo) {
        pc.addTransceiver("video", { direction: "recvonly" });
      }

      // Receive incoming tracks (audio & video)
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteStreams((prev) => ({ ...prev, [targetUserId]: stream }));
        } else if (event.track) {
          setRemoteStreams((prev) => {
            const current = prev[targetUserId] || new MediaStream();
            current.addTrack(event.track);
            return { ...prev, [targetUserId]: current };
          });
        }
      };

      // Relay ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && stompClientRef.current?.connected) {
          stompClientRef.current.publish({
            destination: `/app/room/${roomCode}/webrtc/candidate`,
            body: JSON.stringify({
              senderId: currentUserId,
              targetId: targetUserId,
              candidate: event.candidate,
            }),
          });
        }
      };

      peerConnectionsRef.current[targetUserId] = pc;
      return pc;
    },
    [roomCode, currentUserId]
  );

  // Drain any queued ICE candidates after remote description is set
  const drainIceCandidates = async (peerId, pc) => {
    const queue = pendingCandidatesRef.current[peerId] || [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.error("Error adding queued ICE candidate:", err);
      }
    }
    pendingCandidatesRef.current[peerId] = [];
  };

  // Call a peer: creates Offer and sends via STOMP
  const callPeer = async (targetUserId) => {
    try {
      const pc = getOrCreatePeerConnection(targetUserId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      if (stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/app/room/${roomCode}/webrtc/offer`,
          body: JSON.stringify({
            senderId: currentUserId,
            targetId: targetUserId,
            offer: offer,
          }),
        });
      }
    } catch (err) {
      console.error(`Failed to call peer ${targetUserId}:`, err);
    }
  };

  /**
   * Join the Meeting:
   * Initializes microphone by default (or watch-only if denied) without forcing camera ON!
   */
  const joinMeeting = async () => {
    try {
      let stream = null;
      try {
        // Try getting audio first
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      } catch (audioErr) {
        console.warn("Could not capture microphone, joining in watch-only mode:", audioErr);
        stream = new MediaStream();
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsInCall(true);
      setIsCameraOn(false);
      setIsMuted(false);

      broadcastMediaState(false, false);

      // Announce join to everyone in the room
      if (stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/app/room/${roomCode}/sync`,
          body: JSON.stringify({
            sender: currentUsername,
            userId: currentUserId,
            action: "MEETING_JOINED",
          }),
        });
      }
    } catch (err) {
      console.error("Failed to join meeting:", err);
    }
  };

  /**
   * Leave Meeting:
   * Stops tracks and cleans up peer connections.
   */
  const leaveMeeting = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setIsInCall(false);
    setIsCameraOn(false);
    setIsMuted(false);

    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    pendingCandidatesRef.current = {};
    setRemoteStreams({});

    if (stompClientRef.current?.connected) {
      stompClientRef.current.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify({
          sender: currentUsername,
          userId: currentUserId,
          action: "MEETING_LEFT",
        }),
      });
    }
  };

  /**
   * Independent Camera Toggle:
   * Turns camera ON or OFF independently without affecting microphone or other participants.
   */
  const toggleCamera = async () => {
    if (!isInCall) {
      await joinMeeting();
    }

    if (isCameraOn) {
      // Turn Camera OFF
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });

        // Replace track in peer connections with null
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(null).catch(() => {});
          }
        });
      }

      setIsCameraOn(false);
      broadcastMediaState(false, isMuted);
    } else {
      // Turn Camera ON
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
        });
        const newVideoTrack = videoStream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        // Add or replace video track in all active peer connections
        for (const [peerId, pc] of Object.entries(peerConnectionsRef.current)) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === "video" || (!s.track && s.kind === "video"));
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          } else {
            pc.addTrack(newVideoTrack, localStreamRef.current);
          }
          // Renegotiate with peer
          await callPeer(Number(peerId));
        }

        setIsCameraOn(true);
        broadcastMediaState(true, isMuted);
      } catch (err) {
        console.error("Failed to access camera:", err);
        alert("Camera permission denied or camera unavailable.");
      }
    }
  };

  /**
   * Independent Microphone Toggle:
   * Mutes/unmutes local microphone without affecting camera.
   */
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextMuted = !isMuted;
        audioTracks.forEach((t) => (t.enabled = !nextMuted));
        setIsMuted(nextMuted);
        broadcastMediaState(isCameraOn, nextMuted);
      }
    }
  };

  // -------------------------------------------------------------
  // Data Fetching & Sync
  // -------------------------------------------------------------
  const fetchMembersList = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/room/${roomCode}/members`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
      });
      const data = await response.json();
      const memberArray = Array.isArray(data) ? data : [];
      setMembers(memberArray);

      memberArray.forEach((m) => {
        let mId = typeof m === "object" ? m?.userId?.id || m?.userId || m?.id || m?.user?.id : m;
        if (typeof mId === "object" && mId !== null) mId = mId.id || mId.userId;
        let mName = m?.username || m?.name || m?.user?.username || m?.user?.name;

        if (mId && mName) {
          saveStoredRoomName(mId, mName);
        }
      });

      return memberArray;
    } catch (err) {
      console.error("Error fetching members:", err);
      return [];
    }
  };

  const fetchRoom = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/room/${roomCode}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
      });

      if (!response.ok) throw new Error("Failed to load room details.");
      const data = await response.json();
      setRoom(data);

      const freshMembers = await fetchMembersList();
      fetchMessages(data.id, freshMembers);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (roomId) => {
    if (!roomId) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/chat/${roomId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
      });
      const rawMessages = await response.json();
      const nameMap = getStoredRoomNames();

      const enrichedMessages = (Array.isArray(rawMessages) ? rawMessages : []).map((msg) => {
        let name = msg.username || msg.senderName || msg.sender;
        if (msg.userId && name) {
          saveStoredRoomName(msg.userId, name);
        }
        if (!name || name === "null" || name === "User" || name.startsWith("User #")) {
          name = nameMap[Number(msg.userId)];
        }
        if (Number(msg.userId) === Number(currentUserId)) {
          name = currentUsername;
        }

        return {
          ...msg,
          displayName: name || nameMap[Number(msg.userId)] || `User #${msg.userId}`,
        };
      });

      setMessages(enrichedMessages);
    } catch (err) {
      console.error("Error fetching chat:", err);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !room?.id) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/chat/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
        body: JSON.stringify({
          roomId: room.id,
          userId: currentUserId,
          username: currentUsername,
          message: message.trim(),
        }),
      });
      setMessage("");
      fetchMessages(room.id);
    } catch (err) {
      console.error("Message send failure:", err);
    }
  };

  const sendBotMessage = async () => {
    if (!botInput.trim() || isBotLoading) return;
    const userText = botInput.trim();
    setBotInput("");

    let currentSeconds = 0.0;
    if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
      currentSeconds = playerRef.current.getCurrentTime() || 0.0;
    } else {
      const html5Video = document.getElementById("room-video-player");
      if (html5Video && html5Video.currentTime) {
        currentSeconds = html5Video.currentTime;
      }
    }

    const userMsgObj = {
      id: Date.now(),
      sender: "You",
      text: userText,
      isBot: false,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setBotMessages((prev) => [...prev, userMsgObj]);
    setIsBotLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/v1/bot/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
        body: JSON.stringify({
          roomId: roomCode || "default-room",
          userMessage: userText,
          currentTimestamp: currentSeconds,
        }),
      });

      if (!response.ok) throw new Error("Bot service offline");
      const data = await response.json();

      const botMsgObj = {
        id: Date.now() + 1,
        sender: "BingeBot",
        text: data.answer || "I couldn't process your question right now.",
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setBotMessages((prev) => [...prev, botMsgObj]);
    } catch (err) {
      console.error("BingeBot Error:", err);
      setBotMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "BingeBot",
          text: "Oops! BingeBot ran into a temporary glitch. Try again!",
          isBot: true,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsBotLoading(false);
    }
  };

  const leaveRoom = async () => {
    leaveMeeting();
    if (!room?.id) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/room/leave`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
        body: JSON.stringify({
          roomId: room.id,
          userId: currentUserId,
        }),
      });
      navigate("/");
    } catch (err) {
      console.error("Failed to leave room cleanly:", err);
      navigate("/");
    }
  };

  const isYouTubeUrl = (url) => {
    if (!url) return false;
    return url.includes("youtube.com") || url.includes("youtu.be");
  };

  const getYouTubeId = (url) => {
    if (!url) return "";
    const regex = /(?:youtube\.com.*v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]+)/;
    const match = url.match(regex);
    return match ? match[1] : url;
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!roomCode) return;
    fetchRoom();
  }, [roomCode]);

  useEffect(() => {
    if (!room?.id) return;
    const interval = setInterval(() => {
      fetchMessages(room.id);
      fetchMembersList();
    }, 3000);
    return () => clearInterval(interval);
  }, [room?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollBotToBottom();
  }, [botMessages, isBotLoading, activeTab]);

  // -------------------------------------------------------------
  // Simultaneous Video Player Synchronization
  // -------------------------------------------------------------
  const handleLocalPlay = () => {
    if (ignoreNextSyncRef.current) return;
    stompClientRef.current?.publish({
      destination: `/app/room/${roomCode}/sync`,
      body: JSON.stringify({
        sender: currentUsername,
        userId: currentUserId,
        action: "PLAY",
      }),
    });
  };

  const handleLocalPause = () => {
    if (ignoreNextSyncRef.current) return;
    stompClientRef.current?.publish({
      destination: `/app/room/${roomCode}/sync`,
      body: JSON.stringify({
        sender: currentUsername,
        userId: currentUserId,
        action: "PAUSE",
      }),
    });
  };

  const handleLocalSeek = (seconds) => {
    const client = stompClientRef.current;
    if (client && client.connected) {
      client.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify({
          sender: currentUsername,
          userId: currentUserId,
          action: "SEEK_REQUEST",
          targetTime: seconds,
        }),
      });
    }
  };

  const handleApplySync = (targetTime) => {
    const activeSource = demoVideo || room?.movieLink;
    if (isYouTubeUrl(activeSource)) {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        isSeekingRef.current = true;
        ignoreNextSyncRef.current = true;
        playerRef.current.seekTo(targetTime, true);
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 1200);
      }
    } else {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        playerRef.current.seekTo(targetTime);
      } else {
        const html5Player = document.getElementById("room-video-player");
        if (html5Player) {
          html5Player.currentTime = targetTime;
        }
      }
    }
    setPendingSync(null);
  };

  // YouTube API Initialization
  useEffect(() => {
    if (!room?.movieLink || !isYouTubeUrl(room.movieLink)) return;

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      playerRef.current = new window.YT.Player("room-video-player", {
        events: {
          onStateChange: (event) => {
            if (ignoreNextSyncRef.current) {
              if (
                event.data === window.YT.PlayerState.PLAYING ||
                event.data === window.YT.PlayerState.PAUSED
              ) {
                ignoreNextSyncRef.current = false;
              }
              return;
            }

            if (event.data === window.YT.PlayerState.PLAYING) {
              handleLocalPlay();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              handleLocalPause();
            } else if (event.data === window.YT.PlayerState.BUFFERING && !isSeekingRef.current) {
              setTimeout(() => {
                if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
                  handleLocalSeek(playerRef.current.getCurrentTime());
                }
              }, 250);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [room?.movieLink]);

  // -------------------------------------------------------------
  // STOMP WebSocket & WebRTC Signals Listener
  // -------------------------------------------------------------
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_BASE_URL),
      connectHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
      reconnectDelay: 5000,
      onConnect: () => {
        // Announce presence in room
        client.publish({
          destination: `/app/room/${roomCode}/sync`,
          body: JSON.stringify({
            sender: currentUsername,
            userId: currentUserId,
            action: "ANNOUNCE",
          }),
        });

        // 1. Media Player Playback Sync & Meeting Presence Listener
        client.subscribe(`/topic/room/${roomCode}/stream`, (message) => {
          const payload = JSON.parse(message.body);
          const packetSender = payload.sender || payload.username || payload.nickname;
          const packetUserId = Number(payload.userId);

          if (packetUserId && packetSender) {
            saveStoredRoomName(packetUserId, packetSender);
          }

          if (packetUserId === currentUserId) return;

          // Simultaneous Media Playback Sync
          if (payload.action === "PLAY") {
            ignoreNextSyncRef.current = true;
            playerRef.current?.play?.();
          } else if (payload.action === "PAUSE") {
            ignoreNextSyncRef.current = true;
            playerRef.current?.pause?.();
          } else if (payload.action === "SEEK_REQUEST" && payload.targetTime !== undefined) {
            setPendingSync({
              sender: packetSender || "Someone",
              targetTime: Number(payload.targetTime),
            });
          }

          // Meeting Presence & Media State Handling
          if (payload.action === "MEETING_JOINED" || payload.action === "ANNOUNCE") {
            // If we are currently sharing media, send an offer to the new participant
            if (isInCall) {
              callPeer(packetUserId);
              // Inform new joiner of our current media state
              broadcastMediaState(isCameraOn, isMuted);
            }
          } else if (payload.action === "MEDIA_STATE_UPDATE") {
            setPeerMediaStates((prev) => ({
              ...prev,
              [packetUserId]: {
                isCameraOn: !!payload.isCameraOn,
                isMuted: !!payload.isMuted,
                name: packetSender,
              },
            }));
          } else if (payload.action === "MEETING_LEFT") {
            if (peerConnectionsRef.current[packetUserId]) {
              peerConnectionsRef.current[packetUserId].close();
              delete peerConnectionsRef.current[packetUserId];
            }
            delete pendingCandidatesRef.current[packetUserId];
            setRemoteStreams((prev) => {
              const updated = { ...prev };
              delete updated[packetUserId];
              return updated;
            });
            setPeerMediaStates((prev) => {
              const updated = { ...prev };
              delete updated[packetUserId];
              return updated;
            });
          }
        });

        // 2. WebRTC Offer Receiver (Even if our camera is off, we receive Person A's video!)
        client.subscribe(`/topic/room/${roomCode}/webrtc/offer`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== currentUserId) return;

          try {
            const pc = getOrCreatePeerConnection(data.senderId);
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            await drainIceCandidates(data.senderId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            client.publish({
              destination: `/app/room/${roomCode}/webrtc/answer`,
              body: JSON.stringify({
                senderId: currentUserId,
                targetId: data.senderId,
                answer: answer,
              }),
            });
          } catch (err) {
            console.error("Failed to handle WebRTC offer:", err);
          }
        });

        // 3. WebRTC Answer Receiver
        client.subscribe(`/topic/room/${roomCode}/webrtc/answer`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== currentUserId) return;

          const pc = peerConnectionsRef.current[data.senderId];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              await drainIceCandidates(data.senderId, pc);
            } catch (err) {
              console.error("Failed to set remote description on answer:", err);
            }
          }
        });

        // 4. WebRTC ICE Candidate Receiver with Queueing
        client.subscribe(`/topic/room/${roomCode}/webrtc/candidate`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== currentUserId) return;

          const pc = peerConnectionsRef.current[data.senderId];
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.error("Error adding direct ICE candidate:", e);
            }
          } else {
            // Queue candidate until setRemoteDescription completes
            if (!pendingCandidatesRef.current[data.senderId]) {
              pendingCandidatesRef.current[data.senderId] = [];
            }
            pendingCandidatesRef.current[data.senderId].push(data.candidate);
          }
        });
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      leaveMeeting();
      if (stompClientRef.current) stompClientRef.current.deactivate();
    };
  }, [roomCode, currentUserId, currentUsername, isInCall, isCameraOn, isMuted, getOrCreatePeerConnection, broadcastMediaState]);

  const resolveMemberName = (m, idx) => {
    if (!m) return idx === 0 ? currentUsername : `Member #${idx + 1}`;

    let mUserId = null;
    if (typeof m === "number" || typeof m === "string") {
      mUserId = m;
    } else if (m && typeof m === "object") {
      mUserId = m.userId?.id || m.userId || m.id || m.user?.id;
      if (typeof mUserId === "object" && mUserId !== null) {
        mUserId = mUserId.id || mUserId.userId;
      }
    }

    if (mUserId && Number(mUserId) === Number(currentUserId)) {
      return currentUsername;
    }

    const storedMap = getStoredRoomNames();
    if (mUserId && storedMap[Number(mUserId)]) {
      return storedMap[Number(mUserId)];
    }

    let rawName = null;
    if (typeof m === "string") {
      rawName = m;
    } else if (m && typeof m === "object") {
      rawName =
        m.username ||
        m.name ||
        m.nickname ||
        m.user?.username ||
        m.user?.name ||
        (m.email ? m.email.split("@")[0] : null);
    }

    if (
      rawName &&
      rawName !== "null" &&
      rawName !== "User" &&
      !rawName.startsWith("User #") &&
      !rawName.startsWith("Member #")
    ) {
      return rawName;
    }

    return mUserId ? `User #${mUserId}` : `Member #${idx + 1}`;
  };

  // Compile active participants for the Google Meet dock
  const allParticipantIds = Array.from(
    new Set([
      ...Object.keys(remoteStreams).map(Number),
      ...Object.keys(peerMediaStates).map(Number),
    ])
  ).filter((id) => id !== currentUserId);

  return (
    <div className="room-container">
      {/* CENTERED POPUP MODAL FOR SYNC */}
      {pendingSync && (
        <div className="sync-modal-backdrop">
          <div className="sync-modal-card">
            <button className="sync-close-x" onClick={() => setPendingSync(null)}>
              ✕
            </button>
            <div className="sync-icon">🎬</div>
            <h3>
              <strong>{pendingSync.sender}</strong> wants to skip to{" "}
              <strong>{formatTime(pendingSync.targetTime)}</strong>
            </h3>
            <p className="sync-subtext">Everyone will be synced in real-time</p>

            <div className="sync-btn-group">
              <button
                className="sync-accept-btn"
                onClick={() => handleApplySync(pendingSync.targetTime)}
              >
                Accept
              </button>
              <button className="sync-ignore-btn" onClick={() => setPendingSync(null)}>
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER NAV BAR */}
      <header className="room-navbar">
        <div className="nav-left-group">
          <span className="room-logo-icon">🎬</span>
          <h1 className="room-main-title">{room?.roomName || "Watch Party"}</h1>
          <span className="room-badge">{room?.roomType || "Solo"}</span>

          <div className="room-code-chip">
            <span className="code-lbl">
              Room Code: <strong>{roomCode}</strong>
            </span>
            <button className="copy-code-btn" onClick={handleCopyCode}>
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>
        </div>

        <div className="nav-right-group">
          <div className="avatar-stack">
            {members.length > 0 ? (
              members.slice(0, 3).map((m, idx) => {
                const displayName = resolveMemberName(m, idx);
                return (
                  <div key={idx} className="stack-avatar" title={displayName}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                );
              })
            ) : (
              <div className="stack-avatar" title={currentUsername}>
                {currentUsername.charAt(0).toUpperCase()}
              </div>
            )}

            {members.length > 3 && (
              <div className="stack-avatar extra">+{members.length - 3}</div>
            )}
          </div>

          <button className="leave-room-header-btn" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </header>

      {/* MAIN WATCH PARTY LAYOUT */}
      <div className="room-content-layout">
        <div className="left-stage-column">
          {/* 1. MEDIA VIDEO PLAYER (Plays concurrently with video call!) */}
          <div className="video-player-frame">
            {demoVideo || room?.movieLink ? (
              isYouTubeUrl(demoVideo || room?.movieLink) ? (
                <iframe
                  id="room-video-player"
                  width="100%"
                  height="460"
                  src={`https://www.youtube.com/embed/${getYouTubeId(
                    demoVideo || room.movieLink
                  )}?enablejsapi=1&origin=${window.location.origin}`}
                  title="YouTube Video"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <CustomVideoPlayer
                  ref={playerRef}
                  src={demoVideo || room.movieLink}
                  title={room?.roomName || "Watch Party Stream"}
                  onPlay={handleLocalPlay}
                  onPause={handleLocalPause}
                  onSeeked={(time) => handleLocalSeek(time)}
                />
              )
            ) : (
              <div className="no-video-placeholder">
                <span>🍿</span>
                <p>No video source attached to this room.</p>
                <div
                  style={{
                    marginTop: "16px",
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <button
                    className="modal-btn secondary"
                    style={{ fontSize: "12px", padding: "8px 14px", cursor: "pointer" }}
                    onClick={() =>
                      setDemoVideo(
                        "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"
                      )
                    }
                  >
                    🎬 Load Multi-Audio/Subtitles Demo
                  </button>
                  <button
                    className="modal-btn secondary"
                    style={{ fontSize: "12px", padding: "8px 14px", cursor: "pointer" }}
                    onClick={() =>
                      setDemoVideo("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")
                    }
                  >
                    🍿 Load Big Buck Bunny HLS
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. GOOGLE MEET-STYLE INDEPENDENT VIDEO & AUDIO DOCK */}
          <div className="google-meet-stage">
            <div className="meet-stage-header">
              <div className="meet-header-title">
                <span className="live-pulsing-dot"></span>
                <h3>Live Call & Video Meeting</h3>
                <span className="meet-mode-tag">Google Meet Mode</span>
              </div>

              {/* Controls: Independent Mic, Camera, & Leave Call */}
              <div className="meet-controls-bar">
                {!isInCall ? (
                  <div className="join-options-group">
                    <button className="meet-btn primary-join" onClick={joinMeeting}>
                      🎙️ Join Audio Only
                    </button>
                    <button className="meet-btn camera-join" onClick={toggleCamera}>
                      🎥 Join With Camera
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`meet-btn ${isMuted ? "btn-danger" : "btn-neutral"}`}
                      onClick={toggleMute}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {isMuted ? "🔇 Unmute Mic" : "🎙️ Mute Mic"}
                    </button>

                    <button
                      className={`meet-btn ${isCameraOn ? "btn-active" : "btn-neutral"}`}
                      onClick={toggleCamera}
                      title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                    >
                      {isCameraOn ? "📷 Camera On" : "🎥 Camera Off"}
                    </button>

                    <button
                      className="meet-btn btn-leave"
                      onClick={leaveMeeting}
                      title="Leave Video Call"
                    >
                      📞 Leave Call
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Google Meet Participant Video / Avatar Grid */}
            <div className="meet-tiles-grid">
              {/* Local Participant Tile (Always shown when in call) */}
              {isInCall && (
                <ParticipantVideoTile
                  stream={localStream}
                  name={currentUsername}
                  isLocal={true}
                  isCameraOn={isCameraOn}
                  isMuted={isMuted}
                  avatarInitial={currentUsername.charAt(0).toUpperCase()}
                />
              )}

              {/* Remote Participants Tiles */}
              {allParticipantIds.map((peerId) => {
                const stream = remoteStreams[peerId];
                const state = peerMediaStates[peerId] || {};
                const name =
                  state.name || getStoredRoomNames()[peerId] || `User #${peerId}`;
                const hasVideoTrack =
                  stream &&
                  stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
                const remoteCameraActive = state.isCameraOn ?? hasVideoTrack;

                return (
                  <ParticipantVideoTile
                    key={peerId}
                    stream={stream}
                    name={name}
                    isLocal={false}
                    isCameraOn={remoteCameraActive}
                    isMuted={!!state.isMuted}
                    avatarInitial={name.charAt(0).toUpperCase()}
                  />
                );
              })}

              {!isInCall && allParticipantIds.length === 0 && (
                <div className="empty-meet-placeholder">
                  <span className="meet-icon-large">📹</span>
                  <p>No active cameras or callers. Click <strong>Join With Camera</strong> or <strong>Join Audio Only</strong> to start!</p>
                </div>
              )}
            </div>
          </div>

          {demoVideo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(147, 51, 234, 0.15)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "12px",
                color: "#e2e8f0",
                marginTop: "10px",
              }}
            >
              <span>
                ✨ <b>Demo Stream Active:</b> Tears of Steel HLS
              </span>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#f472b6",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                onClick={() => setDemoVideo(null)}
              >
                ✕ Reset
              </button>
            </div>
          )}

          {/* MEMBERS PANEL */}
          <div className="members-panel">
            <h3 className="members-title">Members ({members.length || 1})</h3>
            <div className="members-chips-grid">
              {members.length > 0 ? (
                members.map((member, i) => {
                  const displayName = resolveMemberName(member, i);
                  const isHost = i === 0;

                  return (
                    <div key={i} className="member-card-chip">
                      <div className="member-avatar">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="member-name-text">
                        {displayName} {isHost && <span className="host-tag">(Host)</span>}
                      </span>
                      <span className="online-indicator-dot"></span>
                    </div>
                  );
                })
              ) : (
                <div className="member-card-chip">
                  <div className="member-avatar">
                    {currentUsername.charAt(0).toUpperCase()}
                  </div>
                  <span className="member-name-text">
                    {currentUsername} <span className="host-tag">(Host)</span>
                  </span>
                  <span className="online-indicator-dot"></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CHAT SECTION WITH TABS */}
        <div className="right-chat-column">
          <div className="chat-panel-header-tabs">
            <button
              className={`chat-tab-btn ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              💬 Room Chat
            </button>
            <button
              className={`chat-tab-btn ${activeTab === "bot" ? "active" : ""}`}
              onClick={() => setActiveTab("bot")}
            >
              🤖 BingeBot <span className="tab-badge">AI</span>
            </button>
          </div>

          {/* TAB 1: GROUP CHAT */}
          {activeTab === "chat" && (
            <>
              <div className="chat-messages-scroll">
                {Array.isArray(messages) && messages.length > 0 ? (
                  messages.map((msg, index) => {
                    const isMyMessage = Number(msg.userId) === currentUserId;
                    const senderName = isMyMessage
                      ? "You"
                      : msg.displayName || currentUsername;

                    return (
                      <div
                        key={msg.id || index}
                        className={`message-row ${
                          isMyMessage ? "own-row" : "other-row"
                        }`}
                      >
                        {!isMyMessage && (
                          <div className="msg-avatar">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="msg-content-wrapper">
                          <div className="msg-header-info">
                            <span className="msg-author">{senderName}</span>
                          </div>

                          <div
                            className={`msg-bubble ${
                              isMyMessage ? "own-bubble" : "other-bubble"
                            }`}
                          >
                            <p>{msg.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-chat-msg">
                    <span>💬</span>
                    <p>No messages yet. Say hello to the room!</p>
                  </div>
                )}
                <div ref={messagesEndRef}></div>
              </div>

              <div className="chat-input-bar">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button className="chat-send-btn" onClick={sendMessage}>
                  Send
                </button>
              </div>
            </>
          )}

          {/* TAB 2: PRIVATE BINGEBOT AI */}
          {activeTab === "bot" && (
            <>
              <div className="chat-messages-scroll">
                {botMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-row ${
                      msg.isBot ? "other-row" : "own-row"
                    }`}
                  >
                    {msg.isBot && <div className="msg-avatar bot-avatar-icon">🤖</div>}

                    <div className="msg-content-wrapper">
                      <div className="msg-header-info">
                        <span className="msg-author">{msg.sender}</span>
                        <span className="msg-time">{msg.timestamp}</span>
                      </div>

                      <div
                        className={`msg-bubble ${
                          msg.isBot ? "other-bubble bot-bubble" : "own-bubble"
                        } ${msg.isError ? "error-bubble" : ""}`}
                      >
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {isBotLoading && (
                  <div className="message-row other-row">
                    <div className="msg-avatar bot-avatar-icon">🤖</div>
                    <div className="msg-content-wrapper">
                      <div className="msg-header-info">
                        <span className="msg-author">BingeBot</span>
                      </div>
                      <div className="msg-bubble other-bubble bot-bubble loading-dots">
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={botMessagesEndRef}></div>
              </div>

              <div className="chat-input-bar">
                <input
                  type="text"
                  placeholder="Ask BingeBot anything..."
                  value={botInput}
                  onChange={(e) => setBotInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendBotMessage()}
                  disabled={isBotLoading}
                />
                <button
                  className="chat-send-btn bot-send-btn"
                  onClick={sendBotMessage}
                  disabled={!botInput.trim() || isBotLoading}
                >
                  Ask
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoomPage;
