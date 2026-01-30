import express from 'express'
import cors from 'cors'
import db from './database.js'

const app = express()
const PORT = process.env.PORT || 5001

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

// Новые веса критериев
const CRITERIA_WEIGHTS = {
  choreography: 0.45,  // 45%
  technique: 0.35,     // 35%
  artistry: 0.15,      // 15%
  overall: 0.05        // 5%
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
        // Среднее взвешенное по всем судьям
        const judgesTotal = judgeScores.reduce((sum, score) => {
          let weightedScore = 0

          // Используем новые критерии если они есть
          if (score.scores.choreography) {
            weightedScore =
              score.scores.choreography.score * CRITERIA_WEIGHTS.choreography +
              score.scores.technique.score * CRITERIA_WEIGHTS.technique +
              score.scores.artistry.score * CRITERIA_WEIGHTS.artistry +
              score.scores.overall.score * CRITERIA_WEIGHTS.overall
          }
          // Fallback на старые критерии для совместимости
          else if (score.scores.technique && score.scores.creativity) {
            weightedScore = score.average || 0
          }

          return sum + weightedScore
        }, 0)

        judgesWeightedScore = judgesTotal / judgeScores.length
      }

      // Get spectator scores
      const spectatorScores = db.data.spectatorScores.filter(
        s => s.team_id === team.id && s.nomination_id === team.nomination_id
      )

      let spectatorsAvg = 0
      let spectatorVotes = 0
      if (spectatorScores.length > 0) {
        spectatorsAvg = spectatorScores.reduce((sum, s) => sum + s.score, 0) / spectatorScores.length
        spectatorVotes = spectatorScores.length
      }

      return {
        team_id: team.id,
        team_name: team.name,
        nomination_id: team.nomination_id,
        nomination_name: nomination?.name || '',
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
})
