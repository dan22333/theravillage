import React, { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import MainApp from './components/MainApp'

import ClientProfileCompletion from './components/ClientProfileCompletion'
import AdminPanel from './components/AdminPanel'
import InvitationAccept from './components/InvitationAccept'
import './App.css'

// Professional loading component
const AppLoading = () => (
  <div style={{ 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: 10000, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' 
  }}>
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '16px', 
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', 
      padding: '48px', 
      textAlign: 'center' 
    }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        border: '4px solid #F8F9FA', 
        borderTop: '4px solid #20B2AA', 
        borderRadius: '50%', 
        animation: 'spin 1s linear infinite', 
        margin: '0 auto 16px' 
      }}></div>
      <p style={{ color: '#6C757D', fontSize: '18px', margin: 0 }}>Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<AppLoading />}>
          <div className="App">
            <main className="main-content">
              <Routes>
                <Route path="/" element={<MainApp />} />
                <Route path="/client/complete-profile" element={<ClientProfileCompletion />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/invite/:invitationToken" element={<InvitationAccept />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Suspense>
      </Router>
    </AuthProvider>
  )
}

export default App
