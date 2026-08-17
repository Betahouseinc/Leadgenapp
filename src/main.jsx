import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Leads from './pages/Leads.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Signup from './pages/Signup.jsx'
import Pricing from './pages/Pricing.jsx'
import Legal from './pages/Legal.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import CookieConsent from './components/CookieConsent.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
        <Route path="/legal/:doc" element={<Legal />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieConsent />
    </BrowserRouter>
  </StrictMode>,
)
