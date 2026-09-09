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
  const [activeTab, setActiveTab] = useState(null); // 'link' or 'upload'
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Upload Progress & ETA States
  const [uploadProgress, setUploadProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);

  // Success Modal State
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) setUsername(savedUsername);
  }, []);

  // Format seconds to clean readable text
  const formatTimeRemaining = (seconds) => {
    if (seconds === null || isNaN(seconds) || seconds < 0) return "";
    if (seconds >= 60) {
      const minutes = Math.ceil(seconds / 60);
      return `~${minutes} min left`;
    }
    return `~${seconds}s left`;
  };

  // Safe file selection handler with 500MB guard
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE_MB = 500;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File size exceeds ${MAX_SIZE_MB}MB. Please select a smaller video file.`);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setActiveTab("upload");
    setMovieLink("");
  };

  // Direct Binary Upload Execution with Real-Time Progress Tracking
  const uploadVideoToS3 = async (file) => {
    const token = localStorage.getItem("token");
    setUploading(true);
    setUploadProgress(0);
    setTimeLeft(null);

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
        throw new Error("Failed to fetch presigned upload URL from server.");
      }

      const { uploadUrl, fileUrl } = await presignRes.json();

      // Zero-dependency binary transfer using XMLHttpRequest for real-time progress events
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const startTime = Date.now();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(percent);

            const elapsedSec = (Date.now() - startTime) / 1000;
            const uploadSpeed = event.loaded / elapsedSec; // bytes per second
            const remainingBytes = event.total - event.loaded;
            const remainingSec = uploadSpeed > 0 ? Math.round(remainingBytes / uploadSpeed) : null;

            setTimeLeft(remainingSec);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`Storage direct transfer rejected with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error occurred during storage binary upload."));
        xhr.ontimeout = () => reject(new Error("Upload timed out. Please check your internet connection."));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      setUploading(false);
      return fileUrl;
    } catch (err) {
      setUploading(false);
      setUploadProgress(0);
      setTimeLeft(null);
      console.error("Storage Upload Error:", err);
      alert(`Upload Error: ${err.message}`);
      return null;
    }
  };

  const createRoom = async () => {
    const savedUserId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    if (!savedUserId || !token) {
      alert("Your session has expired or you are not logged in.");
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
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const room = await response.json();
      if (!room || !room.roomCode) {
        alert("Room created, but failed to retrieve room code.");
        return;
      }

      setCreatedRoom(room);
    } catch (error) {
      console.error("Error creating room:", error);
      alert(`Room creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (createdRoom?.roomCode) {
      navigator.clipboard.writeText(createdRoom.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleShareInvite = () => {
    if (navigator.share && createdRoom?.roomCode) {
      navigator.share({
        title: "Join my BingeTogether Watch Party!",
        text: `Hey! Join my watch party room using code: ${createdRoom.roomCode}`,
        url: window.location.origin,
      }).catch(() => {});
    } else {
      handleCopyCode();
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="create-room-wrapper">
      <div className="ambient-background"></div>

      {/* SUCCESS MODAL */}
      {createdRoom && (
        <div className="room-modal-backdrop">
          <div className="room-modal-card">
            <div className="modal-header-icon">🎉</div>
            <h2>Room Created Successfully!</h2>
            <p className="modal-room-title">{createdRoom.roomName || roomName}</p>

            <div className="code-display-box">
              <span className="code-label">ROOM CODE</span>
              <div className="code-value">{createdRoom.roomCode}</div>
            </div>

            <div className="modal-actions-grid">
              <button className="modal-btn secondary" onClick={handleCopyCode}>
                {copied ? "✓ Copied!" : "📋 Copy Code"}
              </button>
              <button className="modal-btn secondary" onClick={handleShareInvite}>
                🔗 Share Invite
              </button>
            </div>

            <button
              className="modal-btn primary-enter"
              onClick={() => navigate(`/room/${createdRoom.roomCode}`)}
            >
              Enter Room →
            </button>
          </div>
        </div>
      )}

      <div className="create-room-container">
        {/* Top Navbar */}
        <header className="create-navbar">
          <div className="navbar-left">
            <button className="back-home-btn" onClick={() => navigate("/")}>
              ← Home
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
          <p className="subtitle">Create a room, invite your friends, and watch in perfect sync.</p>
          <span className="sync-note-badge">⚡ Every playback action is synchronized for everyone.</span>
        </div>

        {/* Main Form Card */}
        <div className="create-room-card">
          {/* Room Name */}
          <div className="input-group">
            <label>Room Name</label>
            <input
              type="text"
              placeholder="e.g. Movie Night 🍿"
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
                <option value="solo">🍿 Solo Room</option>
                <option value="couple">❤️ Couple Room</option>
                <option value="group">👥 Group Room</option>
              </select>
              <span className="select-chevron">⌄</span>
            </div>
          </div>

          {/* Source Options with OR Divider */}
          <div className="source-section-wrapper">
            {/* Option A: Link Card */}
            <div
              className={`source-card ${activeTab === "link" ? "selected-glow" : ""}`}
              onClick={() => {
                setActiveTab("link");
                setSelectedFile(null);
              }}
            >
              <div className="source-card-header">
                <span className="source-icon">🎬</span>
                <div>
                  <h4>Video or Stream Link</h4>
                  <p>HLS streams (.m3u8), MP4/WebM, or YouTube</p>
                </div>
              </div>
              <input
                type="text"
                placeholder="Paste .m3u8, direct video URL, or YouTube link..."
                value={movieLink}
                onFocus={() => {
                  setActiveTab("link");
                  setSelectedFile(null);
                }}
                onChange={(e) => {
                  setMovieLink(e.target.value);
                  setActiveTab("link");
                  setSelectedFile(null);
                }}
                disabled={loading || uploading}
                className="source-input"
              />
              <div className="demo-stream-pills" style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", alignSelf: "center" }}>Quick Demos:</span>
                <button
                  type="button"
                  style={{
                    background: "rgba(147, 51, 234, 0.2)",
                    border: "1px solid rgba(168, 85, 247, 0.4)",
                    color: "#c084fc",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovieLink("https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8");
                    setActiveTab("link");
                    setSelectedFile(null);
                  }}
                >
                  🎧 Multi-Audio & Subtitles HLS
                </button>
                <button
                  type="button"
                  style={{
                    background: "rgba(6, 182, 212, 0.2)",
                    border: "1px solid rgba(6, 182, 212, 0.4)",
                    color: "#22d3ee",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovieLink("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8");
                    setActiveTab("link");
                    setSelectedFile(null);
                  }}
                >
                  🍿 Big Buck Bunny HLS
                </button>
              </div>
            </div>

            <div className="or-divider">
              <span>OR</span>
            </div>

            {/* Option B: Local File Card */}
            <div
              className={`source-card ${activeTab === "upload" ? "selected-glow" : ""}`}
              onClick={() => {
                setActiveTab("upload");
                setMovieLink("");
              }}
            >
              <div className="source-card-header">
                <span className="source-icon">📂</span>
                <div>
                  <h4>Upload MP4 File</h4>
                  <p>Upload local video file directly</p>
                </div>
              </div>

              <label className="dropzone-area">
                <input
                  type="file"
                  accept="video/mp4,video/mkv,video/webm"
                  onChange={handleFileSelect}
                  disabled={loading || uploading}
                  hidden
                />
                <span className="cloud-icon">☁️</span>
                <span className="dropzone-text">
                  {selectedFile ? selectedFile.name : "Drag & Drop your movie here or Click to Browse"}
                </span>
                <span className="dropzone-sub">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                    : "Supports MP4 files only"}
                </span>
              </label>
            </div>
          </div>

          {/* Real-time Upload Progress Track */}
          {uploading && (
            <div className="upload-progress-track">
              <div
                className="upload-progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Submit Button with Live Progress Display */}
          <button
            className="submit-create-btn"
            onClick={createRoom}
            disabled={loading || uploading}
          >
            {uploading ? (
              <span className="popcorn-loader">
                🍿 Uploading Video: {uploadProgress}%
                {timeLeft !== null && ` (${formatTimeRemaining(timeLeft)})`}
              </span>
            ) : loading ? (
              <span className="popcorn-loader">🍿 Creating your watch room...</span>
            ) : (
              "🎬 Create & Continue →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateRoomPage;