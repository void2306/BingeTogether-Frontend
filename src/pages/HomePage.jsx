import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [username, setUsername] = useState("User");
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  // Mock list of recent rooms (set to [] to test Empty State!)
  const [recentRooms, setRecentRooms] = useState([
    { id: 1, name: "Chill Stream", type: "Solo", members: "3 Members", time: "2h ago", code: "CHILL6382" },
    { id: 2, name: "Marvel Night", type: "Movie", members: "5 Members", time: "5h ago", code: "MARVEL901" },
    { id: 3, name: "Anime Adda", type: "Solo", members: "2 Members", time: "1d ago", code: "ANIME441" },
  ]);

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
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    localStorage.removeItem("avatarUrl");
    navigate("/login");
  };

  return (
    <div className="home-wrapper">
      {/* Subtle Background Glow Orbs */}
      <div className="bg-glow-orb orb-1"></div>
      <div className="bg-glow-orb orb-2"></div>

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

          {/* Glassmorphism Profile Chip */}
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

        {/* 2. HERO SECTION */}
        <section className="hero-section">
          <div className="hero-text">
            <h1>
              Welcome back, {username}! <span className="waving-hand">👋</span>
            </h1>
            <p>Ready for another amazing watch party?</p>
          </div>
        </section>

        {/* 3. LIVE ACTIVITY BANNER */}
        <div className="live-activity-banner">
          <div className="live-item">
            <span className="live-dot"></span>
            <strong>12</strong> Active Rooms
          </div>
          <div className="banner-divider">•</div>
          <div className="live-item">
            👥 <strong>48</strong> Users Online
          </div>
          <div className="banner-divider">•</div>
          <div className="live-item">
            🎬 <strong>6</strong> Watch Parties Running
          </div>
        </div>

        {/* 4. DASHBOARD STATS */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">🍿</span>
            <div className="stat-info">
              <h4>14</h4>
              <p>Rooms Created</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⏱️</span>
            <div className="stat-info">
              <h4>38h</h4>
              <p>Hours Watched</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">👥</span>
            <div className="stat-info">
              <h4>26</h4>
              <p>Friends Joined</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎬</span>
            <div className="stat-info">
              <h4>19</h4>
              <p>Movies Synced</p>
            </div>
          </div>
        </section>

        {/* 5. CREATE & JOIN CARDS */}
        <section className="primary-actions-grid">
          <Link to="/create" className="premium-card create-card">
            <div className="card-left">
              <div className="card-icon-wrapper">🎬</div>
              <div className="card-details">
                <h3>Create Room</h3>
                <p>Start a new room and invite your squad</p>
              </div>
            </div>
            <div className="card-arrow-circle">+</div>
          </Link>

          <Link to="/join" className="premium-card join-card">
            <div className="card-left">
              <div className="card-icon-wrapper">👥</div>
              <div className="card-details">
                <h3>Join Room</h3>
                <p>Enter with a room code instantly</p>
              </div>
            </div>
            <div className="card-arrow-circle">→</div>
          </Link>
        </section>

        {/* 6. QUICK ACTION SECTION */}
        <section className="quick-actions-section">
          <h3 className="section-title">Quick Actions</h3>
          <div className="quick-actions-grid">
            <div className="quick-card" onClick={() => alert("Watch History coming soon!")}>
              <span className="quick-icon">🍿</span>
              <div className="quick-info">
                <h4>Watch History</h4>
                <p>View past movies watched</p>
              </div>
            </div>

            <div className="quick-card" onClick={() => alert("Friends feature coming soon!")}>
              <span className="quick-icon">👥</span>
              <div className="quick-info">
                <h4>Friends</h4>
                <p>See who is online</p>
              </div>
            </div>

            <div className="quick-card" onClick={() => alert("Favorites coming soon!")}>
              <span className="quick-icon">⭐</span>
              <div className="quick-info">
                <h4>Favorites</h4>
                <p>Saved movies & videos</p>
              </div>
            </div>

            <div className="quick-card" onClick={() => alert("Settings coming soon!")}>
              <span className="quick-icon">⚙️</span>
              <div className="quick-info">
                <h4>Settings</h4>
                <p>Account & preferences</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. RECENT ROOMS PANEL */}
        <section className="recent-rooms-panel">
          <div className="panel-header">
            <h3>Recent Rooms</h3>
            {recentRooms.length > 0 && <span className="view-all-link">View all →</span>}
          </div>

          {recentRooms.length === 0 ? (
            /* EMPTY STATE */
            <div className="empty-rooms-state">
              <span className="empty-icon">🍿</span>
              <h4>No watch rooms yet</h4>
              <p>Create your first room and invite your friends!</p>
              <button className="empty-create-btn" onClick={() => navigate("/create")}>
                + Create Room
              </button>
            </div>
          ) : (
            /* ROOM LIST CARDS */
            <div className="rooms-grid">
              {recentRooms.map((room) => (
                <div key={room.id} className="room-card-modern">
                  <div className="room-card-left">
                    <span className="room-card-icon">🎬</span>
                    <div className="room-card-info">
                      <div className="title-row">
                        <h4>{room.name}</h4>
                        <span className="room-type-badge">{room.type}</span>
                      </div>
                      <span className="room-card-meta">👥 {room.members} • {room.time}</span>
                    </div>
                  </div>
                  <button 
                    className="rejoin-btn"
                    onClick={() => navigate(`/room/${room.code.toLowerCase()}`)}
                  >
                    Rejoin →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 8. PREMIUM OUTLINED LOGOUT BUTTON */}
        <button className="premium-logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}

export default HomePage;