🎬 BingeTogether
Create rooms. Watch together. Chat together.

> BingeTogether is a real-time watch party platform that allows friends to create private rooms, watch YouTube videos together in perfect synchronization, chat live, and enjoy a shared viewing experience from anywhere.

## ✨ Features

- 🔐 Secure Google OAuth Authentication
- 🎥 Create Private Watch Rooms
- 🔗 Join Rooms using a Shareable Room Code
- ▶️ Real-time Video Synchronization
- 💬 Live Chat with WebSockets
- ⏩ Skip Confirmation Popups for synchronized seeking
- 👥 Live Member List
- 📋 One-click Room Code Copy
- 🌙 Modern Dark UI
- 📱 Responsive Design
- 📺 Watch YouTube videos together
- 📁 Upload MP4 videos stored securely on AWS S3

## 📸 Screenshots

### 🏠 Home Page

> <img width="1252" height="900" alt="image" src="https://github.com/user-attachments/assets/0866ae8e-6141-47c1-ad98-368a141b8cc2" />

### 🎬 Create Room

> <img width="1255" height="898" alt="image" src="https://github.com/user-attachments/assets/16828ff3-c5c3-4751-807a-604da3401b19" />

### 🚪 Join Room

> <img width="1256" height="897" alt="image" src="https://github.com/user-attachments/assets/f65f1aa2-36f5-441c-8737-8defec0ad522" />

### 🍿 Watch Room

> <img width="1247" height="892" alt="image" src="https://github.com/user-attachments/assets/ce6023d0-e9e9-40eb-82bf-6e74ea4170fa" />

### 🔄 Sync Request Popup

<img width="1341" height="857" alt="image" src="https://github.com/user-attachments/assets/006e1b2f-a265-4ea4-86cc-1a7e00ea577c" />

## 🎥 Demo

> _Add your demo GIF or screen recording here._

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React.js + Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| Authentication | Google OAuth |
| API | Axios |
| Real-time | WebSocket (STOMP) |
| Deployment | Vercel |
|Video Storage | AWS S3 |

## 🚀 Key Features
🔐 Authentication
- Login using Google OAuth
- Persistent user sessions
- Secure authentication flow
🎬 Watch Rooms
- Create new watch rooms
- Join existing rooms using room codes
- Copy room code instantly
- Multiple participants per room
▶️ Real-Time Synchronization
Every playback action is synchronized across all connected participants.
Supported actions include:
- Play
- Pause
- Seek
- Skip Requests

Instead of abruptly changing playback, users receive a synchronization request popup before jumping to the requested timestamp, creating a smoother collaborative experience.
### 💬 Live Chat
Communicate with everyone in the room instantly through real-time messaging powered by WebSockets.
### 🎨 User Experience
- Beautiful dark theme
- Responsive layouts
- Interactive hover effects
- Smooth transitions
- Minimal and distraction-free interface

## 🏗️ Application Flow
```
Login
   │
   ▼
Home
   │
   ├─────────────┐
   ▼             ▼
Create Room   Join Room
      │          │
      └────┬─────┘
           ▼
      Watch Room
           │
   ┌───────┼────────┐
   ▼       ▼        ▼
 Chat    Members   Video Sync
```

## 📂 Project Structure
```
src/
│
├── assets/
├── components/
├── pages/
├── services/
├── hooks/
├── context/
├── utils/
├── App.jsx
└── main.jsx
```

## 🧠 What I Learned
During the development of BingeTogether, I learned:
- Building real-time applications using WebSockets (STOMP)
- Synchronizing video playback across multiple users
- Implementing secure Google OAuth authentication
- Integrating AWS S3 for cloud-based MP4 storage
- Connecting React with Spring Boot using REST APIs
- Deploying frontend on Vercel and backend on Railway
- Designing responsive interfaces using Tailwind CSS
- 
## ⚙️ Getting Started
Clone the repository
```bash
git clone https://github.com/void2306/BingeTogether-Frontend.git
```

### Navigate to the project

```bash
cd BingeTogether-Frontend
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

The application will be available at:

```
http://localhost:5173
```

## ⚙️ Backend

The frontend communicates with the backend using REST APIs for room management and STOMP WebSockets for real-time synchronization.

Backend Repository:
👉 [BingeTogether-Backend](https://github.com/void2306/BingeTogether)

## 🚀 Future Enhancements

- 🎭 Emoji Reactions
- 🔔 Room Notifications
- 📜 Watch History
- 🎞️ Playback Queue
- 🎵 Voice Chat
- 📺 Support for additional streaming platforms
- 👤 User Profiles
- 📱 Enhanced Mobile Experience

## 🔗 Links

🌐 Live Demo: [BingeTogether](https://bingetogether.vercel.app)

💻 Frontend: [BingeTogether-Frontend](https://github.com/void2306/BingeTogether-Frontend)

⚙️ Backend: [BingeTogether-Backend](https://github.com/void2306/BingeTogether)


## 👩‍💻 Developer

Sakshi Kumari
B.Tech Computer Science Engineering

🌐GitHub: [@void2306](https://github.com/void2306)
💼LinkedIn: [Sakshi Kumari](https://www.linkedin.com/in/sakshi-kumari-374bb9330/)


## ⭐ If you like this project

Give the repository a ⭐ and feel free to explore the code or contribute!
