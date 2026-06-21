import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const login = async () => {

    try {

      const response = await fetch("http://localhost:8080/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      console.log("Status:", response.status);

      const text = await response.text();
      console.log("Raw response:", text);

      // IMPORTANT: handle empty response safely
      if (!text) {
        alert("Invalid login (empty response)");
        return;
      }

      const data = JSON.parse(text);

      localStorage.setItem("userId", data.id);
      localStorage.setItem("username", data.username);

      navigate("/");

    } catch (error) {
      console.error("Login error:", error);
      alert("Something went wrong");
    }
  };

  return (
    <div>
      <h1>Login</h1>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />

      <br /><br />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />

      <br /><br />

      <button onClick={login}>Login</button>
    </div>
  );
}

export default LoginPage;