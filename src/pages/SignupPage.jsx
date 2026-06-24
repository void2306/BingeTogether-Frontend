import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function SignupPage() {
  // 1. Declare three distinct independent state variables
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSignup = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!username.trim() || !email.trim() || !password.trim()) {
      alert("Please fill in all input fields.");
      return;
    }

    setLoading(true);
    const newUser = {
      username: username.trim(),
      email: email.trim(),
      password: password.trim()
    };

    try {
      const response = await fetch("http://localhost:8080/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        throw new Error("Registration failed. Email might already be taken.");
      }

      alert("Account created successfully! 🎉 Please log in.");
      navigate("/login"); 

    } catch (error) {
      console.error("Signup process failure:", error);
      alert(error.message || "Failed to reach registration server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignup}>
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