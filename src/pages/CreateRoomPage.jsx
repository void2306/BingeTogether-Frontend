import { useState } from "react";
import { useNavigate } from "react-router-dom";
function CreateRoomPage() {
const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [movieLink, setMovieLink] = useState("");
  const [userId, setUserId] = useState("");

const createRoom = async () => {
  const requestBody = {
    roomName,
    roomType,
    movieLink,
    userId: Number(userId)
  };

  try {
    const response = await fetch("http://localhost:8080/room/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    console.log("Backend Response:", data);
navigate(`/room/${data.roomCode}`);
    alert("Room Created Successfully 🎉");

  } catch (error) {
    console.error("Error creating room:", error);
    alert("Failed to create room ❌");
  }
};
  return (
    <div>
      <h1>Create Room</h1>

      <input
        type="text"
        placeholder="Room Name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
      />

      <br /><br />

      <select
        value={roomType}
        onChange={(e) => setRoomType(e.target.value)}
      >
        <option value="">Select Room Type</option>
        <option value="solo">Solo</option>
        <option value="couple">Couple</option>
        <option value="group">Group</option>
      </select>

      <br /><br />

      <input
        type="text"
        placeholder="Movie Link"
        value={movieLink}
        onChange={(e) => setMovieLink(e.target.value)}
      />

      <br /><br />

      <input
        type="number"
        placeholder="User Id"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />

      <br /><br />

      <p>{roomName}</p>

      <button onClick={createRoom}>
        Create Room
      </button>

    </div>
  );
}

export default CreateRoomPage;