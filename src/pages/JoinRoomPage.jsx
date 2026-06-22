import { useState } from "react";
import { useNavigate } from "react-router-dom";

function JoinRoomPage() {

  const [roomCode, setRoomCode] = useState("");

  const navigate = useNavigate();

  const joinRoom = async () => {

    try {

      const response = await fetch(
        "http://localhost:8080/room/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomCode: roomCode,
            userId: Number(localStorage.getItem("userId")),
          }),
        }
      );

      const data = await response.text();

      console.log(data);

      if (response.ok) {

        alert("Joined Room Successfully 🎉");

        navigate(`/room/${roomCode}`);

      } else {

        alert(data);

      }

    } catch (error) {

      console.error(error);

      alert("Failed to join room ❌");

    }
  };

  return (
    <div>

      <h1>Join Room</h1>

      <input
        type="text"
        placeholder="Enter Room Code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
      />

      <br />
      <br />

      <button onClick={joinRoom}>
        Join Room
      </button>

    </div>
  );
}

export default JoinRoomPage;