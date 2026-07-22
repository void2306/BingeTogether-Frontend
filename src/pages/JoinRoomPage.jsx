import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./JoinRoomPage.css";

function JoinRoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("User");
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) setUsername(savedUsername);
  }, []);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomCode(text.trim());
        setErrorMessage("");
      }
    } catch (err) {
      console.error("Clipboard permission denied:", err);
    }
  };

  const handleJoinRoom = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const userId = localStorage.getItem("userId");
    const currentUsername = localStorage.getItem("username") || "User";

    if (!userId || userId === "undefined" || userId === "null") {
      setErrorMessage("Please log in first to join a room.");
      setTimeout(() => navigate("/login"), 1500);
      return;
    }

    if (!roomCode.trim()) {
      setErrorMessage("Please enter a valid room code.");
      return;
    }

    setLoading(true);

    const payload = {
      roomCode: roomCode.trim(),
      userId: Number(userId),
      username: currentUsername // 🔑 Passes username directly
    };

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
        throw new Error("Room not found. Please check the code and try again.");
      }

      const data = await response.json();

      if (data.success || data.roomCode) {
        setSuccessMessage("✅ Joined successfully! Redirecting...");
        const targetRoomCode = data.roomCode || roomCode.trim();
        
        setTimeout(() => {
          navigate(`/room/${targetRoomCode}`);
        }, 700);
      } else {
        setErrorMessage(`❌ ${data.message || "Room not found. Please check the room code and try again."}`);
      }
    } catch (error) {
      console.error("Network interface error:", error);
      setErrorMessage("❌ Room not found. Please check the room code and try again.");
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
        <header className="join-navbar">
          <div className="navbar-left">
            <button className="back-home-btn" onClick={() => navigate("/")}>
              ← Home
            </button>

            <div className="navbar-brand">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 4L26 16L7 28V4Z" fill="url(#paint0_linear_join)" />
                <circle cx="21" cy="7" r="2.5" fill="#A855F7" />
                <circle cx="25" cy="11" r="2" fill="#06B6D4" />
                <circle cx="17" cy="5" r="1.5" fill="#EC4899" />
                <defs>
                  <linearGradient id="paint0_linear_join" x1="7" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9333EA" />
                    <stop offset="1" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="brand-title">BingeTogether</span>
            </div>
          </div>

          <div className="user-profile-menu">
            <button className="profile-chip-glass" onClick={() => setShowDropdown(!showDropdown)}>
              <div className="avatar-circle">{username.charAt(0).toUpperCase()}</div>
              <span className="profile-name">{username}</span>
              <span className="dropdown-arrow">⌄</span>
            </button>

            {showDropdown && (
              <div className="profile-dropdown-menu">
                <button onClick={handleLogout} className="dropdown-logout-item">
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="join-card-wrapper">
          <div className="page-title-block">
            <h1>Join a Room</h1>
            <p className="subtitle">Enter the room code shared by your friend.</p>
          </div>

          <div className="join-room-card">
            <form onSubmit={handleJoinRoom} className="join-form">
              <div className="input-group">
                <label>🔑 Room Code</label>
                <div className="input-paste-wrapper">
                  <input
                    type="text"
                    placeholder="Enter room code"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value);
                      setErrorMessage("");
                    }}
                    disabled={loading}
                    required
                  />
                  <button type="button" className="paste-action-btn" onClick={handlePasteFromClipboard} disabled={loading}>
                    📋 Paste
                  </button>
                </div>
              </div>

              {errorMessage && <div className="card-alert-banner error-alert">{errorMessage}</div>}
              {successMessage && <div className="card-alert-banner success-alert">{successMessage}</div>}

              <button type="submit" className="submit-join-btn" disabled={loading}>
                {loading ? (
                  <span className="joining-loader">
                    <span className="spinner-dot"></span> Joining...
                  </span>
                ) : (
                  "Join Room"
                )}
              </button>
            </form>

            <div className="info-help-box">
              <div className="info-icon-circle">?</div>
              <div className="info-text">
                <h4>How to find room code?</h4>
                <p>Ask your friend to share the room code and paste it above.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JoinRoomPage;