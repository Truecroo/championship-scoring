const API_URL = '/api'

// Nominations
export const getNominations = async () => {
  const res = await fetch(`${API_URL}/nominations`)
  return res.json()
}

export const createNomination = async (name) => {
  const res = await fetch(`${API_URL}/nominations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  return res.json()
}

export const deleteNomination = async (id) => {
  await fetch(`${API_URL}/nominations/${id}`, { method: 'DELETE' })
}

// Teams
export const getTeams = async (nominationId = null) => {
  const url = nominationId
    ? `${API_URL}/teams?nomination_id=${nominationId}`
    : `${API_URL}/teams`
  const res = await fetch(url)
  return res.json()
}

export const createTeam = async (name, nominationId) => {
  const res = await fetch(`${API_URL}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, nomination_id: nominationId })
  })
  return res.json()
}

export const deleteTeam = async (id) => {
  await fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' })
}

// Scores
export const getScores = async () => {
  const res = await fetch(`${API_URL}/scores`)
  return res.json()
}

export const createScore = async (scoreData) => {
  const res = await fetch(`${API_URL}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData)
  })
  return res.json()
}

export const updateScore = async (id, scoreData) => {
  const res = await fetch(`${API_URL}/scores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData)
  })
  return res.json()
}

export const deleteScore = async (id) => {
  await fetch(`${API_URL}/scores/${id}`, { method: 'DELETE' })
}

// Spectator Scores
export const getSpectatorScores = async () => {
  const res = await fetch(`${API_URL}/spectator-scores`)
  return res.json()
}

export const createSpectatorScore = async (scoreData) => {
  const res = await fetch(`${API_URL}/spectator-scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData)
  })
  return res.json()
}

// Current Team (for spectators)
export const getCurrentTeam = async () => {
  const res = await fetch(`${API_URL}/current-team`)
  return res.json()
}

export const setCurrentTeam = async (teamId, nominationId) => {
  const res = await fetch(`${API_URL}/current-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id: teamId, nomination_id: nominationId })
  })
  return res.json()
}

// Results
export const getResults = async () => {
  const res = await fetch(`${API_URL}/results`)
  return res.json()
}
