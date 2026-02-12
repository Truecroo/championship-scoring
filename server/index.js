import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

const app = express()

// Security headers
app.use(helmet())
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

// Rate limiting to prevent abuse
// 500 requests per 15 min — enough for 3 judges saving simultaneously
// (each slider change = 1 debounced request, ~40-80 per judge per session)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Слишком много запросов с вашего IP, попробуйте позже'
})

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: 'Слишком много попыток входа, попробуйте позже'
})

// Stricter rate limit for voting
const voteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 votes per 5 minutes
  message: 'Слишком много голосов, подождите немного'
})

// Higher rate limit for read-only spectator endpoints (600+ concurrent users polling)
const spectatorReadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 reads per minute per IP (polling every 15s = 4/min, with margin)
  message: 'Слишком много запросов, подождите немного'
})

app.use('/api/', limiter)
app.use(express.json())

// UUID v4 validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isValidUUID = (id) => UUID_REGEX.test(id)

// Admin session tokens with expiry (in-memory, resets on server restart)
const ADMIN_SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours
const adminSessions = new Map() // token -> { createdAt }

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
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    adminSessions.set(token, { createdAt: Date.now() })

    res.json({ success: true, token })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============ NOMINATIONS ============

app.get('/api/nominations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('nominations')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/nominations', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body

    const { data, error } = await supabase
      .from('nominations')
      .insert([{ name }])
      .select()
      .single()

    if (error) throw error
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
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ TEAMS ============

app.get('/api/teams', async (req, res) => {
  try {
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
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/teams', requireAdmin, async (req, res) => {
  try {
    const { name, nomination_id } = req.body

    const { data, error } = await supabase
      .from('teams')
      .insert([{ name, nomination_id }])
      .select()
      .single()

    if (error) throw error
    res.json(data)
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
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reorder teams within a nomination
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
    const weightedAverage = totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0

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
    const { scores } = req.body

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
    const weightedAverage = totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0

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

app.delete('/api/scores/:id', async (req, res) => {
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

app.get('/api/current-team', spectatorReadLimiter, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('current_team')
      .select('team_id, nomination_id')
      .eq('id', 1)
      .single()

    if (error) throw error

    if (!data.team_id || !data.nomination_id) {
      res.json(null)
      return
    }

    // Fetch team and nomination names
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name')
      .eq('id', data.team_id)
      .single()

    if (teamError) throw teamError

    const { data: nomination, error: nominationError } = await supabase
      .from('nominations')
      .select('name')
      .eq('id', data.nomination_id)
      .single()

    if (nominationError) throw nominationError

    res.json({
      team_id: data.team_id,
      nomination_id: data.nomination_id,
      team_name: team.name,
      nomination_name: nomination.name
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/current-team', requireAdmin, async (req, res) => {
  try {
    const { team_id, nomination_id } = req.body

    const { error } = await supabase
      .from('current_team')
      .update({ team_id, nomination_id })
      .eq('id', 1)

    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ RESULTS ============

app.get('/api/results', async (req, res) => {
  try {
    // Fetch all teams with their nominations
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        nomination_id,
        nominations (
          name
        )
      `)

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

      return {
        team_id: team.id,
        team_name: team.name,
        nomination_id: team.nomination_id,
        nomination_name: team.nominations?.name || '',
        judges_score: Math.round(judgesWeightedScore * 100) / 100,
        judges_count: judgeAvgs.length,
        spectators_avg: Math.round(spectatorsAvg * 100) / 100,
        spectator_votes: specScores.length
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
