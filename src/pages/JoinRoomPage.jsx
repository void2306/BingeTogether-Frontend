import { useState } from "react";
import { useNavigate } from "react-router-dom";

function JoinRoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoinRoom = async () => {
    const userId = localStorage.getItem("userId");
    
    // 1. Guard Clause: Check authentication state
    if (!userId || userId === "undefined" || userId === "null") {
      alert("Please log in first.");
      navigate("/login");
      return;
    }

    // 2. Guard Clause: Check input field state
    if (!roomCode.trim()) {
      alert("Please enter a valid Room Code.");
      return;
    }

    setLoading(true);

    // 3. FIX: Reference 'roomCode' state variable correctly
    const payload = {
      roomCode: roomCode.trim(),
      userId: Number(userId)
    };

    console.log("[DEBUG] Sending Clean Join Payload:", payload);

    try {
      const response = await fetch("http://localhost:8080/room/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("[DEBUG] Server Handshake Data:", data);

      if (data.success) {
        alert("Successfully joined watch party! 🎉");
        navigate(`/room/${data.roomCode}`); // Direct route navigation jump
      } else {
        alert(`Failed to join room: ${data.message} ❌`);
      }

    } catch (error) {
      console.error("Network interface error:", error);
      alert(`Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Join Room</h1>
      
      <input
        type="text"
        placeholder="Enter Room Code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        disabled={loading}
      />

      <br /><br />

      <button onClick={handleJoinRoom} disabled={loading}>
        {loading ? "Connecting to space..." : "Join Room"}
      </button>
    </div>
  );
}

export default JoinRoomPage;