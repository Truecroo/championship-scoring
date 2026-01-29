import express from 'express'
import cors from 'cors'
import db from './database.js'

const app = express()
const PORT = 5001

app.use(cors())
app.use(express.json())

// Helper to generate ID
const generateId = (array) => {
  return array.length > 0 ? Math.max(...array.map(item => item.id)) + 1 : 1
}

// ============ NOMINATIONS ============

app.get('/api/nominations', async (req, res) => {
  try {
    await db.read()
    res.json(db.data.nominations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/nominations', async (req, res) => {
  try {
    await db.read()
    const { name } = req.body
    const nomination = {
      id: generateId(db.data.nominations),
      name,
      created_at: new Date().toISOString()
    }
    db.data.nominations.push(nomination)
    await db.write()
    res.json(nomination)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/nominations/:id', async (req, res) => {
  try {
    await db.read()
    const id = parseInt(req.params.id)
    db.data.nominations = db.data.nominations.filter(n => n.id !== id)
    db.data.teams = db.data.teams.filter(t => t.nomination_id !== id)
    await db.write()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ TEAMS ============

app.get('/api/teams', async (req, res) => {
  try {
    await db.read()
    const { nomination_id } = req.query
    let teams = db.data.teams

    if (nomination_id) {
      teams = teams.filter(t => t.nomination_id === parseInt(nomination_id))
    }

    res.json(teams)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/teams', async (req, res) => {
  try {
    await db.read()
    const { name, nomination_id } = req.body
    const team = {
      id: generateId(db.data.teams),
      name,
      nomination_id: parseInt(nomination_id),
      created_at: new Date().toISOString()
    }
    db.data.teams.push(team)
    await db.write()
    res.json(team)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/teams/:id', async (req, res) => {
  try {
    await db.read()
    const id = parseInt(req.params.id)
    db.data.teams = db.data.teams.filter(t => t.id !== id)
    await db.write()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SCORES ============

app.get('/api/scores', async (req, res) => {
  try {
    await db.read()
    res.json(db.data.scores)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/scores', async (req, res) => {
  try {
    await db.read()
    const { judge_id, nomination_id, team_id, scores, average, timestamp } = req.body

    const score = {
      id: generateId(db.data.scores),
      judge_id,
      nomination_id: parseInt(nomination_id),
      team_id: parseInt(team_id),
      scores,
      average,
      timestamp,
      created_at: new Date().toISOString()
    }

    db.data.scores.push(score)
    await db.write()
    res.json({ id: score.id, success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/scores/:id', async (req, res) => {
  try {
    await db.read()
    const id = parseInt(req.params.id)
    const { scores, average } = req.body

    const scoreIndex = db.data.scores.findIndex(s => s.id === id)
    if (scoreIndex !== -1) {
      db.data.scores[scoreIndex].scores = scores
      db.data.scores[scoreIndex].average = average
      await db.write()
      res.json({ success: true })
    } else {
      res.status(404).json({ error: 'Score not found' })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/scores/:id', async (req, res) => {
  try {
    await db.read()
    const id = parseInt(req.params.id)
    db.data.scores = db.data.scores.filter(s => s.id !== id)
    await db.write()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SPECTATOR SCORES ============

app.get('/api/spectator-scores', async (req, res) => {
  try {
    await db.read()
    res.json(db.data.spectatorScores)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/spectator-scores', async (req, res) => {
  try {
    await db.read()
    const { nomination_id, team_id, score, timestamp } = req.body

    const spectatorScore = {
      id: generateId(db.data.spectatorScores),
      nomination_id: parseInt(nomination_id),
      team_id: parseInt(team_id),
      score,
      timestamp,
      created_at: new Date().toISOString()
    }

    db.data.spectatorScores.push(spectatorScore)
    await db.write()
    res.json({ id: spectatorScore.id, success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ CURRENT TEAM ============

app.get('/api/current-team', async (req, res) => {
  try {
    await db.read()
    const { teamId, nominationId } = db.data.currentTeam

    if (!teamId || !nominationId) {
      res.json(null)
      return
    }

    const team = db.data.teams.find(t => t.id === teamId)
    const nomination = db.data.nominations.find(n => n.id === nominationId)

    if (!team || !nomination) {
      res.json(null)
      return
    }

    res.json({
      team_id: teamId,
      nomination_id: nominationId,
      team_name: team.name,
      nomination_name: nomination.name
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/current-team', async (req, res) => {
  try {
    await db.read()
    const { team_id, nomination_id } = req.body

    db.data.currentTeam = {
      teamId: parseInt(team_id),
      nominationId: parseInt(nomination_id),
      updated_at: new Date().toISOString()
    }

    await db.write()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ RESULTS ============

const COEFFICIENTS = {
  technique: 1.2,
  creativity: 1.0,
  teamwork: 1.1,
  presentation: 0.9,
  overall: 1.3,
  spectators: 0.5
}

app.get('/api/results', async (req, res) => {
  try {
    await db.read()

    const results = db.data.teams.map(team => {
      const nomination = db.data.nominations.find(n => n.id === team.nomination_id)

      // Get judge scores for this team
      const judgeScores = db.data.scores.filter(
        s => s.team_id === team.id && s.nomination_id === team.nomination_id
      )

      // Calculate weighted average for judges
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

      // Get spectator scores
      const spectatorScores = db.data.spectatorScores.filter(
        s => s.team_id === team.id && s.nomination_id === team.nomination_id
      )

      let spectatorsAvg = 0
      if (spectatorScores.length > 0) {
        spectatorsAvg = spectatorScores.reduce((sum, s) => sum + s.score, 0) / spectatorScores.length
      }

      const spectatorsWeighted = spectatorsAvg * COEFFICIENTS.spectators

      // Final score
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

    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SERVER ============

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📊 API available at http://localhost:${PORT}/api`)
})
