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
      // 🎯 Using centralized API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/room/${roomCode}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
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
      // 🎯 Using centralized API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/room/${roomCode}/members`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      setMembers(data);
    } catch (err) {
      console.error("Error fetching members:", err);
    }
  };

  const fetchMessages = async (roomId) => {
    if (!roomId) return;
    try {
      const token = localStorage.getItem("token");
      // 🎯 Using centralized API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/chat/${roomId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error("Error fetching chat:", err);
    } 
  };

  const sendMessage = async () => {
    if (!message.trim() || !room?.id) return;

    try {
      const token = localStorage.getItem("token");
      // 🎯 Using centralized API_BASE_URL
      await fetch(`${API_BASE_URL}/chat/send`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
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
      // 🎯 Using centralized API_BASE_URL
      await fetch(`${API_BASE_URL}/room/leave`, {
        method: "DELETE",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
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

  useEffect(() => {
    if (!room?.movieLink) return;

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
    // 🎯 Using centralized WS_BASE_URL endpoint dynamically
    const socket = new SockJS(WS_BASE_URL);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("Connected to BingeTogether WebSocket Broker! 🎉");

        client.subscribe(`/topic/room/${roomCode}/stream`, (message) => {
          const payload = JSON.parse(message.body);
          console.log("[DEBUG] Received Sync Payload from WebSocket:", payload);

          if (payload.sender === currentUsername) {
            return; 
          }

          if (payload.action === "SEEK_REQUEST" && playerRef.current) {
            setPendingSync({
              sender: payload.sender,
              targetTime: payload.targetTime
            });
          }
        });
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (stompClientRef.current) stompClientRef.current.deactivate();
    };
  }, [roomCode, currentUsername]);

  const handleLocalSeek = (seconds) => {
    if (stompClientRef.current && stompClientRef.current.connected) {
      const syncPayload = {
        sender: currentUsername, 
        action: "SEEK_REQUEST",
        targetTime: seconds, 
      };
      
      console.log("[DEBUG] Sending Sync Payload to Backend:", syncPayload);

      stompClientRef.current.publish({
        destination: `/app/room/${roomCode}/sync`,
        body: JSON.stringify(syncPayload),
      });
    }
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
            <button onClick={() => {
              isSeekingRef.current = true;
              ignoreNextSyncRef.current = true;
              playerRef.current.seekTo(pendingSync.targetTime, true);
              setPendingSync(null);
              setTimeout(() => { isSeekingRef.current = false; }, 1200);
            }} style={{ backgroundColor: "#2ed573", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
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
        <div className="video-section">
          {room && <p>{getRoomVibeMessage(room.roomType)}</p>}
          {room?.movieLink ? (
            <div style={{ borderRadius: "12px", overflow: "hidden", backgroundColor: "#000" }}>
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
                const isMyMessage = 
                  msg.userId === currentUserId || 
                  msg.sender === currentUsername;

                return (
                  <div
                    key={msg.id || Math.random()}
                    className={`message-wrapper ${isMyMessage ? "own-wrapper" : "other-wrapper"}`}
                  >
                    <span className="message-username">
                      {isMyMessage ? "You" : (msg.sender || "Member")}
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