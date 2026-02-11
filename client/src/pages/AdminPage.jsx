import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Trophy, Users,
  Eye, BarChart3, Settings, ChevronUp, ChevronDown, Download, QrCode, LogOut, RefreshCw
} from 'lucide-react'
import {
  getNominations, createNomination, deleteNomination,
  getTeams, createTeam, deleteTeam,
  getResults, setCurrentTeam, getCurrentTeam
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
    const [nomsData, teamsData, currentData] = await Promise.all([
      getNominations(),
      getTeams(),
      getCurrentTeam()
    ])
    setNominations(nomsData)
    setTeams(teamsData)
    setCurrentTeamState(currentData)
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
    if (!confirm('Удалить эту номинацию? Все связанные команды тоже будут удалены.')) return
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

  const handleSetCurrentTeam = async () => {
    if (!selectedTeamForCurrent || !selectedNominationForCurrent) return

    await setCurrentTeam(selectedTeamForCurrent, selectedNominationForCurrent)
    loadData()
  }

  const handleMoveTeamUp = (index) => {
    if (index === 0) return
    const newTeams = [...teams]
    const temp = newTeams[index]
    newTeams[index] = newTeams[index - 1]
    newTeams[index - 1] = temp
    setTeams(newTeams)
  }

  const handleMoveTeamDown = (index) => {
    if (index === teams.length - 1) return
    const newTeams = [...teams]
    const temp = newTeams[index]
    newTeams[index] = newTeams[index + 1]
    newTeams[index + 1] = temp
    setTeams(newTeams)
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
    <div className="min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
      {/* Header */}
      <div className="text-white shadow-lg" style={{ backgroundColor: '#1a1a1a', borderBottom: '2px solid #FF6E00' }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255, 110, 0, 0.2)', color: '#FF6E00' }}
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 110, 0, 0.2)' }}>
              <Settings className="w-10 h-10" style={{ color: '#FF6E00' }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Панель администратора</h1>
              <p className="text-gray-400">Управление чемпионатом</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="rounded-xl shadow-md mb-6" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="flex" style={{ borderBottom: '1px solid #2a2a2a' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors"
                  style={{
                    color: isActive ? '#FF6E00' : '#888',
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
        <div className="rounded-xl shadow-md p-6" style={{ backgroundColor: '#1a1a1a' }}>
          {/* Nominations Tab */}
          {activeTab === 'nominations' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-white">Управление номинациями</h2>

              <form onSubmit={handleCreateNomination} className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newNominationName}
                  onChange={(e) => setNewNominationName(e.target.value)}
                  placeholder="Название номинации"
                  className="flex-1 px-4 py-3 rounded-lg focus:ring-2 text-white"
                  style={{
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #3a3a3a',
                    focusRing: '#FF6E00'
                  }}
                />
                <button
                  type="submit"
                  className="px-6 py-3 text-black rounded-lg font-semibold flex items-center gap-2 transition-all hover:opacity-90"
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
                    className="flex items-center justify-between p-4 rounded-lg"
                    style={{ backgroundColor: '#2a2a2a' }}
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5" style={{ color: '#FF6E00' }} />
                      <span className="font-medium text-white">{nom.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteNomination(nom.id)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: '#ff4444' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
              <h2 className="text-2xl font-bold mb-6 text-white">Управление командами</h2>

              <form onSubmit={handleCreateTeam} className="rounded-xl p-6 mb-6" style={{ backgroundColor: '#2a2a2a', border: '2px solid rgba(255, 110, 0, 0.3)' }}>
                <h3 className="text-lg font-semibold mb-4 text-white">Добавить новую команду</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedNominationForTeam}
                    onChange={(e) => setSelectedNominationForTeam(e.target.value)}
                    className="w-48 px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#3a3a3a', border: '1px solid #4a4a4a' }}
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
                    className="flex-1 px-4 py-3 rounded-lg text-white"
                    style={{ backgroundColor: '#3a3a3a', border: '1px solid #4a4a4a' }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={!selectedNominationForTeam || !newTeamName.trim()}
                    className="px-6 py-3 text-black rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
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
                      <div key={nomination.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
                        <div className="px-6 py-4" style={{ backgroundColor: '#FF6E00' }}>
                          <h3 className="text-xl font-bold text-black flex items-center gap-2">
                            <Trophy className="w-6 h-6" />
                            {nomination.name}
                          </h3>
                          <p className="text-black/70 text-sm mt-1">
                            Команд: {nominationTeams.length}
                          </p>
                        </div>

                        <div className="p-6">
                          {nominationTeams.length === 0 ? (
                            <p className="text-center text-gray-500 py-6">Нет команд в этой номинации</p>
                          ) : (
                            <div className="space-y-2">
                              {nominationTeams.map((team, index) => {
                                const globalIndex = teams.findIndex(t => t.id === team.id)
                                return (
                                  <div
                                    key={team.id}
                                    className="flex items-center gap-4 p-4 rounded-lg transition-colors"
                                    style={{ backgroundColor: '#3a3a3a' }}
                                  >
                                    <div className="flex-shrink-0 w-10 h-10 text-black rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: '#FF6E00' }}>
                                      {index + 1}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-semibold text-white">{team.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleMoveTeamUp(globalIndex)}
                                        disabled={globalIndex === 0}
                                        className="p-2 text-gray-400 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-white/10"
                                        title="Переместить вверх"
                                      >
                                        <ChevronUp className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleMoveTeamDown(globalIndex)}
                                        disabled={globalIndex === teams.length - 1}
                                        className="p-2 text-gray-400 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors hover:bg-white/10"
                                        title="Переместить вниз"
                                      >
                                        <ChevronDown className="w-5 h-5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTeam(team.id)}
                                        className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                                        style={{ color: '#ff4444' }}
                                        title="Удалить команду"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
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
              <h2 className="text-2xl font-bold mb-6 text-white">Текущая команда для зрителей</h2>

              <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <p className="text-sm text-blue-300">
                  Выберите команду, за которую сейчас могут голосовать зрители. Зрители голосуют по ссылке: <code className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>/vote</code>
                </p>
              </div>

              {currentTeam && (
                <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <p className="text-sm text-green-300 mb-1">Сейчас голосуют за:</p>
                  <p className="font-bold text-lg text-green-400">{currentTeam.team_name}</p>
                  <p className="text-sm text-green-300">{currentTeam.nomination_name}</p>
                </div>
              )}

              {/* Быстрое переключение по номинациям */}
              <div className="space-y-4">
                {nominations.map((nomination) => {
                  const nominationTeams = teams.filter(t => t.nomination_id === nomination.id)
                  if (nominationTeams.length === 0) return null

                  return (
                    <div key={nomination.id} className="rounded-lg p-4" style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
                      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Trophy className="w-5 h-5" style={{ color: '#FF6E00' }} />
                        {nomination.name}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {nominationTeams.map((team) => (
                          <button
                            key={team.id}
                            onClick={() => {
                              setSelectedNominationForCurrent(nomination.id)
                              setSelectedTeamForCurrent(team.id)
                              handleSetCurrentTeam()
                            }}
                            className="px-4 py-3 text-left rounded-lg border-2 transition-all"
                            style={{
                              backgroundColor: currentTeam?.team_id === team.id ? 'rgba(34, 197, 94, 0.2)' : '#3a3a3a',
                              borderColor: currentTeam?.team_id === team.id ? '#22c55e' : '#4a4a4a',
                              color: currentTeam?.team_id === team.id ? '#86efac' : '#fff',
                              fontWeight: currentTeam?.team_id === team.id ? '600' : '400'
                            }}
                          >
                            {team.name}
                            {currentTeam?.team_id === team.id && (
                              <span className="ml-2" style={{ color: '#22c55e' }}>●</span>
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
                <h2 className="text-2xl font-bold text-white">Результаты чемпионата</h2>
                <div className="flex gap-3">
                  <button
                    onClick={loadResults}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:opacity-90"
                    style={{ backgroundColor: '#5a5a5a', color: 'white' }}
                    title="Обновить результаты"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Обновить
                  </button>
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:opacity-90"
                    style={{ backgroundColor: '#3b82f6', color: 'white' }}
                  >
                    <QrCode className="w-5 h-5" />
                    QR-код для зрителей
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={results.length === 0}
                    className="px-4 py-2 text-black rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90 font-semibold"
                    style={{ backgroundColor: '#FF6E00' }}
                  >
                    <Download className="w-5 h-5" />
                    Экспорт в Excel
                  </button>
                </div>
              </div>

              {/* QR Code Modal */}
              {showQR && (
                <div className="mb-6 rounded-xl p-6" style={{ backgroundColor: '#2a2a2a', border: '2px solid rgba(59, 130, 246, 0.3)' }}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">QR-код для голосования зрителей</h3>
                      <p className="text-sm text-gray-400">Покажите этот QR-код зрителям или поделитесь ссылкой</p>
                    </div>
                    <button
                      onClick={() => setShowQR(false)}
                      className="text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-600">
                      <QRCodeCanvas value={voteUrl} size={200} level="H" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-300 mb-2">Ссылка для голосования:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={voteUrl}
                          readOnly
                          className="flex-1 px-3 py-2 rounded-lg text-sm text-white"
                          style={{ backgroundColor: '#3a3a3a', border: '1px solid #4a4a4a' }}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(voteUrl)
                            alert('Ссылка скопирована!')
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium transition-all"
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
                          <span className="text-white">{nominationName}</span>
                        </h3>

                        {/* Судейские результаты */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-300 mb-3">Оценки судей</h4>
                          <div className="overflow-x-auto rounded-lg" style={{ backgroundColor: '#2a2a2a' }}>
                            <table className="w-full">
                              <thead style={{ backgroundColor: '#3a3a3a' }}>
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Место</th>
                                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Команда</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Балл</th>
                                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Судей</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedByJudges.map((result, index) => (
                                  <tr key={result.team_id} style={{ borderBottom: '1px solid #3a3a3a' }}>
                                    <td className="px-4 py-3">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold" style={{
                                        backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#4a4a4a',
                                        color: index < 3 ? '#000' : '#888'
                                      }}>
                                        {index + 1}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-white">{result.team_name}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="font-bold text-lg" style={{ color: '#FF6E00' }}>
                                        {result.judges_score?.toFixed(2) || '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-400">
                                      {result.judges_count || 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Зрительские голоса - ТОП-3 */}
                        {(() => {
                          const sortedBySpectators = [...nominationResults]
                            .filter(r => r.spectator_votes > 0)
                            .sort((a, b) => b.spectators_avg - a.spectators_avg)
                            .slice(0, 3)

                          if (sortedBySpectators.length === 0) return null

                          return (
                            <div className="rounded-lg p-4" style={{ backgroundColor: 'rgba(255, 191, 0, 0.1)', border: '1px solid rgba(255, 191, 0, 0.3)' }}>
                              <h4 className="text-sm font-semibold mb-3" style={{ color: '#FFBF00' }}>🎭 ТОП-3 по выбору зрителей</h4>
                              <div className="space-y-2">
                                {sortedBySpectators.map((result, index) => (
                                  <div key={result.team_id} className="flex items-center justify-between p-3 rounded-lg" style={{
                                    backgroundColor: index === 0 ? 'rgba(255, 191, 0, 0.2)' : '#3a3a3a',
                                    border: `1px solid ${index === 0 ? 'rgba(255, 191, 0, 0.4)' : '#4a4a4a'}`
                                  }}>
                                    <div className="flex items-center gap-3">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-black" style={{
                                        backgroundColor: index === 0 ? '#FFBF00' : index === 1 ? '#FFD666' : '#FFE499'
                                      }}>
                                        {index + 1}
                                      </span>
                                      <div>
                                        <p className={`font-bold ${index === 0 ? 'text-white' : 'text-gray-300'}`}>
                                          {result.team_name}
                                        </p>
                                        <p className="text-sm" style={{ color: '#FFBF00' }}>
                                          Средняя оценка: {result.spectators_avg.toFixed(2)}
                                          <span className="text-gray-400"> ({result.spectator_votes} голосов)</span>
                                        </p>
                                      </div>
                                    </div>
                                    {index === 0 && <Trophy className="w-8 h-8" style={{ color: '#FFBF00' }} />}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
