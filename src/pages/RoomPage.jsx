import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./RoomPage.css";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
// 🔑 Config variables imported correctly
import { API_BASE_URL, WS_BASE_URL } from "../config";

function RoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  // API Player & Automated Jump Blockers
  const playerRef = useRef(null); 
  const isSeekingRef = useRef(false);
  const ignoreNextSyncRef = useRef(false);

  const currentUserId = Number(localStorage.getItem("userId")) || 999;
  const currentUsername = localStorage.getItem("username")?.trim() || "Room Member";

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const stompClientRef = useRef(null);

  // Dynamic Pop-up State
  const [pendingSync, setPendingSync] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      fetchMessages(data.id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMembers = async () => {
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
      console.log("[DEBUG] MEMBERS LIST:", data);
      setMembers(data);
    } catch (err) {
      console.error("Error fetching members:", err);
    }
  };

  const fetchMessages = async (roomId) => {
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
      const data = await response.json();
      console.log("[DEBUG] CHAT MESSAGES PAYLOAD:", data);
      setMessages(data);
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
          message: message.trim(),
        }),
      });
      setMessage("");
      fetchMessages(room.id);
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
    }
  };

  const getRoomVibeMessage = (roomType) => {
    if (!roomType) return "Enjoy your watch session 🎬";
    switch (roomType.toLowerCase()) {
      case "couple": return "Get cozy together ❤️ enjoy your movie time";
      case "group": return "Let’s gooo 🔥 enjoy with your squad";
      case "solo": return "Relax, unwind, and enjoy your time 🎧";
      default: return "Enjoy your watch session 🎬";
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

  // 🎯 Dynamic Name Resolver: Maps userId to members list or falls back gracefully
  const getSenderName = (msg) => {
    if (!msg) return "User";

    // 1. Check if direct string values are sent
    if (msg.sender && typeof msg.sender === "string") return msg.sender;
    if (msg.username && typeof msg.username === "string") return msg.username;
    if (msg.senderName && typeof msg.senderName === "string") return msg.senderName;

    // 2. Lookup in members array fetched from room
    if (msg.userId && Array.isArray(members) && members.length > 0) {
      const foundMember = members.find(
        (m) => Number(m.id || m.userId) === Number(msg.userId)
      );
      if (foundMember) {
        return foundMember.username || foundMember.name || foundMember.email?.split("@")[0];
      }
    }

    // 3. Fallback
    if (msg.userId) return `User #${msg.userId}`;
    return "Member";
  };

  useEffect(() => {
    if (!roomCode) return;
    fetchRoom();
    fetchMembers();
  }, [roomCode]);

  useEffect(() => {
    if (!room?.id) return;
    const interval = setInterval(() => {
      fetchMessages(room.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [room?.id]); 

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // YouTube API Player Initialization
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

  // WebSocket Subscription Management
  useEffect(() => {
    console.log("[DEBUG] Connecting via SockJS to:", WS_BASE_URL);

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_BASE_URL),
      connectHeaders: {
        "ngrok-skip-browser-warning": "true"
      },
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("Connected to BingeTogether WebSocket Broker via SockJS! 🎉");

        client.subscribe(`/topic/room/${roomCode}/stream`, (message) => {
          const payload = JSON.parse(message.body);
          console.log("[DEBUG] Received Sync Payload from WebSocket:", payload);

          const packetSender = payload.sender || payload.username || payload.nickname;

          if (packetSender && packetSender.trim() === currentUsername.trim()) {
            return; 
          }

          if ((payload.targetTime !== undefined || payload.action)) {
            console.log("[POPUP TRIGGERED] Showing synchronization modal for time:", payload.targetTime);
            setPendingSync({
              sender: packetSender || "Another Member",
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
        action: "SEEK_REQUEST",
        targetTime: seconds, 
      };
      
      console.log("[DEBUG] Pushing frame packet out:", syncPayload);

      client.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify(syncPayload),
      });
    } else {
      console.warn("[WARN] STOMP Client is not connected yet.");
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

  return (
    <div className="room-container">
      {pendingSync && (
        <div className="sync-popup-overlay" style={{
          position: "fixed", top: "25px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1c1c27", color: "#ffffff", padding: "16px 28px",
          borderRadius: "12px", boxShadow: "0px 10px 30px rgba(0,0,0,0.6)", zIndex: 9999,
          display: "flex", gap: "20px", alignItems: "center", border: "1px solid #32324d"
        }}>
          <span style={{ fontSize: "14px", letterSpacing: "0.3px" }}>
            🎬 <strong>{pendingSync.sender}</strong> wants to switch to <strong>{formatTime(pendingSync.targetTime)}</strong>. Do you?
          </span>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => handleApplySync(pendingSync.targetTime)} style={{ backgroundColor: "#2ed573", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              Yes
            </button>
            <button onClick={() => setPendingSync(null)} style={{ backgroundColor: "#ff4757", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              No
            </button>
          </div>
        </div>
      )}

      <div className="room-header">
        {room && (
          <>
            <div className="header-top">
              <div className="room-title">
                <h1>🎬 {room.roomName}</h1>
              </div>
              <button className="leave-btn" onClick={leaveRoom}>
                Leave Room
              </button>
            </div>

            <div className="room-details">
              <div className="detail-card">
                <span>Room Code</span>
                <h4>{room.roomCode}</h4>
              </div>
              <div className="detail-card">
                <span>Room Type</span>
                <h4>{room.roomType}</h4>
              </div>
              <div className="detail-card">
                <span>Members</span>
                <h4>{members.length}</h4>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="content-container">
        {/* 🚀 DYNAMIC VIDEO PLAYER ENGINE */}
        <div className="video-section">
          {room && <p>{getRoomVibeMessage(room.roomType)}</p>}
          {room?.movieLink ? (
            <div style={{ borderRadius: "12px", overflow: "hidden", backgroundColor: "#000" }}>
              {isYouTubeUrl(room.movieLink) ? (
                <iframe
                  id="room-video-player"
                  width="100%"
                  height="400"
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
                  height="400"
                  style={{ objectFit: "contain", display: "block" }}
                  src={room.movieLink}
                  onSeeked={(e) => {
                    handleLocalSeek(e.target.currentTime);
                  }}
                >
                  Your browser does not support HTML5 video playback format.
                </video>
              )}
            </div>
          ) : (
            <p>No video available</p>
          )}
        </div>

        <div className="chat-section">
          <h2>Chat</h2>
          <div className="messages-container">
            {Array.isArray(messages) &&
              messages.map((msg) => {
                const isMyMessage = Number(msg.userId) === Number(currentUserId);
                const senderDisplayName = isMyMessage ? "You" : getSenderName(msg);

                return (
                  <div
                    key={msg.id || Math.random()}
                    className={`message-wrapper ${isMyMessage ? "own-wrapper" : "other-wrapper"}`}
                  >
                    <span className="message-username">
                      {senderDisplayName}
                    </span>
                    <div className={`message-bubble ${isMyMessage ? "own-bubble" : "other-bubble"}`}>
                      <p>{msg.message}</p>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef}></div>
          </div>

          <div className="input-container">
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomPage;