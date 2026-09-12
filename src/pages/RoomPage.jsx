import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./RoomPage.css";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL, WS_BASE_URL } from "../config";
import CustomVideoPlayer from "../components/CustomVideoPlayer";
import { getMemberColor } from "../utils/avatarColors";

// Free Google STUN Servers
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * Participant Video Tile Subcomponent
 * Displays live video when camera is ON, or an animated Avatar placeholder when camera is OFF.
 * Video element is muted={true} so browsers ALWAYS allow instant autoplay without blocking!
 * Remote audio is played through a dedicated <audio> element.
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

  // Play video track
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream && isCameraOn) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play?.().catch((e) => {
        console.warn("[VideoTile] Video play warning:", e);
      });
    }
  }, [stream, isCameraOn]);

  // Play microphone audio for remote participant (works whether camera is ON or OFF)
  useEffect(() => {
    const audio = audioRef.current;
    if (!isLocal && audio && stream) {
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      audio.play?.().catch((e) => {
        console.warn("[VideoTile] Audio autoplay warning:", e);
      });
    }
  }, [stream, isLocal]);

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
          muted={true} // ALWAYS muted so browsers (Chrome/Safari/Edge) NEVER block autoplay!
          className={`participant-video ${isLocal ? "mirrored" : ""}`}
        />
      ) : (
        /* 2. Avatar Placeholder when Camera is OFF */
        <div className="avatar-placeholder-container">
          <div className="party-avatar-circle">
            {avatarInitial || (name ? name.charAt(0).toUpperCase() : "U")}
          </div>
          <span className="camera-off-indicator">Camera Off</span>
        </div>
      )}

      {/* Remote audio element: Always mounted for remote users so sound streams continuously */}
      {!isLocal && (
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
  const [memberPositions, setMemberPositions] = useState({});
  const clientSessionIdRef = useRef(
    `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  );

  // BingeBot State & Controls
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

  // Independent Media States
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // REFS TO PREVENT STOMP EFFECT TEARDOWN ON STATE CHANGES
  const isInCallRef = useRef(false);
  const isCameraOnRef = useRef(false);
  const isMutedRef = useRef(false);
  const membersRef = useRef([]);

  useEffect(() => { isInCallRef.current = isInCall; }, [isInCall]);
  useEffect(() => { isCameraOnRef.current = isCameraOn; }, [isCameraOn]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { membersRef.current = members; }, [members]);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }
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

  // Live tracking ref from CustomVideoPlayer for high-frequency sub-second accuracy
  const localPlaybackRef = useRef({ currentTime: 0, isPlaying: false });

  const handleProgressUpdate = useCallback((time, playing) => {
    localPlaybackRef.current.currentTime = time;
    localPlaybackRef.current.isPlaying = playing;
  }, []);

  // Helper to extract current playback time and playing state
  const getCurrentPlaybackState = useCallback(() => {
    let currSeconds = 0;
    let isPlaying = false;

    // 1. High-frequency live tracking ref
    if (localPlaybackRef.current && localPlaybackRef.current.currentTime > 0) {
      return {
        currSeconds: localPlaybackRef.current.currentTime,
        isPlaying: localPlaybackRef.current.isPlaying,
      };
    }

    // 2. Direct player ref handle
    if (playerRef.current) {
      if (typeof playerRef.current.getCurrentTime === "function") {
        currSeconds = playerRef.current.getCurrentTime() || 0;
      }
      if (typeof playerRef.current.isPlaying === "function") {
        isPlaying = playerRef.current.isPlaying();
      } else {
        const internal = playerRef.current.getInternalPlayer?.();
        isPlaying = internal ? !internal.paused : false;
      }
    }

    // 3. Fallback to DOM element
    if (!currSeconds) {
      const html5Video = document.getElementById("room-video-player");
      if (html5Video && html5Video.currentTime) {
        currSeconds = html5Video.currentTime || 0;
        if (!isPlaying) isPlaying = !html5Video.paused;
      }
    }
    return { currSeconds, isPlaying };
  }, []);

  // Broadcasts current position heartbeat over STOMP
  const broadcastHeartbeat = useCallback(
    (overrideSeconds = null, overridePlaying = null) => {
      if (!stompClientRef.current?.connected) return;
      const { currSeconds, isPlaying } = getCurrentPlaybackState();
      const timeToSend = typeof overrideSeconds === "number" ? overrideSeconds : currSeconds;
      const playToSend = typeof overridePlaying === "boolean" ? overridePlaying : isPlaying;

      stompClientRef.current.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify({
          sender: currentUsername,
          userId: currentUserId,
          sessionId: clientSessionIdRef.current,
          action: "POSITION_HEARTBEAT",
          currentTime: timeToSend,
          isPlaying: playToSend,
        }),
      });
    },
    [roomCode, currentUsername, currentUserId, getCurrentPlaybackState]
  );

  // Periodic heartbeat emission
  useEffect(() => {
    const interval = setInterval(() => {
      broadcastHeartbeat();
    }, 1000);

    return () => clearInterval(interval);
  }, [broadcastHeartbeat]);

  // Stale position pruning: prune users who haven't sent a heartbeat for > 8s
  useEffect(() => {
    const pruneInterval = setInterval(() => {
      const now = Date.now();
      setMemberPositions((prev) => {
        let hasStale = false;
        const next = {};
        for (const [id, pos] of Object.entries(prev)) {
          if (now - pos.lastUpdated <= 8000) {
            next[id] = pos;
          } else {
            hasStale = true;
          }
        }
        return hasStale ? next : prev;
      });
    }, 3000);

    return () => clearInterval(pruneInterval);
  }, []);

  // -------------------------------------------------------------
  // WebRTC Engine
  // -------------------------------------------------------------

  /**
   * Creates or retrieves an RTCPeerConnection for targetUserId.
   * Configures tracks or transceivers properly so sending/receiving works both ways.
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

      // Ensure transceivers exist to receive audio and video
      const transceivers = pc.getTransceivers();
      const hasAudio = transceivers.some((t) => t.receiver?.track?.kind === "audio" || t.sender?.track?.kind === "audio");
      const hasVideo = transceivers.some((t) => t.receiver?.track?.kind === "video" || t.sender?.track?.kind === "video");

      if (!hasAudio) {
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }
      if (!hasVideo) {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }

      // Capture incoming tracks
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track (${event.track.kind}) from user: ${targetUserId}`);
        const [stream] = event.streams;
        if (stream) {
          // Re-create MediaStream with all tracks to guarantee React state updates on new tracks
          setRemoteStreams((prev) => ({
            ...prev,
            [targetUserId]: new MediaStream(stream.getTracks()),
          }));
        } else if (event.track) {
          setRemoteStreams((prev) => {
            const current = prev[targetUserId] || new MediaStream();
            current.addTrack(event.track);
            return {
              ...prev,
              [targetUserId]: new MediaStream(current.getTracks()),
            };
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

  // Drain queued ICE candidates
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
    if (!targetUserId || targetUserId === currentUserId) return;
    try {
      console.log(`[WebRTC] Initiating call/offer to peer: ${targetUserId}`);
      const pc = getOrCreatePeerConnection(targetUserId);

      // Make sure transceivers are set to sendrecv if we have local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === track.kind || (!s.track && s.kind === track.kind));
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, localStreamRef.current);
          }
        });
      }

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

  // Call all other members in the room
  const callAllMembers = () => {
    const peerSet = new Set();

    // 1. From membersRef (REST API)
    membersRef.current.forEach((m) => {
      let mId = m?.userId?.id || m?.userId || m?.id || m?.user?.id;
      if (typeof mId === "object" && mId !== null) mId = mId.id || mId.userId;
      mId = Number(mId);
      if (mId && mId !== currentUserId) peerSet.add(mId);
    });

    // 2. From real-time heartbeats (memberPositions)
    Object.values(memberPositions).forEach((pos) => {
      const uId = Number(pos.userId);
      if (uId && uId !== currentUserId) peerSet.add(uId);
    });

    // 3. From known media states
    Object.keys(peerMediaStates).forEach((k) => {
      const uId = Number(k);
      if (uId && uId !== currentUserId) peerSet.add(uId);
    });

    peerSet.forEach((targetId) => {
      callPeer(targetId);
    });
  };

  /**
   * Join the Meeting:
   * Initializes microphone without forcing camera ON!
   */
  const joinMeeting = async () => {
    try {
      let stream = null;
      try {
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
      isInCallRef.current = true;
      setIsCameraOn(false);
      isCameraOnRef.current = false;
      setIsMuted(false);
      isMutedRef.current = false;

      broadcastMediaState(false, false);

      // Call everyone currently in room
      callAllMembers();

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
    isInCallRef.current = false;
    setIsCameraOn(false);
    isCameraOnRef.current = false;
    setIsMuted(false);
    isMutedRef.current = false;

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
   * Turns camera ON or OFF independently.
   */
  const toggleCamera = async () => {
    if (!isInCallRef.current) {
      setIsInCall(true);
      isInCallRef.current = true;
    }

    if (isCameraOnRef.current) {
      // Turn Camera OFF
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });

        // Inform senders
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(null).catch(() => {});
          }
        });
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      setIsCameraOn(false);
      isCameraOnRef.current = false;
      broadcastMediaState(false, isMutedRef.current);
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

        setIsCameraOn(true);
        isCameraOnRef.current = true;
        broadcastMediaState(true, isMutedRef.current);

        // Update all peers with new video track
        callAllMembers();
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
    if (!isInCallRef.current) {
      joinMeeting();
      return;
    }

    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextMuted = !isMutedRef.current;
        audioTracks.forEach((t) => (t.enabled = !nextMuted));
        setIsMuted(nextMuted);
        isMutedRef.current = nextMuted;
        broadcastMediaState(isCameraOnRef.current, nextMuted);
      } else {
        // If joined with no mic track, capture mic track now
        navigator.mediaDevices.getUserMedia({ audio: true }).then((micStream) => {
          const micTrack = micStream.getAudioTracks()[0];
          localStreamRef.current.addTrack(micTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          setIsMuted(false);
          isMutedRef.current = false;
          broadcastMediaState(isCameraOnRef.current, false);
          callAllMembers();
        }).catch((err) => {
          console.error("Failed to capture mic:", err);
        });
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
        sessionId: clientSessionIdRef.current,
        action: "PLAY",
      }),
    });
    broadcastHeartbeat(null, true);
  };

  const handleLocalPause = () => {
    if (ignoreNextSyncRef.current) return;
    stompClientRef.current?.publish({
      destination: `/app/room/${roomCode}/sync`,
      body: JSON.stringify({
        sender: currentUsername,
        userId: currentUserId,
        sessionId: clientSessionIdRef.current,
        action: "PAUSE",
      }),
    });
    broadcastHeartbeat(null, false);
  };

  const handleLocalSeek = (seconds) => {
    const client = stompClientRef.current;
    if (client && client.connected) {
      client.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify({
          sender: currentUsername,
          userId: currentUserId,
          sessionId: clientSessionIdRef.current,
          action: "SEEK_REQUEST",
          targetTime: seconds,
        }),
      });
      broadcastHeartbeat(seconds, null);
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
            sessionId: clientSessionIdRef.current,
            action: "ANNOUNCE",
          }),
        });
        setTimeout(() => broadcastHeartbeat(), 400);

        // 1. Media Player Playback Sync & Meeting Presence Listener
        client.subscribe(`/topic/room/${roomCode}/stream`, (message) => {
          const payload = JSON.parse(message.body);
          const packetSender = (payload.sender || payload.username || payload.nickname || "").trim();
          const packetUserId = Number(payload.userId);
          const packetSessionId = payload.sessionId;

          if (packetUserId && packetSender) {
            saveStoredRoomName(packetUserId, packetSender);
          }

          // 🛑 1. CRITICAL: Never add ourselves to remote memberPositions!
          if (
            packetSender &&
            currentUsername &&
            packetSender.toLowerCase() === currentUsername.trim().toLowerCase()
          ) {
            return;
          }

          // Ignore echoes from this exact tab/session or user id
          if (packetSessionId && packetSessionId === clientSessionIdRef.current) {
            return;
          }
          if (packetUserId && currentUserId && packetUserId === currentUserId) {
            return;
          }

          // 🔑 2. Unique memberKey: Key by sender username so Akshat and Vibhor NEVER collide or share a key!
          const memberKey = packetSender
            ? packetSender.toLowerCase()
            : (packetUserId ? String(packetUserId) : (packetSessionId || "remote_user"));

          const memberColor = getMemberColor(packetUserId || packetSender || memberKey);

          if (payload.action === "POSITION_HEARTBEAT") {
            const reportedTime = Number(payload.currentTime) || 0;
            setMemberPositions((prev) => ({
              ...prev,
              [memberKey]: {
                key: memberKey,
                userId: packetUserId,
                sessionId: packetSessionId,
                username: packetSender || `User #${packetUserId || ""}`,
                currentTime: reportedTime,
                isPlaying: !!payload.isPlaying,
                lastUpdated: Date.now(),
                color: memberColor,
              },
            }));
          } else if (payload.action === "PLAY") {
            ignoreNextSyncRef.current = true;
            playerRef.current?.play?.();
            setTimeout(() => { ignoreNextSyncRef.current = false; }, 600);
            setMemberPositions((prev) => {
              const existing = prev[memberKey] || {
                key: memberKey,
                userId: packetUserId,
                sessionId: packetSessionId,
                username: packetSender || `User #${packetUserId || ""}`,
                currentTime: payload.currentTime !== undefined ? Number(payload.currentTime) : 0,
                color: memberColor,
              };
              return {
                ...prev,
                [memberKey]: { ...existing, isPlaying: true, lastUpdated: Date.now() },
              };
            });
          } else if (payload.action === "PAUSE") {
            ignoreNextSyncRef.current = true;
            playerRef.current?.pause?.();
            setTimeout(() => { ignoreNextSyncRef.current = false; }, 600);
            setMemberPositions((prev) => {
              const existing = prev[memberKey] || {
                key: memberKey,
                userId: packetUserId,
                sessionId: packetSessionId,
                username: packetSender || `User #${packetUserId || ""}`,
                currentTime: payload.currentTime !== undefined ? Number(payload.currentTime) : 0,
                color: memberColor,
              };
              return {
                ...prev,
                [memberKey]: { ...existing, isPlaying: false, lastUpdated: Date.now() },
              };
            });
          } else if (payload.action === "SEEK_REQUEST" && payload.targetTime !== undefined) {
            const tgt = Number(payload.targetTime);
            setPendingSync({
              sender: packetSender || "Someone",
              targetTime: tgt,
            });
            setMemberPositions((prev) => {
              const existing = prev[memberKey] || {
                key: memberKey,
                userId: packetUserId,
                sessionId: packetSessionId,
                username: packetSender || `User #${packetUserId || ""}`,
                isPlaying: false,
                color: memberColor,
              };
              return {
                ...prev,
                [memberKey]: { ...existing, currentTime: tgt, lastUpdated: Date.now() },
              };
            });
          }

          // Meeting Presence & Media State Handling
          if (payload.action === "MEETING_JOINED" || payload.action === "ANNOUNCE") {
            broadcastHeartbeat();

            // If we are sharing camera or mic, call the new participant immediately
            if (isInCallRef.current || isCameraOnRef.current) {
              callPeer(packetUserId);
              broadcastMediaState(isCameraOnRef.current, isMutedRef.current);
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

            // If peer turned on camera or mic and no connection exists yet, connect!
            if (payload.isCameraOn && !peerConnectionsRef.current[packetUserId]) {
              callPeer(packetUserId);
            }
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
            setMemberPositions((prev) => {
              const updated = { ...prev };
              const cleanSender = packetSender?.toLowerCase();
              for (const k of Object.keys(updated)) {
                if (
                  (cleanSender && k === cleanSender) ||
                  (packetUserId && (k === String(packetUserId) || k.startsWith(`${packetUserId}_`)))
                ) {
                  delete updated[k];
                }
              }
              return updated;
            });
          }
        });

        // 2. WebRTC Offer Receiver (Person B receives Person A's camera & audio!)
        client.subscribe(`/topic/room/${roomCode}/webrtc/offer`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== currentUserId) return;

          try {
            console.log(`[WebRTC] Received offer from: ${data.senderId}`);
            const pc = getOrCreatePeerConnection(data.senderId);

            // Handle glare: if connection is not in stable state, rollback local description
            if (pc.signalingState !== "stable") {
              console.log("[WebRTC] Glare detected, rolling back to accept remote offer");
              try {
                await pc.setLocalDescription({ type: "rollback" });
              } catch (e) {
                console.warn("[WebRTC] Rollback warning:", e);
              }
            }

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
              console.log(`[WebRTC] Received answer from: ${data.senderId}`);
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
  }, [roomCode, currentUserId, currentUsername]);

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

  const allParticipantIds = Array.from(
    new Set([
      ...Object.keys(remoteStreams).map(Number),
      ...Object.keys(peerMediaStates).map(Number),
      ...Object.values(memberPositions).map((p) => Number(p.userId)),
      ...members.map((m) => {
        let mId = m?.userId?.id || m?.userId || m?.id || m?.user?.id;
        if (typeof mId === "object" && mId !== null) mId = mId.id || mId.userId;
        return Number(mId);
      }),
    ])
  ).filter((id) => id && id !== currentUserId);

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
          {/* 1. MEDIA VIDEO PLAYER */}
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
                  memberPositions={memberPositions}
                  currentUsername={currentUsername}
                  currentUserId={currentUserId}
                  onPlay={handleLocalPlay}
                  onPause={handleLocalPause}
                  onSeeked={(time) => handleLocalSeek(time)}
                  onProgressUpdate={handleProgressUpdate}
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

          {/* 2. PARTY CAM & VOICE CHAT DOCK */}
          <div className="party-cam-stage">
            <div className="party-cam-header">
              <div className="party-header-title">
                <span className="live-pulsing-dot"></span>
                <h3>Party Cam & Voice</h3>
                <span className="party-cam-tag">Live</span>
              </div>

              {/* Controls: Independent Mic, Camera, & Disconnect */}
              <div className="party-controls-bar">
                {!isInCall ? (
                  <div className="join-options-group">
                    <button className="party-btn primary-join" onClick={joinMeeting}>
                      🎙️ Join Voice
                    </button>
                    <button className="party-btn camera-join" onClick={toggleCamera}>
                      🎥 Turn Camera On
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`party-btn ${isMuted ? "btn-danger" : "btn-neutral"}`}
                      onClick={toggleMute}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {isMuted ? "🔇 Unmute Mic" : "🎙️ Mute Mic"}
                    </button>

                    <button
                      className={`party-btn ${isCameraOn ? "btn-active" : "btn-neutral"}`}
                      onClick={toggleCamera}
                      title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                    >
                      {isCameraOn ? "📷 Camera On" : "🎥 Camera Off"}
                    </button>

                    <button
                      className="party-btn btn-leave"
                      onClick={leaveMeeting}
                      title="Disconnect Call"
                    >
                      📞 Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Participant Video / Avatar Grid */}
            <div className="party-tiles-grid">
              {/* Local Participant Tile */}
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
                <div className="empty-party-placeholder">
                  <span className="party-icon-large">📹</span>
                  <p>Turn on your camera or mic to chat live with your watch party!</p>
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
