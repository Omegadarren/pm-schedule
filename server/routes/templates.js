const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET all templates (with task count)
router.get('/', (req, res) => {
  const db = getDb();
  const templates = db.prepare(`
    SELECT t.*, COUNT(tt.id) as task_count
    FROM templates t
    LEFT JOIN template_tasks tt ON tt.template_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at ASC
  `).all();
  res.json(templates);
});

// GET single template with its tasks
router.get('/:id', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const tasks = db.prepare(
    'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY row_order ASC'
  ).all(req.params.id);
  res.json({ ...template, tasks });
});

// POST /api/templates/from-project/:projectId — snapshot a project as a template
router.post('/from-project/:projectId', (req, res) => {
  const db = getDb();
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const sourceTasks = db.prepare(
    'SELECT * FROM tasks WHERE project_id = ? ORDER BY row_order ASC, wbs ASC'
  ).all(req.params.projectId);

  // Build old task UUID → new template_task UUID map
  const idMap = {};
  const mapped = sourceTasks.map((t) => {
    const newId = uuidv4();
    idMap[t.id] = newId;
    return { ...t, newId };
  });

  const templateId = uuidv4();

  const doInsert = db.transaction(() => {
    db.prepare(
      'INSERT INTO templates (id, name, description) VALUES (?, ?, ?)'
    ).run(templateId, name, description || '');

    const insertTask = db.prepare(`
      INSERT INTO template_tasks
        (id, template_id, parent_task_id, wbs, name, duration_days, priority, notes, row_order, predecessor_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of mapped) {
      // Remap parent_task_id
      const parentId = t.parent_task_id ? (idMap[t.parent_task_id] || null) : null;

      // Remap predecessor_ids (stored as JSON array of task UUIDs)
      let predIds = [];
      try { predIds = JSON.parse(t.predecessor_ids || '[]'); } catch (_) {}
      const remapped = predIds.map((pid) => idMap[pid] || pid);

      insertTask.run(
        t.newId, templateId, parentId,
        t.wbs, t.name, t.duration_days || 1, t.priority || 'medium',
        t.notes || null, t.row_order || 0, JSON.stringify(remapped)
      );
    }
  });

  doInsert();

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
  res.status(201).json({ ...template, task_count: mapped.length });
});

// POST /api/templates/:id/create-project — create a new project from a template
router.post('/:id/create-project', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { name, description, start_date, end_date, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const templateTasks = db.prepare(
    'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY row_order ASC'
  ).all(req.params.id);

  const projectId = uuidv4();
  const idMap = {}; // template_task UUID → new task UUID

  const doCreate = db.transaction(() => {
    db.prepare(`
      INSERT INTO projects (id, name, description, start_date, end_date, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      projectId, name,
      description || template.description || '',
      start_date || null, end_date || null,
      color || '#3b82f6'
    );

    // First pass: assign new task UUIDs
    const rows = templateTasks.map((t) => {
      const newId = uuidv4();
      idMap[t.id] = newId;
      return { ...t, newId };
    });

    const insertTask = db.prepare(`
      INSERT INTO tasks
        (id, project_id, parent_task_id, wbs, name, duration_days,
         priority, notes, row_order, predecessor_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of rows) {
      const parentId = t.parent_task_id ? (idMap[t.parent_task_id] || null) : null;
      let predIds = [];
      try { predIds = JSON.parse(t.predecessor_ids || '[]'); } catch (_) {}
      const remapped = predIds.map((pid) => idMap[pid] || pid);

      insertTask.run(
        t.newId, projectId, parentId,
        t.wbs, t.name, t.duration_days || 1,
        t.priority || 'medium', t.notes || null,
        t.row_order || 0, JSON.stringify(remapped)
      );
    }
  });

  doCreate();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE project_id = ? ORDER BY row_order ASC'
  ).all(projectId);

  res.status(201).json({ project, tasks });
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT /api/templates/:id — rename / update template metadata
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  db.prepare('UPDATE templates SET name = ?, description = ? WHERE id = ?')
    .run(name, description ?? '', req.params.id);
  const template = db.prepare(`
    SELECT t.*, COUNT(tt.id) as task_count
    FROM templates t LEFT JOIN template_tasks tt ON tt.template_id = t.id
    WHERE t.id = ? GROUP BY t.id
  `).get(req.params.id);
  res.json(template);
});

// PUT /api/templates/:id/tasks — bulk-replace all tasks for a template
router.put('/:id/tasks', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT id FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { tasks = [] } = req.body;

  const doReplace = db.transaction(() => {
    db.prepare('DELETE FROM template_tasks WHERE template_id = ?').run(req.params.id);
    const ins = db.prepare(`
      INSERT INTO template_tasks
        (id, template_id, wbs, name, duration_days, priority, notes, row_order, predecessor_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    tasks.forEach((t, i) => {
      ins.run(
        t.id || uuidv4(),
        req.params.id,
        t.wbs || null,
        t.name,
        parseInt(t.duration_days) || 1,
        t.priority || 'medium',
        t.notes || null,
        i,
        '[]'
      );
    });
  });

  doReplace();
  const updated = db.prepare(
    'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY row_order ASC'
  ).all(req.params.id);
  res.json(updated);
});

module.exports = router;
