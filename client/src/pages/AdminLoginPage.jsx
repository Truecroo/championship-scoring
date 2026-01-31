import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Lock } from 'lucide-react'
import { API_URL } from '../utils/config'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Если уже залогинен - редирект на админку
  useEffect(() => {
    const auth = localStorage.getItem('admin_auth')
    if (auth) {
      try {
        const authData = JSON.parse(auth)
        if (Date.now() - authData.timestamp < 24 * 60 * 60 * 1000) {
          navigate('/admin', { replace: true })
        }
      } catch {
        localStorage.removeItem('admin_auth')
      }
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка авторизации')
      }

      // Сохраняем данные администратора в localStorage
      localStorage.setItem('admin_auth', JSON.stringify({
        authenticated: true,
        timestamp: Date.now()
      }))

      // Перенаправляем на страницу администратора
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Панель администратора</h1>
          <p className="text-gray-600">Введите пароль для входа</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Пароль администратора
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Введите пароль"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            По умолчанию пароль: <code className="bg-gray-100 px-2 py-1 rounded">admin123</code>
          </p>
        </div>
      </div>
    </div>
  )
}
