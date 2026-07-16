import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 🚀 Wrapping globally with the absolute Google Client ID */}
    <GoogleOAuthProvider clientId="813321728507-jmlef4nu5m1evckp39uq82mflmjrc2j9.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)