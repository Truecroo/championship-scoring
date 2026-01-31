import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
const PORT = process.env.PORT || 5001

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️  Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

app.use(cors())
app.use(express.json())

// Criteria weights for score calculation
const CRITERIA_WEIGHTS = {
  choreography: 0.45,  // 45%
  technique: 0.35,     // 35%
  artistry: 0.15,      // 15%
  overall: 0.05        // 5%
}

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

app.post('/api/nominations', async (req, res) => {
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

app.delete('/api/nominations/:id', async (req, res) => {
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

app.post('/api/teams', async (req, res) => {
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

app.delete('/api/teams/:id', async (req, res) => {
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

// ============ SCORES ============

app.get('/api/scores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Transform database format to frontend format
    const transformedData = data.map(score => ({
      id: score.id,
      judge_id: score.judge_id,
      nomination_id: score.nomination_id,
      team_id: score.team_id,
      scores: {
        choreography: {
          score: parseFloat(score.choreography_score),
          comment: score.choreography_comment || ''
        },
        technique: {
          score: parseFloat(score.technique_score),
          comment: score.technique_comment || ''
        },
        artistry: {
          score: parseFloat(score.artistry_score),
          comment: score.artistry_comment || ''
        },
        overall: {
          score: parseFloat(score.overall_score),
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

    // Calculate weighted average
    const weightedAverage =
      scores.choreography.score * CRITERIA_WEIGHTS.choreography +
      scores.technique.score * CRITERIA_WEIGHTS.technique +
      scores.artistry.score * CRITERIA_WEIGHTS.artistry +
      scores.overall.score * CRITERIA_WEIGHTS.overall

    // Transform frontend format to database format
    const scoreData = {
      judge_id,
      nomination_id,
      team_id,
      choreography_score: scores.choreography.score,
      choreography_comment: scores.choreography.comment || null,
      technique_score: scores.technique.score,
      technique_comment: scores.technique.comment || null,
      artistry_score: scores.artistry.score,
      artistry_comment: scores.artistry.comment || null,
      overall_score: scores.overall.score,
      overall_comment: scores.overall.comment || null,
      weighted_average: weightedAverage
    }

    const { data, error } = await supabase
      .from('scores')
      .insert([scoreData])
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

    // Calculate weighted average
    const weightedAverage =
      scores.choreography.score * CRITERIA_WEIGHTS.choreography +
      scores.technique.score * CRITERIA_WEIGHTS.technique +
      scores.artistry.score * CRITERIA_WEIGHTS.artistry +
      scores.overall.score * CRITERIA_WEIGHTS.overall

    // Transform frontend format to database format
    const scoreData = {
      choreography_score: scores.choreography.score,
      choreography_comment: scores.choreography.comment || null,
      technique_score: scores.technique.score,
      technique_comment: scores.technique.comment || null,
      artistry_score: scores.artistry.score,
      artistry_comment: scores.artistry.comment || null,
      overall_score: scores.overall.score,
      overall_comment: scores.overall.comment || null,
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

app.post('/api/spectator-scores', async (req, res) => {
  try {
    const { nomination_id, team_id, score } = req.body

    const { data, error } = await supabase
      .from('spectator_scores')
      .insert([{ nomination_id, team_id, score }])
      .select()
      .single()

    if (error) throw error
    res.json({ id: data.id, success: true })
  } catch (error) {
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

app.post('/api/current-team', async (req, res) => {
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
