import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Trophy, Users,
  Eye, BarChart3, Settings, ChevronUp, ChevronDown, Download, QrCode, LogOut
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Settings className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Панель администратора</h1>
              <p className="text-white/90">Управление чемпионатом</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-amber-600 border-b-2 border-amber-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Добавить
                </button>
              </form>

              <div className="space-y-3">
                {nominations.map((nom) => (
                  <div
                    key={nom.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span className="font-medium">{nom.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteNomination(nom.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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

              <form onSubmit={handleCreateTeam} className="space-y-3 mb-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Название команды"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  <select
                    value={selectedNominationForTeam}
                    onChange={(e) => setSelectedNominationForTeam(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Выберите номинацию</option>
                    {nominations.map((nom) => (
                      <option key={nom.id} value={nom.id}>{nom.name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedNominationForTeam}
                    className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                    Добавить
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {teams.map((team, index) => {
                  const nomination = nominations.find(n => n.id === team.nomination_id)
                  return (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{team.name}</p>
                          <p className="text-sm text-gray-600">{nomination?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMoveTeamUp(index)}
                          disabled={index === 0}
                          className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Переместить вверх"
                        >
                          <ChevronUp className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleMoveTeamDown(index)}
                          disabled={index === teams.length - 1}
                          className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Переместить вниз"
                        >
                          <ChevronDown className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {teams.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Нет команд</p>
                )}
              </div>
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
                        <Trophy className="w-5 h-5 text-amber-500" />
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
                            className={`px-4 py-3 text-left rounded-lg border-2 transition-all ${
                              currentTeam?.team_id === team.id
                                ? 'bg-green-50 border-green-500 text-green-900 font-semibold'
                                : 'bg-white border-gray-200 hover:border-amber-400 hover:bg-amber-50'
                            }`}
                          >
                            {team.name}
                            {currentTeam?.team_id === team.id && (
                              <span className="ml-2 text-green-600">●</span>
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
                    onClick={() => setShowQR(!showQR)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
                  >
                    <QrCode className="w-5 h-5" />
                    QR-код для зрителей
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={results.length === 0}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                          <Trophy className="w-6 h-6 text-amber-500" />
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
                                      <span className="font-bold text-lg text-primary-600">
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

                        {/* Зрительские голоса */}
                        {topBySpectators && topBySpectators.spectator_votes > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-green-800 mb-2">🎭 Выбор зрителей</h4>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-green-900">{topBySpectators.team_name}</p>
                                <p className="text-sm text-green-700">
                                  Средняя оценка: {topBySpectators.spectators_avg.toFixed(2)}
                                  ({topBySpectators.spectator_votes} голосов)
                                </p>
                              </div>
                              <Trophy className="w-10 h-10 text-green-600" />
                            </div>
                          </div>
                        )}
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
