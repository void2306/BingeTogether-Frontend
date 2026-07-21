import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

function CreateRoomPage() {
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [movieLink, setMovieLink] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // ☁️ Direct AWS S3 Presigned Upload Execution
  const uploadVideoToS3 = async (file) => {
    const token = localStorage.getItem("token");
    setUploading(true);

    try {
      // 1. Fetch Presigned Upload URL from Spring Boot Backend
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

      // 2. Direct Binary Stream Upload to S3 Bucket
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
      return fileUrl; // Returns permanent AWS S3 public video URL
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

    // Priority: If local MP4 was picked, upload to S3 first
    if (selectedFile) {
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

    console.log("[DEBUG] TRANSMITTING PAYLOAD:", requestBody);

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

  return (
    <div style={{ padding: "30px", maxWidth: "500px", margin: "0 auto" }}>
      <h1>Create Room Space</h1>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Room Name</label>
        <input
          type="text"
          placeholder="e.g. Chill Stream"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          disabled={loading || uploading}
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>Room Type</label>
        <select
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
          disabled={loading || uploading}
          style={{ width: "100%", padding: "8px" }}
        >
          <option value="">Select Room Type</option>
          <option value="solo">Solo</option>
          <option value="couple">Couple</option>
          <option value="group">Group</option>
        </select>
      </div>

      <div style={{ padding: "15px", border: "1px dashed #ccc", borderRadius: "8px", marginBottom: "20px" }}>
        {/* Option 1: URL */}
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Option A: Paste YouTube / Video Link</label>
          <input
            type="text"
            placeholder="https://..."
            value={movieLink}
            onChange={(e) => {
              setMovieLink(e.target.value);
              if (e.target.value) setSelectedFile(null);
            }}
            disabled={loading || uploading || !!selectedFile}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ textAlign: "center", fontSize: "12px", color: "#888", margin: "10px 0" }}>— OR —</div>

        {/* Option 2: S3 Upload */}
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Option B: Upload MP4 File directly to S3</label>
          <input
            type="file"
            accept="video/mp4,video/mkv,video/webm"
            onChange={(e) => {
              if (e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
                setMovieLink("");
              }
            }}
            disabled={loading || uploading || !!movieLink}
            style={{ width: "100%" }}
          />
          {selectedFile && (
            <p style={{ color: "green", fontSize: "12px", marginTop: "5px" }}>
              Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
            </p>
          )}
        </div>
      </div>

      <button
        onClick={createRoom}
        disabled={loading || uploading}
        style={{
          width: "100%",
          padding: "12px",
          backgroundColor: uploading ? "#f39c12" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        {uploading
          ? "Uploading MP4 to AWS S3..."
          : loading
          ? "Generating Space..."
          : "Create Room"}
      </button>
    </div>
  );
}

export default CreateRoomPage;