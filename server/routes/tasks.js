const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET all tasks for a project
router.get('/project/:projectId', (req, res) => {
  const db = getDb();
  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE project_id = ? ORDER BY row_order ASC, wbs ASC'
  ).all(req.params.projectId);
  res.json(tasks);
});

// GET single task
router.get('/:id', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST create task
router.post('/', (req, res) => {
  const db = getDb();
  const {
    project_id, parent_task_id, wbs, name, start_date, end_date,
    duration_days, percent_complete, assigned_to, predecessor_ids,
    priority, status, notes, cost, actual, payment_status, row_order, _socketId,
  } = req.body;

  if (!project_id || !name) return res.status(400).json({ error: 'project_id and name are required' });

  const id = req.body.id || uuidv4();
  db.prepare(`
    INSERT INTO tasks (
      id, project_id, parent_task_id, wbs, name, start_date, end_date,
      duration_days, percent_complete, assigned_to, predecessor_ids,
      priority, status, notes, cost, actual, payment_status, row_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, project_id, parent_task_id || null, wbs || null, name,
    start_date || null, end_date || null, duration_days || 1,
    percent_complete || 0, assigned_to || null,
    JSON.stringify(predecessor_ids || []),
    priority || 'medium', status || 'not_started', notes || null,
    cost || 0, actual || 0, payment_status || null, row_order || 0
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  // Broadcast via Socket.IO — exclude the originating socket to prevent echo duplicates
  const io = req.app.get('io');
  if (io) {
    const emitter = _socketId ? io.to(`project:${project_id}`).except(_socketId) : io.to(`project:${project_id}`);
    emitter.emit('task:added', task);
  }

  res.status(201).json(task);
});

// PUT update task (full update)
router.put('/:id', (req, res) => {
  const db = getDb();
  const {
    name, start_date, end_date, duration_days, percent_complete,
    assigned_to, predecessor_ids, priority, status, notes, cost, actual, payment_status, wbs, row_order, _socketId,
  } = req.body;

  // predecessor_ids arrives as a JSON string from the client — don't re-stringify it
  const predsValue = predecessor_ids == null
    ? '[]'
    : typeof predecessor_ids === 'string'
      ? predecessor_ids
      : JSON.stringify(predecessor_ids);

  db.prepare(`
    UPDATE tasks SET
      name=?, start_date=?, end_date=?, duration_days=?, percent_complete=?,
      assigned_to=?, predecessor_ids=?, priority=?, status=?, notes=?,
      cost=?, actual=?, payment_status=?, wbs=?, row_order=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    name, start_date || null, end_date || null, duration_days, percent_complete,
    assigned_to || null, predsValue,
    priority, status, notes || null,
    cost ?? 0, actual ?? 0, payment_status ?? null, wbs || null, row_order || 0, req.params.id
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

  // Broadcast — exclude the originating socket
  const io = req.app.get('io');
  if (io && task) {
    const emitter = _socketId ? io.to(`project:${task.project_id}`).except(_socketId) : io.to(`project:${task.project_id}`);
    emitter.emit('task:updated', task);
  }

  res.json(task);
});

// PATCH reorder tasks (bulk row_order + optional wbs update)
router.patch('/reorder', (req, res) => {
  const db = getDb();
  const { updates } = req.body; // [{ id, row_order, wbs? }]
  const stmtBoth  = db.prepare("UPDATE tasks SET row_order=?, wbs=?, updated_at=datetime('now') WHERE id=?");
  const stmtOrder = db.prepare("UPDATE tasks SET row_order=?, updated_at=datetime('now') WHERE id=?");
  const updateAll = db.transaction((items) => {
    for (const item of items) {
      if (item.wbs !== undefined) stmtBoth.run(item.row_order, item.wbs, item.id);
      else stmtOrder.run(item.row_order, item.id);
    }
  });
  updateAll(updates);
  res.json({ success: true });
});

// DELETE task
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { _socketId } = req.query;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

  const io = req.app.get('io');
  if (io && task) {
    const emitter = _socketId ? io.to(`project:${task.project_id}`).except(_socketId) : io.to(`project:${task.project_id}`);
    emitter.emit('task:deleted', req.params.id);
  }

  res.json({ success: true });
});

module.exports = router;
