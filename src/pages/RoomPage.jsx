import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./RoomPage.css";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { API_BASE_URL, WS_BASE_URL } from "../config";

function RoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

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
  
  // Dynamic Map for User ID -> Username
  const [userCache, setUserCache] = useState({});

  const stompClientRef = useRef(null);
  const [pendingSync, setPendingSync] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateCache = (id, name) => {
    if (!id || !name || name === "User" || name.startsWith("User #") || name.startsWith("Member #")) return;
    setUserCache((prev) => ({ ...prev, [Number(id)]: name }));
  };

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
          updateCache(mId, mName);
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

      // Cache owner if available
      const ownerName = data.createdByUsername || data.ownerName || data.createdByName;
      const ownerId = data.createdBy || data.userId || data.ownerId;
      if (ownerId && ownerName) {
        updateCache(ownerId, ownerName);
      }

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

      const enrichedMessages = (Array.isArray(rawMessages) ? rawMessages : []).map((msg) => {
        let name = msg.username || msg.senderName || msg.sender;

        if (msg.userId && name) {
          updateCache(msg.userId, name);
        }

        if (!name || name === "null" || name === "User" || name.startsWith("User #")) {
          name = userCache[Number(msg.userId)];
        }

        if (Number(msg.userId) === Number(currentUserId)) {
          name = currentUsername;
        }

        return {
          ...msg,
          displayName: name || userCache[Number(msg.userId)] || `User #${msg.userId}`
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

  const leaveRoom = async () => {
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
                  console.log("[USER-SEEK] Manual timeline slider scrub captured:", currentTime);
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

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_BASE_URL),
      connectHeaders: {
        "ngrok-skip-browser-warning": "true"
      },
      reconnectDelay: 5000,
      onConnect: () => {
        // Broadcast presence & username to everyone
        client.publish({
          destination: `/app/room/${roomCode}/sync`,
          body: JSON.stringify({
            sender: currentUsername,
            userId: currentUserId,
            action: "USER_ANNOUNCE"
          })
        });

        client.subscribe(`/topic/room/${roomCode}/stream`, (message) => {
          const payload = JSON.parse(message.body);
          const packetSender = payload.sender || payload.username || payload.nickname;
          const packetUserId = payload.userId;

          if (packetUserId && packetSender) {
            updateCache(packetUserId, packetSender);
          }

          if (packetSender && packetSender.trim() === currentUsername.trim()) {
            return; 
          }

          if ((payload.targetTime !== undefined || payload.action === "SEEK_REQUEST")) {
            setPendingSync({
              sender: packetSender || "Someone",
              targetTime: Number(payload.targetTime)
            });
          }
        });
      }
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
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
    if (isYouTubeUrl(room?.movieLink)) {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        isSeekingRef.current = true;
        ignoreNextSyncRef.current = true;
        playerRef.current.seekTo(targetTime, true);
        setTimeout(() => { isSeekingRef.current = false; }, 1200);
      }
    } else {
      const html5Player = document.getElementById("room-video-player");
      if (html5Player) {
        html5Player.currentTime = targetTime;
      }
    }
    setPendingSync(null);
  };

  // 🎯 Fully Dynamic Member Resolver
  const resolveMemberName = (m, idx) => {
    if (!m) return idx === 0 ? "Host" : `Member #${idx + 1}`;

    let mUserId = null;
    if (typeof m === "number" || typeof m === "string") {
      mUserId = m;
    } else if (m && typeof m === "object") {
      mUserId = m.userId?.id || m.userId || m.id || m.user?.id;
      if (typeof mUserId === "object" && mUserId !== null) {
        mUserId = mUserId.id || mUserId.userId;
      }
    }

    // 1. Is this current logged-in user in this browser session?
    if (mUserId && Number(mUserId) === Number(currentUserId)) {
      return currentUsername;
    }

    // 2. Is this name cached via WebSocket / chat broadcasts?
    if (mUserId && userCache[Number(mUserId)]) {
      return userCache[Number(mUserId)];
    }

    // 3. Check direct raw property on member object
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

    // 4. Host fallback from room payload if index is 0
    if (idx === 0) {
      const hostName = room?.createdByUsername || room?.ownerName || room?.createdByName;
      if (hostName) return hostName;
    }

    // 5. Clean fallback
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
          <div className="video-player-frame">
            {room?.movieLink ? (
              isYouTubeUrl(room.movieLink) ? (
                <iframe
                  id="room-video-player"
                  width="100%"
                  height="460"
                  src={`https://www.youtube.com/embed/${getYouTubeId(room.movieLink)}?enablejsapi=1&origin=${window.location.origin}`}
                  title="YouTube Video"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <video
                  id="room-video-player"
                  controls
                  autoPlay
                  width="100%"
                  height="460"
                  style={{ objectFit: "contain", display: "block" }}
                  src={room.movieLink}
                  onSeeked={(e) => handleLocalSeek(e.target.currentTime)}
                >
                  Your browser does not support HTML5 video.
                </video>
              )
            ) : (
              <div className="no-video-placeholder">
                <span>🍿</span>
                <p>No video source attached to this room.</p>
              </div>
            )}
          </div>

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

        {/* CHAT SECTION */}
        <div className="right-chat-column">
          <div className="chat-panel-header">
            <span className="chat-icon">💬</span>
            <h2>Chat</h2>
          </div>

          <div className="chat-messages-scroll">
            {Array.isArray(messages) && messages.length > 0 ? (
              messages.map((msg, index) => {
                const isMyMessage = Number(msg.userId) === Number(currentUserId);
                const senderName = isMyMessage ? "You" : (msg.displayName || userCache[Number(msg.userId)] || currentUsername);

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
        </div>

      </div>
    </div>
  );
}

export default RoomPage;