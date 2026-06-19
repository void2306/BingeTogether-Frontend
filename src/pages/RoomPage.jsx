import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./RoomPage.css";
function RoomPage() {

  const { roomCode } = useParams();

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

console.log("Fetched Messages:", data);
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

 useEffect(() => {
  fetchRoom();
  fetchMembers();
}, []);
return (
  <div className="room-container">

    <div className="room-header">

      {room && (
        <>
          <h1>{room.roomName}</h1>

          <p>Room Code: {room.roomCode}</p>

          <p>Room Type: {room.roomType}</p>

          <p>Members: {members.length}</p>
        </>
      )}

    </div>

    <div className="content-container">

      <div className="video-section">

        <h2>Video Area</h2>

        {room && (
          <p>{room.movieLink}</p>
        )}

      </div>

      <div className="chat-section">

        <h2>Chat</h2>

        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button onClick={sendMessage}>
          Send
        </button>

        <h3>Messages</h3>

       {messages.map((msg) => (
  <div
    key={msg.id}
    className={`message ${msg.userId === 1 ? "own" : "other"}`}
  >
    <p>{msg.message}</p>
  </div>
))}
      </div>

    </div>

  </div>
);
}

export default RoomPage;