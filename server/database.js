import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const db = new Database(join(__dirname, '../database/championship.db'))

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS nominations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nomination_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    judge_id TEXT NOT NULL,
    nomination_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    technique_score REAL NOT NULL,
    technique_comment TEXT,
    creativity_score REAL NOT NULL,
    creativity_comment TEXT,
    teamwork_score REAL NOT NULL,
    teamwork_comment TEXT,
    presentation_score REAL NOT NULL,
    presentation_comment TEXT,
    overall_score REAL NOT NULL,
    overall_comment TEXT,
    average REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS spectator_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomination_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    score REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS current_team (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    team_id INTEGER,
    nomination_id INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (nomination_id) REFERENCES nominations(id) ON DELETE SET NULL
  );

  INSERT OR IGNORE INTO current_team (id, team_id, nomination_id) VALUES (1, NULL, NULL);
`)

console.log('Database initialized successfully')

export default db
