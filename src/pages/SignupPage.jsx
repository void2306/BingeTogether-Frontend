import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config";

function SignupPage() {
  // 1. Declare three distinct independent state variables
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

  try {
    // 🚨 FIX 1: Point to the new secure public authentication route
    const response = await fetch("http://54.164.153.160:8080/auth/signup", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      // 🚨 FIX 2: Ensure your model attributes exactly match what User.java expects
      body: JSON.stringify({
        username: username.trim(), // Make sure your state variable name matches
        email: email.trim(),
        password: password
      }),
    });

    if (!response.ok) {
      throw new Error("Registration failed at server level");
    }

    setLoading(true);
    const newUser = {
      username: username.trim(),
      email: email.trim(),
      password: password.trim()
    };

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        let errorMessage = "Registration failed. Email might already be taken.";
        try {
          const text = await response.text();
          try {
            const parsed = JSON.parse(text);
            errorMessage = parsed.message || parsed.error || text || errorMessage;
          } catch (_) {
            if (text) errorMessage = text;
          }
        } catch (_) { }
        throw new Error(errorMessage);
      }

      alert("Account created successfully! 🎉 Now take your seat and log in.");
      navigate("/login");

    } catch (err) {
      console.error("Signup error details:", err);
      alert("Registration failed. Please try again.");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignupSubmit}>
        {/* FIRST BOX: Username */}
        <input
          type="text"
          value={username} //  FIX: Bind to username state
          onChange={(e) => setUsername(e.target.value)} //  FIX: Update username state
          placeholder="Username"
          disabled={loading}
          required
        />
        <br /><br />

        {/* SECOND BOX: Email */}
        <input
          type="email"
          value={email} // Verified link to email state
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          disabled={loading}
          required
        />
        <br /><br />

        {/* THIRD BOX: Password */}
        <input
          type="password"
          value={password} // Verified link to password state
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