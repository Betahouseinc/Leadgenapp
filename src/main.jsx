import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Legal from './pages/Legal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Existing app (auth + all dashboards) lives at "/" — untouched */}
        <Route path="/" element={<App />} />
        {/* New action-first dashboard preview at "/dashboard" */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Legal pages — /legal/privacy, /legal/terms, /legal/security, /legal/data-protection */}
        <Route path="/legal/:page" element={<Legal />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
