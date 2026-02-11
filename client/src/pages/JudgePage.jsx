import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Trophy, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { getNominations, getTeams, createScore, updateScore, getScores } from '../utils/api'
import ScoreInput from '../components/ScoreInput'

const CRITERIA = [
  { key: 'choreography', label: 'Хореография и рисунки', description: 'Сложность, оригинальность и актуальность постановки', weight: 0.45 },
  { key: 'technique', label: 'Техника и исполнение', description: 'Точность и качество выполнения, синхронность и тайминг', weight: 0.35 },
  { key: 'artistry', label: 'Артистизм, образ и костюм', description: 'Сценический образ и презентация', weight: 0.15 },
  { key: 'overall', label: 'Общее впечатление', description: 'Целостность выступления', weight: 0.05 }
]

export default function JudgePage() {
  const { judgeId } = useParams()
  const navigate = useNavigate()
  const [nominations, setNominations] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedNomination, setSelectedNomination] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [scores, setScores] = useState({})
  const [comments, setComments] = useState({})
  const [savedScores, setSavedScores] = useState({}) // Сохраненные оценки для всех команд
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const saveTimeoutRef = useRef(null)

  useEffect(() => {
    loadNominations()
    loadAllScores()
  }, [])

  useEffect(() => {
    if (selectedNomination) {
      loadTeams(selectedNomination)
    } else {
      setTeams([])
      setSelectedTeam('')
    }
  }, [selectedNomination])

  // Загружаем сохраненные оценки при смене команды
  useEffect(() => {
    if (selectedTeam && savedScores[selectedTeam]) {
      const saved = savedScores[selectedTeam]
      const newScores = {}
      const newComments = {}

      CRITERIA.forEach(c => {
        if (saved.scores[c.key]) {
          newScores[c.key] = saved.scores[c.key].score
          newComments[c.key] = saved.scores[c.key].comment
        }
      })

      setScores(newScores)
      setComments(newComments)
    } else {
      setScores({})
      setComments({})
    }
  }, [selectedTeam])

  const loadNominations = async () => {
    try {
      const data = await getNominations()
      setNominations(data)
    } catch (error) {
      console.error('Error loading nominations:', error)
    }
  }

  const loadTeams = async (nominationId) => {
    try {
      const data = await getTeams(nominationId)
      setTeams(data)
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const loadAllScores = async () => {
    try {
      const data = await getScores()
      // Группируем оценки по командам для текущего судьи
      const scoresByTeam = {}
      data.forEach(score => {
        if (score.judge_id === judgeId) {
          scoresByTeam[score.team_id] = score
        }
      })
      setSavedScores(scoresByTeam)
    } catch (error) {
      console.error('Error loading scores:', error)
    }
  }

  const handleScoreChange = (criterion, value) => {
    setScores(prev => {
      const newScores = { ...prev, [criterion]: value }
      // Автосохранение после изменения ползунка
      scheduleAutoSave(newScores, comments)
      return newScores
    })
  }

  const handleCommentChange = (criterion, value) => {
    setComments(prev => {
      const newComments = { ...prev, [criterion]: value }
      // Автосохранение после изменения комментария (с задержкой)
      scheduleAutoSave(scores, newComments)
      return newComments
    })
  }

  const scheduleAutoSave = (currentScores, currentComments) => {
    // Отменяем предыдущий таймер
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Запускаем новый таймер (500мс задержка для комментариев)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(currentScores, currentComments)
    }, 500)
  }

  const autoSave = async (currentScores, currentComments) => {
    // Проверяем, что выбраны номинация и команда
    if (!selectedNomination || !selectedTeam) return

    // Проверяем, что заполнены все оценки
    const hasAllScores = CRITERIA.every(c =>
      currentScores[c.key] != null &&
      currentScores[c.key] >= 0.1 &&
      currentScores[c.key] <= 10
    )

    if (!hasAllScores) return

    setSaving(true)
    try {
      const scoreData = {
        judge_id: judgeId,
        nomination_id: selectedNomination,
        team_id: selectedTeam,
        scores: CRITERIA.reduce((acc, c) => {
          acc[c.key] = {
            score: currentScores[c.key],
            comment: currentComments[c.key] || ''
          }
          return acc
        }, {}),
        average: calculateWeightedAverageFromScores(currentScores),
        timestamp: new Date().toISOString()
      }

      // Проверяем существует ли уже оценка для этой команды
      const existingScore = savedScores[selectedTeam]

      if (existingScore && existingScore.id) {
        // UPDATE: оценка уже существует
        await updateScore(existingScore.id, scoreData)
      } else {
        // CREATE: новая оценка
        const result = await createScore(scoreData)
        // Сохраняем ID для будущих обновлений
        scoreData.id = result.id
      }

      // Сохраняем оценки локально
      setSavedScores(prev => ({
        ...prev,
        [selectedTeam]: scoreData
      }))

      // Показываем уведомление об успехе
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)

    } catch (error) {
      console.error('Error auto-saving scores:', error)
    } finally {
      setSaving(false)
    }
  }

  const calculateWeightedAverageFromScores = (currentScores) => {
    let totalWeighted = 0
    CRITERIA.forEach(c => {
      if (currentScores[c.key] != null) {
        totalWeighted += currentScores[c.key] * c.weight
      }
    })
    return totalWeighted
  }

  const calculateWeightedAverage = () => {
    let totalWeighted = 0
    let hasAllScores = true

    CRITERIA.forEach(c => {
      if (scores[c.key] != null) {
        totalWeighted += scores[c.key] * c.weight
      } else {
        hasAllScores = false
      }
    })

    return hasAllScores ? totalWeighted : 0
  }


  // Навигация по командам
  const currentTeamIndex = teams.findIndex(t => t.id === parseInt(selectedTeam))
  const canGoPrev = currentTeamIndex > 0
  const canGoNext = currentTeamIndex < teams.length - 1 && currentTeamIndex !== -1

  const handlePrevTeam = () => {
    if (canGoPrev) {
      setSelectedTeam(teams[currentTeamIndex - 1].id.toString())
    }
  }

  const handleNextTeam = () => {
    if (canGoNext) {
      setSelectedTeam(teams[currentTeamIndex + 1].id.toString())
    }
  }

  const handleLogout = () => {
    if (confirm('Вы уверены что хотите выйти?')) {
      localStorage.removeItem('judge_auth')
      navigate('/judge-login')
    }
  }

  // Цветовая схема для каждого судьи
  // Судья 1 (Алинучи): фон #5c5c5c, текст белый
  // Судья 2 (Эмиль): фон #ABC0D2, текст темный
  // Судья 3 (Алина Черновская): фон #FFa057, текст темный
  const judgeThemes = {
    '1': {
      bg: '#5c5c5c',
      text: '#FFFFFF',
      name: 'Алинучи'
    },
    '2': {
      bg: '#ABC0D2',
      text: '#1D1D1D',
      name: 'Эмиль'
    },
    '3': {
      bg: '#FFa057',
      text: '#141414',
      name: 'Алина Черновская'
    }
  }

  const theme = judgeThemes[judgeId] || judgeThemes['1']

  // Подсчет прогресса по текущей номинации
  const getProgress = () => {
    if (!selectedNomination) return { scored: 0, total: 0, percentage: 0 }

    const nominationTeams = teams.filter(t => t.nomination_id === selectedNomination)
    const scored = nominationTeams.filter(t => savedScores[t.id]).length
    const total = nominationTeams.length
    const percentage = total > 0 ? Math.round((scored / total) * 100) : 0

    return { scored, total, percentage }
  }

  const progress = getProgress()
  const average = calculateWeightedAverage()

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <div style={{ backgroundColor: '#1d1d1d' }} className="shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-opacity">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
            >
              <LogOut className="w-4 h-4" />
              Выход
            </button>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">{theme.name}</h1>
              <p className="text-white/90">Оценка команд по критериям</p>
            </div>
          </div>

          {/* Progress bar */}
          {selectedNomination && progress.total > 0 && (
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Прогресс по номинации</span>
                <span className="text-sm font-bold text-white">{progress.scored} / {progress.total}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%`, backgroundColor: '#FF6E00' }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto-save indicator */}
      {saving && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span className="font-medium">Сохранение...</span>
        </div>
      )}

      {success && !saving && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Сохранено!</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Selection */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Номинация <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedNomination}
                onChange={(e) => {
                  setSelectedNomination(e.target.value)
                  setSelectedTeam('')
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Выберите номинацию</option>
                {nominations.map(nom => (
                  <option key={nom.id} value={nom.id}>{nom.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Команда <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                disabled={!selectedNomination}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Выберите команду</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} {savedScores[team.id] && '✓'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Team Navigation */}
          {selectedTeam && teams.length > 0 && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={handlePrevTeam}
                disabled={!canGoPrev}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                Предыдущая команда
              </button>
              <button
                onClick={handleNextTeam}
                disabled={!canGoNext}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Следующая команда
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Scoring */}
        {selectedTeam && (
          <>
            <div className="space-y-6">
              {CRITERIA.map((criterion) => (
                <ScoreInput
                  key={criterion.key}
                  label={`${criterion.label} (${(criterion.weight * 100).toFixed(0)}%)`}
                  description={criterion.description}
                  value={scores[criterion.key]}
                  comment={comments[criterion.key]}
                  onScoreChange={(val) => handleScoreChange(criterion.key, val)}
                  onCommentChange={(val) => handleCommentChange(criterion.key, val)}
                />
              ))}
            </div>

            {/* Navigation buttons at bottom */}
            {teams.length > 0 && (
              <div className="mt-8 flex gap-3">
                <button
                  onClick={handlePrevTeam}
                  disabled={!canGoPrev}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Предыдущая команда
                </button>
                <button
                  onClick={handleNextTeam}
                  disabled={!canGoNext}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Следующая команда
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Auto-save indicator */}
            <div className="mt-6 bg-white rounded-xl shadow-md p-4">
              <p className="text-sm text-gray-600 text-center">
                ✨ Оценки сохраняются автоматически
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
