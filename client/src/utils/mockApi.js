// Mock API для тестирования без backend
let mockData = {
  nominations: [],
  teams: [],
  scores: [],
  spectatorScores: [],
  currentTeam: { teamId: null, nominationId: null }
}

let nextId = {
  nominations: 1,
  teams: 1,
  scores: 1,
  spectatorScores: 1
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Nominations
export const getNominations = async () => {
  await delay(200)
  return mockData.nominations
}

export const createNomination = async (name) => {
  await delay(200)
  const nomination = {
    id: nextId.nominations++,
    name,
    created_at: new Date().toISOString()
  }
  mockData.nominations.push(nomination)
  return nomination
}

export const deleteNomination = async (id) => {
  await delay(200)
  mockData.nominations = mockData.nominations.filter(n => n.id !== id)
  mockData.teams = mockData.teams.filter(t => t.nomination_id !== id)
}

// Teams
export const getTeams = async (nominationId = null) => {
  await delay(200)
  if (nominationId) {
    return mockData.teams.filter(t => t.nomination_id === nominationId)
  }
  return mockData.teams
}

export const createTeam = async (name, nominationId) => {
  await delay(200)
  const team = {
    id: nextId.teams++,
    name,
    nomination_id: nominationId,
    created_at: new Date().toISOString()
  }
  mockData.teams.push(team)
  return team
}

export const deleteTeam = async (id) => {
  await delay(200)
  mockData.teams = mockData.teams.filter(t => t.id !== id)
}

// Scores
export const getScores = async () => {
  await delay(200)
  return mockData.scores
}

export const createScore = async (scoreData) => {
  await delay(200)
  const score = {
    id: nextId.scores++,
    ...scoreData,
    created_at: new Date().toISOString()
  }
  mockData.scores.push(score)
  return { id: score.id, success: true }
}

export const updateScore = async (id, scoreData) => {
  await delay(200)
  const index = mockData.scores.findIndex(s => s.id === id)
  if (index !== -1) {
    mockData.scores[index] = { ...mockData.scores[index], ...scoreData }
  }
  return { success: true }
}

export const deleteScore = async (id) => {
  await delay(200)
  mockData.scores = mockData.scores.filter(s => s.id !== id)
}

// Spectator Scores
export const getSpectatorScores = async () => {
  await delay(200)
  return mockData.spectatorScores
}

export const createSpectatorScore = async (scoreData) => {
  await delay(200)
  const score = {
    id: nextId.spectatorScores++,
    ...scoreData,
    created_at: new Date().toISOString()
  }
  mockData.spectatorScores.push(score)
  return { id: score.id, success: true }
}

// Current Team
export const getCurrentTeam = async () => {
  await delay(200)
  const { teamId, nominationId } = mockData.currentTeam

  if (!teamId || !nominationId) {
    return null
  }

  const team = mockData.teams.find(t => t.id === teamId)
  const nomination = mockData.nominations.find(n => n.id === nominationId)

  if (!team || !nomination) {
    return null
  }

  return {
    team_id: teamId,
    nomination_id: nominationId,
    team_name: team.name,
    nomination_name: nomination.name
  }
}

export const setCurrentTeam = async (teamId, nominationId) => {
  await delay(200)
  mockData.currentTeam = { teamId, nominationId }
  return { success: true }
}

// Results
const COEFFICIENTS = {
  technique: 1.2,
  creativity: 1.0,
  teamwork: 1.1,
  presentation: 0.9,
  overall: 1.3,
  spectators: 0.5
}

export const getResults = async () => {
  await delay(200)

  const results = mockData.teams.map(team => {
    const nomination = mockData.nominations.find(n => n.id === team.nomination_id)

    const judgeScores = mockData.scores.filter(
      s => s.team_id === team.id && s.nomination_id === team.nomination_id
    )

    let judgesWeightedScore = 0
    if (judgeScores.length > 0) {
      const totals = judgeScores.reduce((acc, score) => {
        acc.technique += score.scores.technique.score * COEFFICIENTS.technique
        acc.creativity += score.scores.creativity.score * COEFFICIENTS.creativity
        acc.teamwork += score.scores.teamwork.score * COEFFICIENTS.teamwork
        acc.presentation += score.scores.presentation.score * COEFFICIENTS.presentation
        acc.overall += score.scores.overall.score * COEFFICIENTS.overall
        return acc
      }, { technique: 0, creativity: 0, teamwork: 0, presentation: 0, overall: 0 })

      const sumOfCoefficients =
        COEFFICIENTS.technique +
        COEFFICIENTS.creativity +
        COEFFICIENTS.teamwork +
        COEFFICIENTS.presentation +
        COEFFICIENTS.overall

      judgesWeightedScore =
        (totals.technique + totals.creativity + totals.teamwork + totals.presentation + totals.overall) /
        (judgeScores.length * sumOfCoefficients)
    }

    const spectatorScores = mockData.spectatorScores.filter(
      s => s.team_id === team.id && s.nomination_id === team.nomination_id
    )

    let spectatorsAvg = 0
    if (spectatorScores.length > 0) {
      spectatorsAvg = spectatorScores.reduce((sum, s) => sum + s.score, 0) / spectatorScores.length
    }

    const spectatorsWeighted = spectatorsAvg * COEFFICIENTS.spectators
    const finalScore = judgesWeightedScore + spectatorsWeighted

    return {
      team_id: team.id,
      team_name: team.name,
      nomination_id: team.nomination_id,
      nomination_name: nomination?.name || '',
      judges_avg: judgesWeightedScore,
      spectators_avg: spectatorsAvg,
      spectators_weighted: spectatorsWeighted,
      final_score: finalScore,
      judges_count: judgeScores.length
    }
  })

  return results
}
