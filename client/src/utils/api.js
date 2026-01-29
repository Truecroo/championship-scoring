// TEMPORARY: Use mock API until backend is fixed on Render
// Change USE_MOCK_API to 'false' when backend is ready
const USE_MOCK_API = true

// Use environment variable for production, fallback to local proxy for dev
const API_URL = import.meta.env.VITE_API_URL || '/api'

// Import mock API
import * as mockApi from './mockApi.js'

// Helper to switch between mock and real API
const api = (mockFn, realFn) => USE_MOCK_API ? mockFn : realFn

// Nominations
export const getNominations = api(
  mockApi.getNominations,
  async () => {
    const res = await fetch(`${API_URL}/nominations`)
    return res.json()
  }
)

export const createNomination = api(
  mockApi.createNomination,
  async (name) => {
    const res = await fetch(`${API_URL}/nominations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    return res.json()
  }
)

export const deleteNomination = api(
  mockApi.deleteNomination,
  async (id) => {
    await fetch(`${API_URL}/nominations/${id}`, { method: 'DELETE' })
  }
)

// Teams
export const getTeams = api(
  mockApi.getTeams,
  async (nominationId = null) => {
    const url = nominationId
      ? `${API_URL}/teams?nomination_id=${nominationId}`
      : `${API_URL}/teams`
    const res = await fetch(url)
    return res.json()
  }
)

export const createTeam = api(
  mockApi.createTeam,
  async (name, nominationId) => {
    const res = await fetch(`${API_URL}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nomination_id: nominationId })
    })
    return res.json()
  }
)

export const deleteTeam = api(
  mockApi.deleteTeam,
  async (id) => {
    await fetch(`${API_URL}/teams/${id}`, { method: 'DELETE' })
  }
)

// Scores
export const getScores = api(
  mockApi.getScores,
  async () => {
    const res = await fetch(`${API_URL}/scores`)
    return res.json()
  }
)

export const createScore = api(
  mockApi.createScore,
  async (scoreData) => {
    const res = await fetch(`${API_URL}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreData)
    })
    return res.json()
  }
)

export const updateScore = api(
  mockApi.updateScore,
  async (id, scoreData) => {
    const res = await fetch(`${API_URL}/scores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreData)
    })
    return res.json()
  }
)

export const deleteScore = api(
  mockApi.deleteScore,
  async (id) => {
    await fetch(`${API_URL}/scores/${id}`, { method: 'DELETE' })
  }
)

// Spectator Scores
export const getSpectatorScores = api(
  mockApi.getSpectatorScores,
  async () => {
    const res = await fetch(`${API_URL}/spectator-scores`)
    return res.json()
  }
)

export const createSpectatorScore = api(
  mockApi.createSpectatorScore,
  async (scoreData) => {
    const res = await fetch(`${API_URL}/spectator-scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreData)
    })
    return res.json()
  }
)

// Current Team (for spectators)
export const getCurrentTeam = api(
  mockApi.getCurrentTeam,
  async () => {
    const res = await fetch(`${API_URL}/current-team`)
    return res.json()
  }
)

export const setCurrentTeam = api(
  mockApi.setCurrentTeam,
  async (teamId, nominationId) => {
    const res = await fetch(`${API_URL}/current-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, nomination_id: nominationId })
    })
    return res.json()
  }
)

// Results
export const getResults = api(
  mockApi.getResults,
  async () => {
    const res = await fetch(`${API_URL}/results`)
    return res.json()
  }
)
