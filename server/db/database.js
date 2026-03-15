const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'pmschedule.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      start_date  TEXT,
      end_date    TEXT,
      status      TEXT DEFAULT 'active',
      color       TEXT DEFAULT '#3b82f6',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- Tasks table (supports WBS hierarchy via parent_task_id)
    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_task_id  TEXT,
      wbs             TEXT,
      name            TEXT NOT NULL,
      start_date      TEXT,
      end_date        TEXT,
      duration_days   INTEGER DEFAULT 1,
      percent_complete INTEGER DEFAULT 0,
      assigned_to     TEXT,
      predecessor_ids TEXT DEFAULT '[]',
      priority        TEXT DEFAULT 'medium',
      status          TEXT DEFAULT 'not_started',
      notes           TEXT,
      cost            REAL DEFAULT 0,
      row_order       INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    -- Resources
    CREATE TABLE IF NOT EXISTS resources (
      id          TEXT PRIMARY KEY,
      project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      role        TEXT,
      email       TEXT,
      hourly_rate REAL DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- Task / resource assignments
    CREATE TABLE IF NOT EXISTS task_assignments (
      task_id         TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      resource_id     TEXT REFERENCES resources(id) ON DELETE CASCADE,
      hours_allocated REAL DEFAULT 0,
      PRIMARY KEY (task_id, resource_id)
    );
  `);

  // Migrations – add columns that may not exist in older DBs
  try { db.exec(`ALTER TABLE projects ADD COLUMN hourly_rate REAL DEFAULT 0`); } catch (_) {}

  // Seed a demo project if empty
  const count = db.prepare('SELECT COUNT(*) as n FROM projects').get();
  if (count.n === 0) {
    const { v4: uuidv4 } = require('uuid');
    const projectId = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, name, description, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, 'Sample Office Renovation', 'Demo project', '2026-03-01', '2026-08-31', 'active');

    const tasks = [
      { name: 'Planning & Design', start: '2026-03-01', end: '2026-03-28', pct: 80, status: 'in_progress', priority: 'high', wbs: '1' },
      { name: 'Schematic Design', start: '2026-03-01', end: '2026-03-14', pct: 100, status: 'complete', priority: 'high', wbs: '1.1' },
      { name: 'Design Development', start: '2026-03-15', end: '2026-03-28', pct: 60, status: 'in_progress', priority: 'high', wbs: '1.2' },
      { name: 'Permitting', start: '2026-03-29', end: '2026-04-18', pct: 0, status: 'not_started', priority: 'medium', wbs: '2' },
      { name: 'Submit Applications', start: '2026-03-29', end: '2026-04-04', pct: 0, status: 'not_started', priority: 'medium', wbs: '2.1' },
      { name: 'Permit Review', start: '2026-04-05', end: '2026-04-18', pct: 0, status: 'not_started', priority: 'medium', wbs: '2.2' },
      { name: 'Construction', start: '2026-04-19', end: '2026-07-31', pct: 0, status: 'not_started', priority: 'high', wbs: '3' },
      { name: 'Demolition', start: '2026-04-19', end: '2026-05-02', pct: 0, status: 'not_started', priority: 'high', wbs: '3.1' },
      { name: 'Framing & MEP Rough-in', start: '2026-05-03', end: '2026-06-13', pct: 0, status: 'not_started', priority: 'high', wbs: '3.2' },
      { name: 'Finishes', start: '2026-06-14', end: '2026-07-31', pct: 0, status: 'not_started', priority: 'medium', wbs: '3.3' },
      { name: 'Closeout & Punch List', start: '2026-08-01', end: '2026-08-31', pct: 0, status: 'not_started', priority: 'low', wbs: '4' },
    ];

    const insert = db.prepare(`
      INSERT INTO tasks (id, project_id, name, start_date, end_date, duration_days, percent_complete, status, priority, wbs, row_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    tasks.forEach((t, i) => {
      const days = Math.round((new Date(t.end) - new Date(t.start)) / 86400000) + 1;
      insert.run(uuidv4(), projectId, t.name, t.start, t.end, days, t.pct, t.status, t.priority, t.wbs, i);
    });
  }

  // Safe migration: add cost column if it doesn't exist yet
  try { db.exec('ALTER TABLE tasks ADD COLUMN cost REAL DEFAULT 0'); } catch (_) {}

  console.log('[DB] Database initialized:', DB_PATH);
}

module.exports = { getDb, initDb };
