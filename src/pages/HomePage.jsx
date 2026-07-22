import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./HomePage.css";

function HomePage() {
  const [username, setUsername] = useState("User");
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    const savedUserId = localStorage.getItem("userId");

    if (!savedUserId) {
      navigate("/login");
      return;
    }

    if (savedUsername) {
      setUsername(savedUsername);
    }

    // Fetch actual rooms from backend API
    fetchExistingRooms(savedUserId);
  }, [navigate]);

  const fetchExistingRooms = async (userId) => {
    setLoadingRooms(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/room/user/${userId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "69420"
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setRecentRooms(data);
        } else {
          setRecentRooms([]);
        }
      } else {
        setRecentRooms([]);
      }
    } catch (err) {
      console.error("Error fetching rooms:", err);
      setRecentRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    localStorage.removeItem("avatarUrl");
    navigate("/login");
  };

  return (
    <div className="home-wrapper">
      {/* Background Glow */}
      <div className="bg-glow-orb orb-1"></div>

      <div className="home-container">
        {/* 1. TOP NAVBAR */}
        <header className="home-navbar">
          <div className="navbar-brand">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4L26 16L7 28V4Z" fill="url(#paint0_linear_home)" />
              <circle cx="21" cy="7" r="2.5" fill="#A855F7" />
              <circle cx="25" cy="11" r="2" fill="#06B6D4" />
              <circle cx="17" cy="5" r="1.5" fill="#EC4899" />
              <defs>
                <linearGradient id="paint0_linear_home" x1="7" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9333EA" />
                  <stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
            <h2>BingeTogether</h2>
          </div>

          {/* User Profile Chip */}
          <div className="user-profile-menu">
            <button className="profile-chip-glass" onClick={() => setShowDropdown(!showDropdown)}>
              <div className="avatar-circle">
                {username.charAt(0).toUpperCase()}
              </div>
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

        {/* 2. HERO GREETING */}
        <section className="hero-section">
          <div className="hero-text">
            <h1>
              Welcome back, {username}! <span className="waving-hand">👋</span>
            </h1>
            <p>Ready for another amazing watch party?</p>
          </div>
        </section>

        {/* 3. PRIMARY ACTION CARDS */}
        <section className="primary-actions-grid">
          <Link to="/create" className="premium-card create-card">
            <div className="card-left">
              <div className="card-icon-wrapper">🎬</div>
              <div className="card-details">
                <h3>Create Room</h3>
                <p>Create a new watch room and invite your friends</p>
              </div>
            </div>
            <div className="card-arrow-circle">+</div>
          </Link>

          <Link to="/join" className="premium-card join-card">
            <div className="card-left">
              <div className="card-icon-wrapper">👥</div>
              <div className="card-details">
                <h3>Join Room</h3>
                <p>Join an existing room with a room code</p>
              </div>
            </div>
            <div className="card-arrow-circle">→</div>
          </Link>
        </section>

        {/* 4. RECENT ROOMS PANEL */}
        <section className="recent-rooms-panel">
          <div className="panel-header">
            <h3>Recent Rooms</h3>
          </div>

          {loadingRooms ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#8888a0" }}>
              Loading existing rooms...
            </div>
          ) : recentRooms.length === 0 ? (
            /* EMPTY STATE WHEN NO ROOMS EXIST */
            <div className="empty-rooms-state">
              <span className="empty-icon">🍿</span>
              <h4>No existing rooms found</h4>
              <p>Create your first watch room and invite your friends!</p>
              <button className="empty-create-btn" onClick={() => navigate("/create")}>
                + Create Room
              </button>
            </div>
          ) : (
            /* LIST OF EXISTING ROOMS */
            <div className="rooms-grid">
              {recentRooms.map((room) => (
                <div key={room.id || room.roomCode} className="room-card-modern">
                  <div className="room-card-left">
                    <span className="room-card-icon">🎬</span>
                    <div className="room-card-info">
                      <div className="title-row">
                        <h4>{room.roomName || room.name}</h4>
                        <span className="room-type-badge">{room.roomType || "Watch"}</span>
                      </div>
                      <span className="room-card-meta">
                        Code: <strong>{room.roomCode}</strong>
                      </span>
                    </div>
                  </div>
                  <button 
                    className="rejoin-btn"
                    onClick={() => navigate(`/room/${room.roomCode}`)}
                  >
                    Rejoin →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. LOGOUT BUTTON */}
        <button className="premium-logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}

export default HomePage;