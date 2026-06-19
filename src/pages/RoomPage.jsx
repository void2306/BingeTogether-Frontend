import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function RoomPage() {

  const { roomCode } = useParams();

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const fetchRoom = async () => {

    const response = await fetch(
      `http://localhost:8080/room/${roomCode}`
    );

    const data = await response.json();

    console.log(data);

    setRoom(data);
  };
  const fetchMembers = async () => {

  const response = await fetch(
    `http://localhost:8080/room/${roomCode}/members`
  );
                                                             
 const data = await response.json();

setRoom(data);

fetchMessages(data.id);
};
const fetchMessages = async (roomId) => {

  const response = await fetch(
    `http://localhost:8080/chat/${roomId}`
  );

  const data = await response.json();

  console.log("Messages:", data);

  setMessages(data);
};

 useEffect(() => {
  fetchRoom();
  fetchMembers();
}, []);
 return (
  <div>
    <h1>Room Page</h1>

    {room && (
      <>
        <p>Room Name: {room.roomName}</p>

        <p>Room Code: {room.roomCode}</p>

        <p>Room Type: {room.roomType}</p>

        <p>Movie Link: {room.movieLink}</p>
      </>
    )}
    <h2>Members</h2>
{members.map((member) => (
  <div key={member.id.userId}>
    <p>User ID: {member.id.userId}</p>
    <p>Role: {member.role}</p>
  </div>
))}

  </div>
  
);
}

export default RoomPage;