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

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

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

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!response.ok) {
        throw new Error("Google callback validation was rejected by server.");
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
        alert("Server returned missing schema structures.");
      }
    } catch (error) {
      console.error("OAuth loop failure:", error);
      alert(error.message || "Failed to finalize authentication with server.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      alert("Please enter your email address.");
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });

      if (response.ok) {
        alert("Password reset link sent to your email! 📩");
      } else {
        alert("If that email is registered, a reset link has been dispatched.");
      }
      setShowForgotModal(false);
      setResetEmail("");
    } catch (err) {
      console.error(err);
      alert("Password reset request completed.");
      setShowForgotModal(false);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Background Overlay */}
      <div className="auth-bg-overlay"></div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="forgot-modal-backdrop">
          <div className="forgot-modal">
            <h3>Reset Your Password 🔑</h3>
            <p>Enter your account email and we'll send you a password reset link.</p>
            <form onSubmit={handleForgotPassword}>
              <input
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              <div className="forgot-modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowForgotModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="send-btn" disabled={resetLoading}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content Container */}
      <div className="auth-content">
        {/* Header Branding */}
        <div className="auth-header">
          <div className="brand-logo">
            <svg width="42" height="42" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4L26 16L7 28V4Z" fill="url(#paint0_linear)" />
              <circle cx="21" cy="7" r="2.5" fill="#A855F7" />
              <circle cx="25" cy="11" r="2" fill="#06B6D4" />
              <circle cx="17" cy="5" r="1.5" fill="#EC4899" />
              <defs>
                <linearGradient id="paint0_linear" x1="7" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#9333EA" />
                  <stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="brand-title">BingeTogether</span>
          </div>
          <h1 className="welcome-text">Welcome Back! 👋</h1>
          <p className="welcome-sub">Glad to see you again. Let’s watch together.</p>
        </div>

        {/* Form Card */}
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

            <button
              type="button"
              className="forgot-link"
              onClick={() => setShowForgotModal(true)}
            >
              Forgot password?
            </button>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Authenticating..." : "Login"}
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <div className="google-btn-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
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
    </div>
  );
}

export default LoginPage;