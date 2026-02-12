import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Trophy, Users,
  Eye, BarChart3, Settings, ChevronUp, ChevronDown, Download, QrCode, LogOut, RefreshCw, AlertCircle, CheckCircle
} from 'lucide-react'
import {
  getNominations, createNomination, deleteNomination,
  getTeams, createTeam, deleteTeam, reorderTeams,
  getResults, setCurrentTeam, getCurrentTeam, getScores
} from '../utils/api'
import * as XLSX from 'xlsx'
import { QRCodeCanvas } from 'qrcode.react'

export default function AdminPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('nominations')
  const [nominations, setNominations] = useState([])
  const [teams, setTeams] = useState([])
  const [results, setResults] = useState([])
  const [currentTeam, setCurrentTeamState] = useState(null)

  const [newNominationName, setNewNominationName] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedNominationForTeam, setSelectedNominationForTeam] = useState('')
  const [selectedNominationForCurrent, setSelectedNominationForCurrent] = useState('')
  const [selectedTeamForCurrent, setSelectedTeamForCurrent] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeTab === 'results') {
      loadResults()
    }
  }, [activeTab])

  // Auto-refresh results every 5 seconds when on results tab
  useEffect(() => {
    if (activeTab === 'results') {
      const interval = setInterval(() => {
        loadResults()
      }, 5000) // Refresh every 5 seconds

      return () => clearInterval(interval)
    }
  }, [activeTab])

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

  const loadResults = async () => {
    const data = await getResults()
    setResults(data)
  }

  const handleCreateNomination = async (e) => {
    e.preventDefault()
    if (!newNominationName.trim()) return

    await createNomination(newNominationName)
    setNewNominationName('')
    loadData()
  }

  const handleDeleteNomination = async (id) => {
    // Check if nomination has scores
    try {
      const allScores = await getScores()
      const nominationScores = allScores.filter(s => s.nomination_id === id)
      const nominationTeams = teams.filter(t => t.nomination_id === id)

      let message = 'Удалить эту номинацию?'
      if (nominationTeams.length > 0 || nominationScores.length > 0) {
        message = `Удалить эту номинацию? Будут удалены: ${nominationTeams.length} команд`
        if (nominationScores.length > 0) {
          message += ` и ${nominationScores.length} оценок судей`
        }
        message += '. Это действие необратимо!'
      }

      if (!confirm(message)) return
    } catch {
      if (!confirm('Удалить эту номинацию? Все связанные данные тоже будут удалены.')) return
    }

    await deleteNomination(id)
    loadData()
  }

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName.trim() || !selectedNominationForTeam) return

    await createTeam(newTeamName, selectedNominationForTeam)
    setNewTeamName('')
    loadData()
  }

  const handleDeleteTeam = async (id) => {
    if (!confirm('Удалить эту команду?')) return
    await deleteTeam(id)
    loadData()
  }

  const handleSetCurrentTeam = async (teamId, nominationId) => {
    const tId = teamId || selectedTeamForCurrent
    const nId = nominationId || selectedNominationForCurrent
    if (!tId || !nId) return

    try {
      await setCurrentTeam(tId, nId)
      await loadData()
      showToast('Текущая команда переключена')
    } catch (error) {
      showToast('Ошибка переключения команды', 'error')
    }
  }

  const handleMoveTeamUp = async (teamId, nominationId) => {
    const nominationTeams = teams.filter(t => t.nomination_id === nominationId)
    const localIndex = nominationTeams.findIndex(t => t.id === teamId)
    if (localIndex <= 0) return

    const newTeams = [...teams]
    const globalA = newTeams.findIndex(t => t.id === nominationTeams[localIndex].id)
    const globalB = newTeams.findIndex(t => t.id === nominationTeams[localIndex - 1].id)
    const temp = newTeams[globalA]
    newTeams[globalA] = newTeams[globalB]
    newTeams[globalB] = temp
    setTeams(newTeams)

    // Persist new order to DB
    const reordered = newTeams.filter(t => t.nomination_id === nominationId).map(t => t.id)
    try { await reorderTeams(reordered) } catch (e) { console.error('Reorder failed:', e) }
  }

  const handleMoveTeamDown = async (teamId, nominationId) => {
    const nominationTeams = teams.filter(t => t.nomination_id === nominationId)
    const localIndex = nominationTeams.findIndex(t => t.id === teamId)
    if (localIndex >= nominationTeams.length - 1) return

    const newTeams = [...teams]
    const globalA = newTeams.findIndex(t => t.id === nominationTeams[localIndex].id)
    const globalB = newTeams.findIndex(t => t.id === nominationTeams[localIndex + 1].id)
    const temp = newTeams[globalA]
    newTeams[globalA] = newTeams[globalB]
    newTeams[globalB] = temp
    setTeams(newTeams)

    // Persist new order to DB
    const reordered = newTeams.filter(t => t.nomination_id === nominationId).map(t => t.id)
    try { await reorderTeams(reordered) } catch (e) { console.error('Reorder failed:', e) }
  }

  const handleExportExcel = () => {
    if (results.length === 0) {
      alert('Нет данных для экспорта')
      return
    }

    // Группируем по номинациям
    const resultsByNomination = results.reduce((acc, result) => {
      if (!acc[result.nomination_name]) {
        acc[result.nomination_name] = []
      }
      acc[result.nomination_name].push(result)
      return acc
    }, {})

    // Создаем workbook
    const wb = XLSX.utils.book_new()

    // Для каждой номинации создаем отдельный лист
    Object.entries(resultsByNomination).forEach(([nominationName, nominationResults]) => {
      const sortedResults = [...nominationResults].sort((a, b) => b.judges_score - a.judges_score)

      const data = sortedResults.map((r, index) => ({
        'Место': index + 1,
        'Команда': r.team_name,
        'Балл судей': r.judges_score.toFixed(2),
        'Кол-во судей': r.judges_count,
        'Балл зрителей': r.spectators_avg.toFixed(2),
        'Голосов зрителей': r.spectator_votes
      }))

      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, nominationName.substring(0, 31)) // Excel limit 31 chars
    })

    // Сохраняем файл
    const timestamp = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `Результаты_чемпионата_${timestamp}.xlsx`)
  }

  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      localStorage.removeItem('admin_auth')
      navigate('/admin-login')
    }
  }

  const [showQR, setShowQR] = useState(false)
  // Формируем правильный URL для голосования
  const basePath = import.meta.env.BASE_URL || '/'
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const voteUrl = `${window.location.origin}${cleanBasePath}/vote`

  const tabs = [
    { id: 'nominations', label: 'Номинации', icon: Trophy },
    { id: 'teams', label: 'Команды', icon: Users },
    { id: 'current', label: 'Текущая команда', icon: Eye },
    { id: 'results', label: 'Результаты', icon: BarChart3 }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="shadow-lg" style={{ backgroundColor: '#1d1d1d' }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
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
              <Settings className="w-10 h-10" style={{ color: '#FF6E00' }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Панель администратора</h1>
              <p className="text-white/80">Управление чемпионатом</p>
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        {pageLoading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto mb-4" style={{ borderColor: '#FF6E00', borderTopColor: 'transparent' }}></div>
            <p className="text-gray-600 font-medium">Загрузка данных...</p>
          </div>
        ) : connectionError ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Нет связи с сервером</h2>
            <p className="text-gray-500 mb-6">Сервер не отвечает. Возможно, он запускается — подождите немного.</p>
            <button
              onClick={() => { setPageLoading(true); loadData() }}
              className="px-6 py-3 text-white rounded-lg font-semibold"
              style={{ backgroundColor: '#FF6E00' }}
            >
              Попробовать снова
            </button>
          </div>
        ) : (
        <>
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors"
                  style={{
                    color: isActive ? '#FF6E00' : '#666',
                    borderBottom: isActive ? '2px solid #FF6E00' : '2px solid transparent'
                  }}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-md p-6">
          {/* Nominations Tab */}
          {activeTab === 'nominations' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Управление номинациями</h2>

              <form onSubmit={handleCreateNomination} className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newNominationName}
                  onChange={(e) => setNewNominationName(e.target.value)}
                  placeholder="Название номинации"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                  style={{ focusRingColor: '#FF6E00' }}
                />
                <button
                  type="submit"
                  className="px-6 py-3 text-white rounded-lg font-semibold flex items-center gap-2 transition-all hover:opacity-90"
                  style={{ backgroundColor: '#FF6E00' }}
                >
                  <Plus className="w-5 h-5" />
                  Добавить
                </button>
              </form>

              <div className="space-y-3">
                {nominations.map((nom) => (
                  <div
                    key={nom.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5" style={{ color: '#FF6E00' }} />
                      <span className="font-medium">{nom.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteNomination(nom.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {nominations.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Нет номинаций</p>
                )}
              </div>
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Управление командами</h2>

              <form onSubmit={handleCreateTeam} className="bg-orange-50 border-2 rounded-xl p-6 mb-6" style={{ borderColor: '#FF6E00' }}>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Добавить новую команду</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedNominationForTeam}
                    onChange={(e) => setSelectedNominationForTeam(e.target.value)}
                    className="w-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                    style={{ focusRingColor: '#FF6E00' }}
                    required
                  >
                    <option value="">Выберите номинацию</option>
                    {nominations.map((nom) => (
                      <option key={nom.id} value={nom.id}>{nom.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Название команды"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2"
                    style={{ focusRingColor: '#FF6E00' }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={!selectedNominationForTeam || !newTeamName.trim()}
                    className="px-6 py-3 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                    style={{ backgroundColor: '#FF6E00' }}
                  >
                    <Plus className="w-5 h-5" />
                    Добавить
                  </button>
                </div>
              </form>

              {/* Группировка команд по номинациям */}
              {nominations.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Сначала создайте номинации</p>
              ) : (
                <div className="space-y-6">
                  {nominations.map((nomination) => {
                    const nominationTeams = teams.filter(t => t.nomination_id === nomination.id)

                    return (
                      <div key={nomination.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 bg-gray-800">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Trophy className="w-6 h-6" />
                            {nomination.name}
                          </h3>
                          <p className="text-white/70 text-sm mt-1">
                            Команд: {nominationTeams.length}
                          </p>
                        </div>

                        <div className="p-6">
                          {nominationTeams.length === 0 ? (
                            <p className="text-center text-gray-400 py-6">Нет команд в этой номинации</p>
                          ) : (
                            <div className="space-y-2">
                              {nominationTeams.map((team, index) => (
                                  <div
                                    key={team.id}
                                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex-shrink-0 w-10 h-10 text-white rounded-full flex items-center justify-center font-bold text-lg bg-gray-700">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-800">{team.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleMoveTeamUp(team.id, nomination.id)}
                                        disabled={index === 0}
                                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Переместить вверх"
                                      >
                                        <ChevronUp className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveTeamDown(team.id, nomination.id)}
                                        disabled={index === nominationTeams.length - 1}
                                        className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Переместить вниз"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTeam(team.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Удалить команду"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Current Team Tab */}
          {activeTab === 'current' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Текущая команда для зрителей</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Выберите команду, за которую сейчас могут голосовать зрители. Зрители голосуют по ссылке: <code className="bg-blue-100 px-2 py-1 rounded">/vote</code>
                </p>
              </div>

              {currentTeam && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-800 mb-1">Сейчас голосуют за:</p>
                  <p className="font-bold text-lg text-green-900">{currentTeam.team_name}</p>
                  <p className="text-sm text-green-700">{currentTeam.nomination_name}</p>
                </div>
              )}

              {/* Быстрое переключение по номинациям */}
              <div className="space-y-4">
                {nominations.map((nomination) => {
                  const nominationTeams = teams.filter(t => t.nomination_id === nomination.id)
                  if (nominationTeams.length === 0) return null

                  return (
                    <div key={nomination.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Trophy className="w-5 h-5" style={{ color: '#FF6E00' }} />
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
                                : 'bg-white border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                            }`}
                            style={currentTeam?.team_id === team.id ? { backgroundColor: '#FFF3E6', borderColor: '#FF6E00' } : {}}
                          >
                            {team.name}
                            {currentTeam?.team_id === team.id && (
                              <span className="ml-2" style={{ color: '#FF6E00' }}>●</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {nominations.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Сначала добавьте номинации и команды</p>
                )}
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Результаты чемпионата</h2>
                <div className="flex gap-3">
                  <button
                    onClick={loadResults}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 transition-colors"
                    title="Обновить результаты"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Обновить
                  </button>
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
                  >
                    <QrCode className="w-5 h-5" />
                    QR-код для зрителей
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={results.length === 0}
                    className="px-4 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold hover:opacity-90"
                    style={{ backgroundColor: '#FF6E00' }}
                  >
                    <Download className="w-5 h-5" />
                    Экспорт в Excel
                  </button>
                </div>
              </div>

              {/* QR Code Modal */}
              {showQR && (
                <div className="mb-6 bg-white border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">QR-код для голосования зрителей</h3>
                      <p className="text-sm text-gray-600">Покажите этот QR-код зрителям или поделитесь ссылкой</p>
                    </div>
                    <button
                      onClick={() => setShowQR(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                      <QRCodeCanvas value={voteUrl} size={200} level="H" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-2">Ссылка для голосования:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={voteUrl}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(voteUrl)
                            alert('Ссылка скопирована!')
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                        >
                          Копировать
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        💡 Зрители могут сканировать QR-код камерой телефона или перейти по ссылке
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {results.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Пока нет результатов</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    results.reduce((acc, result) => {
                      if (!acc[result.nomination_name]) {
                        acc[result.nomination_name] = []
                      }
                      acc[result.nomination_name].push(result)
                      return acc
                    }, {})
                  ).map(([nominationName, nominationResults]) => {
                    // Сортируем по баллам судей
                    const sortedByJudges = [...nominationResults].sort((a, b) => b.judges_score - a.judges_score)
                    // Находим топ команду по зрительским голосам
                    const topBySpectators = [...nominationResults].sort((a, b) => b.spectators_avg - a.spectators_avg)[0]

                    return (
                      <div key={nominationName}>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                          <Trophy className="w-6 h-6" style={{ color: '#FF6E00' }} />
                          {nominationName}
                        </h3>

                        {/* Судейские результаты */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Оценки судей</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold">Место</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold">Команда</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold">Балл</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold">Судей</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedByJudges.map((result, index) => (
                                  <tr key={result.team_id} className="border-b">
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                        index === 1 ? 'bg-gray-300 text-gray-900' :
                                        index === 2 ? 'bg-orange-400 text-orange-900' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {index + 1}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium">{result.team_name}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="font-bold text-lg" style={{ color: '#FF6E00' }}>
                                        {result.judges_score?.toFixed(2) || '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                      {result.judges_count || 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    )
                  })}

                  {/* Зрительские голоса - общая таблица */}
                  {(() => {
                    const allSpectatorResults = results
                      .filter(r => r.spectator_votes > 0)
                      .sort((a, b) => b.spectators_avg - a.spectators_avg)
                      .slice(0, 5)

                    if (allSpectatorResults.length === 0) return null

                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h4 className="text-lg font-bold text-amber-800 mb-3">ТОП-5 по выбору зрителей</h4>
                        <div className="space-y-2">
                          {allSpectatorResults.map((result, index) => (
                            <div key={result.team_id} className={`flex items-center justify-between p-3 rounded-lg ${
                              index === 0 ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-amber-200'
                            }`}>
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                  index === 0 ? 'bg-amber-500 text-white' :
                                  index === 1 ? 'bg-amber-400 text-white' :
                                  'bg-amber-300 text-amber-900'
                                }`}>
                                  {index + 1}
                                </span>
                                <div>
                                  <p className={`font-bold ${index === 0 ? 'text-amber-900' : 'text-gray-900'}`}>
                                    {result.team_name}
                                  </p>
                                  <p className="text-sm text-amber-700">
                                    {result.nomination_name} — {result.spectators_avg.toFixed(2)}
                                    <span className="text-amber-600"> ({result.spectator_votes} голосов)</span>
                                  </p>
                                </div>
                              </div>
                              {index === 0 && <Trophy className="w-8 h-8 text-amber-600" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
