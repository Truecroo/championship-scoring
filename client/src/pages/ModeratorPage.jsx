import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Monitor, Trophy, LogOut, AlertCircle, CheckCircle } from 'lucide-react'
import { getNominations, getTeams, getCurrentTeam, setCurrentTeamModerator } from '../utils/api'

export default function ModeratorPage() {
  const navigate = useNavigate()
  const [nominations, setNominations] = useState([])
  const [teams, setTeams] = useState([])
  const [currentTeam, setCurrentTeamState] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Проверка сессии модератора
  useEffect(() => {
    const checkSession = () => {
      try {
        const auth = JSON.parse(localStorage.getItem('moderator_auth') || '{}')
        if (!auth.token || !auth.timestamp || Date.now() - auth.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('moderator_auth')
          navigate('/moderator-login')
        }
      } catch {
        localStorage.removeItem('moderator_auth')
        navigate('/moderator-login')
      }
    }
    checkSession()
    const interval = setInterval(checkSession, 60000)
    return () => clearInterval(interval)
  }, [navigate])

  useEffect(() => {
    loadData()
  }, [])

  // Автообновление текущей команды каждые 5 секунд
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getCurrentTeam()
        setCurrentTeamState(data)
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [nomsData, teamsData, currentData] = await Promise.all([
        getNominations(),
        getTeams(),
        getCurrentTeam()
      ])
      setNominations(nomsData)
      setTeams(teamsData)
      setCurrentTeamState(currentData)
      setConnectionError(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setConnectionError(true)
    } finally {
      setPageLoading(false)
    }
  }

  const handleSetCurrentTeam = async (teamId, nominationId) => {
    try {
      await setCurrentTeamModerator(teamId, nominationId)
      const data = await getCurrentTeam()
      setCurrentTeamState(data)
      showToast('Текущая команда переключена')
    } catch (error) {
      if (error.message?.includes('401') || error.message?.includes('авторизац')) {
        showToast('Сессия истекла. Войдите заново', 'error')
        localStorage.removeItem('moderator_auth')
        setTimeout(() => navigate('/moderator-login'), 1500)
      } else {
        showToast('Ошибка переключения команды', 'error')
      }
    }
  }

  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      localStorage.removeItem('moderator_auth')
      navigate('/moderator-login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="shadow-lg" style={{ backgroundColor: '#1d1d1d' }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Monitor className="w-10 h-10 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Панель модератора</h1>
              <p className="text-white/80">Переключение команд для голосования</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {pageLoading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto mb-4" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-600 font-medium">Загрузка данных...</p>
          </div>
        ) : connectionError ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Нет связи с сервером</h2>
            <p className="text-gray-500 mb-6">Сервер не отвечает. Возможно, он запускается.</p>
            <button
              onClick={() => { setPageLoading(true); loadData() }}
              className="px-6 py-3 text-white rounded-lg font-semibold"
              style={{ backgroundColor: '#7C3AED' }}
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Текущая команда для зрителей</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Выберите команду, за которую сейчас могут голосовать зрители.
              </p>
            </div>

            {currentTeam && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-800 mb-1">Сейчас голосуют за:</p>
                <p className="font-bold text-lg text-green-900">{currentTeam.team_name}</p>
                <p className="text-sm text-green-700">{currentTeam.nomination_name}</p>
              </div>
            )}

            <div className="space-y-4">
              {nominations.map((nomination) => {
                const nominationTeams = teams.filter(t => t.nomination_id === nomination.id)
                if (nominationTeams.length === 0) return null

                return (
                  <div key={nomination.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-purple-500" />
                      {nomination.name}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {nominationTeams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => handleSetCurrentTeam(team.id, nomination.id)}
                          className={`px-4 py-3 text-left rounded-lg border-2 transition-all ${
                            currentTeam?.team_id === team.id
                              ? 'border-green-500 text-green-900 font-semibold'
                              : 'bg-white border-gray-200 hover:border-purple-400 hover:bg-purple-50'
                          }`}
                          style={currentTeam?.team_id === team.id ? { backgroundColor: '#F3E8FF', borderColor: '#7C3AED' } : {}}
                        >
                          {team.name}
                          {currentTeam?.team_id === team.id && (
                            <span className="ml-2 text-purple-600">●</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {nominations.length === 0 && (
                <p className="text-center text-gray-500 py-8">Нет номинаций</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
