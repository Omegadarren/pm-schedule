const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET all resources for a project
router.get('/project/:projectId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM resources WHERE project_id = ? ORDER BY name ASC'
  ).all(req.params.projectId);
  res.json(rows);
});

// POST create a resource
router.post('/', (req, res) => {
  const { project_id, name, role, email, hourly_rate } = req.body;
  if (!project_id || !name) return res.status(400).json({ error: 'project_id and name required' });
  const db = getDb();
  // Avoid duplicates (case-insensitive)
  const existing = db.prepare(
    'SELECT id FROM resources WHERE project_id = ? AND LOWER(name) = LOWER(?)'
  ).get(project_id, name);
  if (existing) return res.json(existing);
  const id = uuidv4();
  db.prepare(
    'INSERT INTO resources (id, project_id, name, role, email, hourly_rate) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, project_id, name.trim(), role || null, email || null, hourly_rate || 0);
  res.status(201).json({ id, name: name.trim() });
});

// DELETE a resource
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
