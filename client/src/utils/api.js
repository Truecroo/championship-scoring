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

// Auto-redirect to login on 401 for admin requests
function handleAdminAuthError(res, options) {
  if (res.status === 401 && options?.headers?.['X-Admin-Token']) {
    localStorage.removeItem('admin_auth')
    window.location.href = window.location.origin + (import.meta.env.BASE_URL || '/') + 'admin-login'
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
  async (name, nominationId) => safeFetch(`${API_URL}/teams`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name, nomination_id: nominationId })
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
  async (id) => safeFetchNoBody(`${API_URL}/scores/${id}`, { method: 'DELETE' })
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

// Current Team (for spectators)
export const getCurrentTeam = api(
  mockApi.getCurrentTeam,
  async () => safeFetch(`${API_URL}/current-team`)
)

export const setCurrentTeam = api(
  mockApi.setCurrentTeam,
  async (teamId, nominationId) => safeFetch(`${API_URL}/current-team`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ team_id: teamId, nomination_id: nominationId })
  })
)

// Results
export const getResults = api(
  mockApi.getResults,
  async () => safeFetch(`${API_URL}/results`)
)
