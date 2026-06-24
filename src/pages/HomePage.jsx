import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function HomePage() {
  const [username, setUsername] = useState("Guest");
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Grab the saved username from local storage memory
    const savedUsername = localStorage.getItem("username");
    const savedUserId = localStorage.getItem("userId");

    // 2. Security Guard: If no user session exists, kick them back to login page
    if (!savedUserId) {
      navigate("/login");
      return;
    }

    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, [navigate]);

  const handleLogout = () => {
    // Clear out session tokens completely
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      {/* 3. DYNAMIC GREETING: Shows their actual username! */}
      <h1>Welcome to BingeTogether, <span style={{ color: "#007bff" }}>{username}</span>! 🎉</h1>
      <p style={{ fontSize: "18px", color: "#555" }}>
        Your ultimate theater destination for watching movies together.
      </p>

      <hr style={{ width: "50%", margin: "30px auto", borderColor: "#eee" }} />

      {/* Main Navigation Actions */}
      <div style={{ margin: "30px 0" }}>
        <Link to="/create">
          <button style={{ padding: "12px 24px", margin: "10px", fontSize: "16px", cursor: "pointer" }}>
            📺 Create a Watch Room
          </button>
        </Link>
        
        <Link to="/join">
          <button style={{ padding: "12px 24px", margin: "10px", fontSize: "16px", cursor: "pointer" }}>
            🤝 Join Existing Room
          </button>
        </Link>
      </div>

      <br /><br />
      <button 
        onClick={handleLogout} 
        style={{ padding: "8px 16px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
      >
        Log Out
      </button>
    </div>
  );
}

export default HomePage;