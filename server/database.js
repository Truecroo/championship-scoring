import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize database
const file = join(__dirname, '../database/db.json')
const adapter = new JSONFile(file)
const defaultData = {
  nominations: [],
  teams: [],
  scores: [],
  spectatorScores: [],
  currentTeam: { teamId: null, nominationId: null }
}

const db = new Low(adapter, defaultData)

// Initialize database
await db.read()
db.data ||= defaultData
await db.write()

console.log('Database initialized successfully')

export default db
