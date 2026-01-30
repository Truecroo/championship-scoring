import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Trophy, Users,
  Eye, BarChart3, Settings
} from 'lucide-react'
import {
  getNominations, createNomination, deleteNomination,
  getTeams, createTeam, deleteTeam,
  getResults, setCurrentTeam, getCurrentTeam
} from '../utils/api'

export default function AdminPage() {
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
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Link>
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
                {teams.map((team) => {
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
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
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
                  Выберите команду, за которую сейчас могут голосовать зрители
                </p>
              </div>

              {currentTeam && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-800 mb-1">Текущая команда:</p>
                  <p className="font-bold text-green-900">{currentTeam.team_name}</p>
                  <p className="text-sm text-green-700">{currentTeam.nomination_name}</p>
                </div>
              )}

              <div className="space-y-3">
                <select
                  value={selectedNominationForCurrent}
                  onChange={(e) => {
                    setSelectedNominationForCurrent(e.target.value)
                    setSelectedTeamForCurrent('')
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Выберите номинацию</option>
                  {nominations.map((nom) => (
                    <option key={nom.id} value={nom.id}>{nom.name}</option>
                  ))}
                </select>

                <select
                  value={selectedTeamForCurrent}
                  onChange={(e) => setSelectedTeamForCurrent(e.target.value)}
                  disabled={!selectedNominationForCurrent}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
                >
                  <option value="">Выберите команду</option>
                  {teams
                    .filter(t => t.nomination_id === selectedNominationForCurrent)
                    .map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                </select>

                <button
                  onClick={handleSetCurrentTeam}
                  disabled={!selectedTeamForCurrent}
                  className="w-full px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 font-semibold"
                >
                  Установить текущую команду
                </button>
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Результаты чемпионата</h2>

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
