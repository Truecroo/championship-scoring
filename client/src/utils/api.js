// TEMPORARY: Use mock API until backend is fixed on Render
// Change USE_MOCK_API to 'false' when backend is ready
const USE_MOCK_API = false

// Import shared configuration
import { API_URL } from './config.js'

// Import mock API
import * as mockApi from './mockApi.js'

// Helper to switch between mock and real API
const api = (mockFn, realFn) => USE_MOCK_API ? mockFn : realFn

// Get admin token from localStorage
function getAdminToken() {
  try {
    const auth = JSON.parse(localStorage.getItem('admin_auth') || '{}')
    return auth.token || ''
  } catch { return '' }
}

// Headers with admin auth
function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Token': getAdminToken()
  }
}

// Get moderator token from localStorage
function getModeratorToken() {
  try {
    const auth = JSON.parse(localStorage.getItem('moderator_auth') || '{}')
    return auth.token || ''
  } catch { return '' }
}

// Headers with moderator auth
function moderatorHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Moderator-Token': getModeratorToken()
  }
}

// Auto-redirect to login on 401 for admin requests
function handleAdminAuthError(res, options) {
  if (res.status === 401 && options?.headers?.['X-Admin-Token']) {
    localStorage.removeItem('admin_auth')
    window.location.href = window.location.origin + (import.meta.env.BASE_URL || '/') + 'admin-login'
  }
  if (res.status === 401 && options?.headers?.['X-Moderator-Token']) {
    localStorage.removeItem('moderator_auth')
    window.location.href = window.location.origin + (import.meta.env.BASE_URL || '/') + 'moderator-login'
  }
}

// Safe fetch wrapper — throws on HTTP errors instead of silently returning error body
async function safeFetch(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    handleAdminAuthError(res, options)
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Ошибка сервера (${res.status})`)
  }
  return res.json()
}

async function safeFetchNoBody(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    handleAdminAuthError(res, options)
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Ошибка сервера (${res.status})`)
  }
}

// Nominations
export const getNominations = api(
  mockApi.getNominations,
  async () => safeFetch(`${API_URL}/nominations`)
)

export const createNomination = api(
  mockApi.createNomination,
  async (name) => safeFetch(`${API_URL}/nominations`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name })
  })
)

export const deleteNomination = api(
  mockApi.deleteNomination,
  async (id) => safeFetchNoBody(`${API_URL}/nominations/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': getAdminToken() }
  })
)

// Teams
export const getTeams = api(
  mockApi.getTeams,
  async (nominationId = null) => {
    const url = nominationId
      ? `${API_URL}/teams?nomination_id=${nominationId}`
      : `${API_URL}/teams`
    return safeFetch(url)
  }
)

export const createTeam = api(
  mockApi.createTeam,
  async (name, nominationId, penalty = 0) => safeFetch(`${API_URL}/teams`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name, nomination_id: nominationId, penalty })
  })
)

export const updateTeamPenalty = api(
  () => Promise.resolve(),
  async (id, penalty) => safeFetch(`${API_URL}/teams/${id}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ penalty })
  })
)

export const deleteTeam = api(
  mockApi.deleteTeam,
  async (id) => safeFetchNoBody(`${API_URL}/teams/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': getAdminToken() }
  })
)

// Reorder teams
export const reorderTeams = api(
  () => Promise.resolve(), // mock: no-op
  async (teamIds) => safeFetch(`${API_URL}/teams/reorder`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ team_ids: teamIds })
  })
)

// Scores
export const getScores = api(
  mockApi.getScores,
  async () => safeFetch(`${API_URL}/scores`)
)

export const createScore = api(
  mockApi.createScore,
  async (scoreData) => safeFetch(`${API_URL}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData)
  })
)

export const updateScore = api(
  mockApi.updateScore,
  async (id, scoreData) => safeFetch(`${API_URL}/scores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData)
  })
)

export const deleteScore = api(
  mockApi.deleteScore,
  async (id) => safeFetchNoBody(`${API_URL}/scores/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': getAdminToken() }
  })
)

// Spectator Scores
export const getSpectatorScores = api(
  mockApi.getSpectatorScores,
  async () => safeFetch(`${API_URL}/spectator-scores`)
)

export const createSpectatorScore = api(
  mockApi.createSpectatorScore,
  async (scoreData) => safeFetch(`${API_URL}/spectator-scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData)
  })
)

// Lightweight spectator check (vote count + hasVoted)
export const checkSpectatorVote = api(
  () => Promise.resolve({ vote_count: 0, has_voted: false }),
  async (teamId, nominationId, fingerprint) => {
    const params = new URLSearchParams({ team_id: teamId, nomination_id: nominationId })
    if (fingerprint) params.append('fingerprint', fingerprint)
    return safeFetch(`${API_URL}/spectator-scores/check?${params}`)
  }
)

// Current Team (for spectators)
export const getCurrentTeam = api(
  mockApi.getCurrentTeam,
  async () => safeFetch(`${API_URL}/current-team`)
)

export const setCurrentTeam = api(
  mockApi.setCurrentTeam,
  async (teamId, nominationId, votingMode) => safeFetch(`${API_URL}/current-team`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ team_id: teamId, nomination_id: nominationId, voting_mode: votingMode })
  })
)

// Judges (admin only)
export const getJudges = api(
  () => Promise.resolve([{ id: '1', name: 'Судья 1' }, { id: '2', name: 'Судья 2' }, { id: '3', name: 'Судья 3' }]),
  async () => safeFetch(`${API_URL}/judges`, { headers: adminHeaders() })
)

// Moderator: switch current team
export const setCurrentTeamModerator = api(
  mockApi.setCurrentTeam,
  async (teamId, nominationId, votingMode) => safeFetch(`${API_URL}/current-team`, {
    method: 'POST',
    headers: moderatorHeaders(),
    body: JSON.stringify({ team_id: teamId, nomination_id: nominationId, voting_mode: votingMode })
  })
)

// Top-3 Votes
export const submitTop3Vote = api(
  () => Promise.resolve({ success: true }),
  async (fingerprint, firstTeamId, secondTeamId, thirdTeamId) => safeFetch(`${API_URL}/top3-votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint, first_team_id: firstTeamId, second_team_id: secondTeamId, third_team_id: thirdTeamId })
  })
)

export const checkTop3Vote = api(
  () => Promise.resolve({ total_votes: 0, has_voted: false }),
  async (fingerprint) => {
    const params = new URLSearchParams()
    if (fingerprint) params.append('fingerprint', fingerprint)
    return safeFetch(`${API_URL}/top3-votes/check?${params}`)
  }
)

// Results
export const getResults = api(
  mockApi.getResults,
  async () => safeFetch(`${API_URL}/results`)
)
