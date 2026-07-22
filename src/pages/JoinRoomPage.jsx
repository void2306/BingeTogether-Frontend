import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./JoinRoomPage.css";

function JoinRoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("User");
  const [showDropdown, setShowDropdown] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) setUsername(savedUsername);
  }, []);

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
      userId: Number(userId),
    };

    console.log("[DEBUG] Sending Clean Join Payload:", payload);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE_URL}/room/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status code ${response.status}`);
      }

      const data = await response.json();
      console.log("[DEBUG] Server Handshake Data:", data);

      if (data.success || data.roomCode) {
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

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="join-room-wrapper">
      <div className="ambient-background"></div>

      <div className="join-room-container">
        {/* Top Navbar */}
        <header className="join-navbar">
          <div className="navbar-left">
            <button className="back-home-btn" onClick={() => navigate("/")}>
              ← Home
            </button>

            <div className="navbar-brand">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M7 4L26 16L7 28V4Z" fill="url(#paint0_linear_join)" />
                <circle cx="21" cy="7" r="2.5" fill="#A855F7" />
                <circle cx="25" cy="11" r="2" fill="#06B6D4" />
                <circle cx="17" cy="5" r="1.5" fill="#EC4899" />
                <defs>
                  <linearGradient
                    id="paint0_linear_join"
                    x1="7"
                    y1="4"
                    x2="26"
                    y2="28"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#9333EA" />
                    <stop offset="1" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="brand-title">BingeTogether</span>
            </div>
          </div>

          <div className="user-profile-menu">
            <button
              className="profile-chip-glass"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="avatar-circle">
                {username.charAt(0).toUpperCase()}
              </div>
              <span className="profile-name">{username}</span>
              <span className="dropdown-arrow">⌄</span>
            </button>

            {showDropdown && (
              <div className="profile-dropdown-menu">
                <button
                  onClick={handleLogout}
                  className="dropdown-logout-item"
                >
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Form Card Center Block */}
        <div className="join-card-wrapper">
          <div className="page-title-block">
            <h1>Join a Room</h1>
            <p className="subtitle">Enter the room code shared by your friend.</p>
          </div>

          <div className="join-room-card">
            <form onSubmit={handleJoinRoom} className="join-form">
              <div className="input-group">
                <label>Room Code</label>
                <input
                  type="text"
                  placeholder="e.g. CHILL1234"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="submit-join-btn"
                disabled={loading}
              >
                {loading ? "Connecting to space..." : "Join Room"}
              </button>
            </form>

            {/* Help Information Box matching Mockup */}
            <div className="info-help-box">
              <div className="info-icon-circle">?</div>
              <div className="info-text">
                <h4>How to find room code?</h4>
                <p>
                  Ask the host for the room code and enter it above to jump into the watch party.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinRoomPage;