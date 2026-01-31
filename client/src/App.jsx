import { Routes, Route, Navigate } from 'react-router-dom'
import JudgePage from './pages/JudgePage'
import AdminPage from './pages/AdminPage'
import SpectatorPage from './pages/SpectatorPage'
import HomePage from './pages/HomePage'
import JudgeLoginPage from './pages/JudgeLoginPage'
import AdminLoginPage from './pages/AdminLoginPage'

// Protected Route для судей
function ProtectedJudgeRoute({ children }) {
  const auth = localStorage.getItem('judge_auth')

  if (!auth) {
    return <Navigate to="/judge-login" replace />
  }

  try {
    const authData = JSON.parse(auth)
    // Проверяем, что прошло не более 24 часов
    if (Date.now() - authData.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('judge_auth')
      return <Navigate to="/judge-login" replace />
    }
  } catch {
    return <Navigate to="/judge-login" replace />
  }

  return children
}

// Protected Route для администратора
function ProtectedAdminRoute({ children }) {
  const auth = localStorage.getItem('admin_auth')

  if (!auth) {
    return <Navigate to="/admin-login" replace />
  }

  try {
    const authData = JSON.parse(auth)
    // Проверяем, что прошло не более 24 часов
    if (Date.now() - authData.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('admin_auth')
      return <Navigate to="/admin-login" replace />
    }
  } catch {
    return <Navigate to="/admin-login" replace />
  }

  return children
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Главная страница - только для тестов */}
        <Route path="/" element={<HomePage />} />

        {/* Страницы логина */}
        <Route path="/judge-login" element={<JudgeLoginPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />

        {/* Прямая ссылка для зрителей (без логина) */}
        <Route path="/vote" element={<SpectatorPage />} />

        {/* Защищенные страницы */}
        <Route
          path="/judge/:judgeId"
          element={
            <ProtectedJudgeRoute>
              <JudgePage />
            </ProtectedJudgeRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <AdminPage />
            </ProtectedAdminRoute>
          }
        />

        {/* Старый маршрут зрителей - редирект на /vote */}
        <Route path="/spectator" element={<Navigate to="/vote" replace />} />
      </Routes>
    </div>
  )
}

export default App
