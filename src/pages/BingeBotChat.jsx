import React, { useState, useRef, useEffect } from 'react';
import './BingeBotChat.css'; // Optional styling file

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://bingetogether.onrender.com'; // Fallback to your live backend domain

const BingeBotChat = ({ roomId, playerRef }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'BingeBot',
      text: "Hey! I'm your private watch-party assistant. Ask me anything about the stream!",
      isBot: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    // 1. Get current video timestamp if player ref is available
    let currentSeconds = 0.0;
    if (playerRef?.current) {
      if (typeof playerRef.current.getCurrentTime === 'function') {
        currentSeconds = playerRef.current.getCurrentTime() || 0.0;
      }
    }

    // 2. Append User Message
    const userMsgObj = {
      id: Date.now(),
      sender: 'You',
      text: userText,
      isBot: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsgObj]);
    setIsLoading(true);

    try {
      // 3. Call Live Deployed Spring Boot Endpoint
      const response = await fetch(`${API_BASE_URL}/api/v1/bot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: roomId || 'default-room',
          userMessage: userText,
          currentTimestamp: currentSeconds,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      // 4. Append BingeBot Response
      const botMsgObj = {
        id: Date.now() + 1,
        sender: 'BingeBot',
        text: data.answer || "Sorry, I couldn't process that response.",
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsgObj]);
    } catch (error) {
      console.error('Error fetching BingeBot response:', error);
      
      const errorMsgObj = {
        id: Date.now() + 1,
        sender: 'BingeBot',
        text: 'Oops! Unable to reach BingeBot right now. Please try again.',
        isBot: true,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, errorMsgObj]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bingebot-container">
      {/* Header */}
      <div className="bingebot-header">
        <h3>🤖 BingeBot <span className="private-badge">Private</span></h3>
      </div>

      {/* Chat Messages List */}
      <div className="bingebot-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-bubble ${msg.isBot ? 'bot' : 'user'} ${msg.isError ? 'error' : ''}`}
          >
            <div className="message-header">
              <span className="sender-name">{msg.sender}</span>
              <span className="time">{msg.timestamp}</span>
            </div>
            <div className="message-text">{msg.text}</div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="message-bubble bot loading">
            <span className="sender-name">BingeBot</span>
            <div className="typing-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="bingebot-input-form">
        <input
          type="text"
          placeholder="Ask BingeBot something..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" disabled={!inputMessage.trim() || isLoading}>
          Send
        </button>
      </form>
    </div>
  );
};

export default BingeBotChat;