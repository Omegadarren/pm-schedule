/**
 * export-data.js
 * Reads the local SQLite database and writes a static JSON snapshot to
 * client/public/web-data.json for the GitHub Pages read-only build.
 */

const Database = require(require.resolve('better-sqlite3', { paths: [require('path').join(__dirname, '../server')] }));
const path     = require('path');
const fs       = require('fs');

const DB_PATH      = path.join(__dirname, '../server/data/pmschedule.db');
const OUT_PATH     = path.join(__dirname, '../client/public/web-data.json');
const COL_STATE_TMP = path.join(__dirname, './col-state-tmp.json');

if (!fs.existsSync(DB_PATH)) {
  console.error('❌  Database not found at', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

const projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all();

const tasks     = {};
const resources = {};

for (const project of projects) {
  tasks[project.id] = db
    .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY row_order, id')
    .all(project.id);
  resources[project.id] = db
    .prepare('SELECT * FROM resources WHERE project_id = ? ORDER BY name')
    .all(project.id);
}

db.close();

// Include column state if one was saved from the browser at publish time.
let colState = null;
try {
  if (fs.existsSync(COL_STATE_TMP)) {
    colState = JSON.parse(fs.readFileSync(COL_STATE_TMP, 'utf8'));
  }
} catch (_) {}

const payload = {
  exportedAt: new Date().toISOString(),
  projects,
  tasks,
  resources,
  colState,
};

// Make sure public dir exists
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

const taskCount = Object.values(tasks).reduce((s, arr) => s + arr.length, 0);
console.log(`✅  Exported ${projects.length} project(s), ${taskCount} task(s) → web-data.json`);
