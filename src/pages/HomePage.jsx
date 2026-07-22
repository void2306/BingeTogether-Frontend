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
        setRecentRooms(Array.isArray(data) ? data : []);
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
      {/* 7. GitHub-style Faint Radial Ambient Glow */}
      <div className="ambient-background"></div>

      <div className="home-container">
        {/* Navbar */}
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
            {/* 5. Tiny Purple Glow on Brand Name */}
            <h2 className="glowing-brand-title">BingeTogether</h2>
          </div>

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

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-text">
            <h1>
              Welcome back, {username}! <span className="waving-hand">👋</span>
            </h1>
            {/* 3. Product-like Welcome Line */}
            <p>Create a room, invite your friends, and enjoy synchronized streaming together.</p>
          </div>
        </section>

        {/* Primary Cards */}
        <section className="primary-actions-grid">
          {/* 4. Smooth Hover Animation Card */}
          <Link to="/create" className="premium-card create-card">
            <div className="card-left">
              <div className="card-icon-wrapper">🎬</div>
              <div className="card-details">
                <h3>Create Room</h3>
                <p>Create a watch room and invite friends</p>
              </div>
            </div>
            <div className="card-arrow-circle">+</div>
          </Link>

          <Link to="/join" className="premium-card join-card">
            <div className="card-left">
              <div className="card-icon-wrapper">👥</div>
              <div className="card-details">
                <h3>Join Room</h3>
                <p>Join an existing room with a code</p>
              </div>
            </div>
            <div className="card-arrow-circle">→</div>
          </Link>
        </section>

        {/* Recent Rooms Panel */}
        <section className="recent-rooms-panel">
          <div className="panel-header">
            <h3>Recent Rooms</h3>
          </div>

          {loadingRooms ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#8888a0" }}>
              Loading existing rooms...
            </div>
          ) : recentRooms.length === 0 ? (
            /* 6. Friendly Empty State Text */
            <div className="empty-rooms-state">
              <span className="empty-icon">🍿</span>
              <h4>No watch rooms yet.</h4>
              <p>Create your first room and start watching together.</p>
              <button className="empty-create-btn" onClick={() => navigate("/create")}>
                + Create Room
              </button>
            </div>
          ) : (
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

        {/* 2. Features Section (Completes the Page) */}
        <section className="features-section">
          <h3 className="section-title">Built for Binging Together</h3>
          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🎬</span>
              <h4>Sync Playback</h4>
              <p>Play, pause, and seek in perfect frame synchronization.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">💬</span>
              <h4>Live Chat</h4>
              <p>Real-time reactions and room chat alongside video.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">👑</span>
              <h4>Host Controls</h4>
              <p>Host manages playback permissions and guest access.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">⚡</span>
              <h4>Real Time</h4>
              <p>Ultra-low latency web socket syncing engine.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HomePage;