const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/database');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// Routes
const projectsRouter = require('./routes/projects');
const tasksRouter    = require('./routes/tasks');
const resourcesRouter = require('./routes/resources');
const publishRouter  = require('./routes/publish');
app.use('/api/projects', projectsRouter);
app.use('/api/tasks',    tasksRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/publish',  publishRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── Socket.IO realtime sync ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Join a project "room" so updates only go to relevant users
  socket.on('join:project', (projectId) => {
    socket.join(`project:${projectId}`);
    console.log(`[WS] ${socket.id} joined project:${projectId}`);
  });

  socket.on('leave:project', (projectId) => {
    socket.leave(`project:${projectId}`);
  });

  // Client requests a task update → save it and broadcast to room
  socket.on('task:update', ({ projectId, task }) => {
    const db = require('./db/database').getDb();
    const stmt = db.prepare(`
      UPDATE tasks SET
        name = ?, start_date = ?, end_date = ?, duration_days = ?,
        percent_complete = ?, assigned_to = ?, predecessor_ids = ?,
        priority = ?, status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(
      task.name, task.start_date, task.end_date, task.duration_days,
      task.percent_complete, task.assigned_to, task.predecessor_ids,
      task.priority, task.status, task.notes, task.id
    );
    // Broadcast to everyone else in the room
    socket.to(`project:${projectId}`).emit('task:updated', task);
  });

  // Client adds a task → broadcast to room
  socket.on('task:add', ({ projectId, task }) => {
    socket.to(`project:${projectId}`).emit('task:added', task);
  });

  // Client deletes a task → broadcast to room
  socket.on('task:delete', ({ projectId, taskId }) => {
    socket.to(`project:${projectId}`).emit('task:deleted', taskId);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ─── Init DB and start server ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDb();
server.listen(PORT, () => {
  console.log(`PM Schedule server running on http://localhost:${PORT}`);
});
