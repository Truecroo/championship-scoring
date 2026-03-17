import { useState, useEffect } from 'react'
import { Eye, Heart, Send, CheckCircle, AlertCircle, Users, Trophy, X } from 'lucide-react'
import { getCurrentTeam, createSpectatorScore, checkSpectatorVote, getTeams, getNominations, submitTop3Vote, checkTop3Vote } from '../utils/api'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

function LiveVoteUI({ currentTeam, fingerprint, fingerprintError }) {
  const [score, setScore] = useState(5.0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [voteCount, setVoteCount] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)

  const pluralVotes = (n) => {
    const abs = Math.abs(n) % 100
    const lastDigit = abs % 10
    if (abs > 10 && abs < 20) return 'голосов'
    if (lastDigit > 1 && lastDigit < 5) return 'голоса'
    if (lastDigit === 1) return 'голос'
    return 'голосов'
  }

  useEffect(() => {
    if (currentTeam?.team_id && fingerprint) {
      loadVoteStatus()
    }
    if (currentTeam?.team_id) {
      const voteInterval = setInterval(loadVoteStatus, 30000)
      return () => clearInterval(voteInterval)
    }
  }, [currentTeam?.team_id, fingerprint])

  // Reset when team changes
  useEffect(() => {
    setHasVoted(false)
    setScore(5.0)
    setVoteCount(0)
  }, [currentTeam?.team_id])

  const loadVoteStatus = async () => {
    if (!currentTeam?.team_id) return
    try {
      const result = await checkSpectatorVote(currentTeam.team_id, currentTeam.nomination_id, fingerprint)
      setVoteCount(result.vote_count)
      if (fingerprint) setHasVoted(result.has_voted)
    } catch (error) {
      console.error('Error loading vote status:', error)
    }
  }

  const handleSubmit = async () => {
    if (!currentTeam || !fingerprint) return
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
    <>
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

      {!currentTeam?.team_id ? (
        <div className="rounded-2xl shadow-2xl p-12 text-center" style={{ backgroundColor: '#2a2a2a' }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#3a3a3a' }}>
            <AlertCircle className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Нет активной команды</h2>
          <p className="text-gray-400">Администратор ещё не выбрал команду для голосования</p>
        </div>
      ) : (
        <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
          <div className="p-8 text-white text-center" style={{ backgroundColor: '#373737' }}>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ backgroundColor: 'rgba(255, 191, 0, 0.2)' }}>
              <Heart className="w-10 h-10" style={{ color: '#FFBF00' }} />
            </div>
            <h2 className="text-3xl font-bold mb-2">{currentTeam.team_name}</h2>
            <p className="text-white/90 text-lg">{currentTeam.nomination_name}</p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(255, 191, 0, 0.2)' }}>
              <Users className="w-5 h-5" />
              <span className="font-semibold">{voteCount} {pluralVotes(voteCount)}</span>
            </div>
          </div>

          <div className="p-8">
            {fingerprintError ? (
              <div className="rounded-xl p-6 text-center mb-6" style={{ backgroundColor: 'rgba(255, 80, 80, 0.1)', border: '2px solid rgba(255, 80, 80, 0.3)' }}>
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                <p className="text-lg font-semibold text-white">Не удалось идентифицировать устройство</p>
                <p className="text-sm text-gray-300 mt-1">Попробуйте обновить страницу или используйте другой браузер</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 rounded-lg font-semibold text-black" style={{ backgroundColor: '#FFBF00' }}>
                  Обновить страницу
                </button>
              </div>
            ) : hasVoted ? (
              <div className="rounded-xl p-6 text-center mb-6" style={{ backgroundColor: 'rgba(255, 191, 0, 0.1)', border: '2px solid rgba(255, 191, 0, 0.3)' }}>
                <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#FFBF00' }} />
                <p className="text-lg font-semibold text-white">Вы уже проголосовали!</p>
                <p className="text-sm text-gray-300 mt-1">Спасибо за участие в оценке этой команды</p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-medium text-gray-300">Ваша оценка:</span>
                    <input
                      type="number" min="0.1" max="10.0" step="0.1" value={score}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) setScore(Math.max(0.1, Math.min(10.0, val)))
                      }}
                      className="text-5xl font-bold text-center w-32 bg-transparent border-b-2 outline-none"
                      style={{ color: '#FFBF00', borderColor: '#FFBF00' }}
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="range" min="0.1" max="10.0" step="0.1" value={score}
                      onChange={(e) => setScore(parseFloat(e.target.value))}
                      className="w-full h-4 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-gold-thumb"
                      style={{ background: `linear-gradient(to right, #FFBF00 0%, #FFBF00 ${((score - 0.1) / 9.9) * 100}%, #4a4a4a ${((score - 0.1) / 9.9) * 100}%, #4a4a4a 100%)` }}
                    />
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>0.1</span><span>5.0</span><span>10.0</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSubmit} disabled={loading || hasVoted}
                  className="w-full py-5 text-black font-bold text-xl rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                  style={{ backgroundColor: '#FFBF00' }}
                >
                  {loading ? 'Отправка...' : (<><Send className="w-6 h-6" />Отправить голос</>)}
                </button>
                <p className="text-center text-sm text-gray-400 mt-4">Вы можете проголосовать один раз за каждую команду</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const RANK_STYLES = [
  { label: '1-е место', short: '1', color: '#FFD700', bg: 'rgba(255, 215, 0, 0.25)', border: 'rgba(255, 215, 0, 0.6)', points: 3 },
  { label: '2-е место', short: '2', color: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.2)', border: 'rgba(192, 192, 192, 0.5)', points: 2 },
  { label: '3-е место', short: '3', color: '#CD7F32', bg: 'rgba(205, 127, 50, 0.2)', border: 'rgba(205, 127, 50, 0.5)', points: 1 },
]

function Top3VoteUI({ fingerprint, fingerprintError }) {
  const [allTeams, setAllTeams] = useState([])
  const [allNominations, setAllNominations] = useState([])
  const [picks, setPicks] = useState([null, null, null]) // [1st, 2nd, 3rd]
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [hasVoted, setHasVoted] = useState(false)
  const [totalVotes, setTotalVotes] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadTeamsAndNominations()
  }, [])

  useEffect(() => {
    if (fingerprint) {
      loadTop3Status()
      const interval = setInterval(loadTop3Status, 30000)
      return () => clearInterval(interval)
    }
  }, [fingerprint])

  const loadTeamsAndNominations = async () => {
    try {
      const [teams, noms] = await Promise.all([getTeams(), getNominations()])
      setAllTeams(teams)
      setAllNominations(noms)
    } catch (err) {
      console.error('Error loading teams:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const loadTop3Status = async () => {
    try {
      const result = await checkTop3Vote(fingerprint)
      setTotalVotes(result.total_votes)
      setHasVoted(result.has_voted)
    } catch (err) {
      console.error('Error checking top3 status:', err)
    }
  }

  const handleTeamTap = (teamId) => {
    // If already picked, remove it
    const existingIdx = picks.indexOf(teamId)
    if (existingIdx !== -1) {
      const newPicks = [...picks]
      newPicks[existingIdx] = null
      setPicks(newPicks)
      return
    }
    // Assign to next empty slot
    const emptyIdx = picks.indexOf(null)
    if (emptyIdx !== -1) {
      const newPicks = [...picks]
      newPicks[emptyIdx] = teamId
      setPicks(newPicks)
    }
  }

  const handleClearSlot = (idx) => {
    const newPicks = [...picks]
    newPicks[idx] = null
    setPicks(newPicks)
  }

  const handleSubmit = async () => {
    if (!fingerprint || picks.includes(null)) return
    setLoading(true)
    setError(false)
    try {
      await submitTop3Vote(fingerprint, picks[0], picks[1], picks[2])
      setSuccess(true)
      setHasVoted(true)
      setTotalVotes(prev => prev + 1)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Top-3 vote error:', err)
      setErrorMessage(err.message || 'Ошибка. Попробуйте ещё раз')
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  const getTeamName = (teamId) => allTeams.find(t => t.id === teamId)?.name || ''

  const teamsByNomination = allNominations.map(nom => ({
    ...nom,
    teams: allTeams.filter(t => t.nomination_id === nom.id)
  })).filter(g => g.teams.length > 0)

  const pluralVotes = (n) => {
    const abs = Math.abs(n) % 100
    const lastDigit = abs % 10
    if (abs > 10 && abs < 20) return 'голосов'
    if (lastDigit > 1 && lastDigit < 5) return 'голоса'
    if (lastDigit === 1) return 'голос'
    return 'голосов'
  }

  if (dataLoading) {
    return (
      <div className="rounded-2xl shadow-2xl p-12 text-center" style={{ backgroundColor: '#2a2a2a' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto mb-6" style={{ borderColor: '#FFBF00', borderTopColor: 'transparent' }}></div>
        <h2 className="text-xl font-bold text-white">Загрузка команд...</h2>
      </div>
    )
  }

  return (
    <>
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

      <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
        {/* Header */}
        <div className="p-6 text-white text-center" style={{ backgroundColor: '#373737' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 191, 0, 0.2)' }}>
            <Trophy className="w-8 h-8" style={{ color: '#FFBF00' }} />
          </div>
          <h2 className="text-2xl font-bold mb-1">Выберите ТОП-3</h2>
          <p className="text-white/80">Отметьте три лучшие команды</p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'rgba(255, 191, 0, 0.2)' }}>
            <Users className="w-5 h-5" />
            <span className="font-semibold">{totalVotes} {pluralVotes(totalVotes)}</span>
          </div>
        </div>

        <div className="p-6">
          {fingerprintError ? (
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(255, 80, 80, 0.1)', border: '2px solid rgba(255, 80, 80, 0.3)' }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
              <p className="text-lg font-semibold text-white">Не удалось идентифицировать устройство</p>
              <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 rounded-lg font-semibold text-black" style={{ backgroundColor: '#FFBF00' }}>
                Обновить страницу
              </button>
            </div>
          ) : hasVoted ? (
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(255, 191, 0, 0.1)', border: '2px solid rgba(255, 191, 0, 0.3)' }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#FFBF00' }} />
              <p className="text-lg font-semibold text-white">Вы уже проголосовали!</p>
              <p className="text-sm text-gray-300 mt-1">Спасибо за участие</p>
            </div>
          ) : allTeams.length < 3 ? (
            <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(255, 191, 0, 0.1)', border: '2px solid rgba(255, 191, 0, 0.3)' }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-semibold text-white">Недостаточно команд для голосования</p>
              <p className="text-sm text-gray-300 mt-1">Нужно минимум 3 команды</p>
            </div>
          ) : (
            <>
              {/* Selected slots */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {picks.map((teamId, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-3 text-center relative min-h-[80px] flex flex-col items-center justify-center"
                    style={{ backgroundColor: RANK_STYLES[idx].bg, border: `2px solid ${RANK_STYLES[idx].border}` }}
                  >
                    <span className="text-xs font-bold mb-1" style={{ color: RANK_STYLES[idx].color }}>
                      {RANK_STYLES[idx].label}
                    </span>
                    <span className="text-xs opacity-60 text-white">{RANK_STYLES[idx].points} {RANK_STYLES[idx].points === 1 ? 'очко' : 'очка'}</span>
                    {teamId ? (
                      <>
                        <p className="text-sm font-semibold text-white mt-1 leading-tight">{getTeamName(teamId)}</p>
                        <button
                          onClick={() => handleClearSlot(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Нажмите на команду</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Team list grouped by nomination */}
              <div className="space-y-4 mb-6">
                {teamsByNomination.map(group => (
                  <div key={group.id}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{group.name}</p>
                    <div className="space-y-2">
                      {group.teams.map(team => {
                        const rankIdx = picks.indexOf(team.id)
                        const isSelected = rankIdx !== -1
                        return (
                          <button
                            key={team.id}
                            onClick={() => handleTeamTap(team.id)}
                            className="w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3"
                            style={isSelected ? {
                              backgroundColor: RANK_STYLES[rankIdx].bg,
                              border: `2px solid ${RANK_STYLES[rankIdx].border}`
                            } : {
                              backgroundColor: '#373737',
                              border: '2px solid transparent'
                            }}
                          >
                            {isSelected && (
                              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm text-black" style={{ backgroundColor: RANK_STYLES[rankIdx].color }}>
                                {RANK_STYLES[rankIdx].short}
                              </span>
                            )}
                            <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                              {team.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || picks.includes(null)}
                className="w-full py-5 text-black font-bold text-xl rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                style={{ backgroundColor: '#FFBF00' }}
              >
                {loading ? 'Отправка...' : (<><Send className="w-6 h-6" />Отправить голос</>)}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default function SpectatorPage() {
  const [votingMode, setVotingMode] = useState(null) // null = loading
  const [currentTeam, setCurrentTeam] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [fingerprint, setFingerprint] = useState(null)
  const [fingerprintError, setFingerprintError] = useState(false)

  useEffect(() => {
    const loadFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        setFingerprint(result.visitorId)
      } catch (err) {
        console.error('FingerprintJS error:', err)
        setFingerprintError(true)
      }
    }
    loadFingerprint()
  }, [])

  useEffect(() => {
    loadCurrentTeam()
    const interval = setInterval(loadCurrentTeam, 15000)
    return () => clearInterval(interval)
  }, [])

  const loadCurrentTeam = async () => {
    try {
      const data = await getCurrentTeam()
      setVotingMode(data?.voting_mode || 'live')
      setCurrentTeam(data)
      setConnectionError(false)
    } catch (error) {
      console.error('Error loading current team:', error)
      setConnectionError(true)
    } finally {
      setPageLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1d1d1d' }}>
      {/* Header */}
      <div className="shadow-lg" style={{ backgroundColor: '#141414' }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 191, 0, 0.2)' }}>
              <Eye className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">Зрительское голосование</h1>
              <p className="text-white/90">
                {votingMode === 'top3' ? 'Выберите три лучшие команды' : 'Оцените выступление команды'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {pageLoading ? (
          <div className="rounded-2xl shadow-2xl p-12 text-center" style={{ backgroundColor: '#2a2a2a' }}>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mx-auto mb-6" style={{ borderColor: '#FFBF00', borderTopColor: 'transparent' }}></div>
            <h2 className="text-xl font-bold text-white">Загрузка...</h2>
          </div>
        ) : connectionError ? (
          <div className="rounded-2xl shadow-2xl p-12 text-center" style={{ backgroundColor: '#2a2a2a' }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#3a3a3a' }}>
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Нет связи с сервером</h2>
            <p className="text-gray-400 mb-6">Сервер не отвечает. Возможно, он запускается — подождите немного.</p>
            <button
              onClick={() => { setPageLoading(true); loadCurrentTeam() }}
              className="px-6 py-3 rounded-lg font-semibold text-black"
              style={{ backgroundColor: '#FFBF00' }}
            >
              Попробовать снова
            </button>
          </div>
        ) : votingMode === 'closed' ? (
          <div className="rounded-2xl shadow-2xl p-12 text-center" style={{ backgroundColor: '#2a2a2a' }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#3a3a3a' }}>
              <AlertCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Голосование закрыто</h2>
            <p className="text-gray-400">Спасибо за участие!</p>
          </div>
        ) : votingMode === 'top3' ? (
          <Top3VoteUI fingerprint={fingerprint} fingerprintError={fingerprintError} />
        ) : (
          <LiveVoteUI currentTeam={currentTeam} fingerprint={fingerprint} fingerprintError={fingerprintError} />
        )}
      </div>
    </div>
  )
}
