import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, Heart, Send, CheckCircle, AlertCircle, Users } from 'lucide-react'
import { getCurrentTeam, createSpectatorScore, getSpectatorScores } from '../utils/api'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

export default function SpectatorPage() {
  const [currentTeam, setCurrentTeam] = useState(null)
  const [score, setScore] = useState(5.0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [fingerprint, setFingerprint] = useState(null)
  const [voteCount, setVoteCount] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)

  useEffect(() => {
    // Получаем fingerprint при загрузке
    const loadFingerprint = async () => {
      const fp = await FingerprintJS.load()
      const result = await fp.get()
      setFingerprint(result.visitorId)

      // Проверяем, голосовал ли пользователь за текущую команду
      checkIfVoted(result.visitorId)
    }
    loadFingerprint()
  }, [])

  useEffect(() => {
    loadCurrentTeam()
    const interval = setInterval(loadCurrentTeam, 5000) // Обновляем каждые 5 секунд
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (currentTeam && fingerprint) {
      checkIfVoted(fingerprint)
      loadVoteCount()
    }
  }, [currentTeam, fingerprint])

  const loadCurrentTeam = async () => {
    try {
      const data = await getCurrentTeam()
      setCurrentTeam(data)
    } catch (error) {
      console.error('Error loading current team:', error)
    }
  }

  const loadVoteCount = async () => {
    if (!currentTeam) return

    try {
      const scores = await getSpectatorScores()
      const teamVotes = scores.filter(s =>
        s.team_id === currentTeam.team_id &&
        s.nomination_id === currentTeam.nomination_id
      )
      setVoteCount(teamVotes.length)
    } catch (error) {
      console.error('Error loading vote count:', error)
    }
  }

  const checkIfVoted = async (fp) => {
    if (!currentTeam || !fp) return

    try {
      const scores = await getSpectatorScores()
      const userVote = scores.find(s =>
        s.team_id === currentTeam.team_id &&
        s.nomination_id === currentTeam.nomination_id &&
        s.fingerprint === fp
      )
      setHasVoted(!!userVote)
    } catch (error) {
      console.error('Error checking vote:', error)
    }
  }

  const handleSubmit = async () => {
    if (!currentTeam || !fingerprint) return

    // Проверяем, не голосовал ли уже
    if (hasVoted) {
      setErrorMessage('Вы уже голосовали за эту команду!')
      setError(true)
      setTimeout(() => setError(false), 3000)
      return
    }

    setLoading(true)
    setError(false)

    try {
      await createSpectatorScore({
        team_id: currentTeam.team_id,
        nomination_id: currentTeam.nomination_id,
        score: score,
        fingerprint: fingerprint,
        timestamp: new Date().toISOString()
      })

      setSuccess(true)
      setHasVoted(true)
      setVoteCount(prev => prev + 1)
      setTimeout(() => setSuccess(false), 3000)
      setScore(5.0)
    } catch (err) {
      console.error('Error submitting score:', err)
      setErrorMessage('Ошибка. Попробуйте ещё раз')
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-emerald-600">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
              <Eye className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">Зрительское голосование</h1>
              <p className="text-white/90">Оцените выступление команды</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="fixed top-4 right-4 bg-white text-green-600 px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">Ваш голос учтён!</span>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 bg-white text-red-600 px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {!currentTeam ? (
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Нет активной команды
            </h2>
            <p className="text-gray-600">
              Администратор ещё не выбрал команду для голосования
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Team Info */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-white text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4">
                <Heart className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold mb-2">{currentTeam.team_name}</h2>
              <p className="text-white/90 text-lg">{currentTeam.nomination_name}</p>

              {/* Vote Counter */}
              <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm">
                <Users className="w-5 h-5" />
                <span className="font-semibold">{voteCount} {voteCount === 1 ? 'голос' : voteCount < 5 ? 'голоса' : 'голосов'}</span>
              </div>
            </div>

            {/* Scoring */}
            <div className="p-8">
              {hasVoted ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center mb-6">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-green-900">Вы уже проголосовали!</p>
                  <p className="text-sm text-green-700 mt-1">Спасибо за участие в оценке этой команды</p>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-medium text-gray-700">
                        Ваша оценка:
                      </span>
                      <span className="text-5xl font-bold text-green-600">
                        {score.toFixed(1)}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type="range"
                        min="0.1"
                        max="10.0"
                        step="0.1"
                        value={score}
                        onChange={(e) => setScore(parseFloat(e.target.value))}
                        className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${((score - 0.1) / 9.9) * 100}%, #e5e7eb ${((score - 0.1) / 9.9) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>0.1</span>
                        <span>5.0</span>
                        <span>10.0</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading || hasVoted}
                    className="w-full py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      'Отправка...'
                    ) : (
                      <>
                        <Send className="w-6 h-6" />
                        Отправить голос
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-gray-500 mt-4">
                    Вы можете проголосовать один раз за каждую команду
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
