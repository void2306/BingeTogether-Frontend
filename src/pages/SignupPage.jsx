import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);

    try {
    const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          username: username.trim(), // 🔑 Explicitly matches User.java fields
          email: email.trim(),
          password: password.trim()
          // Removed manual 'id' entirely so PostgreSQL IDENTITY works perfectly
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

      alert("Account created successfully! 🎉 Now take your seat and log in.");
      navigate("/login");

    } catch (err) {
      console.error("Signup error details:", err);
      alert(`⚠️ Server Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignup}> 
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          disabled={loading}
          required
        />
        <br /><br />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          disabled={loading}
          required
        />
        <br /><br />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          disabled={loading}
          required
        />
        <br /><br />

        <button type="submit" disabled={loading}>
          {loading ? "Registering account..." : "Sign Up"}
        </button>
      </form>

      <br />
      <p style={{ fontSize: "14px" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "#007bff", fontWeight: "bold", textDecoration: "none" }}>
          Login
        </Link>
      </p>
    </div>
  );
}

export default SignupPage;