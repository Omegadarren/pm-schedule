/**
 * One-time script: snapshot the Inman project as the "Standard Build" template.
 * Safe to run multiple times — skips if the template name already exists.
 */
const { initDb, getDb } = require('../server/db/database.js');
const { v4: uuidv4 } = require('../server/node_modules/uuid');

initDb();
const db = getDb();

const TEMPLATE_NAME = 'Standard Build';
const INMAN_PROJECT_ID = '2d2002a9-6cb2-4529-b7d5-db0b8cf4a023';

const existing = db.prepare('SELECT id FROM templates WHERE name = ?').get(TEMPLATE_NAME);
if (existing) {
  console.log('Template already exists:', existing.id);
  process.exit(0);
}

const tasks = db.prepare(
  'SELECT * FROM tasks WHERE project_id = ? ORDER BY row_order ASC'
).all(INMAN_PROJECT_ID);

if (tasks.length === 0) {
  console.error('No tasks found for Inman project. Check project ID.');
  process.exit(1);
}

// Map old task UUIDs → new template_task UUIDs
const idMap = {};
const mapped = tasks.map((t) => {
  const newId = uuidv4();
  idMap[t.id] = newId;
  return { ...t, newId };
});

const templateId = uuidv4();

const doInsert = db.transaction(() => {
  db.prepare('INSERT INTO templates (id, name, description) VALUES (?, ?, ?)').run(
    templateId, TEMPLATE_NAME,
    'Standard task structure based on the Inman project'
  );

  const insertTask = db.prepare(`
    INSERT INTO template_tasks
      (id, template_id, parent_task_id, wbs, name, duration_days, priority, notes, row_order, predecessor_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of mapped) {
    const parentId = t.parent_task_id ? (idMap[t.parent_task_id] || null) : null;
    let predIds = [];
    try { predIds = JSON.parse(t.predecessor_ids || '[]'); } catch (_) {}
    const remapped = predIds.map((pid) => idMap[pid] || pid);

    insertTask.run(
      t.newId, templateId, parentId,
      t.wbs, t.name, t.duration_days || 1,
      t.priority || 'medium', t.notes || null,
      t.row_order || 0, JSON.stringify(remapped)
    );
  }
});

doInsert();
console.log(`Template "${TEMPLATE_NAME}" created with ID ${templateId} (${mapped.length} tasks).`);
