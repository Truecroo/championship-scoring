import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const app = express()

// Simple in-memory cache: { key: { data, expires } }
const cache = new Map()
function invalidateTeamsCache() {
  for (const key of cache.keys()) {
    if (key.startsWith('teams:')) cache.delete(key)
  }
}
function cached(key, ttlMs, fetchFn) {
  return async (req, res) => {
    const cacheKey = typeof key === 'function' ? key(req) : key
    const entry = cache.get(cacheKey)
    if (entry && Date.now() < entry.expires) {
      return res.json(entry.data)
    }
    try {
      const data = await fetchFn(req)
      cache.set(cacheKey, { data, expires: Date.now() + ttlMs })
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
}

// Prevent server crash on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err)
})

// Render runs behind a proxy — required for express-rate-limit to work
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// Health check — no auth, no rate limit
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})
const PORT = process.env.PORT || 5001

// Initialize Supabase client with SERVICE ROLE KEY for RLS bypass
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️  Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.')
  process.exit(1)
}

// Use service role key to bypass RLS (Row Level Security)
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// CORS configuration - restrict to your domain only
const allowedOrigins = [
  'https://truecroo.github.io',
  'http://localhost:3000',
  'http://localhost:5173'
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

// Rate limiting — only for auth (brute-force protection) and spectator votes (spam protection)
// Judge/admin endpoints have NO rate limit — they're behind auth tokens
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 login attempts per 15 min per IP
  message: 'Слишком много попыток входа, подождите немного'
})

// Vote spam protection — very high limit since 600+ spectators may share venue WiFi
// Real duplicate protection is fingerprint unique constraint in DB
const voteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3000, // 600 users on same WiFi, each votes a few times
  message: 'Слишком много голосов, подождите немного'
})

// Spectator read endpoints — essentially unlimited (polling from 600+ devices on same WiFi)
const spectatorReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10000, // 600 users × ~10 req/min + big safety margin
  message: 'Слишком много запросов, подождите немного'
})

// NO general rate limiter — judge/admin endpoints are protected by auth tokens
// Only auth, vote, and spectator-read endpoints have rate limits (applied per-route below)
app.use(express.json())

// UUID v4 validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isValidUUID = (id) => UUID_REGEX.test(id)

// Admin session tokens with expiry (in-memory, resets on server restart)
const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours
const adminSessions = new Map() // token -> { createdAt }

// Moderator session tokens (same pattern as admin)
const MODERATOR_SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours
const moderatorSessions = new Map() // token -> { createdAt }

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now()
  for (const [token, session] of adminSessions) {
    if (now - session.createdAt > ADMIN_SESSION_TTL) adminSessions.delete(token)
  }
  for (const [token, session] of moderatorSessions) {
    if (now - session.createdAt > MODERATOR_SESSION_TTL) moderatorSessions.delete(token)
  }
}, 60 * 60 * 1000)

// Middleware to check admin authorization
const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token']
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' })
  }
  // Check expiry
  const session = adminSessions.get(token)
  if (Date.now() - session.createdAt > ADMIN_SESSION_TTL) {
    adminSessions.delete(token)
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' })
  }
  next()
}

// Middleware: moderator OR admin can access
const requireModeratorOrAdmin = (req, res, next) => {
  // Check moderator token
  const modToken = req.headers['x-moderator-token']
  if (modToken && moderatorSessions.has(modToken)) {
    const session = moderatorSessions.get(modToken)
    if (Date.now() - session.createdAt <= MODERATOR_SESSION_TTL) {
      return next()
    }
    moderatorSessions.delete(modToken)
  }
  // Fallback: check admin token
  const adminToken = req.headers['x-admin-token']
  if (adminToken && adminSessions.has(adminToken)) {
    const session = adminSessions.get(adminToken)
    if (Date.now() - session.createdAt <= ADMIN_SESSION_TTL) {
      return next()
    }
    adminSessions.delete(adminToken)
  }
  return res.status(401).json({ error: 'Требуется авторизация' })
}

// Criteria weights for score calculation
const CRITERIA_WEIGHTS = {
  choreography: 0.45,  // 45%
  technique: 0.35,     // 35%
  artistry: 0.15,      // 15%
  overall: 0.05        // 5%
}

// ============ AUTHENTICATION ============

app.post('/api/auth/judge/login', authLimiter, async (req, res) => {
  try {
    const { judge_id, password } = req.body

    // Validate input
    if (!judge_id || !password) {
      return res.status(400).json({ error: 'ID судьи и пароль обязательны' })
    }

    // Get judge from database (with hashed password)
    const { data, error } = await supabase
      .from('judge_auth')
      .select('id, name, password')
      .eq('id', judge_id)
      .single()

    if (error || !data) {
      return res.status(401).json({ error: 'Неверный ID судьи или пароль' })
    }

    // Only bcrypt passwords are supported
    const passwordMatch = await bcrypt.compare(password, data.password)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный ID судьи или пароль' })
    }

    res.json({
      success: true,
      judge: {
        id: data.id,
        name: data.name
      }
    })
  } catch (error) {
    console.error('Judge login error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/auth/admin/login', authLimiter, async (req, res) => {
  try {
    const { password } = req.body

    // Validate input
    if (!password) {
      return res.status(400).json({ error: 'Пароль обязателен' })
    }

    // Get admin from database (with hashed password)
    const { data, error } = await supabase
      .from('admin_auth')
      .select('id, password')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return res.status(401).json({ error: 'Неверный пароль администратора' })
    }

    // Only bcrypt passwords are supported
    const passwordMatch = await bcrypt.compare(password, data.password)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный пароль администратора' })
    }

    // Generate session token with expiry tracking
    const token = crypto.randomBytes(32).toString('hex')
    adminSessions.set(token, { createdAt: Date.now() })

    res.json({ success: true, token })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/auth/moderator/login', authLimiter, async (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Пароль обязателен' })
    }

    const { data, error } = await supabase
      .from('moderator_auth')
      .select('id, password')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return res.status(401).json({ error: 'Неверный пароль модератора' })
    }

    const passwordMatch = await bcrypt.compare(password, data.password)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный пароль модератора' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    moderatorSessions.set(token, { createdAt: Date.now() })

    res.json({ success: true, token })
  } catch (error) {
    console.error('Moderator login error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============ JUDGES (admin only) ============

app.get('/api/judges', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('judge_auth')
      .select('id, name')
      .order('id', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ NOMINATIONS ============

app.get('/api/nominations', cached('nominations', 5000, async () => {
  const { data, error } = await supabase
    .from('nominations')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}))

app.post('/api/nominations', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' })

    const { data, error } = await supabase
      .from('nominations')
      .insert([{ name }])
      .select()
      .single()

    if (error) throw error
    cache.delete('nominations')
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/nominations/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUUID(id)) return res.status(400).json({ error: 'Некорректный ID' })

    const { error } = await supabase
      .from('nominations')
      .delete()
      .eq('id', id)

    if (error) throw error
    cache.delete('nominations')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reorder nominations
app.put('/api/nominations/reorder', requireAdmin, async (req, res) => {
  try {
    const { nomination_ids } = req.body

    if (!Array.isArray(nomination_ids) || nomination_ids.length === 0) {
      return res.status(400).json({ error: 'nomination_ids must be a non-empty array' })
    }

    const updates = nomination_ids.map((id, index) =>
      supabase
        .from('nominations')
        .update({ display_order: index })
        .eq('id', id)
    )

    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed) throw failed.error

    cache.delete('nominations')
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ TEAMS ============

app.get('/api/teams', cached(
  (req) => `teams:${req.query.nomination_id || 'all'}`,
  5000,
  async (req) => {
    const { nomination_id } = req.query
    let query = supabase
      .from('teams')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (nomination_id) {
      query = query.eq('nomination_id', nomination_id)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }
))

app.post('/api/teams', requireAdmin, async (req, res) => {
  try {
    const { name, nomination_id, penalty } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название команды обязательно' })
    if (!nomination_id) return res.status(400).json({ error: 'Номинация обязательна' })

    const { data, error } = await supabase
      .from('teams')
      .insert([{ name, nomination_id, penalty: penalty || 0 }])
      .select()
      .single()

    if (error) throw error
    invalidateTeamsCache()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reorder teams within a nomination (must be before :id route)
app.put('/api/teams/reorder', requireAdmin, async (req, res) => {
  try {
    const { team_ids } = req.body // ordered array of team UUIDs

    if (!Array.isArray(team_ids) || team_ids.length === 0) {
      return res.status(400).json({ error: 'team_ids must be a non-empty array' })
    }

    // Update display_order for each team
    const updates = team_ids.map((id, index) =>
      supabase
        .from('teams')
        .update({ display_order: index })
        .eq('id', id)
    )

    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed) throw failed.error

    invalidateTeamsCache()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/teams/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUUID(id)) return res.status(400).json({ error: 'Некорректный ID' })

    const { penalty, name } = req.body
    const updateData = {}
    if (penalty !== undefined) updateData.penalty = penalty ?? 0
    if (name !== undefined) {
      if (!name || !name.trim()) return res.status(400).json({ error: 'Название не может быть пустым' })
      updateData.name = name.trim()
    }
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'Нечего обновлять' })

    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
    invalidateTeamsCache()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/teams/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUUID(id)) return res.status(400).json({ error: 'Некорректный ID' })

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id)

    if (error) throw error
    invalidateTeamsCache()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SCORES ============

app.get('/api/scores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Transform database format to frontend format (handle nullable scores)
    const transformedData = data.map(score => ({
      id: score.id,
      judge_id: score.judge_id,
      nomination_id: score.nomination_id,
      team_id: score.team_id,
      scores: {
        choreography: {
          score: score.choreography_score != null ? parseFloat(score.choreography_score) : null,
          comment: score.choreography_comment || ''
        },
        technique: {
          score: score.technique_score != null ? parseFloat(score.technique_score) : null,
          comment: score.technique_comment || ''
        },
        artistry: {
          score: score.artistry_score != null ? parseFloat(score.artistry_score) : null,
          comment: score.artistry_comment || ''
        },
        overall: {
          score: score.overall_score != null ? parseFloat(score.overall_score) : null,
          comment: score.overall_comment || ''
        }
      },
      average: parseFloat(score.weighted_average),
      timestamp: score.created_at,
      created_at: score.created_at
    }))

    res.json(transformedData)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/scores', async (req, res) => {
  try {
    const { judge_id, nomination_id, team_id, scores } = req.body

    // Verify judge exists
    if (!judge_id) return res.status(400).json({ error: 'judge_id обязателен' })
    const { data: judge, error: judgeError } = await supabase
      .from('judge_auth').select('id').eq('id', judge_id).single()
    if (judgeError || !judge) return res.status(403).json({ error: 'Судья не найден' })

    // Calculate weighted average only from filled criteria (proportional)
    let totalWeighted = 0
    let totalWeight = 0
    for (const [key, weight] of Object.entries(CRITERIA_WEIGHTS)) {
      const val = scores[key]?.score
      if (val != null && val >= 0.1 && val <= 10) {
        totalWeighted += Math.round(val * weight * 10000) / 10000
        totalWeight += weight
      }
    }
    const weightedAverage = totalWeight > 0 ? totalWeighted / totalWeight : 0

    // Transform frontend format to database format (null for unfilled criteria)
    const scoreData = {
      judge_id,
      nomination_id,
      team_id,
      choreography_score: scores.choreography?.score ?? null,
      choreography_comment: scores.choreography?.comment || null,
      technique_score: scores.technique?.score ?? null,
      technique_comment: scores.technique?.comment || null,
      artistry_score: scores.artistry?.score ?? null,
      artistry_comment: scores.artistry?.comment || null,
      overall_score: scores.overall?.score ?? null,
      overall_comment: scores.overall?.comment || null,
      weighted_average: weightedAverage
    }

    const { data, error } = await supabase
      .from('scores')
      .upsert([scoreData], { onConflict: 'judge_id,team_id' })
      .select()
      .single()

    if (error) throw error
    res.json({ id: data.id, success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/scores/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUUID(id)) return res.status(400).json({ error: 'Некорректный ID' })
    const { judge_id, scores } = req.body

    // Verify the score belongs to this judge
    if (judge_id) {
      const { data: existing } = await supabase
        .from('scores').select('judge_id').eq('id', id).single()
      if (existing && existing.judge_id !== judge_id) {
        return res.status(403).json({ error: 'Нельзя редактировать чужую оценку' })
      }
    }

    // Calculate weighted average only from filled criteria (proportional)
    let totalWeighted = 0
    let totalWeight = 0
    for (const [key, weight] of Object.entries(CRITERIA_WEIGHTS)) {
      const val = scores[key]?.score
      if (val != null && val >= 0.1 && val <= 10) {
        totalWeighted += Math.round(val * weight * 10000) / 10000
        totalWeight += weight
      }
    }
    const weightedAverage = totalWeight > 0 ? totalWeighted / totalWeight : 0

    // Transform frontend format to database format (null for unfilled criteria)
    const scoreData = {
      choreography_score: scores.choreography?.score ?? null,
      choreography_comment: scores.choreography?.comment || null,
      technique_score: scores.technique?.score ?? null,
      technique_comment: scores.technique?.comment || null,
      artistry_score: scores.artistry?.score ?? null,
      artistry_comment: scores.artistry?.comment || null,
      overall_score: scores.overall?.score ?? null,
      overall_comment: scores.overall?.comment || null,
      weighted_average: weightedAverage
    }

    const { error } = await supabase
      .from('scores')
      .update(scoreData)
      .eq('id', id)

    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/scores/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidUUID(id)) return res.status(400).json({ error: 'Некорректный ID' })

    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', id)

    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SPECTATOR SCORES ============

app.get('/api/spectator-scores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('spectator_scores')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Lightweight endpoint for spectators: returns vote count + whether this fingerprint voted
// Avoids sending all spectator_scores to 600+ clients
app.get('/api/spectator-scores/check', spectatorReadLimiter, async (req, res) => {
  try {
    const { team_id, nomination_id, fingerprint } = req.query
    if (!team_id || !nomination_id) {
      return res.status(400).json({ error: 'team_id and nomination_id required' })
    }

    // Count votes for this team
    const { count, error: countError } = await supabase
      .from('spectator_scores')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team_id)
      .eq('nomination_id', nomination_id)

    if (countError) throw countError

    // Check if this fingerprint already voted
    let hasVoted = false
    if (fingerprint) {
      const { data, error: checkError } = await supabase
        .from('spectator_scores')
        .select('id')
        .eq('team_id', team_id)
        .eq('nomination_id', nomination_id)
        .eq('fingerprint', fingerprint)
        .limit(1)

      if (checkError) throw checkError
      hasVoted = data.length > 0
    }

    res.json({ vote_count: count, has_voted: hasVoted })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/spectator-scores', voteLimiter, async (req, res) => {
  try {
    const { nomination_id, team_id, score, fingerprint } = req.body

    // Validate input
    if (!nomination_id || !team_id || score === undefined || !fingerprint) {
      return res.status(400).json({ error: 'Все поля обязательны' })
    }

    // Validate score range
    if (score < 0.1 || score > 10) {
      return res.status(400).json({ error: 'Оценка должна быть от 0.1 до 10' })
    }

    const { data, error } = await supabase
      .from('spectator_scores')
      .insert([{ nomination_id, team_id, score, fingerprint }])
      .select()
      .single()

    if (error) {
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Вы уже голосовали за эту команду' })
      }
      throw error
    }

    res.json({ id: data.id, success: true })
  } catch (error) {
    console.error('Spectator vote error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============ CURRENT TEAM ============

app.get('/api/current-team', spectatorReadLimiter, cached('current-team', 3000, async () => {
  const { data, error } = await supabase
    .from('current_team')
    .select('team_id, nomination_id, voting_mode')
    .eq('id', 1)
    .single()

  if (error) throw error

  const votingMode = data.voting_mode || 'live'

  if (!data.team_id || !data.nomination_id) {
    return { voting_mode: votingMode }
  }

  const [{ data: team, error: teamError }, { data: nomination, error: nominationError }] = await Promise.all([
    supabase.from('teams').select('name').eq('id', data.team_id).single(),
    supabase.from('nominations').select('name').eq('id', data.nomination_id).single()
  ])

  if (teamError) throw teamError
  if (nominationError) throw nominationError

  return {
    team_id: data.team_id,
    nomination_id: data.nomination_id,
    team_name: team.name,
    nomination_name: nomination.name,
    voting_mode: votingMode
  }
}))

app.post('/api/current-team', requireModeratorOrAdmin, async (req, res) => {
  try {
    const { team_id, nomination_id, voting_mode } = req.body

    const updateData = { team_id, nomination_id }
    if (voting_mode) {
      if (!['live', 'top3', 'closed'].includes(voting_mode)) {
        return res.status(400).json({ error: 'Недопустимый режим голосования' })
      }
      updateData.voting_mode = voting_mode
    }

    const { error } = await supabase
      .from('current_team')
      .update(updateData)
      .eq('id', 1)

    if (error) throw error
    cache.delete('current-team') // invalidate cache on update
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ TOP-3 VOTES ============

app.post('/api/top3-votes', voteLimiter, async (req, res) => {
  try {
    const { fingerprint, first_team_id, second_team_id, third_team_id } = req.body

    if (!fingerprint || !first_team_id || !second_team_id || !third_team_id) {
      return res.status(400).json({ error: 'Все поля обязательны' })
    }

    if (!isValidUUID(first_team_id) || !isValidUUID(second_team_id) || !isValidUUID(third_team_id)) {
      return res.status(400).json({ error: 'Некорректный ID команды' })
    }

    if (first_team_id === second_team_id || first_team_id === third_team_id || second_team_id === third_team_id) {
      return res.status(400).json({ error: 'Все три команды должны быть разными' })
    }

    // Verify voting mode is top3
    const { data: config } = await supabase
      .from('current_team')
      .select('voting_mode')
      .eq('id', 1)
      .single()

    if (config?.voting_mode !== 'top3') {
      return res.status(400).json({ error: 'Голосование Top-3 сейчас не активно' })
    }

    const { data, error } = await supabase
      .from('top3_votes')
      .insert([{ fingerprint, first_team_id, second_team_id, third_team_id }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Вы уже проголосовали' })
      }
      throw error
    }

    res.json({ id: data.id, success: true })
  } catch (error) {
    console.error('Top-3 vote error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/top3-votes/check', spectatorReadLimiter, async (req, res) => {
  try {
    const { fingerprint } = req.query

    // Total ballot count
    const { count, error: countError } = await supabase
      .from('top3_votes')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    let hasVoted = false
    if (fingerprint) {
      const { data, error: checkError } = await supabase
        .from('top3_votes')
        .select('id')
        .eq('fingerprint', fingerprint)
        .limit(1)

      if (checkError) throw checkError
      hasVoted = data.length > 0
    }

    res.json({ total_votes: count, has_voted: hasVoted })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ RESULTS ============

app.get('/api/results', async (req, res) => {
  try {
    // Fetch all teams with their nominations (including penalty)
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        nomination_id,
        penalty,
        nominations (
          name
        )
      `)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (teamsError) throw teamsError

    // Fetch only aggregated data: weighted_average per team (not full rows)
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('team_id, nomination_id, weighted_average')

    if (scoresError) throw scoresError

    // Fetch only score values per team (not fingerprints etc.)
    const { data: spectatorScores, error: spectatorError } = await supabase
      .from('spectator_scores')
      .select('team_id, nomination_id, score')

    if (spectatorError) throw spectatorError

    // Fetch top-3 votes
    const { data: top3Votes, error: top3Error } = await supabase
      .from('top3_votes')
      .select('first_team_id, second_team_id, third_team_id')

    // top3 table may not exist yet — ignore error
    const top3Data = top3Error ? [] : (top3Votes || [])

    // Aggregate top-3 points per team: 1st=3, 2nd=2, 3rd=1
    const top3Map = new Map()
    for (const v of top3Data) {
      top3Map.set(v.first_team_id, (top3Map.get(v.first_team_id) || 0) + 3)
      top3Map.set(v.second_team_id, (top3Map.get(v.second_team_id) || 0) + 2)
      top3Map.set(v.third_team_id, (top3Map.get(v.third_team_id) || 0) + 1)
    }

    // Pre-group scores by team_id+nomination_id for O(1) lookups instead of O(n) per team
    const judgeMap = new Map()
    for (const s of scores) {
      const key = `${s.team_id}|${s.nomination_id}`
      if (!judgeMap.has(key)) judgeMap.set(key, [])
      judgeMap.get(key).push(parseFloat(s.weighted_average))
    }

    const spectatorMap = new Map()
    for (const s of spectatorScores) {
      const key = `${s.team_id}|${s.nomination_id}`
      if (!spectatorMap.has(key)) spectatorMap.set(key, [])
      spectatorMap.get(key).push(parseFloat(s.score))
    }

    // Calculate results for each team
    const results = teams.map(team => {
      const key = `${team.id}|${team.nomination_id}`

      const judgeAvgs = judgeMap.get(key) || []
      let judgesWeightedScore = 0
      if (judgeAvgs.length > 0) {
        judgesWeightedScore = judgeAvgs.reduce((a, b) => a + b, 0) / judgeAvgs.length
      }

      const specScores = spectatorMap.get(key) || []
      let spectatorsAvg = 0
      if (specScores.length > 0) {
        spectatorsAvg = specScores.reduce((a, b) => a + b, 0) / specScores.length
      }

      const penalty = parseFloat(team.penalty || 0)
      return {
        team_id: team.id,
        team_name: team.name,
        nomination_id: team.nomination_id,
        nomination_name: team.nominations?.name || '',
        judges_score: judgesWeightedScore + penalty,
        judges_count: judgeAvgs.length,
        penalty,
        spectators_avg: spectatorsAvg,
        spectator_votes: specScores.length,
        top3_points: top3Map.get(team.id) || 0
      }
    })

    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SERVER ============

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📊 API available at http://localhost:${PORT}/api`)
  console.log(`🗄️  Connected to Supabase`)
})
