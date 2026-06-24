import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import SignupPage from "./pages/SignupPage";
import RoomPage from "./pages/RoomPage";
import LoginPage from "./pages/LoginPage";
function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={<HomePage />} />

        <Route path="/create" element={<CreateRoomPage />} />

        <Route path="/join" element={<JoinRoomPage />} />

        <Route path="/room/:roomCode" element={<RoomPage />} />

        <Route path="/signup" element={<SignupPage />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
