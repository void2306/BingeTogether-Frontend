import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [username, setUsername] = useState("User");
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  // Mock recent rooms list matching the reference image layout
  const recentRooms = [
    { id: 1, name: "Chill Stream", type: "Solo", members: "3 Members", time: "2h ago", code: "CHILL6382" },
    { id: 2, name: "Marvel Night", type: "Movie", members: "5 Members", time: "5h ago", code: "MARVEL901" },
    { id: 3, name: "Anime Adda", type: "Solo", members: "2 Members", time: "1d ago", code: "ANIME441" },
  ];

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
      <div className="home-container">
        
        {/* 1. TOP NAVBAR */}
        <header className="home-navbar">
          <div className="navbar-brand">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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

          {/* User Profile Dropdown */}
          <div className="user-profile-menu">
            <button className="profile-btn" onClick={() => setShowDropdown(!showDropdown)}>
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

        {/* 2. WELCOME BANNER SECTION */}
        <section className="welcome-banner">
          <div className="welcome-text-container">
            <h1>Welcome back, {username}! 👋</h1>
            <p>Ready for another amazing watch party?</p>
          </div>
          
          <div className="banner-illustration">
            {/* Watch party artwork element */}
            <div className="illustration-card">
              <span className="illus-emoji">🍿</span>
              <div className="illus-avatars">
                <span className="avatar-chip a1">👥</span>
                <span className="avatar-chip a2">🎬</span>
                <span className="avatar-chip a3">✨</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. MAIN ACTION CARDS (CREATE & JOIN) */}
        <section className="action-cards-grid">
          <Link to="/create" className="action-card create-card">
            <div className="card-left">
              <div className="card-icon-box">🎬</div>
              <div className="card-text">
                <h3>Create Room</h3>
                <p>Create a new watch room and invite your friends</p>
              </div>
            </div>
            <div className="card-action-icon">+</div>
          </Link>

          <Link to="/join" className="action-card join-card">
            <div className="card-left">
              <div className="card-icon-box">👥</div>
              <div className="card-text">
                <h3>Join Room</h3>
                <p>Join an existing room with a room code</p>
              </div>
            </div>
            <div className="card-action-icon">→</div>
          </Link>
        </section>

        {/* 4. RECENT ROOMS SECTION */}
        <section className="recent-rooms-panel">
          <div className="panel-header">
            <h3>Recent Rooms</h3>
            <span className="view-all-link">View all →</span>
          </div>

          <div className="rooms-list">
            {recentRooms.map((room) => (
              <div 
                key={room.id} 
                className="room-row" 
                onClick={() => navigate(`/room/${room.code.toLowerCase()}`)}
              >
                <div className="room-info">
                  <span className="room-icon">🎬</span>
                  <span className="room-title">{room.name}</span>
                  <span className="room-tag">{room.type}</span>
                </div>
                <div className="room-meta">
                  <span className="room-members">{room.members}</span>
                  <span className="room-time">{room.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. BOTTOM FULL-WIDTH LOGOUT BUTTON */}
        <button className="logout-btn-bar" onClick={handleLogout}>
          Log Out
        </button>

      </div>
    </div>
  );
}

export default HomePage;