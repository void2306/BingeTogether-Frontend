import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { GoogleLogin } from "@react-oauth/google";
import "./SignupPage.css";

function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (password !== confirmPassword) {
      alert("⚠️ Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password: password.trim()
        }),
      });

      if (!response.ok) {
        let serverError = "Registration failed.";
        try {
          const textData = await response.text();
          if (textData) {
            try {
              const parsedJson = JSON.parse(textData);
              serverError = parsedJson.message || parsedJson.error || textData;
            } catch (_) {
              serverError = textData;
            }
          }
        } catch (_) {}
        throw new Error(serverError);
      }

      // Show sleek success toast
      setShowSuccessToast(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (err) {
      console.error("Signup error details:", err);
      alert(`⚠️ Server Error: ${err.message}`);
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
        throw new Error("Google signup rejected by server.");
      }

      const data = await response.json();

      if (data && data.user && data.user.id) {
        localStorage.setItem("userId", String(data.user.id));
        localStorage.setItem("username", data.user.username || "User");
        localStorage.setItem("token", data.token);

        setShowSuccessToast(true);
        setTimeout(() => navigate("/"), 2000);
      }
    } catch (error) {
      console.error("Google Signup Error:", error);
      alert(error.message || "Failed to complete Google Signup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-bg-overlay"></div>

      <div className="auth-content">
        {/* Header Section */}
        <div className="auth-header">
          <div className="brand-logo">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <h1 className="welcome-text">Create Your Account 🎉</h1>
          <p className="welcome-sub">Join BingeTogether and start your watch party journey!</p>
        </div>

        {/* Signup Form Card */}
        <div className="auth-card">
          <form onSubmit={handleSignup} className="auth-form">
            <div className="input-group">
              <label>Username</label>
              <div className="input-field-wrapper">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Email</label>
              <div className="input-field-wrapper">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
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

            <div className="input-group">
              <label>Confirm Password</label>
              <div className="input-field-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <button type="submit" className="signup-btn" disabled={loading}>
              {loading ? "Registering account..." : "Sign Up"}
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <div className="google-btn-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => alert("Google signup sequence failed to fire up.")}
              disabled={loading}
              theme="filled_blue"
              shape="rectangular"
              width="100%"
            />
          </div>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Login</Link>
          </div>

          {/* Success Banner matching screenshot */}
          {showSuccessToast && (
            <div className="toast-success">
              <div className="toast-icon">✓</div>
              <div className="toast-text">
                <strong>Account created successfully! 🎉</strong>
                <span>Welcome to BingeTogether. Redirecting...</span>
              </div>
              <button className="toast-close" onClick={() => setShowSuccessToast(false)}>✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SignupPage;