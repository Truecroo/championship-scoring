import { Routes, Route, Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import JudgePage from './pages/JudgePage'
import AdminPage from './pages/AdminPage'
import SpectatorPage from './pages/SpectatorPage'
import HomePage from './pages/HomePage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/judge/:judgeId" element={<JudgePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/spectator" element={<SpectatorPage />} />
      </Routes>
    </div>
  )
}

export default App
