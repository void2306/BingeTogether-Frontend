import { Link } from "react-router-dom";

function HomePage() {
  return (
    <div>
      <h1>Welcome To BingeTogether</h1>

      <Link to="/create">
        <button>Create Room</button>
      </Link>

      <br />
      <br />

      <Link to="/join">
        <button>Join Room</button>
      </Link>
    </div>
  );
}

export default HomePage;