import express from 'express'
import cors from 'cors'
import db from './database.js'

const app = express()
const PORT = 5000

app.use(cors())
app.use(express.json())

// ============ NOMINATIONS ============

// Get all nominations
app.get('/api/nominations', (req, res) => {
  try {
    const nominations = db.prepare('SELECT * FROM nominations ORDER BY created_at DESC').all()
    res.json(nominations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create nomination
app.post('/api/nominations', (req, res) => {
  try {
    const { name } = req.body
    const result = db.prepare('INSERT INTO nominations (name) VALUES (?)').run(name)
    res.json({ id: result.lastInsertRowid, name })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete nomination
app.delete('/api/nominations/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM nominations WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ TEAMS ============

// Get all teams (optionally filtered by nomination)
app.get('/api/teams', (req, res) => {
  try {
    const { nomination_id } = req.query
    let teams

    if (nomination_id) {
      teams = db.prepare('SELECT * FROM teams WHERE nomination_id = ? ORDER BY name').all(nomination_id)
    } else {
      teams = db.prepare('SELECT * FROM teams ORDER BY name').all()
    }

    res.json(teams)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create team
app.post('/api/teams', (req, res) => {
  try {
    const { name, nomination_id } = req.body
    const result = db.prepare('INSERT INTO teams (name, nomination_id) VALUES (?, ?)').run(name, nomination_id)
    res.json({ id: result.lastInsertRowid, name, nomination_id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete team
app.delete('/api/teams/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SCORES ============

// Get all scores
app.get('/api/scores', (req, res) => {
  try {
    const scores = db.prepare('SELECT * FROM scores ORDER BY timestamp DESC').all()
    res.json(scores)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create score
app.post('/api/scores', (req, res) => {
  try {
    const { judge_id, nomination_id, team_id, scores, average, timestamp } = req.body

    const result = db.prepare(`
      INSERT INTO scores (
        judge_id, nomination_id, team_id,
        technique_score, technique_comment,
        creativity_score, creativity_comment,
        teamwork_score, teamwork_comment,
        presentation_score, presentation_comment,
        overall_score, overall_comment,
        average, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      judge_id, nomination_id, team_id,
      scores.technique.score, scores.technique.comment || null,
      scores.creativity.score, scores.creativity.comment || null,
      scores.teamwork.score, scores.teamwork.comment || null,
      scores.presentation.score, scores.presentation.comment || null,
      scores.overall.score, scores.overall.comment || null,
      average, timestamp
    )

    res.json({ id: result.lastInsertRowid, success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update score
app.put('/api/scores/:id', (req, res) => {
  try {
    const { scores, average } = req.body

    db.prepare(`
      UPDATE scores SET
        technique_score = ?, technique_comment = ?,
        creativity_score = ?, creativity_comment = ?,
        teamwork_score = ?, teamwork_comment = ?,
        presentation_score = ?, presentation_comment = ?,
        overall_score = ?, overall_comment = ?,
        average = ?
      WHERE id = ?
    `).run(
      scores.technique.score, scores.technique.comment || null,
      scores.creativity.score, scores.creativity.comment || null,
      scores.teamwork.score, scores.teamwork.comment || null,
      scores.presentation.score, scores.presentation.comment || null,
      scores.overall.score, scores.overall.comment || null,
      average,
      req.params.id
    )

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Delete score
app.delete('/api/scores/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM scores WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ SPECTATOR SCORES ============

// Get all spectator scores
app.get('/api/spectator-scores', (req, res) => {
  try {
    const scores = db.prepare('SELECT * FROM spectator_scores ORDER BY timestamp DESC').all()
    res.json(scores)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create spectator score
app.post('/api/spectator-scores', (req, res) => {
  try {
    const { nomination_id, team_id, score, timestamp } = req.body

    const result = db.prepare(`
      INSERT INTO spectator_scores (nomination_id, team_id, score, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(nomination_id, team_id, score, timestamp)

    res.json({ id: result.lastInsertRowid, success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ CURRENT TEAM ============

// Get current team for spectators
app.get('/api/current-team', (req, res) => {
  try {
    const current = db.prepare(`
      SELECT
        ct.team_id,
        ct.nomination_id,
        t.name as team_name,
        n.name as nomination_name
      FROM current_team ct
      LEFT JOIN teams t ON ct.team_id = t.id
      LEFT JOIN nominations n ON ct.nomination_id = n.id
      WHERE ct.id = 1
    `).get()

    if (!current || !current.team_id) {
      res.json(null)
    } else {
      res.json(current)
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Set current team
app.post('/api/current-team', (req, res) => {
  try {
    const { team_id, nomination_id } = req.body

    db.prepare(`
      UPDATE current_team
      SET team_id = ?, nomination_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(team_id, nomination_id)

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============ RESULTS ============

// Coefficients for scoring formula
const COEFFICIENTS = {
  technique: 1.2,
  creativity: 1.0,
  teamwork: 1.1,
  presentation: 0.9,
  overall: 1.3,
  spectators: 0.5  // Weight for spectator votes
}

// Get results with calculated scores
app.get('/api/results', (req, res) => {
  try {
    // Get all teams with their nominations
    const teams = db.prepare(`
      SELECT
        t.id as team_id,
        t.name as team_name,
        n.id as nomination_id,
        n.name as nomination_name
      FROM teams t
      JOIN nominations n ON t.nomination_id = n.id
      ORDER BY n.name, t.name
    `).all()

    const results = teams.map(team => {
      // Get judge scores for this team
      const judgeScores = db.prepare(`
        SELECT
          technique_score, creativity_score, teamwork_score,
          presentation_score, overall_score
        FROM scores
        WHERE team_id = ? AND nomination_id = ?
      `).all(team.team_id, team.nomination_id)

      // Calculate weighted average for judges
      let judgesWeightedScore = 0
      if (judgeScores.length > 0) {
        const totals = judgeScores.reduce((acc, score) => {
          acc.technique += score.technique_score * COEFFICIENTS.technique
          acc.creativity += score.creativity_score * COEFFICIENTS.creativity
          acc.teamwork += score.teamwork_score * COEFFICIENTS.teamwork
          acc.presentation += score.presentation_score * COEFFICIENTS.presentation
          acc.overall += score.overall_score * COEFFICIENTS.overall
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
      const spectatorScores = db.prepare(`
        SELECT AVG(score) as avg_score
        FROM spectator_scores
        WHERE team_id = ? AND nomination_id = ?
      `).get(team.team_id, team.nomination_id)

      const spectatorsAvg = spectatorScores?.avg_score || 0
      const spectatorsWeighted = spectatorsAvg * COEFFICIENTS.spectators

      // Final score
      const finalScore = judgesWeightedScore + spectatorsWeighted

      return {
        team_id: team.team_id,
        team_name: team.team_name,
        nomination_id: team.nomination_id,
        nomination_name: team.nomination_name,
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
  console.log(`Server running on http://localhost:${PORT}`)
})
