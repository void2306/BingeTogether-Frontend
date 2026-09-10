import { useEffect, useState, useRef } from "react";
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
  const [activeTab, setActiveTab] = useState("chat"); // "chat" or "bot"
  const [botMessages, setBotMessages] = useState([
    {
      id: 1,
      sender: "BingeBot",
      text: "Hey! I'm your private watch-party AI assistant. Ask me anything about this movie or scene!",
      isBot: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [botInput, setBotInput] = useState("");
  const [isBotLoading, setIsBotLoading] = useState(false);

  // 📹 WebRTC Audio & Video States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [senderId]: MediaStream }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMediaActive, setIsMediaActive] = useState(false);

  const peerConnectionsRef = useRef({}); // { [peerId]: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);

  // Read/Save room members persistent map
  const getStoredRoomNames = () => {
    try {
      const saved = localStorage.getItem(`room_names_${roomCode}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
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

  // -------------------------------------------------------------
  // 🎙️ WebRTC Engine Setup
  // -------------------------------------------------------------
  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMediaActive(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Notify others in room to start WebRTC handshake
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.publish({
          destination: `/app/room/${roomCode}/sync`,
          body: JSON.stringify({
            sender: currentUsername,
            userId: currentUserId,
            action: "WEBRTC_JOINED",
          }),
        });
      }
    } catch (err) {
      console.error("Failed to access camera/mic:", err);
      alert("Unable to access camera and microphone. Please check browser permissions.");
    }
  };

  const stopMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setIsMediaActive(false);

    // Close all open peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    setRemoteStreams({});
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // WebRTC Peer Connection Factory
  const createPeerConnection = (targetUserId) => {
    if (peerConnectionsRef.current[targetUserId]) {
      return peerConnectionsRef.current[targetUserId];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks to send to peer
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Capture incoming remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetUserId]: remoteStream,
        }));
      }
    };

    // Send candidate back through Spring Boot STOMP relay
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
  };

  // Initiate an offer to another peer
  const callPeer = async (targetUserId) => {
    const pc = createPeerConnection(targetUserId);
    const offer = await pc.createOffer();
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
  };

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const fetchMembersList = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/room/${roomCode}/members`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
        }
      });
      const data = await response.json();
      const memberArray = Array.isArray(data) ? data : [];
      setMembers(memberArray);

      memberArray.forEach((m) => {
        let mId = typeof m === "object" ? (m?.userId?.id || m?.userId || m?.id || m?.user?.id) : m;
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
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
        }
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

  const fetchMessages = async (roomId, activeMembers = members) => {
    if (!roomId) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/chat/${roomId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
        }
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
          displayName: name || nameMap[Number(msg.userId)] || `User #${msg.userId}`
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
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify({
          roomId: room.id,
          userId: currentUserId,
          username: currentUsername,
          message: message.trim(),
        }),
      });
      setMessage("");
      fetchMessages(room.id, members);
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setBotMessages((prev) => [...prev, userMsgObj]);
    setIsBotLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/v1/bot/chat`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsBotLoading(false);
    }
  };

  const leaveRoom = async () => {
    stopMedia();
    if (!room?.id) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE_URL}/room/leave`, {
        method: "DELETE",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
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
      fetchMessages(room.id, members);
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
              if (event.data === window.YT.PlayerState.PLAYING || event.data === window.YT.PlayerState.PAUSED) {
                ignoreNextSyncRef.current = false;
              }
              return;
            }

            if (event.data === window.YT.PlayerState.BUFFERING && !isSeekingRef.current) {
              setTimeout(() => {
                if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
                  const currentTime = playerRef.current.getCurrentTime();
                  handleLocalSeek(currentTime);
                }
              }, 250); 
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
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
        "ngrok-skip-browser-warning": "true"
      },
      reconnectDelay: 5000,
      onConnect: () => {
        client.publish({
          destination: `/app/room/${roomCode}/sync`,
          body: JSON.stringify({
            sender: currentUsername,
            userId: currentUserId,
            action: "ANNOUNCE"
          })
        });

        // 1. Video Playback & General Sync
        client.subscribe(`/topic/room/${roomCode}/stream`, (message) => {
          const payload = JSON.parse(message.body);
          const packetSender = payload.sender || payload.username || payload.nickname;
          const packetUserId = payload.userId;

          if (packetUserId && packetSender) {
            saveStoredRoomName(packetUserId, packetSender);
          }

          if (packetSender && packetSender.trim() === currentUsername.trim()) {
            return; 
          }

          // If someone turned on camera, initiate peer call
          if (payload.action === "WEBRTC_JOINED" && localStreamRef.current) {
            callPeer(packetUserId);
          }

          if ((payload.targetTime !== undefined || payload.action === "SEEK_REQUEST")) {
            setPendingSync({
              sender: packetSender || "Someone",
              targetTime: Number(payload.targetTime)
            });
          }
        });

        // 2. WebRTC Offer Receiver
        client.subscribe(`/topic/room/${roomCode}/webrtc/offer`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== Number(currentUserId)) return;

          const pc = createPeerConnection(data.senderId);
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
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
        });

        // 3. WebRTC Answer Receiver
        client.subscribe(`/topic/room/${roomCode}/webrtc/answer`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== Number(currentUserId)) return;

          const pc = peerConnectionsRef.current[data.senderId];
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        });

        // 4. WebRTC ICE Candidate Receiver
        client.subscribe(`/topic/room/${roomCode}/webrtc/candidate`, async (msg) => {
          const data = JSON.parse(msg.body);
          if (Number(data.targetId) !== Number(currentUserId)) return;

          const pc = peerConnectionsRef.current[data.senderId];
          if (pc && data.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.error("Error adding ICE candidate:", e);
            }
          }
        });
      }
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      stopMedia();
      if (stompClientRef.current) stompClientRef.current.deactivate();
    };
  }, [roomCode, currentUsername]);

  const handleLocalSeek = (seconds) => {
    const client = stompClientRef.current;
    if (client && client.connected) {
      const syncPayload = {
        sender: currentUsername, 
        userId: currentUserId,
        action: "SEEK_REQUEST",
        targetTime: seconds, 
      };

      client.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify(syncPayload),
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
        setTimeout(() => { isSeekingRef.current = false; }, 1200);
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

    if (rawName && rawName !== "null" && rawName !== "User" && !rawName.startsWith("User #") && !rawName.startsWith("Member #")) {
      return rawName;
    }

    if (idx === 0) {
      return room?.createdByUsername || room?.ownerName || "Sakshi Kumari";
    }

    if (idx === 1) {
      return "Akshat";
    }

    return mUserId ? `User #${mUserId}` : `Member #${idx + 1}`;
  };

  return (
    <div className="room-container">
      {/* CENTERED POPUP MODAL FOR SYNC */}
      {pendingSync && (
        <div className="sync-modal-backdrop">
          <div className="sync-modal-card">
            <button className="sync-close-x" onClick={() => setPendingSync(null)}>✕</button>
            <div className="sync-icon">🎬</div>
            <h3><strong>{pendingSync.sender}</strong> wants to skip to <strong>{formatTime(pendingSync.targetTime)}</strong></h3>
            <p className="sync-subtext">Everyone will be synced in real-time</p>

            <div className="sync-btn-group">
              <button className="sync-accept-btn" onClick={() => handleApplySync(pendingSync.targetTime)}>
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
            <span className="code-lbl">Room Code: <strong>{roomCode}</strong></span>
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

      {/* MAIN LAYOUT */}
      <div className="room-content-layout">
        <div className="left-stage-column">
          {/* VIDEO PLAYER FRAME */}
          <div className="video-player-frame">
            {(demoVideo || room?.movieLink) ? (
              isYouTubeUrl(demoVideo || room?.movieLink) ? (
                <iframe
                  id="room-video-player"
                  width="100%"
                  height="460"
                  src={`https://www.youtube.com/embed/${getYouTubeId(demoVideo || room.movieLink)}?enablejsapi=1&origin=${window.location.origin}`}
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
                  onSeeked={(time) => handleLocalSeek(time)}
                />
              )
            ) : (
              <div className="no-video-placeholder">
                <span>🍿</span>
                <p>No video source attached to this room.</p>
                <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    className="modal-btn secondary"
                    style={{ fontSize: "12px", padding: "8px 14px", cursor: "pointer" }}
                    onClick={() => setDemoVideo("https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8")}
                  >
                    🎬 Load Multi-Audio/Subtitles Demo
                  </button>
                  <button
                    className="modal-btn secondary"
                    style={{ fontSize: "12px", padding: "8px 14px", cursor: "pointer" }}
                    onClick={() => setDemoVideo("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")}
                  >
                    🍿 Load Big Buck Bunny HLS
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 📹 WEBRTC SOCIAL CONTROLS & WEBCAM GRID */}
          <div className="webrtc-stage-bar">
            {!isMediaActive ? (
              <button className="join-media-btn" onClick={startMedia}>
                📹 Join Voice & Video
              </button>
            ) : (
              <div className="active-media-controls">
                <button className={`media-toggle-btn ${isMuted ? "muted" : ""}`} onClick={toggleMute}>
                  {isMuted ? "🔇 Unmute Mic" : "🎙️ Mute Mic"}
                </button>
                <button className={`media-toggle-btn ${isVideoOff ? "video-off" : ""}`} onClick={toggleVideo}>
                  {isVideoOff ? "📷 Turn Camera On" : "🎥 Turn Camera Off"}
                </button>
                <button className="leave-media-btn" onClick={stopMedia}>
                  Disconnect Media
                </button>
              </div>
            )}
          </div>

          {/* FLOATING WEBCAM STREAM DOCK */}
          {isMediaActive && (
            <div className="webrtc-floating-dock">
              {/* Local User Self-Preview */}
              <div className="webcam-tile local-tile">
                <video
                  ref={(video) => {
                    if (video && localStream) video.srcObject = localStream;
                  }}
                  autoPlay
                  playsInline
                  muted
                />
                <span className="webcam-label">{currentUsername} (You)</span>
              </div>

              {/* Remote Peers Video Streams */}
              {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <div key={peerId} className="webcam-tile">
                  <video
                    ref={(video) => {
                      if (video && stream) video.srcObject = stream;
                    }}
                    autoPlay
                    playsInline
                  />
                  <span className="webcam-label">User #{peerId}</span>
                </div>
              ))}
            </div>
          )}

          {demoVideo && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(147, 51, 234, 0.15)",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "12px",
              color: "#e2e8f0",
              marginTop: "10px"
            }}>
              <span>✨ <b>Demo Multi-Audio Stream Active:</b> Tears of Steel HLS (Multiple audio tracks & subtitles)</span>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#f472b6",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
                onClick={() => setDemoVideo(null)}
              >
                ✕ Reset to Room Video
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
                  <div className="member-avatar">{currentUsername.charAt(0).toUpperCase()}</div>
                  <span className="member-name-text">{currentUsername} <span className="host-tag">(Host)</span></span>
                  <span className="online-indicator-dot"></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CHAT SECTION WITH TABS (Group Chat & Private BingeBot) */}
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
                    const isMyMessage = Number(msg.userId) === Number(currentUserId);
                    const senderName = isMyMessage ? "You" : (msg.displayName || currentUsername);

                    return (
                      <div
                        key={msg.id || index}
                        className={`message-row ${isMyMessage ? "own-row" : "other-row"}`}
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

                          <div className={`msg-bubble ${isMyMessage ? "own-bubble" : "other-bubble"}`}>
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
                    className={`message-row ${msg.isBot ? "other-row" : "own-row"}`}
                  >
                    {msg.isBot && (
                      <div className="msg-avatar bot-avatar-icon">
                        🤖
                      </div>
                    )}

                    <div className="msg-content-wrapper">
                      <div className="msg-header-info">
                        <span className="msg-author">{msg.sender}</span>
                        <span className="msg-time">{msg.timestamp}</span>
                      </div>

                      <div className={`msg-bubble ${msg.isBot ? "other-bubble bot-bubble" : "own-bubble"} ${msg.isError ? "error-bubble" : ""}`}>
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