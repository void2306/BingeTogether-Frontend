import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./RoomPage.css";

function RoomPage() {

  const { roomCode } = useParams();
  const navigate = useNavigate();

  const messagesEndRef = useRef(null);

  const currentUserId =
    Number(localStorage.getItem("userId"));

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  };

  const fetchRoom = async () => {

    const response = await fetch(
      `http://localhost:8080/room/${roomCode}`
    );

    const data = await response.json();

    setRoom(data);

    fetchMessages(data.id);
  };

  const fetchMembers = async () => {

    const response = await fetch(
      `http://localhost:8080/room/${roomCode}/members`
    );

    const data = await response.json();

    setMembers(data);
  };

  const fetchMessages = async (roomId) => {

    const response = await fetch(
      `http://localhost:8080/chat/${roomId}`
    );

    const data = await response.json();

    setMessages(data);
  };

  const sendMessage = async () => {

    if (!message.trim()) return;

    const response = await fetch(
      "http://localhost:8080/chat/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
          userId: Number(localStorage.getItem("userId")),
          message: message,
        }),
      }
    );

    const data = await response.text();

    console.log(data);

    setMessage("");

    fetchMessages(room.id);
  };

  const leaveRoom = async () => {

    const response = await fetch(
      "http://localhost:8080/room/leave",
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: room.id,
          userId: Number(localStorage.getItem("userId")),
        }),
      }
    );

    const data = await response.text();

    console.log(data);

    navigate("/");
  };

  const getRoomVibeMessage = (roomType) => {

    if (!roomType)
      return "Enjoy your watch session 🎬";

    switch (roomType.toLowerCase()) {

      case "couple":
        return "Get cozy together ❤️ enjoy your movie time";

      case "group":
        return "Let’s gooo 🔥 enjoy with your squad";

      case "solo":
        return "Relax, unwind, and enjoy your time 🎧";

      default:
        return "Enjoy your watch session 🎬";
    }
  };

  const getYouTubeId = (url) => {

    if (!url) return null;

    const regex =
      /(?:youtube\.com.*v=|youtu\.be\/)([^&]+)/;

    const match = url.match(regex);

    return match ? match[1] : null;
  };

  useEffect(() => {

    if (!roomCode) return;

    fetchRoom();
    fetchMembers();

  }, [roomCode]);

  useEffect(() => {

    if (!room) return;

    const interval = setInterval(() => {
      fetchMessages(room.id);
    }, 3000);

    return () => clearInterval(interval);

  }, [room]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="room-container">

      {/* HEADER */}

      <div className="room-header">

        {room && (
          <>
            <div className="header-top">

              <div className="room-title">
                <h1>🎬 {room.roomName}</h1>
              </div>

              <button
                className="leave-btn"
                onClick={leaveRoom}
              >
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

      {/* CONTENT */}

      <div className="content-container">

        {/* VIDEO */}

        <div className="video-section">

          {room && (
            <p>
              {getRoomVibeMessage(room.roomType)}
            </p>
          )}

          {room?.movieLink ? (
            <iframe
              width="100%"
              height="400"
              src={`https://www.youtube.com/embed/${getYouTubeId(
                room.movieLink
              )}`}
              title="YouTube Video"
              frameBorder="0"
              allowFullScreen
            />
          ) : (
            <p>No video available</p>
          )}

        </div>

        {/* CHAT */}

        <div className="chat-section">

          <h2>Chat</h2>

          <div className="messages-container">

            {Array.isArray(messages) &&
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${
                    msg.userId === currentUserId
                      ? "own"
                      : "other"
                  }`}
                >
                  <p>{msg.message}</p>
                </div>
              ))}

            <div ref={messagesEndRef}></div>

          </div>

          <div className="input-container">

            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
            />

            <button onClick={sendMessage}>
              Send
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

export default RoomPage;