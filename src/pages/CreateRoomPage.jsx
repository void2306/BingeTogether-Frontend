import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./CreateRoomPage.css";

function CreateRoomPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("User");
  const [showDropdown, setShowDropdown] = useState(false);

  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [movieLink, setMovieLink] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTab, setActiveTab] = useState("link"); // 'link' or 'upload'
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) setUsername(savedUsername);
  }, []);

  // ☁️ Direct AWS S3 Presigned Upload Execution
  const uploadVideoToS3 = async (file) => {
    const token = localStorage.getItem("token");
    setUploading(true);

    try {
      const presignRes = await fetch(
        `${API_BASE_URL}/s3/upload-url?fileName=${encodeURIComponent(
          file.name
        )}&contentType=${encodeURIComponent(file.type || "video/mp4")}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "69420",
          },
        }
      );

      if (!presignRes.ok) {
        throw new Error("Failed to fetch AWS S3 presigned upload URL from server.");
      }

      const { uploadUrl, fileUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "video/mp4",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Direct S3 binary transfer failed.");
      }

      setUploading(false);
      return fileUrl;
    } catch (err) {
      setUploading(false);
      console.error("AWS S3 Upload Trace Error:", err);
      alert(`S3 Upload Error: ${err.message}`);
      return null;
    }
  };

  const createRoom = async () => {
    const savedUserId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    if (!savedUserId || !token) {
      alert("Your session has expired or you are not logged in. Redirecting to login...");
      navigate("/login");
      return;
    }

    if (!roomName.trim()) {
      alert("Please provide a valid Room Name.");
      return;
    }
    if (!roomType) {
      alert("Please select a Room Type.");
      return;
    }

    setLoading(true);
    let finalVideoUrl = movieLink.trim();

    if (activeTab === "upload" && selectedFile) {
      const s3Url = await uploadVideoToS3(selectedFile);
      if (!s3Url) {
        setLoading(false);
        return;
      }
      finalVideoUrl = s3Url;
    }

    if (!finalVideoUrl) {
      alert("Please paste a video URL or select an MP4 file!");
      setLoading(false);
      return;
    }

    const requestBody = {
      roomName: roomName.trim(),
      roomType: roomType,
      movieLink: finalVideoUrl,
      userId: Number(savedUserId),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "69420",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned error status ${response.status}: ${errorText}`);
      }

      const room = await response.json();
      if (!room || !room.roomCode) {
        alert("The server created a room, but failed to return a valid room tracking code.");
        return;
      }

      navigate(`/room/${room.roomCode}`);
    } catch (error) {
      console.error("### FULL SYSTEM ERROR TRACE ###", error);
      alert(`Room creation aborted: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="create-room-wrapper">
      <div className="ambient-background"></div>

      <div className="create-room-container">
        {/* Top Navbar */}
        <header className="create-navbar">
          <div className="navbar-left">
            <button className="back-arrow-btn" onClick={() => navigate("/")}>
              ←
            </button>

            <div className="navbar-brand">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 4L26 16L7 28V4Z" fill="url(#paint0_linear_create)" />
                <circle cx="21" cy="7" r="2.5" fill="#A855F7" />
                <circle cx="25" cy="11" r="2" fill="#06B6D4" />
                <circle cx="17" cy="5" r="1.5" fill="#EC4899" />
                <defs>
                  <linearGradient id="paint0_linear_create" x1="7" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9333EA" />
                    <stop offset="1" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="brand-title">BingeTogether</span>
            </div>
          </div>

          <div className="user-profile-menu">
            <button className="profile-chip-glass" onClick={() => setShowDropdown(!showDropdown)}>
              <div className="avatar-circle">
                {username.charAt(0).toUpperCase()}
              </div>
              <span className="profile-name">{username}</span>
              <span className="dropdown-arrow">⌄</span>
            </button>

            {showDropdown && (
              <div className="profile-dropdown-menu">
                <button onClick={handleLogout} className="dropdown-logout-item">
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Header */}
        <div className="page-title-block">
          <h1>Create a Watch Room</h1>
          <p>Set up your room and invite your friends.</p>
        </div>

        {/* Main Form Card */}
        <div className="create-room-card">
          {/* Room Name */}
          <div className="input-group">
            <label>Room Name</label>
            <input
              type="text"
              placeholder="e.g. Chill Stream"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              disabled={loading || uploading}
            />
          </div>

          {/* Room Type */}
          <div className="input-group">
            <label>Room Type</label>
            <div className="select-wrapper">
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                disabled={loading || uploading}
              >
                <option value="">Select Room Type</option>
                <option value="solo">Solo</option>
                <option value="couple">Couple</option>
                <option value="group">Group</option>
              </select>
              <span className="select-chevron">⌄</span>
            </div>
          </div>

          {/* Dual Source Option Cards */}
          <div className="source-options-grid">
            {/* Option A: Link Card */}
            <div
              className={`source-card ${activeTab === "link" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("link");
                setSelectedFile(null);
              }}
            >
              <div className="source-card-header">
                <span className="source-icon">🔗</span>
                <div>
                  <h4>Paste YouTube / Video Link</h4>
                  <p>Add any YouTube or video link</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="https://youtu.be/abc123..."
                value={movieLink}
                onChange={(e) => {
                  setMovieLink(e.target.value);
                  setActiveTab("link");
                }}
                disabled={loading || uploading}
                className="source-input"
              />
            </div>

            {/* Option B: Upload MP4 Card */}
            <div
              className={`source-card ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("upload");
                setMovieLink("");
              }}
            >
              <div className="source-card-header">
                <span className="source-icon">📁</span>
                <div>
                  <h4>Upload MP4 File</h4>
                  <p>Upload your MP4 file directly</p>
                </div>
              </div>

              <label className="dropzone-area">
                <input
                  type="file"
                  accept="video/mp4,video/mkv,video/webm"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      setActiveTab("upload");
                      setMovieLink("");
                    }
                  }}
                  disabled={loading || uploading}
                  hidden
                />
                <span className="cloud-icon">☁️</span>
                <span className="dropzone-text">
                  {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                </span>
                <span className="dropzone-sub">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                    : "MP4 file only"}
                </span>
              </label>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            className="submit-create-btn"
            onClick={createRoom}
            disabled={loading || uploading}
          >
            {uploading
              ? "Uploading MP4 to AWS S3..."
              : loading
              ? "Creating Room..."
              : "Create Room"}
          </button>

          <p className="terms-disclaimer">
            By creating a room, you agree to our <a href="#terms">Terms & Conditions</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CreateRoomPage;