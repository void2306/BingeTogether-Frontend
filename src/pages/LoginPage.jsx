import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { GoogleLogin } from "@react-oauth/google";
import "./LoginPage.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Existing Standard Traditional Credentials Login Loop
  const login = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);
    const credentials = { email: email.trim(), password: password.trim() };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error("Invalid email or password credentials.");
      }

      const data = await response.json();

      if (data && data.user && data.user.id) {
        localStorage.setItem("userId", String(data.user.id));
        localStorage.setItem("username", data.user.username || "User");
        localStorage.setItem("token", data.token);

        alert("Logged in successfully! 🎉");
        navigate("/"); 
      } else {
        alert("Server response missing user identity properties.");
      }

    } catch (error) {
      console.error("Login process failure:", error);
      alert(error.message || "Failed to connect to backend server.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Secure Google Authentication Flow Handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    console.log("Incoming raw validation payload matrix:", credentialResponse);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!response.ok) {
        throw new Error("Google callback validation was rejected by the server backend context.");
      }

      const data = await response.json();

      if (data && data.user && data.user.id) {
        localStorage.setItem("userId", String(data.user.id));
        localStorage.setItem("username", data.user.username || "User");
        localStorage.setItem("token", data.token);
        if (data.user.avatarUrl) {
          localStorage.setItem("avatarUrl", data.user.avatarUrl);
        }

        alert("Google Authentication Successful! 🎉");
        navigate("/"); 
      } else {
        alert("Server processed details but returned missing schema structures.");
      }
    } catch (error) {
      console.error("OAuth loop failure metrics:", error);
      alert(error.message || "Failed to finalize authentication handshake with server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* 1. Header Section */}
      <div className="auth-header">
        <div className="brand-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 4L26 16L7 28V4Z" fill="url(#paint0_linear)" />
            <defs>
              <linearGradient id="paint0_linear" x1="7" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C5DFA" />
                <stop offset="1" stopColor="#4831D4" />
              </linearGradient>
            </defs>
          </svg>
          <h2>BingeTogether</h2>
        </div>
        <h1>Welcome Back! 👋</h1>
        <p>Glad to see you again. Let’s watch together.</p>
      </div>

      {/* 2. Glassmorphism Card */}
      <div className="auth-card">
        <form onSubmit={login} className="auth-form">
          <div className="input-group">
            <label>Email</label>
            <div className="input-field-wrapper">
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-field-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <a href="#forgot" className="forgot-link">Forgot password?</a>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        {/* 3. Google OAuth Button */}
        <div className="google-btn-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.error("Identity collection context crashed at Google layer runtime prompt");
              alert("Google login sequence failed to fire up properly.");
            }}
            disabled={loading}
            theme="filled_blue"
            shape="rectangular"
            width="100%"
          />
        </div>

        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;