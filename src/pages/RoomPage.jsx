import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./RoomPage.css";
function RoomPage() {

  const { roomCode } = useParams();
const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const fetchRoom = async () => {

    const response = await fetch(
      `http://localhost:8080/room/${roomCode}`
    );

    const data = await response.json();

    console.log(data);

    setRoom(data);

     fetchMessages(data.id);
  };
  const getRoomVibeMessage = (roomType) => {
  if (!roomType) return "Enjoy your watch session 🎬";

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
  const fetchMembers = async () => {

  const response = await fetch(
    `http://localhost:8080/room/${roomCode}/members`
  );
                                                             
 const data = await response.json();

setMembers(data);
};
const getYouTubeId = (url) => {
  if (!url) return null;

  const regex =
    /(?:youtube\.com.*v=|youtu\.be\/)([^&]+)/;

  const match = url.match(regex);

  return match ? match[1] : null;
};
const fetchMessages = async (roomId) => {

  const response = await fetch(
    `http://localhost:8080/chat/${roomId}`
  );

  const data = await response.json();

//console.log("Fetched Messages:", data);
  setMessages(data);
};
const sendMessage = async () => {

  const response = await fetch(
    "http://localhost:8080/chat/send",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: room.id,
        userId: 1,
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
        userId: 1,
      }),
    }
  );

  const data = await response.text();

  console.log(data);

  navigate("/");
};


useEffect(() => {
  fetchRoom();
  fetchMembers();
}, []);

useEffect(() => {

  if (!room) return;

  const interval = setInterval(() => {
    fetchMessages(room.id);
  }, 3000);

  return () => clearInterval(interval);

}, [room]);
return (
  <div className="room-container">

    <div className="room-header">

      {room && (
        <>
          <h1>{room.roomName}</h1>

          <p>Room Code: {room.roomCode}</p>

          <p>Room Type: {room.roomType}</p>

          <p>Members: {members.length}</p>
          <button onClick={leaveRoom}>
  Leave Room
</button>
        </>
      )}

    </div>

    <div className="content-container">

      <div className="video-section">


  {room && (
    <p>{getRoomVibeMessage(room.roomType)}</p>
  )}

  {room?.movieLink ? (
    <iframe
      width="100%"
      height="400"
      src={`https://www.youtube.com/embed/${getYouTubeId(room.movieLink)}`}
      title="YouTube video player"
      frameBorder="0"
      allowFullScreen
    />
  ) : (
    <p>No video available</p>
  )}

</div>

      {/* 💬 CHAT SECTION */}
      <div className="chat-section">

        <h2>Chat</h2>

<div className="messages-container">

  {messages.map((msg) => (
    <div
      key={msg.id}
      className={`message ${msg.userId === 1 ? "own" : "other"}`}
    >
      <p>{msg.message}</p>
    </div>
  ))}

</div>

<div className="input-container">

  <input
    type="text"
    placeholder="Type a message..."
    value={message}
    onChange={(e) => setMessage(e.target.value)}
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