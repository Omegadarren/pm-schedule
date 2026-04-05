const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// GET all projects
router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(projects);
});

// GET single project
router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// POST create project
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, start_date, end_date, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO projects (id, name, description, start_date, end_date, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', start_date || null, end_date || null, color || '#3b82f6');

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// PUT update project
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, description, start_date, end_date, status, color, hourly_rate, narrative } = req.body;
  db.prepare(`
    UPDATE projects SET name=?, description=?, start_date=?, end_date=?, status=?, color=?, hourly_rate=?, narrative=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, description, start_date, end_date, status, color, hourly_rate ?? 0, narrative ?? '', req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

// DELETE project
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/projects/:id/share-token — generate (or rotate) a share token
router.post('/:id/share-token', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  // 9 random bytes → 12 URL-safe base64 characters (~72 bits entropy)
  const token = crypto.randomBytes(9).toString('base64url');
  db.prepare(`UPDATE projects SET share_token=?, updated_at=datetime('now') WHERE id=?`).run(token, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// DELETE /api/projects/:id/share-token — revoke share token
router.delete('/:id/share-token', (req, res) => {
  const db = getDb();
  db.prepare(`UPDATE projects SET share_token=NULL, updated_at=datetime('now') WHERE id=?`).run(req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

module.exports = router;
