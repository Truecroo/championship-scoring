import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

const app = express()
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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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

app.use('/api/', limiter)
app.use(express.json())

// Simple admin session tokens (in-memory, resets on server restart)
const adminSessions = new Set()

// Middleware to check admin authorization
const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token']
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' })
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

    // Check if password starts with $2 (bcrypt hash) or is plaintext
    let passwordMatch = false

    if (data.password.startsWith('$2')) {
      // Bcrypt hash - compare securely
      passwordMatch = await bcrypt.compare(password, data.password)
    } else {
      // Plaintext password (backward compatibility during migration)
      passwordMatch = password === data.password
      console.warn(`⚠️  Judge ${judge_id} using plaintext password. Please migrate to bcrypt!`)
    }

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

    // Check if password starts with $2 (bcrypt hash) or is plaintext
    let passwordMatch = false

    if (data.password.startsWith('$2')) {
      // Bcrypt hash - compare securely
      passwordMatch = await bcrypt.compare(password, data.password)
    } else {
      // Plaintext password (backward compatibility during migration)
      passwordMatch = password === data.password
      console.warn('⚠️  Admin using plaintext password. Please migrate to bcrypt!')
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный пароль администратора' })
    }

    // Generate session token
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    adminSessions.add(token)

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
        totalWeighted += val * weight
        totalWeight += weight
      }
    }
    const weightedAverage = totalWeight > 0 ? Number((totalWeighted / totalWeight).toFixed(2)) : 0

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
    const { scores } = req.body

    // Calculate weighted average only from filled criteria (proportional)
    let totalWeighted = 0
    let totalWeight = 0
    for (const [key, weight] of Object.entries(CRITERIA_WEIGHTS)) {
      const val = scores[key]?.score
      if (val != null && val >= 0.1 && val <= 10) {
        totalWeighted += val * weight
        totalWeight += weight
      }
    }
    const weightedAverage = totalWeight > 0 ? Number((totalWeighted / totalWeight).toFixed(2)) : 0

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

app.get('/api/current-team', async (req, res) => {
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

    // Fetch all scores
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')

    if (scoresError) throw scoresError

    // Fetch all spectator scores
    const { data: spectatorScores, error: spectatorError } = await supabase
      .from('spectator_scores')
      .select('*')

    if (spectatorError) throw spectatorError

    // Calculate results for each team
    const results = teams.map(team => {
      // Get judge scores for this team
      const judgeScores = scores.filter(
        s => s.team_id === team.id && s.nomination_id === team.nomination_id
      )

      // Calculate weighted average for judges
      let judgesWeightedScore = 0
      if (judgeScores.length > 0) {
        const judgesTotal = judgeScores.reduce((sum, score) => {
          return sum + parseFloat(score.weighted_average)
        }, 0)

        judgesWeightedScore = judgesTotal / judgeScores.length
      }

      // Get spectator scores for this team
      const teamSpectatorScores = spectatorScores.filter(
        s => s.team_id === team.id && s.nomination_id === team.nomination_id
      )

      let spectatorsAvg = 0
      let spectatorVotes = 0
      if (teamSpectatorScores.length > 0) {
        spectatorsAvg = teamSpectatorScores.reduce((sum, s) => sum + parseFloat(s.score), 0) / teamSpectatorScores.length
        spectatorVotes = teamSpectatorScores.length
      }

      return {
        team_id: team.id,
        team_name: team.name,
        nomination_id: team.nomination_id,
        nomination_name: team.nominations?.name || '',
        judges_score: judgesWeightedScore,
        judges_count: judgeScores.length,
        spectators_avg: spectatorsAvg,
        spectator_votes: spectatorVotes
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
