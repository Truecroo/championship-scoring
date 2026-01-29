import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, ArrowLeft, Save, CheckCircle } from 'lucide-react'
import { getNominations, getTeams, createScore } from '../utils/api'
import ScoreInput from '../components/ScoreInput'

const CRITERIA = [
  { key: 'technique', label: 'Техника', description: 'Точность, форма и исполнение' },
  { key: 'creativity', label: 'Креативность', description: 'Оригинальность и инновации' },
  { key: 'teamwork', label: 'Командная работа', description: 'Синхронность и координация' },
  { key: 'presentation', label: 'Презентация', description: 'Сценическое присутствие' },
  { key: 'overall', label: 'Общее впечатление', description: 'Целостность выступления' }
]

export default function JudgePage() {
  const { judgeId } = useParams()
  const [nominations, setNominations] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedNomination, setSelectedNomination] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [scores, setScores] = useState({})
  const [comments, setComments] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadNominations()
  }, [])

  useEffect(() => {
    if (selectedNomination) {
      loadTeams(selectedNomination)
    } else {
      setTeams([])
      setSelectedTeam('')
    }
  }, [selectedNomination])

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

  const handleScoreChange = (criterion, value) => {
    setScores(prev => ({ ...prev, [criterion]: value }))
  }

  const handleCommentChange = (criterion, value) => {
    setComments(prev => ({ ...prev, [criterion]: value }))
  }

  const calculateAverage = () => {
    const values = Object.values(scores).filter(v => v != null)
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  const isFormValid = () => {
    if (!selectedNomination || !selectedTeam) return false
    return CRITERIA.every(c => scores[c.key] != null && scores[c.key] >= 0.1 && scores[c.key] <= 10)
  }

  const handleSubmit = async () => {
    if (!isFormValid()) return

    setLoading(true)
    try {
      const scoreData = {
        judge_id: judgeId,
        nomination_id: selectedNomination,
        team_id: selectedTeam,
        scores: CRITERIA.reduce((acc, c) => {
          acc[c.key] = {
            score: scores[c.key],
            comment: comments[c.key] || ''
          }
          return acc
        }, {}),
        average: calculateAverage(),
        timestamp: new Date().toISOString()
      }

      await createScore(scoreData)

      // Show success message
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

      // Reset form but keep nomination
      setSelectedTeam('')
      setScores({})
      setComments({})
    } catch (error) {
      console.error('Error submitting scores:', error)
      alert('Ошибка при сохранении оценок')
    } finally {
      setLoading(false)
    }
  }

  const judgeColors = {
    '1': 'from-primary-500 to-primary-600',
    '2': 'from-blue-500 to-blue-600',
    '3': 'from-purple-500 to-purple-600'
  }

  const average = calculateAverage()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className={`bg-gradient-to-r ${judgeColors[judgeId] || 'from-primary-500 to-primary-600'} text-white shadow-lg`}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Судья {judgeId}</h1>
              <p className="text-white/90">Оценка команд по критериям</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">Оценки сохранены!</span>
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
                onChange={(e) => setSelectedNomination(e.target.value)}
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
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scoring */}
        <div className="space-y-6">
          {CRITERIA.map((criterion) => (
            <ScoreInput
              key={criterion.key}
              label={criterion.label}
              description={criterion.description}
              value={scores[criterion.key]}
              comment={comments[criterion.key]}
              onScoreChange={(val) => handleScoreChange(criterion.key, val)}
              onCommentChange={(val) => handleCommentChange(criterion.key, val)}
            />
          ))}
        </div>

        {/* Average & Submit */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Средний балл</p>
              <p className="text-4xl font-bold text-primary-600">{average.toFixed(2)}</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid() || loading}
              className="px-8 py-4 bg-gradient-to-r from-primary-600 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Сохранение...' : 'Сохранить оценки'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
