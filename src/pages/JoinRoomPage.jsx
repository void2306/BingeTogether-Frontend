import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function JoinRoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoinRoom = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    const userId = localStorage.getItem("userId");
    
    if (!userId || userId === "undefined" || userId === "null") {
      alert("Please log in first.");
      navigate("/login");
      return;
    }

    if (!roomCode.trim()) {
      alert("Please enter a valid Room Code.");
      return;
    }

    setLoading(true);

    const payload = {
      roomCode: roomCode.trim(),
      userId: Number(userId)
    };

    console.log("[DEBUG] Sending Clean Join Payload:", payload);

    try {
      const token = localStorage.getItem("token");

      // 🚀 Hits the dynamic server endpoint perfectly now with singular /room/join and bypass header
      const response = await fetch(`${API_BASE_URL}/room/join`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420" // 🔑 Bypasses the ngrok interstitial wall
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status code ${response.status}`);
      }

      const data = await response.json();
      console.log("[DEBUG] Server Handshake Data:", data);

      if (data.success || data.roomCode) {
        alert("Successfully joined watch party! 🎉");
        const targetRoomCode = data.roomCode || roomCode.trim();
        navigate(`/room/${targetRoomCode}`); 
      } else {
        alert(`Failed to join room: ${data.message || "Unknown error"} ❌`);
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