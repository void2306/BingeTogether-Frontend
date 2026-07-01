import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function CreateRoomPage() {
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [movieLink, setMovieLink] = useState("");
  const [loading, setLoading] = useState(false); // Senior Touch: Prevent multi-click spamming

  const createRoom = async () => {
    // STEP 1: Fast-Fail Guard Clause. Check authentication BEFORE building anything.
    const savedUserId = localStorage.getItem("userId");
    
    if (!savedUserId) {
      alert("Your session has expired or you are not logged in. Redirecting to login...");
      navigate("/login");
      return;
    }

    // STEP 2: Basic UI Form Validation
    if (!roomName.trim()) {
      alert("Please provide a valid Room Name.");
      return;
    }
    if (!roomType) {
      alert("Please select a Room Type (Solo, Couple, or Group).");
      return;
    }

    setLoading(true);

    // STEP 3: Safe Request Construction
    const requestBody = {
      roomName: roomName.trim(),
      roomType: roomType,
      movieLink: movieLink.trim() || "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Fallback video default
      userId: Number(savedUserId), // Guaranteed to be a valid non-zero ID now
    };

    console.log("[DEBUG] TRANSMITTING PAYLOAD:", requestBody);
       
    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[DEBUG] SERVER RESPONSE STATUS:", response.status);

      // Handle bad request status explicitly instead of blindly crashing at response.json()
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned error status ${response.status}: ${errorText}`);
      }

      const room = await response.json();
      console.log("[DEBUG] PARSED ROOM OBJECT:", room);

      if (!room || !room.roomCode) {
        alert("The server created a room, but failed to return a valid room tracking code.");
        return;
      }

      // Safe step to target space
      navigate(`/room/${room.roomCode}`);

    } catch (error) {
      console.error("### FULL SYSTEM ERROR TRACE ###", error);
      alert(`Room creation aborted: ${error.message}`);
    } finally {
      setLoading(false); // Clear the block state regardless of outcome
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Create Room</h1>

      <input
        type="text"
        placeholder="Room Name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        disabled={loading}
      />

      <br /><br />

      <select
        value={roomType}
        onChange={(e) => setRoomType(e.target.value)}
        disabled={loading}
      >
        <option value="">Select Room Type</option>
        <option value="solo">Solo</option>
        <option value="couple">Couple</option>
        <option value="group">Group</option>
      </select>

      <br /><br />

      <input
        type="text"
        placeholder="Movie Link (YouTube Link)"
        value={movieLink}
        onChange={(e) => setMovieLink(e.target.value)}
        disabled={loading}
      />

      <br /><br />

      <button onClick={createRoom} disabled={loading}>
        {loading ? "Generating Party Space..." : "Create Room"}
      </button>
    </div>
  );
}

export default CreateRoomPage;