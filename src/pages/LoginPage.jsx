import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
        navigate("/"); // Takes you straight back to the root watch party layout
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

  return (
    <div style={{ padding: "20px" }}>
      <h1>Login</h1>
      <form onSubmit={login}>
        {/* Email input configured for clean auto-captures */}
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          disabled={loading}
          required
        />
        <br /><br />

        {/* Password input configured for clean auto-captures */}
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          disabled={loading}
          required
        />
        <br /><br />

        <button type="submit" disabled={loading}>
          {loading ? "Authenticating..." : "Login"}
        </button>
      </form>

      <br />
      {/* Navigation Link to Signup */}
      <p style={{ fontSize: "14px" }}>
        Don't have an account?{" "}
        <Link to="/signup" style={{ color: "#007bff", fontWeight: "bold", textDecoration: "none" }}>
          Create Account
        </Link>
      </p>
    </div>
  );
}

export default LoginPage;